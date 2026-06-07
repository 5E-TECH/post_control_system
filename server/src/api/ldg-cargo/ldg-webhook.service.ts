import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LdgWebhookLogEntity } from 'src/core/entity/ldg-webhook-log.entity';
import { LdgConfigEntity } from 'src/core/entity/ldg-config.entity';
import { LdgShipmentEntity } from 'src/core/entity/ldg-shipment.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { LdgShipmentService } from './ldg-shipment.service';
import {
  LdgPackageEventData,
  LdgWebhookEnvelope,
} from './dto/ldg-webhook.dto';
import { mapLdgStatus, ldgStatusLabel } from './utils/ldg-status.mapper';
import { verifyLdgSignature } from './utils/ldg-signature.util';
import { Order_status } from 'src/common/enums';
import { OrderService, LdgTerminalResult } from '../order/order.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

export interface ProcessWebhookArgs {
  rawBody: string;
  signatureHeader: string;
  deliveryIdHeader: string;
  eventTypeHeader: string;
}

export interface ProcessWebhookResult {
  // HTTP javob kodi (controller shu bilan javob qaytaradi)
  http_status: number;
  // Tashqariga ko'rsatish uchun qisqacha matn
  message: string;
}

@Injectable()
export class LdgWebhookService {
  private readonly logger = new Logger(LdgWebhookService.name);

  constructor(
    @InjectRepository(LdgWebhookLogEntity)
    private readonly logRepo: Repository<LdgWebhookLogEntity>,
    @InjectRepository(LdgConfigEntity)
    private readonly configRepo: Repository<LdgConfigEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @Inject(forwardRef(() => LdgShipmentService))
    private readonly shipmentService: LdgShipmentService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly activityLog: ActivityLogService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Webhook ni qayta ishlash:
   *   1. Imzoni tekshirish (HMAC-SHA256)
   *   2. Replay protection: delivery_id PK orqali (unique violation = takror)
   *   3. Event turini aniqlash va status yangilash
   *   4. Hammasini ldg_webhook_log ga yozib qo'yish (audit)
   */
  async process(args: ProcessWebhookArgs): Promise<ProcessWebhookResult> {
    const { rawBody, signatureHeader, deliveryIdHeader, eventTypeHeader } = args;

    // Headersiz so'rov — to'g'ridan-to'g'ri 400
    if (!signatureHeader || !deliveryIdHeader) {
      return {
        http_status: 400,
        message: 'Sarlavhalar yo\'q (signature/delivery-id)',
      };
    }

    const config = await this.configRepo.findOne({ where: {} });
    if (!config?.webhook_secret) {
      this.logger.warn('LDG webhook keldi, lekin webhook_secret sozlanmagan');
      return { http_status: 503, message: 'Webhook secret sozlanmagan' };
    }

    // 1) Signature verify
    const verifyResult = verifyLdgSignature(
      rawBody,
      signatureHeader,
      deliveryIdHeader,
      config.webhook_secret,
      config.webhook_secret_previous,
    );

    let envelope: LdgWebhookEnvelope<LdgPackageEventData> | null = null;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      return {
        http_status: 400,
        message: 'Body JSON emas',
      };
    }

    if (!envelope || !envelope.delivery_id || !envelope.type) {
      return { http_status: 400, message: 'Envelope nuqsonli' };
    }

    // 2) Replay protection — log yozishga harakat qilamiz, agar delivery_id mavjud
    //    bo'lsa unique violation bo'ladi va biz 200 qaytaramiz (idempotent)
    const alreadyProcessed = await this.logRepo.findOne({
      where: { delivery_id: envelope.delivery_id },
    });
    if (alreadyProcessed) {
      this.logger.log(
        `LDG webhook takror: delivery_id=${envelope.delivery_id} (skip)`,
      );
      return { http_status: 200, message: 'Already processed' };
    }

    // 3) Imzo noto'g'ri bo'lsa — yozib, 401 qaytaramiz
    if (!verifyResult.valid) {
      await this.saveLog({
        envelope,
        signatureValid: false,
        status: 'invalid_signature',
        errorMessage: verifyResult.reason ?? 'imzo noto\'g\'ri',
      });
      return {
        http_status: 401,
        message: `Imzo noto'g'ri: ${verifyResult.reason}`,
      };
    }

    // 4) Event tipini aniqlash va boshqarish
    const eventType =
      eventTypeHeader || envelope.type || 'unknown';

    try {
      let resultStatus: 'success' | 'skipped' | 'mismatch' | 'failed' =
        'skipped';
      let errorMsg: string | null = null;

      if (eventType === 'webhook.test') {
        // Test webhook — hech narsa qilmaymiz, faqat log
        resultStatus = 'success';
      } else if (eventType.startsWith('package.') || eventType.startsWith('order.')) {
        const outcome = await this.handlePackageEvent(envelope);
        resultStatus = outcome.status;
        errorMsg = outcome.message ?? null;
      } else {
        // Noma'lum event turi — log qilamiz, javob 200
        this.logger.warn(`LDG webhook noma'lum event turi: ${eventType}`);
      }

      await this.saveLog({
        envelope,
        signatureValid: true,
        status: resultStatus,
        errorMessage: errorMsg,
      });
      return { http_status: 200, message: 'OK' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`LDG webhook ishlovda xato: ${msg}`);
      await this.saveLog({
        envelope,
        signatureValid: true,
        status: 'failed',
        errorMessage: msg,
      });
      // Xato bo'lsa ham 200 qaytaramiz — LDG retry qilmasligi uchun
      // (xatolar ldg_webhook_log dan ko'riladi va qo'lda qayta ishlanadi)
      return { http_status: 200, message: 'Logged with error' };
    }
  }

