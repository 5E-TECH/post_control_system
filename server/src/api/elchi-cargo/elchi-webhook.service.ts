import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { ElchiConfigEntity } from 'src/core/entity/elchi-config.entity';
import { ElchiShipmentEntity } from 'src/core/entity/elchi-shipment.entity';
import { ElchiWebhookLogEntity } from 'src/core/entity/elchi-webhook-log.entity';
import { ElchiSettlementPaymentEntity } from 'src/core/entity/elchi-settlement-payment.entity';
import { OrderService } from '../order/order.service';
import { verifyElchiSignature } from './utils/elchi-signature.util';
import { elchiStatusLabel, mapElchiStatus } from './utils/elchi-status.mapper';
import {
  ElchiWebhookPayload,
  ElchiWebhookStatus,
} from './dto/elchi-webhook.dto';

export interface ProcessElchiWebhookArgs {
  rawBody: string;
  signatureHeader: string;
}

export interface ProcessElchiWebhookResult {
  http_status: number;
  message: string;
}

@Injectable()
export class ElchiWebhookService {
  private readonly logger = new Logger(ElchiWebhookService.name);

  constructor(
    @InjectRepository(ElchiConfigEntity)
    private readonly configRepo: Repository<ElchiConfigEntity>,
    @InjectRepository(ElchiShipmentEntity)
    private readonly shipmentRepo: Repository<ElchiShipmentEntity>,
    @InjectRepository(ElchiWebhookLogEntity)
    private readonly logRepo: Repository<ElchiWebhookLogEntity>,
    @InjectRepository(ElchiSettlementPaymentEntity)
    private readonly settlementRepo: Repository<ElchiSettlementPaymentEntity>,
    private readonly orderService: OrderService,
  ) {}

