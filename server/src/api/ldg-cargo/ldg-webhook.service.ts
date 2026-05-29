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
import { OrderService } from '../order/order.service';
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
      let resultStatus: 'success' | 'skipped' = 'skipped';
      let errorMsg: string | null = null;

      if (eventType === 'webhook.test') {
        // Test webhook — hech narsa qilmaymiz, faqat log
        resultStatus = 'success';
      } else if (eventType.startsWith('package.') || eventType.startsWith('order.')) {
        const handled = await this.handlePackageEvent(envelope);
        resultStatus = handled ? 'success' : 'skipped';
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
      let resultStatus: 'success' | 'skipped' = 'skipped';
      if (eventType === 'webhook.test') {
        resultStatus = 'success';
      } else if (
        eventType.startsWith('package.') ||
        eventType.startsWith('order.')
      ) {
        const handled = await this.handlePackageEvent(envelope);
        resultStatus = handled ? 'success' : 'skipped';
      }

      log.status = resultStatus;
      log.error_message = null;
      log.processed_at = Date.now();
      await this.logRepo.save(log);

      return {
        http_status: 200,
        message:
          resultStatus === 'success'
            ? 'Qayta ishlandi (success)'
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
  ): Promise<boolean> {
    const data = envelope.data ?? {};
    // LDG paket ID'sini har xil nomlar bilan yuborishi mumkin: order_id (POST javobi),
    // id (REST GET), yoki package_id. Birinchi mavjudini olamiz.
    const ldgOrderId =
      data.order_id ?? data.id ?? data.package_id ?? undefined;
    const tracking = data.tracking_number;
    const externalId = data.external_order_id;

    const shipment = await this.shipmentService.findShipmentByLdgRef({
      ldg_order_id: ldgOrderId,
      tracking_number: tracking,
      external_order_id: externalId,
    });

    if (!shipment) {
      this.logger.warn(
        `LDG webhook: shipment topilmadi (ldg_order_id=${ldgOrderId} tracking=${tracking} ext=${externalId})`,
      );
      return false;
    }

    const newStatusCode = data.status?.code;
    if (!newStatusCode) {
      this.logger.warn(`LDG webhook: status.code yo'q, event=${envelope.type}`);
      return false;
    }

    const changedAt = data.changed_at ? new Date(data.changed_at) : new Date();
    const result = await this.applyStatusFromCode(
      shipment,
      newStatusCode,
      changedAt,
    );
    return result !== 'unknown_status';
  }

  /**
   * LDG status code'ni shipment va order'ga qo'llaydigan YAGONA markaz.
   *
   * Ham webhook (push), ham reconcile poller (pull) shu metodni chaqiradi —
   * shuning uchun status o'tkazish mantiqi bitta joyda, izchil bo'ladi.
   *
   * Qaytadi:
   *   - 'applied'        — status o'zgardi va qo'llandi
   *   - 'unchanged'      — LDG status avvalgidek (qayta yozish shart emas)
   *   - 'unknown_status' — mapper taniydigan kod emas (status o'zgartirilmaydi)
   */
  async applyStatusFromCode(
    shipment: LdgShipmentEntity,
    statusCode: string,
    changedAt: Date,
  ): Promise<'applied' | 'unchanged' | 'unknown_status'> {
    // LDG "Filialda" statusining code'i raqamli ("8") — JSON'da string yoki number
    // bo'lib kelishi mumkin, shuning uchun stringga keltiramiz (crash oldini olish).
    const code = String(statusCode);

    const mapping = mapLdgStatus(code);
    if (!mapping) {
      this.logger.warn(`LDG status mapping: noma'lum kod=${code}`);
      return 'unknown_status';
    }

    // Idempotentlik: LDG status o'zgarmagan bo'lsa, qayta ishlamaymiz.
    const normalizedNew = code.trim().toUpperCase();
    const normalizedOld = (shipment.ldg_status ?? '').trim().toUpperCase();
    if (normalizedNew === normalizedOld) {
      return 'unchanged';
    }

    // Shipmentning oxirgi ko'rilgan statusini yangilaymiz
    await this.shipmentService.updateShipmentStatus(shipment, code, changedAt);

    const config = await this.configRepo.findOne({ where: {} });

    // Har bir LDG status o'zgarishini order tarixiga (Tarix/tracking) yozamiz —
    // oraliq statuslar (Tranzit, Yetkazilmoqda, Filialda) ham ko'rinadi.
    // Terminal statuslar uchun sell/cancel oqimlari o'z biznes log'ini alohida yozadi.
    this.activityLog.log({
      entity_type: 'order',
      entity_id: shipment.order_id,
      action: 'status_change',
      new_value: { status: mapping.order_status, ldg_status: code },
      description: `LDG: ${ldgStatusLabel(code)}`,
      user: config?.ldg_courier_user_id
        ? { id: config.ldg_courier_user_id }
        : null,
      metadata: { source: 'ldg', ldg_status: code },
    });

    // Terminal statuslar uchun maxsus oqimlar (kassa, status flow)
    if (mapping.terminal_action) {
      if (!config?.ldg_courier_user_id) {
        this.logger.warn(
          `LDG status: ldg_courier_user_id sozlanmagan, terminal oqim o'tkazib yuborildi (order=${shipment.order_id})`,
        );
        // Hech bo'lmaganda statusni qo'yib qo'yamiz
        await this.applyOrderStatus(shipment.order_id, mapping.order_status);
        return 'applied';
      }

      try {
        if (mapping.terminal_action === 'sell') {
          await this.orderService.markDeliveredByLdg(
            shipment.order_id,
            config.ldg_courier_user_id,
          );
        } else if (mapping.terminal_action === 'cancel') {
          await this.orderService.markCancelledByLdg(
            shipment.order_id,
            config.ldg_courier_user_id,
          );
        } else if (mapping.terminal_action === 'return') {
          await this.orderService.markReturnedByLdg(
            shipment.order_id,
            config.ldg_courier_user_id,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `LDG '${mapping.terminal_action}' oqimi muvaffaqiyatsiz (order=${shipment.order_id}): ${msg}`,
        );
        // Asosiy oqimni buzmaymiz — log saqlanadi, operator qo'lda tuzatishi mumkin.
      }
      return 'applied';
    }

    // Oraliq statuslar (NEW, RECEIVED, IN_TRANSIT, OUT_FOR_DELIVERY) — faqat status yangilash
    await this.applyOrderStatus(shipment.order_id, mapping.order_status);
    return 'applied';
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