  /**
   * Saqlangan webhook log'ni qayta ishlash (admin paneldan qo'lda qayta urinish).
   *
   * Imzo tekshirilmaydi — chunki log birinchi kelganda allaqachon tekshirilgan
   * va `raw_payload` saqlangan. Bu skip/failed bo'lib qolgan webhook'larni
   * (masalan, shipment vaqtincha topilmagan yoki terminal oqim xato bergan)
   * qo'lda qayta ishga tushirish uchun ishlatiladi.
   */
  async reprocessFromLog(deliveryId: string): Promise<ProcessWebhookResult> {
    const log = await this.logRepo.findOne({ where: { delivery_id: deliveryId } });
    if (!log) {
      return { http_status: 404, message: 'Webhook log topilmadi' };
    }

    const envelope = log.raw_payload as unknown as LdgWebhookEnvelope<LdgPackageEventData>;
    if (!envelope || !envelope.type) {
      return { http_status: 400, message: 'Saqlangan payload nuqsonli' };
    }

    const eventType = log.event_type || envelope.type || 'unknown';

    try {
      let resultStatus: 'success' | 'skipped' | 'mismatch' | 'failed' =
        'skipped';
      let errorMsg: string | null = null;
      if (eventType === 'webhook.test') {
        resultStatus = 'success';
      } else if (
        eventType.startsWith('package.') ||
        eventType.startsWith('order.')
      ) {
        const outcome = await this.handlePackageEvent(envelope);
        resultStatus = outcome.status;
        errorMsg = outcome.message ?? null;
      }

      log.status = resultStatus;
      log.error_message = errorMsg;
      log.processed_at = Date.now();
      await this.logRepo.save(log);

      return {
        http_status: 200,
        message:
          resultStatus === 'success'
            ? 'Qayta ishlandi (success)'
            : resultStatus === 'mismatch'
              ? 'MISMATCH — LDG status bilan bizning status to\'qnashadi (qo\'lda tekshiring)'
              : resultStatus === 'failed'
                ? `Xato — biznes oqim bajarilmadi: ${errorMsg ?? 'noma\'lum'} (reconcile qayta uradi)`
                : 'Qayta ishlandi, lekin amal bajarilmadi (skipped) — shipment yoki status mosligini tekshiring',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.status = 'failed';
      log.error_message = msg;
      log.processed_at = Date.now();
      await this.logRepo.save(log);
      this.logger.error(`LDG webhook qayta ishlovda xato (${deliveryId}): ${msg}`);
      return { http_status: 200, message: `Qayta ishlashda xato: ${msg}` };
    }
  }

  /**
   * package.* yoki order.* turidagi eventni ishlash:
   *  - shipmentni topish (LDG order_id, tracking, external_order_id bo'yicha)
   *  - status mapping
   *  - shipment va order statusini yangilash
   *  - DELIVERED → OrderService.markDeliveredByLdg (kassaga pul tushadi, SOLD)
   *  - CANCELLED → OrderService.markCancelledByLdg (bekor qilish oqimi, CANCELLED)
   *  - RETURNED  → OrderService.markReturnedByLdg  (bekor qilish oqimi, CLOSED)
   */
  private async handlePackageEvent(
    envelope: LdgWebhookEnvelope<LdgPackageEventData>,
  ): Promise<{
    status: 'success' | 'skipped' | 'mismatch' | 'failed';
    message?: string;
  }> {
    const data = (envelope.data ?? {}) as Record<string, unknown>;
    // LDG paket identifikatorlarini `data` ichidan CHUQUR qidirib topamiz —
    // LDG ularni har xil joylashtirishi mumkin (data.order_id, data.package.id,
    // data.order.tracking_number va h.k.). Bitta qat'iy joyga tayanmaymiz.
    const ref = this.extractPackageRef(data);

    const shipment = await this.shipmentService.findShipmentByLdgRef({
      ldg_order_id: ref.ldg_order_id,
      tracking_number: ref.tracking_number,
      external_order_id: ref.external_order_id,
    });

    if (!shipment) {
      // Topilmasa — haqiqiy payload strukturasini ham yozamiz, toki LDG
      // qaysi maydonlarni yuborayotgani aniq ko'rinsin (debug + tuzatish uchun).
      const msg = `Shipment topilmadi (ldg_order_id=${ref.ldg_order_id} tracking=${ref.tracking_number} ext=${ref.external_order_id})`;
      this.logger.warn(
        `LDG webhook: ${msg} | data=${JSON.stringify(data).slice(0, 500)}`,
      );
      return { status: 'skipped', message: msg };
    }

    const newStatusCode = ref.status_code;
    if (!newStatusCode) {
      this.logger.warn(
        `LDG webhook: status.code yo'q, event=${envelope.type} | data=${JSON.stringify(data).slice(0, 300)}`,
      );
      return { status: 'skipped', message: 'status.code yo\'q' };
    }

    const changedAt = ref.changed_at ? new Date(ref.changed_at) : new Date();
    const result = await this.applyStatusFromCode(
      shipment,
      newStatusCode,
      changedAt,
    );

    switch (result) {
      case 'applied':
      case 'unchanged':
        return { status: 'success' };
      case 'skipped':
        return { status: 'skipped', message: 'order allaqachon terminal holatda' };
      case 'mismatch':
        return {
          status: 'mismatch',
          message: shipment.mismatch_reason ?? 'LDG status order status bilan to\'qnashadi',
        };
      case 'unknown_status':
        return { status: 'skipped', message: `noma'lum LDG status: ${newStatusCode}` };
      case 'error':
        // Biznes oqim xato berdi — reconcile keyinroq qayta uradi.
        return {
          status: 'failed',
          message: shipment.last_error ?? 'LDG status qo\'llashda xato',
        };
    }
  }

  /**
   * Webhook `data` ichidan paket identifikatorlarini CHUQUR (rekursiv) qidirib
   * topadi. LDG har xil eventlarda maydonlarni har xil joylashtirishi mumkin
   * (masalan data.package.order_id yoki data.order.tracking_number) — shuning
   * uchun kalit nomi bo'yicha rekursiv qidiramiz. tenant/client envelope
   * darajasida (data dan tashqarida), shu sabab ularning id'siga tegmaymiz.
   */
  private extractPackageRef(data: Record<string, unknown>): {
    ldg_order_id?: number;
    tracking_number?: string;
    external_order_id?: string;
    status_code?: string;
    changed_at?: string;
  } {
    const isNum = (v: unknown) =>
      typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v));
    const isStr = (v: unknown) => typeof v === 'string' && v.length > 0;