  /**
   * Elchi webhookini qabul qiladi va ishlaydi.
   *
   * TARTIB MUHIM:
   *   1. imzo XOM tana ustidan tekshiriladi (parse qilishdan OLDIN);
   *   2. tana parse qilinadi va `event_id` olinadi;
   *   3. jurnalga insert — takror bo'lsa unique violation (`event_id` PK);
   *   4. posilka yangilanadi, status moslanadi, terminal amal bajariladi;
   *   5. jurnal yozuvi yakuniy holat bilan yangilanadi.
   *
   * HTTP javob har doim ma'noli: 401 (imzo), 200 (qabul/skip/takror).
   * Elchi 2xx bo'lmasa qayta yuboradi (outbox retry) — shu bois vaqtinchalik
   * xatoda 500 qaytarish TO'G'RI: Elchi qayta urinadi.
   */
  async process(
    args: ProcessElchiWebhookArgs,
  ): Promise<ProcessElchiWebhookResult> {
    const config = await this.configRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });

    if (!config) {
      this.logger.warn("Elchi webhook keldi, lekin sozlama yo'q");
      return { http_status: 200, message: "Sozlama yo'q — e'tiborsiz" };
    }

    // ===== 1. IMZO (xom tana ustidan) =====
    const verify = verifyElchiSignature(
      args.rawBody,
      args.signatureHeader,
      config.webhook_secret,
      config.webhook_secret_previous,
    );

    const payload = this.safeParse(args.rawBody);

    if (!verify.valid) {
      this.logger.warn(`Elchi webhook imzo xatosi: ${verify.reason}`);
      await this.writeLog({
        payload,
        rawBody: args.rawBody,
        signatureValid: false,
        status: 'invalid_signature',
        errorMessage: verify.reason ?? null,
      });
      return { http_status: 401, message: `Imzo xato: ${verify.reason}` };
    }
    if (verify.usedPreviousSecret) {
      this.logger.warn(
        'Elchi webhook ESKI sekret bilan tasdiqlandi — rotatsiyani yakunlang',
      );
    }

    // Master/webhook kaliti o'chirilgan bo'lsa: imzoni tasdiqladik (bu haqiqiy
    // Elchi so'rovi), lekin holatni O'ZGARTIRMAYMIZ. 200 qaytaramiz — aks holda
    // Elchi cheksiz qayta yuboradi.
    if (!config.is_active || !config.webhook_enabled) {
      await this.writeLog({
        payload,
        rawBody: args.rawBody,
        signatureValid: true,
        status: 'skipped',
        errorMessage: "integratsiya yoki webhook o'chirilgan",
      });
      return { http_status: 200, message: "O'chirilgan — e'tiborsiz" };
    }

    /**
     * SINOV WEBHOOKI (`webhook.test`).
     *
     * Elchi adminidagi "sinov yuborish" tugmasi shu hodisani yuboradi. Uning
     * maqsadi zanjirni tekshirish: manzil yetib boradimi, imzo mos keladimi.
     * Buyurtma bilan hech qanday aloqasi yo'q.
     *
     * ⚠️ Bu shoxcha IMZO TEKSHIRUVIDAN KEYIN turadi — aks holda imzosiz
     * so'rov ham "sinov" deb o'zini tanitib, javob olishi mumkin edi.
     *
     * Aniq javob qaytaramiz: ilgari bunday hodisa "posilka topilmadi"
     * deb yopilardi va operator sinov O'TDIMI yoki imzo xatoligi bordimi —
     * ajrata olmasdi.
     */
    if (String(payload.event ?? '') === 'webhook.test') {
      await this.writeLog({
        payload,
        rawBody: args.rawBody,
        signatureValid: true,
        status: 'success',
        errorMessage: null,
      });
      this.logger.log(
        `Elchi sinov webhooki qabul qilindi (event_id=${payload.event_id ?? '-'})`,
      );
      return {
        http_status: 200,
        message:
          "Sinov webhooki qabul qilindi — imzo to'g'ri, zanjir ishlayapti",
      };
    }

    // ===== 2. HODISA ID (takror himoyasi kaliti) =====
    const { eventId, synthesized } = this.resolveEventId(payload, args.rawBody);

    // ===== 3. JURNALGA INSERT — takrorni shu yerda tutamiz =====
    let logRow: ElchiWebhookLogEntity;
    try {
      logRow = await this.logRepo.save(
        this.logRepo.create({
          event_id: eventId,
          synthesized_key: synthesized,
          event_type: payload.event ?? null,
          elchi_shipment_id:
            payload.shipment_id != null ? String(payload.shipment_id) : null,
          external_order_id: payload.external_order_id ?? null,
          elchi_status: payload.status ?? null,
          signature_valid: true,
          status: 'success',
          raw_payload: payload as unknown as Record<string, unknown>,
          received_at: Date.now(),
          processed_at: null,
        }),
      );
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;

      // Ayni `event_id` allaqachon bor. Agar oldingi urinish MUVAFFAQIYATSIZ
      // bo'lgan bo'lsa — qayta ishlashga ruxsat beramiz (aks holda vaqtinchalik
      // xato hodisani abadiy yo'q qilardi). Aks holda — haqiqiy takror.
      const existing = await this.logRepo.findOne({
        where: { event_id: eventId },
      });
      if (existing && existing.status !== 'failed') {
        return { http_status: 200, message: 'Takror (allaqachon ishlangan)' };
      }
      logRow =
        existing ??
        this.logRepo.create({
          event_id: eventId,
          received_at: Date.now(),
        } as ElchiWebhookLogEntity);
    }

    // ===== 4. ISHLASH =====
    try {
      const result = await this.applyStatusUpdate(config, payload);
      await this.logRepo.update(
        { event_id: eventId },
        {
          status: result.status,
          error_message: result.note ?? null,
          processed_at: Date.now(),
        },
      );
      return { http_status: 200, message: result.message };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Elchi webhook ishlash xatosi: ${msg}`);
      await this.logRepo.update(
        { event_id: eventId },
        {
          status: 'failed' as ElchiWebhookStatus,
          error_message: msg.slice(0, 1000),
          processed_at: Date.now(),
        },
      );
      // 500 → Elchi outboxi qayta yuboradi; jurnal `failed` bo'lgani uchun
      // takror emas deb qabul qilinadi va qayta ishlanadi.
      return { http_status: 500, message: `Ishlash xatosi: ${msg}` };
    }
  }

  // ===================== ICHKI =====================

  /**
   * HISOB-KITOB TO'LOVINI QAYD ETISH (`settlement.payment`).
   *
   * Elchi bir marketga pul to'laganda yuboradi. Biz uni `elchi_settlement_payment`
   * daftariga AVTOMATIK yozamiz — ilgari faqat qo'lda kiritilardi va unutilsa
   * "Elchi bizga qarz" raqami abadiy noto'g'ri qolardi.
   *
   * ⚠️ BU KASSA EMAS. Daftar `cashbox_history`ga tegmaydi (entity izohiga
   * qarang) — faqat solishtirish uchun. "Elchi qancha to'ladi" shu yerdan
   * yig'iladi va qarz shunga qarab kamayadi.
   *
   * IDEMPOTENT: `external_payment_id` (Elchi to'lov id'si) NOYOB. Outbox retry
   * qilsa ham ikkinchi kelish jimgina rad etiladi.
   */
  private async recordSettlementPayment(
    payload: ElchiWebhookPayload,
  ): Promise<{ status: ElchiWebhookStatus; message: string; note?: string }> {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        status: 'failed',
        message: "settlement.payment: summa musbat bo'lishi kerak",
        note: `amount=${String(payload.amount)}`,
      };
    }

    const paidAt = Number(payload.paid_at) || Date.now();
    // Kelajak sanani rad etamiz — aks holda qarzni BUGUN yolg'on kamaytirardi
    // (qo'lda kiritishdagi ayni qoida).
    if (paidAt > Date.now() + 60_000) {
      return {
        status: 'failed',
        message: "settlement.payment: to'lov sanasi kelajakda bo'lolmaydi",
        note: `paid_at=${paidAt}`,
      };
    }

    const externalPaymentId = String(payload.payment_id ?? '').trim() || null;

    try {
      await this.settlementRepo.save(
        this.settlementRepo.create({
          amount: amount.toFixed(2),
          paid_at: paidAt,
          note: payload.note ? String(payload.note) : 'Elchi avto (webhook)',
          external_payment_id: externalPaymentId,
          created_by: null,
        }),
      );
      this.logger.log(
        `Elchi hisob-kitob to'lovi qayd etildi: ${amount} so'm ` +
          `(payment_id=${externalPaymentId ?? '-'})`,
      );
      return {
        status: 'success',
        message: `Elchi to'lovi qayd etildi: ${amount} so'm`,
      };
    } catch (error) {
      // Ayni `external_payment_id` allaqachon bor — takror, xato emas.
      if (this.isUniqueViolation(error)) {
        return {
          status: 'success',
          message: "Takror to'lov (allaqachon qayd etilgan)",
        };
      }
      throw error;
    }
  }

  /**
   * Elchi `occurred_at` (ISO sana) ni epoch ms ga aylantiradi (jyU65k8v).
   * Yaroqsiz yoki kelajakdagi (soat farqi oynasidan tashqari) sana rad
   * etiladi — `null` qaytariladi (chaqiruvchi hozirgi vaqtga tushadi).
   */
  private parseOccurredAt(raw?: string): number | null {
    if (!raw) return null;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return null;
    if (ms > Date.now() + 5 * 60_000) return null;
    return ms;
  }

  /**
   * Statusni buyurtmaga qo'llaydi: posilkani yangilaydi, statusni moslaydi va
   * terminal amalni bajaradi.
   *
   * PUBLIC va UMUMIY — `ElchiReconcileService` ham AYNAN shu metodni chaqiradi.
   * Nega: agar solishtiruvchi o'zining alohida qo'llash mantig'iga ega bo'lsa,
   * ikki yo'l vaqt o'tib AJRALIB ketadi va bir xil status ikki xil natija
   * berishi mumkin — pul aniqligi talab qilinadigan joyda bu qabul qilinmaydi.
   *
   * `cod_collected` (= Elchi'dagi `paid_amount`) endi webhookdan HAM,
   * solishtiruvdan HAM keladi — `GET /partner/shipments/:id` javobiga alohida
   * maydon sifatida qo'shildi. Ilgari faqat webhookda bor edi va hamkorda
   * webhook ishlamasa (masalan PCS lokalda) pul ma'lumoti umuman yetib
   * bormasdi.
   *
   * ⚠️ NOMI CHALG'ITADI: bu "kuryer mijozdan yiqqan pul" EMAS. Elchi'da
   * `paid_amount` — Elchi marketga QARZINING allaqachon to'langan qismi, va
   * oddiy sotuvda 0 bo'lib qoladi. Shu bois pul NOMUVOFIQLIGI bu maydondan
   * TOPILMAYDI; u `ElchiReconcileService.verifyMoney`da tarif va narx
   * solishtiruvi orqali aniqlanadi.
   */
  async applyStatusUpdate(
    config: ElchiConfigEntity,
    payload: ElchiWebhookPayload,
  ): Promise<{
    status: ElchiWebhookStatus;
    message: string;
    note?: string;
  }> {
    // HISOB-KITOB TO'LOVI — buyurtmaga bog'liq emas, alohida yo'l bilan
    // yoziladi (posilka qidirmaymiz).
    if (String(payload.event ?? '') === 'settlement.payment') {
      return this.recordSettlementPayment(payload);
    }

    const orderId = String(payload.external_order_id ?? '').trim();
    const remoteId =
      payload.shipment_id != null ? String(payload.shipment_id) : '';

    /**
     * ⚠️ UUID DARVOZASI — `order_id` ustuni `uuid` tipida.
     *
     * Elchi `external_order_id`ga ixtiyoriy satr yuborishi mumkin (yorliq,
     * smoke-test id va h.k.). UUID bo'lmagan qiymat bilan `findOne` qilsak
     * Postgres 22P02 tashlaydi -> `if (!shipment)` qo'riqchisigacha YETMAYDI
     * -> HTTP 500. Elchi outboxi 500 ni vaqtinchalik deb 4 marta uradi,
     * so'ng `permanently_failed` qilib hodisani ABADIY tashlaydi.
     *
     * Shuning uchun UUID bo'lmasa `order_id` qidiruvini o'tkazib yuboramiz va
     * `elchi_shipment_id` bo'yicha qidiramiz; u ham topilmasa `skipped` (200).
     */
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        orderId,
      );

    // Posilkani `external_order_id` (bizning UUID) bo'yicha topamiz; bo'lmasa
    // Elchi posilka id'si bilan (masalan biz jo'natishda javobni yo'qotgan
    // bo'lsak, keyin webhook orqali bog'lanadi — backfill).
    let shipment =
      orderId && isUuid
        ? await this.shipmentRepo.findOne({ where: { order_id: orderId } })
        : null;
    if (!shipment && remoteId) {
      shipment = await this.shipmentRepo.findOne({
        where: { elchi_shipment_id: remoteId },
      });
    }

    if (!shipment) {
      return {
        status: 'skipped',
        message: "Posilka topilmadi — e'tiborsiz",
        note: `order_id=${orderId || '-'} shipment_id=${remoteId || '-'}`,
      };
    }

    // Backfill: jo'natishda javob yo'qolgan bo'lsa Elchi id'sini endi bog'laymiz.
    if (!shipment.elchi_shipment_id && remoteId) {
      shipment.elchi_shipment_id = remoteId;
    }

    const rawStatus = String(payload.status ?? '');
    shipment.elchi_status = rawStatus || shipment.elchi_status;
    /**
     * `occurred_at` — Elchi tomonidagi HAQIQIY o'zgarish vaqti. Webhook
     * kechiksa yoki reconcile keyinroq tutsa ham status sanasi to'g'ri
     * bo'ladi. Bo'lmasa (yoki yaroqsiz) — hozirgi vaqt (jyU65k8v).
     * `last_synced_at` esa BIZ oxirgi marta sinxronlagan vaqt — har doim
     * hozir.
     */
    shipment.elchi_status_changed_at =
      this.parseOccurredAt(payload.occurred_at) ?? Date.now();
    shipment.last_synced_at = Date.now();
    if (
      payload.cod_collected != null &&
      Number.isFinite(payload.cod_collected)
    ) {
      // Elchi marketga to'lab bergan qism (`paid_amount`). Faqat qayd etamiz —
      // hisob-kitob ekrani shu yig'indini ko'rsatadi. Nomuvofiqlik tekshiruvi
      // bu maydonga tayanmaydi (yuqoridagi izoh).
      shipment.cod_collected_reported = Number(payload.cod_collected).toFixed(
        2,
      );
    }
    /**
     * HAQIQIY PUL MAYDONLARI (audit M2).
     *
     * ⚠️ UCH HOLAT AJRATILADI (`number | null | undefined`):
     *   • son     -> yoziladi (0 ham HAQIQIY: onlayn to'langan buyurtmada
     *                kuryer naqd yig'maydi, `collected_from_customer = 0`);
     *   • `null`  -> ustunni NULL ga TOZALAYMIZ. Elchi sotuvni qaytarganda
     *                (rollback/return) `sale_collectible_amount`ni null qiladi
     *                va `GET`da `collected_from_customer: null` keladi —
     *                ilgari bu holat e'tiborsiz qolardi (eski qiymat saqlanib,
     *                panel qaytarilgan posilkani "Elchi yig'gan" deb sanardi,
     *                soxta qarz shishardi);
     *   • `undefined` -> Elchi maydonni umuman YUBORMADI, tegilmaydi.
     */
    if (payload.collected_from_customer === null) {
      shipment.collected_from_customer_reported = null;
    } else if (
      payload.collected_from_customer !== undefined &&
      Number.isFinite(Number(payload.collected_from_customer))
    ) {
      shipment.collected_from_customer_reported = Number(
        payload.collected_from_customer,
      ).toFixed(2);
    }
    if (payload.elchi_fee === null) {
      shipment.elchi_fee_reported = null;
    } else if (
      payload.elchi_fee !== undefined &&
      Number.isFinite(Number(payload.elchi_fee))
    ) {
      shipment.elchi_fee_reported = Number(payload.elchi_fee).toFixed(2);
    }
    // KURYER HAQQI (extra_cost) — hisob-kitobda qarzdan ayiriladi (ShM3oBjJ).
    // Ayni uch holat: null->tozala, undefined->tegilmaydi, son->yoz.
    if (payload.extra_cost === null) {
      shipment.extra_cost_reported = null;
    } else if (
      payload.extra_cost !== undefined &&
      Number.isFinite(Number(payload.extra_cost))
    ) {
      shipment.extra_cost_reported = Number(payload.extra_cost).toFixed(2);
    }
    await this.shipmentRepo.save(shipment);

    const mapping = mapElchiStatus(rawStatus);
    if (!mapping) {
      return {
        status: 'skipped',
        message: `Status e'tiborga olinmadi: ${rawStatus}`,
      };
    }

    if (!mapping.terminal_action) {
      // Oraliq status — buyurtma holatiga TEGMAYMIZ. Sabab: oraliq statuslar
      // faqat ma'lumot uchun, ularni yozish sotuv/bekor oqimlarini buzishi
      // mumkin (masalan `WAITING`ga majburan o'tkazish qaytarish oqimini
      // chalkashtiradi). Ular posilka yozuvida ko'rinadi va shu yetarli.
      return {
        status: 'success',
        message: `Oraliq status qayd etildi: ${elchiStatusLabel(rawStatus)}`,
      };
    }

    if (!shipment.order_id) {
      return { status: 'skipped', message: "Posilkada order_id yo'q" };
    }
    if (!config.elchi_courier_user_id) {
      return {
        status: 'failed',
        message: 'Elchi vakil-kuryeri biriktirilmagan',
        note: "terminal amal bajarilmadi — kuryer yo'q",
      };
    }

    const courierId = config.elchi_courier_user_id;
    const result =
      mapping.terminal_action === 'sell'
        ? await this.orderService.markDeliveredByElchi(
            shipment.order_id,
            courierId,
            payload.cod_collected,
            {
              totalPrice: payload.total_price,
              extraCost: payload.extra_cost,
            },
          )
        : mapping.terminal_action === 'cancel'
          ? await this.orderService.markCancelledByElchi(
              shipment.order_id,
              courierId,
            )
          : mapping.terminal_action === 'rollback'
            ? await this.orderService.markRolledBackByElchi(
                shipment.order_id,
                courierId,
              )
            : await this.orderService.markReturnedByElchi(
                shipment.order_id,
                courierId,
              );

    if (result.kind === 'mismatch') {
      // Nomuvofiqlikni posilkaga ham yozamiz — admin paneldagi "Nomuvofiqlik"
      // filtri shu maydon orqali topadi.
      shipment.mismatch_at = Date.now();
      shipment.mismatch_reason = result.reason;
      await this.shipmentRepo.save(shipment);
      return {
        status: 'success',
        message: `Nomuvofiqlik qayd etildi: ${result.reason}`,
        note: result.reason,
      };
    }

    if (result.kind === 'skipped') {
      return {
        status: 'skipped',
        message: `Amal bajarilmadi: ${result.reason}`,
        note: result.reason,
      };
    }

    return {
      status: 'success',
      message: `${elchiStatusLabel(rawStatus)} — qo'llanildi`,
    };
  }

  /**
   * Hodisa id'sini aniqlaydi.
   *
   * Elchi `event_id` yuborsa — o'shani ishlatamiz. Yubormasa (eski versiya)
   * XOM TANA hashi bo'yicha determinatsiyalangan zaxira kalit yasaymiz: ayni
   * webhookning qayta yuborilishi hamon to'siladi. Lekin bu ZAXIRA, yechim
   * emas — bir xil tanali ikki HAR XIL hodisani ajratmaydi.
   */
  private resolveEventId(
    payload: ElchiWebhookPayload,
    rawBody: string,
  ): { eventId: string; synthesized: boolean } {
    const provided = String(payload.event_id ?? '').trim();
    if (provided) return { eventId: provided, synthesized: false };

    const hash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
    this.logger.warn(
      "Elchi webhookida event_id yo'q — zaxira kalit ishlatilmoqda " +
        '(takror himoyasi zaifroq)',
    );
    return { eventId: `syn_${hash.slice(0, 48)}`, synthesized: true };
  }

  /** Imzo tekshiruvidan OLDIN chaqirilishi mumkin — hech qachon tashlamaydi. */
  private safeParse(rawBody: string): ElchiWebhookPayload {
    try {
      const parsed = JSON.parse(rawBody);
      return parsed && typeof parsed === 'object'
        ? (parsed as ElchiWebhookPayload)
        : {};
    } catch {
      return {};
    }
  }

  /** Imzo xato / o'chirilgan holatlar uchun jurnal yozuvi (best-effort). */
  private async writeLog(args: {
    payload: ElchiWebhookPayload;
    rawBody: string;
    signatureValid: boolean;
    status: ElchiWebhookStatus;
    errorMessage: string | null;
  }): Promise<void> {
    const { eventId, synthesized } = this.resolveEventId(
      args.payload,
      args.rawBody,
    );
    try {
      await this.logRepo.save(
        this.logRepo.create({
          event_id: eventId,
          synthesized_key: synthesized,
          event_type: args.payload.event ?? null,
          elchi_shipment_id:
            args.payload.shipment_id != null
              ? String(args.payload.shipment_id)
              : null,
          external_order_id: args.payload.external_order_id ?? null,
          elchi_status: args.payload.status ?? null,
          signature_valid: args.signatureValid,
          status: args.status,
          error_message: args.errorMessage,
          raw_payload: args.payload as unknown as Record<string, unknown>,
          received_at: Date.now(),
          processed_at: Date.now(),
        }),
      );
    } catch (error) {
      // Takror imzo xatosi — jurnalda allaqachon bor, jimgina o'tamiz.
      if (!this.isUniqueViolation(error)) {
        this.logger.warn(
          `Elchi webhook jurnalini yozib bo'lmadi: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /** Postgres unique violation (23505). */
  private isUniqueViolation(error: unknown): boolean {
    const e = error as { code?: string; driverError?: { code?: string } };
    return e?.code === '23505' || e?.driverError?.code === '23505';
  }
}