    // ID: avval order_id, keyin package_id, oxirgi chora — id.
    const orderIdRaw =
      this.findByKey(data, 'order_id', isNum) ??
      this.findByKey(data, 'package_id', isNum) ??
      this.findByKey(data, 'id', isNum);

    // Status obyekt ({code,name}) yoki oddiy string bo'lib kelishi mumkin.
    const statusObj = this.findByKey(
      data,
      'status',
      (v) => !!v && typeof v === 'object' && 'code' in (v as object),
    ) as { code?: string } | undefined;
    const statusStr = this.findByKey(data, 'status', isStr) as
      | string
      | undefined;
    const statusCodeDirect = this.findByKey(data, 'status_code', isStr) as
      | string
      | undefined;

    return {
      ldg_order_id: orderIdRaw != null ? Number(orderIdRaw) : undefined,
      tracking_number: this.findByKey(data, 'tracking_number', isStr) as
        | string
        | undefined,
      external_order_id: this.findByKey(data, 'external_order_id', isStr) as
        | string
        | undefined,
      status_code: statusObj?.code ?? statusStr ?? statusCodeDirect,
      changed_at: this.findByKey(data, 'changed_at', isStr) as
        | string
        | undefined,
    };
  }

  /**
   * Obyekt ichidan (rekursiv, BFS — eng yuza moslik birinchi) berilgan kalit
   * nomiga va predikatga mos birinchi qiymatni qaytaradi.
   */
  private findByKey(
    root: unknown,
    key: string,
    predicate: (v: unknown) => boolean,
  ): unknown {
    if (!root || typeof root !== 'object') return undefined;
    const queue: unknown[] = [root];
    while (queue.length) {
      const cur = queue.shift();
      if (!cur || typeof cur !== 'object') continue;
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (k === key && predicate(v)) return v;
        if (v && typeof v === 'object') queue.push(v);
      }
    }
    return undefined;
  }

  /**
   * LDG status code'ni shipment va order'ga qo'llaydigan YAGONA markaz.
   *
   * Ham webhook (push), ham reconcile poller (pull) shu metodni chaqiradi —
   * shuning uchun status o'tkazish mantiqi bitta joyda, izchil bo'ladi.
   *
   * Qaytadi:
   *   - 'applied'        — status o'zgardi va biznes oqim bajarildi
   *   - 'unchanged'      — LDG status avvalgidek (qayta yozish shart emas)
   *   - 'skipped'        — terminal allaqachon bizda bajarilgan (idempotent)
   *   - 'mismatch'       — LDG ↔ bizning order status to'qnashadi (admin tekshirsin)
   *   - 'unknown_status' — mapper taniydigan kod emas (status o'zgartirilmaydi)
   */
  async applyStatusFromCode(
    shipment: LdgShipmentEntity,
    statusCode: string,
    changedAt: Date,
  ): Promise<
    'applied' | 'unchanged' | 'skipped' | 'mismatch' | 'unknown_status' | 'error'
  > {
    // LDG "Filialda" statusining code'i raqamli ("8") — JSON'da string yoki number
    // bo'lib kelishi mumkin, shuning uchun stringga keltiramiz (crash oldini olish).
    const code = String(statusCode);

    const mapping = mapLdgStatus(code);
    if (!mapping) {
      this.logger.warn(`LDG status mapping: noma'lum kod=${code}`);
      // #4: noma'lum statusni shipmentda ko'rinadigan qilamiz (monitoring uchun).
      // ldg_status'ni O'ZGARTIRMAYMIZ — keyin to'g'ri status kelsa qo'llanadi.
      shipment.last_error = `Noma'lum LDG status kodi: ${code}`;
      await this.shipmentService.saveShipment(shipment);
      return 'unknown_status';
    }

    // Idempotentlik: LDG status o'zgarmagan bo'lsa, qayta ishlamaymiz.
    const normalizedNew = code.trim().toUpperCase();
    const normalizedOld = (shipment.ldg_status ?? '').trim().toUpperCase();
    if (normalizedNew === normalizedOld) {
      return 'unchanged';
    }

    const config = await this.configRepo.findOne({ where: {} });

    // MUHIM TARTIB: avval biznes oqim (kassa/status flow) bajariladi, FAQAT
    // muvaffaqiyatdan keyin shipment.ldg_status yoziladi. Aks holda oqim xato
    // bersa-yu status terminal sifatida yozilsa, idempotentlik + reconcile'ning
    // terminal filtri buyurtmani abadiy "qotirib" qo'yardi (eski bug).

    // Terminal statuslar uchun maxsus oqimlar (kassa, status flow).
    if (mapping.terminal_action) {
      if (!config?.ldg_courier_user_id) {
        this.logger.warn(
          `LDG status: ldg_courier_user_id sozlanmagan, terminal oqim o'tkazib yuborildi (order=${shipment.order_id})`,
        );
        // Hech bo'lmaganda order statusini qo'yamiz; xato bo'lsa status yozilmaydi.
        try {
          await this.applyOrderStatus(shipment.order_id, mapping.order_status);
        } catch (err) {
          return this.recordApplyError(shipment, mapping.terminal_action, err);
        }
        await this.persistShipmentStatus(shipment, code, changedAt);
        this.logIntermediateStatus(shipment.order_id, mapping.order_status, code, config);
        return 'applied';
      }

      let result: LdgTerminalResult;
      try {
        if (mapping.terminal_action === 'sell') {
          result = await this.orderService.markDeliveredByLdg(
            shipment.order_id,
            config.ldg_courier_user_id,
          );
        } else if (mapping.terminal_action === 'cancel') {
          result = await this.orderService.markCancelledByLdg(
            shipment.order_id,
            config.ldg_courier_user_id,
          );
        } else {
          result = await this.orderService.markReturnedByLdg(
            shipment.order_id,
            config.ldg_courier_user_id,
          );
        }
      } catch (err) {
        // Oqim xato berdi — STATUS YOZILMAYDI. shipment.ldg_status eski holatda
        // qoladi → reconcile poller keyinroq qayta uradi (eventual consistency).
        return this.recordApplyError(shipment, mapping.terminal_action, err);
      }

      if (result.kind === 'mismatch') {
        // Real biznes muammosi — LDG statusni yozamiz va mismatch belgilaymiz.
        await this.persistShipmentStatus(shipment, code, changedAt);
        await this.markShipmentMismatch(shipment, code, result.reason);
        this.activityLog.log({
          entity_type: 'order',
          entity_id: shipment.order_id,
          action: 'ldg_mismatch',
          new_value: { ldg_status: code, reason: result.reason },
          description: `LDG MISMATCH: ${ldgStatusLabel(code)} — ${result.reason}`,
          user: config?.ldg_courier_user_id
            ? { id: config.ldg_courier_user_id }
            : null,
          metadata: { source: 'ldg', ldg_status: code, mismatch: true },
        });
        return 'mismatch';
      }

      if (result.kind === 'skipped') {
        // Bizda allaqachon terminal — LDG statusni baribir yozib qo'yamiz (audit).
        await this.persistShipmentStatus(shipment, code, changedAt);
        return 'skipped';
      }

      // applied — biznes oqim bajarildi (sellOrder/cancelOrder o'z logini yozadi)
      await this.persistShipmentStatus(shipment, code, changedAt);
      return 'applied';
    }

    // Oraliq statuslar (NEW, RECEIVED, IN_TRANSIT, OUT_FOR_DELIVERY) — faqat order
    // statusini yangilash. Xato bo'lsa status yozilmaydi → reconcile qayta uradi.
    try {
      await this.applyOrderStatus(shipment.order_id, mapping.order_status);
    } catch (err) {
      return this.recordApplyError(shipment, code, err);
    }
    await this.persistShipmentStatus(shipment, code, changedAt);
    this.logIntermediateStatus(shipment.order_id, mapping.order_status, code, config);
    return 'applied';
  }

  /**
   * Shipmentning oxirgi ko'rilgan LDG statusini muvaffaqiyatdan KEYIN yozadi
   * va avvalgi xatoni tozalaydi (oqim endi tiklandi).
   */
  private async persistShipmentStatus(
    shipment: LdgShipmentEntity,
    code: string,
    changedAt: Date,
  ): Promise<void> {
    shipment.last_error = null;
    await this.shipmentService.updateShipmentStatus(shipment, code, changedAt);
  }

  /**
   * Biznes oqim xato bergan holat: shipment.ldg_status O'ZGARTIRILMAYDI (toki
   * reconcile qayta urinsin), faqat last_error yozilib monitoring'da ko'rinadi.
   */
  private async recordApplyError(
    shipment: LdgShipmentEntity,
    context: string,
    err: unknown,
  ): Promise<'error'> {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.error(
      `LDG '${context}' oqimi muvaffaqiyatsiz (order=${shipment.order_id}): ${msg}`,
    );
    shipment.last_error = `LDG '${context}': ${msg}`;
    try {
      await this.shipmentService.saveShipment(shipment);
    } catch {
      // last_error yozib bo'lmasa ham asosiy oqim buzilmasin
    }
    return 'error';
  }

  /**
   * Oraliq status o'zgarishi uchun activity_log yozish.
   * Terminal statuslar bunga kirmaydi — ular sellOrder/cancelOrder ichida o'z log'ini yozadi.
   */
  private logIntermediateStatus(
    orderId: string,
    orderStatus: Order_status,
    ldgCode: string,
    config: LdgConfigEntity | null,
  ): void {
    this.activityLog.log({
      entity_type: 'order',
      entity_id: orderId,
      action: 'status_change',
      new_value: { status: orderStatus, ldg_status: ldgCode },
      description: `LDG: ${ldgStatusLabel(ldgCode)}`,
      user: config?.ldg_courier_user_id
        ? { id: config.ldg_courier_user_id }
        : null,
      metadata: { source: 'ldg', ldg_status: ldgCode },
    });
  }

  /**
   * Shipment'ga mismatch belgilash — admin panel "Mismatch" filtri shu maydonlardan foydalanadi.
   */
  private async markShipmentMismatch(
    shipment: LdgShipmentEntity,
    ldgCode: string,
    reason: string,
  ): Promise<void> {
    shipment.mismatch_at = Date.now();
    shipment.mismatch_reason = `[${ldgCode}] ${reason}`;
    await this.shipmentService.saveShipment(shipment);
  }

  private async applyOrderStatus(
    orderId: string,
    newStatus: Order_status,
  ): Promise<void> {
    await this.orderRepo.update(
      { id: orderId },
      { status: newStatus },
    );
  }

  private async saveLog(args: {
    envelope: LdgWebhookEnvelope<LdgPackageEventData>;
    signatureValid: boolean;
    status: string;
    errorMessage: string | null;
  }): Promise<void> {
    const now = Date.now();
    try {
      const entity = this.logRepo.create({
        delivery_id: args.envelope.delivery_id,
        event_id: args.envelope.id ?? null,
        event_type: args.envelope.type ?? 'unknown',
        signature_valid: args.signatureValid,
        status: args.status,
        error_message: args.errorMessage,
        received_at: now,
        processed_at: now,
      });
      // raw_payload jsonb (Record<string, unknown>) — TypeORM partial type
      // ozgina noaniqligi uchun alohida belgilaymiz
      entity.raw_payload = JSON.parse(
        JSON.stringify(args.envelope),
      ) as Record<string, unknown>;
      await this.logRepo.save(entity);
    } catch (err) {
      // delivery_id unique violation — biz allaqachon bu webhookni ishlaganmiz.
      // Bu odatdagi holat (LDG retry yuborgan), shuning uchun warn emas, log.
      this.logger.log(
        `LDG webhook log yozilmadi (ehtimol takror): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
