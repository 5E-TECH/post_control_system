import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ElchiConfigEntity } from 'src/core/entity/elchi-config.entity';
import { ElchiShipmentEntity } from 'src/core/entity/elchi-shipment.entity';
import { ElchiWebhookLogEntity } from 'src/core/entity/elchi-webhook-log.entity';
import { ElchiSettlementPaymentEntity } from 'src/core/entity/elchi-settlement-payment.entity';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ElchiConfigService } from './elchi-config.service';
import { ElchiWebhookService } from './elchi-webhook.service';
import { ElchiWebhookPayload } from './dto/elchi-webhook.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ShipmentFilter =
  'all' | 'pending' | 'error' | 'delivered' | 'mismatch';

/**
 * Elchi admin paneli uchun O'QISH va QO'LDA amallar servisi.
 *
 * Chegara: bu yerda **jo'natish mantiqi yo'q**. Jo'natish `ElchiShipmentService`,
 * solishtirish `ElchiReconcileService`, sozlash `ElchiConfigService` zimmasida.
 * Bu servis faqat panelga ma'lumot beradi va operatorning qo'lda amallarini
 * (webhookni qayta ishlash, nomuvofiqlikni yopish, to'lov qayd etish) bajaradi.
 */
@Injectable()
export class ElchiAdminService {
  private readonly logger = new Logger(ElchiAdminService.name);

  constructor(
    @InjectRepository(ElchiConfigEntity)
    private readonly configRepo: Repository<ElchiConfigEntity>,
    @InjectRepository(ElchiShipmentEntity)
    private readonly shipmentRepo: Repository<ElchiShipmentEntity>,
    @InjectRepository(ElchiWebhookLogEntity)
    private readonly webhookLogRepo: Repository<ElchiWebhookLogEntity>,
    @InjectRepository(ElchiSettlementPaymentEntity)
    private readonly paymentRepo: Repository<ElchiSettlementPaymentEntity>,
    private readonly configService: ElchiConfigService,
    private readonly webhookService: ElchiWebhookService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ===================== 1. UMUMIY HOLAT =====================

  /**
   * Panelning birinchi ekrani: tayyorlik checklisti + jonli raqamlar.
   *
   * `getReadiness` tashqi so'rov qiladi (ping + tarif), shu bois bu chaqiruv
   * sekinroq — sahifa ochilganda bir marta, avtomatik qayta-qayta emas.
   */
  async getHealth(): Promise<{
    readiness: Awaited<ReturnType<ElchiConfigService['getReadiness']>>;
    stats: Awaited<ReturnType<ElchiAdminService['getStats']>>;
  }> {
    const [readiness, stats] = await Promise.all([
      this.configService.getReadiness(),
      this.getStats(),
    ]);
    return { readiness, stats };
  }

  /** Jonli raqamlar — tashqi so'rovsiz, faqat bizning jadvallardan. */
  async getStats(): Promise<{
    shipments: {
      total: number;
      dispatched: number;
      pending: number;
      failed: number;
      mismatch: number;
    };
    webhooks: {
      total: number;
      success: number;
      failed: number;
      invalid_signature: number;
      last_received_at: number | null;
    };
    money: {
      cod_sent: number;
      cod_collected: number;
      paid_by_elchi: number;
      debt: number;
    };
  }> {
    const [total, dispatched, failed, mismatch] = await Promise.all([
      this.shipmentRepo.count(),
      this.shipmentRepo
        .createQueryBuilder('s')
        .where('s.elchi_shipment_id IS NOT NULL')
        .getCount(),
      this.shipmentRepo
        .createQueryBuilder('s')
        .where('s.elchi_shipment_id IS NULL')
        .andWhere('s.last_error IS NOT NULL')
        .getCount(),
      /**
       * `> 0` sharti ATAYLAB. LDG'da `mismatch_at` nullable ustunga
       * `bigintTransformerNonNull` qo'llangani uchun null → 0 yozilib,
       * `IS NOT NULL` filtri barcha qatorni "nomuvofiq" deb ko'rsatgan edi.
       * Elchi entiteti to'g'ri transformer ishlatadi, lekin filtr baribir
       * himoyalangan yoziladi — kelajakda kimdir transformerni almashtirsa
       * panel jimgina yolg'on ko'rsatmasin.
       */
      this.shipmentRepo
        .createQueryBuilder('s')
        .where('s.mismatch_at IS NOT NULL')
        .andWhere('s.mismatch_at > 0')
        .getCount(),
    ]);

    const [
      webhookTotal,
      webhookSuccess,
      webhookFailed,
      webhookInvalid,
      lastLog,
    ] = await Promise.all([
      this.webhookLogRepo.count(),
      this.webhookLogRepo.count({ where: { status: 'success' } }),
      this.webhookLogRepo.count({ where: { status: 'failed' } }),
      this.webhookLogRepo.count({ where: { status: 'invalid_signature' } }),
      this.webhookLogRepo.findOne({
        where: {},
        order: { received_at: 'DESC' },
        select: ['event_id', 'received_at'],
      }),
    ]);

    const money = await this.sumMoney();

    return {
      shipments: {
        total,
        dispatched,
        pending: Math.max(0, total - dispatched - failed),
        failed,
        mismatch,
      },
      webhooks: {
        total: webhookTotal,
        success: webhookSuccess,
        failed: webhookFailed,
        invalid_signature: webhookInvalid,
        last_received_at: lastLog?.received_at ?? null,
      },
      money,
    };
  }

  // ===================== 2. JO'NATMALAR =====================

  /**
   * Jo'natmalar ro'yxati — filtr pillalari va qidiruv bilan.
   *
   * `search` buyurtma raqami (butun son), mijoz telefoni yoki Elchi posilka
   * id'si bo'yicha ishlaydi. Ular uch xil jadvalda yotgani uchun bitta OR
   * shartida birlashtiriladi.
   */
  async getShipments(query: {
    page?: number;
    limit?: number;
    filter?: ShipmentFilter;
    search?: string;
  }): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const qb = this.shipmentRepo
      .createQueryBuilder('s')
      .leftJoin('s.order', 'o')
      .leftJoin('o.customer', 'c')
      .leftJoin('o.district', 'd')
      .leftJoin('d.region', 'r')
      .leftJoin('o.market', 'm')
      .addSelect([
        'o.id',
        'o.order_number',
        'o.status',
        'o.total_price',
        'o.control_owner',
        'c.id',
        'c.name',
        'c.phone_number',
        'd.id',
        'd.name',
        'r.id',
        'r.name',
        'm.id',
        'm.name',
      ])
      .orderBy('s.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    switch (query.filter) {
      case 'pending':
        // Hali Elchi'ga yetmagan va xato ham bermagan — navbatda.
        qb.andWhere('s.elchi_shipment_id IS NULL').andWhere(
          's.last_error IS NULL',
        );
        break;
      case 'error':
        qb.andWhere('s.elchi_shipment_id IS NULL').andWhere(
          's.last_error IS NOT NULL',
        );
        break;
      case 'delivered':
        qb.andWhere('LOWER(s.elchi_status) IN (:...done)', {
          done: ['sold', 'delivered', 'partly_sold'],
        });
        break;
      case 'mismatch':
        qb.andWhere('s.mismatch_at IS NOT NULL')
          .andWhere('s.mismatch_at > 0')
          .orderBy('s.mismatch_at', 'DESC');
        break;
      default:
        break;
    }

    const search = String(query.search ?? '').trim();
    if (search) {
      const asNumber = Number(search.replace(/[^0-9]/g, ''));
      const hasNumber = Number.isFinite(asNumber) && asNumber > 0;
      qb.andWhere(
        `(
          c.phone_number ILIKE :like
          OR s.elchi_shipment_id ILIKE :like
          ${hasNumber ? 'OR o.order_number = :num' : ''}
        )`,
        hasNumber
          ? { like: `%${search}%`, num: asNumber }
          : { like: `%${search}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    const data = rows.map((s) => ({
      id: s.id,
      order_id: s.order_id,
      post_id: s.post_id,
      elchi_shipment_id: s.elchi_shipment_id,
      elchi_status: s.elchi_status,
      elchi_status_changed_at: s.elchi_status_changed_at,
      last_synced_at: s.last_synced_at,
      send_attempts: s.send_attempts,
      last_error: s.last_error,
      mismatch_at: s.mismatch_at,
      mismatch_reason: s.mismatch_reason,
      cod_amount_sent: s.cod_amount_sent,
      cod_collected_reported: s.cod_collected_reported,
      created_at: s.created_at,
      order_number: s.order?.order_number ?? null,
      order_status: s.order?.status ?? null,
      order_total_price: s.order?.total_price ?? null,
      control_owner: s.order?.control_owner ?? null,
      customer_name: s.order?.customer?.name ?? null,
      customer_phone: s.order?.customer?.phone_number ?? null,
      district_name: s.order?.district?.name ?? null,
      region_name: s.order?.district?.region?.name ?? null,
      market_name: s.order?.market?.name ?? null,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Nomuvofiqlikni "ko'rib chiqildi" deb yopish.
   *
   * Belgini TOZALAYDI, pulga TEGMAYDI — pul tuzatishi odatdagi kassa/buyurtma
   * oqimi orqali qilinadi. Bu tugma faqat "admin ko'rdi va hal qildi" degani.
   */
  async resolveMismatch(
    orderId: string,
    user?: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    const shipment = await this.shipmentRepo.findOne({
      where: { order_id: orderId },
      relations: ['order'],
    });
    if (!shipment) {
      throw new NotFoundException('Elchi posilkasi topilmadi');
    }
    if (!shipment.mismatch_at) {
      return { success: true, message: "Nomuvofiqlik belgisi yo'q edi" };
    }

    const previousReason = shipment.mismatch_reason;
    shipment.mismatch_at = null;
    shipment.mismatch_reason = null;
    await this.shipmentRepo.save(shipment);

    await this.activityLog.log({
      entity_type: 'order',
      entity_id: orderId,
      action: 'elchi_mismatch_resolved',
      new_value: {
        resolved: true,
        previous_reason: previousReason,
      },
      description: `Buyurtma #${
        shipment.order?.order_number ?? orderId
      } — Elchi nomuvofiqligi qo'lda yopildi`,
      user,
    });

    return { success: true, message: 'Nomuvofiqlik yopildi' };
  }

  // ===================== 3. WEBHOOK LOGLAR =====================

  async getWebhookLogs(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<PaginatedResult<Record<string, unknown>>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const qb = this.webhookLogRepo
      .createQueryBuilder('w')
      .orderBy('w.received_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const status = String(query.status ?? '').trim();
    if (status && status !== 'all') {
      qb.andWhere('w.status = :status', { status });
    }

    const search = String(query.search ?? '').trim();
    if (search) {
      qb.andWhere(
        '(w.external_order_id ILIKE :like OR w.elchi_shipment_id ILIKE :like OR w.event_id ILIKE :like)',
        { like: `%${search}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((w) => ({
        event_id: w.event_id,
        synthesized_key: w.synthesized_key,
        event_type: w.event_type,
        elchi_shipment_id: w.elchi_shipment_id,
        external_order_id: w.external_order_id,
        elchi_status: w.elchi_status,
        signature_valid: w.signature_valid,
        status: w.status,
        error_message: w.error_message,
        raw_payload: w.raw_payload,
        received_at: w.received_at,
        processed_at: w.processed_at,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Webhookni QAYTA ishlash — saqlangan xom payloaddan.
   *
   * ⚠️ IMZO QAYTA TEKSHIRILMAYDI. Sabab: imzo qabul paytida xom tana ustidan
   * tekshirilgan va natijasi yozib qo'yilgan; bu yerda bizda faqat parse
   * qilingan JSON bor, uni qayta serializatsiya qilish bayt-ma-bayt bir xil
   * chiqishiga KAFOLAT YO'Q (kalit tartibi, son formati). Shu bois imzosi
   * NOTO'G'RI deb belgilangan yozuvni qayta ishlashga umuman ruxsat bermaymiz —
   * "qayta tekshiramiz" degan yolg'on xavfsizlikdan ko'ra aniq rad etish
   * xavfsizroq.
   */
  async reprocessWebhook(
    eventId: string,
    user?: JwtPayload,
  ): Promise<{ success: boolean; status: string; message: string }> {
    const log = await this.webhookLogRepo.findOne({
      where: { event_id: eventId },
    });
    if (!log) {
      throw new NotFoundException('Webhook logi topilmadi');
    }
    if (!log.signature_valid) {
      throw new BadRequestException(
        "Imzosi noto'g'ri webhookni qayta ishlab bo'lmaydi — xom tana " +
          "saqlanmagani uchun imzoni qayta tekshirib bo'lmaydi",
      );
    }
    if (log.status === 'success') {
      return {
        success: true,
        status: 'success',
        message: 'Bu hodisa allaqachon muvaffaqiyatli ishlangan',
      };
    }

    const config = await this.configService.getOrCreate();
    const payload = log.raw_payload as unknown as ElchiWebhookPayload;

    try {
      const result = await this.webhookService.applyStatusUpdate(
        config,
        payload,
      );
      log.status = result.status;
      log.error_message = result.note ?? null;
      log.processed_at = Date.now();
      await this.webhookLogRepo.save(log);

      await this.activityLog.log({
        entity_type: 'elchi_webhook_log',
        entity_id: eventId,
        action: 'elchi_webhook_reprocessed',
        new_value: { status: result.status, message: result.message },
        description: `Elchi webhook qo'lda qayta ishlandi (${result.status})`,
        user,
      });

      return {
        success: result.status === 'success',
        status: result.status,
        message: result.message,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.status = 'failed';
      log.error_message = msg.slice(0, 1000);
      log.processed_at = Date.now();
      await this.webhookLogRepo.save(log);
      this.logger.warn(`Webhook qayta ishlash xatosi (${eventId}): ${msg}`);
      throw error;
    }
  }

  // ===================== 4. HISOB-KITOB =====================

  /**
   * Pul solishtiruvi.
   *
   * ⚠️ QARZ DAVR BO'YICHA HISOBLANMAYDI. Qarz — to'planib boradigan qoldiq:
   * davr chegarasi bilan kesilsa, oldingi oyda yig'ilib bu oyda to'langan pul
   * "ortiqcha to'lov" bo'lib ko'rinardi. Shu bois:
   *   • `period` — tanlangan oraliqdagi HARAKAT (jo'natildi/yig'ildi/to'landi);
   *   • `overall` — BUTUN VAQT bo'yicha qoldiq (qarz shu yerda).
   *
   * ⚠️ `cod_collected` — Elchi bergan NET summa (M2): u o'z tarifini ayirib
   * beradi. Ya'ni `cod_sent − cod_collected ≈ Elchi tarifi × soni`, bu farq
   * xato EMAS. Haqiqiy xato — bu farq kutilgan tarifga mos kelmasa.
   */
  async getSettlement(query: { from?: number; to?: number }): Promise<{
    period: {
      from: number;
      to: number;
      cod_sent: number;
      cod_collected: number;
      paid_by_elchi: number;
      dispatched_count: number;
      collected_count: number;
      /**
       * Elchi ushlab qolgan summa — YIG'ILGAN posilkalar bo'yicha
       * (jo'natilgan − qaytarilgan). Kutilgan qiymat: tarif × soni.
       */
      elchi_fee: number;
    };
    overall: {
      cod_sent: number;
      cod_collected: number;
      paid_by_elchi: number;
      debt: number;
    };
    payments: Array<{
      id: string;
      amount: number;
      paid_at: number;
      note: string | null;
      created_by: string | null;
      created_at: number;
    }>;
  }> {
    const to = Number(query.to) || Date.now();
    // Standart oraliq — oxirgi 30 kun.
    const from = Number(query.from) || to - 30 * 24 * 60 * 60 * 1000;
    if (from > to) {
      throw new BadRequestException(
        "Boshlanish sanasi tugash sanasidan katta bo'lishi mumkin emas",
      );
    }

    const periodSent = await this.shipmentRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.cod_amount_sent), 0)', 'sum')
      .addSelect('COUNT(*)', 'cnt')
      .where('s.elchi_shipment_id IS NOT NULL')
      .andWhere('s.created_at BETWEEN :from AND :to', { from, to })
      .getRawOne<{ sum: string; cnt: string }>();

    /**
     * Yig'ilgan pul `elchi_status_changed_at` bo'yicha sanaladi, `created_at`
     * bo'yicha EMAS: pul buyurtma yaratilganda emas, YETKAZILGANDA yig'iladi.
     */
    const periodCollected = await this.shipmentRepo
      .createQueryBuilder('s')
      /**
       * ⚠️ HAQIQIY maydon (audit M2). Ilgari `cod_collected_reported` edi —
       * u Elchi'ning `order.paid_amount` qiymati, "yig'ilgan pul" EMAS.
       */
      .select('COALESCE(SUM(s.collected_from_customer_reported), 0)', 'sum')
      .addSelect('COUNT(*)', 'cnt')
      /** Tarif endi TAXMIN qilinmaydi — Elchi o'zi aytadi. */
      .addSelect('COALESCE(SUM(s.elchi_fee_reported), 0)', 'fee')
      /**
       * AYNI SHU qatorlar bo'yicha jo'natilgan summa ham olinadi.
       *
       * Elchi tarifini `cod_sent − cod_collected` deb hisoblab bo'lmaydi:
       * ular IKKI HAR XIL to'plam (biri davrda jo'natilganlar, ikkinchisi
       * davrda yig'ilganlar). Farqi tarifni emas, to'plamlar farqini
       * ko'rsatardi — ya'ni panel pul haqida yolg'on aytardi.
       */
      .addSelect('COALESCE(SUM(s.cod_amount_sent), 0)', 'sent_for_collected')
      .where('s.collected_from_customer_reported IS NOT NULL')
      .andWhere('s.elchi_fee_reported IS NOT NULL')
      .andWhere('s.elchi_status_changed_at BETWEEN :from AND :to', {
        from,
        to,
      })
      .getRawOne<{
        sum: string;
        cnt: string;
        fee: string;
        sent_for_collected: string;
      }>();

    const periodPaid = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'sum')
      .where('p.paid_at BETWEEN :from AND :to', { from, to })
      .getRawOne<{ sum: string }>();

    const overall = await this.sumMoney();

    const payments = await this.paymentRepo.find({
      where: { paid_at: Between(from, to) },
      order: { paid_at: 'DESC' },
      take: 200,
    });

    return {
      period: {
        from,
        to,
        cod_sent: Number(periodSent?.sum ?? 0),
        cod_collected: Number(periodCollected?.sum ?? 0),
        paid_by_elchi: Number(periodPaid?.sum ?? 0),
        dispatched_count: Number(periodSent?.cnt ?? 0),
        collected_count: Number(periodCollected?.cnt ?? 0),
        /**
         * ⚠️ AYIRMA BILAN TAXMIN QILINMAYDI (audit M2). Ilgari
         * `jo'natilgan − yig'ilgan` edi; yig'ilgan 0 bo'lgani uchun tarif
         * o'rniga BUTUN COD chiqardi. Endi Elchi tarifning sotuvda
         * ishlatilgan snapshotini o'zi yuboradi.
         */
        elchi_fee: Number(periodCollected?.fee ?? 0),
      },
      overall,
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paid_at: p.paid_at,
        note: p.note,
        created_by: p.created_by,
        created_at: p.created_at,
      })),
    };
  }

  /**
   * Butun vaqt bo'yicha pul qoldig'i — qarz shu yerdan chiqadi.
   *
   * ⚠️ QAYTA YOZILDI (audit M2). Ilgari qarz `cod_collected_reported` dan
   * hisoblanardi, u esa Elchi'ning `order.paid_amount` qiymati — "kuryer
   * yig'gan pul" EMAS, market qarzining avto-to'langan qismi, oddiy sotuvda
   * 0. Natijada uchta ko'rsatkich jimgina yolg'on edi:
   *
   *   "Elchi yig'gan"   = 0
   *   "Elchi bizga qarz" = 0 - to'lovlar = MANFIY
   *   "Elchi ushlagan"   = jo'natilgan - 0 = BUTUN COD (tarif emas)
   *
   * Endi Elchi ANIQ nomli ikki maydon yuboradi va qarz shulardan chiqadi.
   *
   * ⚠️ ESKI POSILKALAR YANGI QIYMAT BILAN ARALASHTIRILMAYDI. Ularda
   * `collected_from_customer_reported IS NULL`, va `COALESCE` bilan eski
   * yolg'on qiymatga qaytish rost bilan yolg'onni bir yig'indiga qo'shardi.
   * Ular `unreported_count` da alohida sanaladi — panel "N posilka bo'yicha
   * ma'lumot yo'q" deb ochiq aytadi.
   */
  private async sumMoney(): Promise<{
    cod_sent: number;
    cod_collected: number;
    elchi_fee: number;
    paid_by_elchi: number;
    debt: number;
    unreported_count: number;
  }> {
    const [sent, reported, paid, unreported] = await Promise.all([
      this.shipmentRepo
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.cod_amount_sent), 0)', 'sum')
        .where('s.elchi_shipment_id IS NOT NULL')
        .getRawOne<{ sum: string }>(),
      /**
       * Ikki maydon BIR SO'ROVDA va IKKISI HAM bo'lishi sharti bilan —
       * biri bor, ikkinchisi yo'q qator yig'indini buzardi (tarifsiz
       * yig'ilgan pul butun qarzga aylanardi).
       */
      this.shipmentRepo
        .createQueryBuilder('s')
        .select(
          'COALESCE(SUM(s.collected_from_customer_reported), 0)',
          'collected',
        )
        .addSelect('COALESCE(SUM(s.elchi_fee_reported), 0)', 'fee')
        .where('s.collected_from_customer_reported IS NOT NULL')
        .andWhere('s.elchi_fee_reported IS NOT NULL')
        .getRawOne<{ collected: string; fee: string }>(),
      this.paymentRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'sum')
        .getRawOne<{ sum: string }>(),
      this.shipmentRepo
        .createQueryBuilder('s')
        .select('COUNT(*)', 'cnt')
        .where('s.elchi_shipment_id IS NOT NULL')
        .andWhere(
          '(s.collected_from_customer_reported IS NULL OR s.elchi_fee_reported IS NULL)',
        )
        .getRawOne<{ cnt: string }>(),
    ]);

    const codSent = Number(sent?.sum ?? 0);
    const codCollected = Number(reported?.collected ?? 0);
    const elchiFee = Number(reported?.fee ?? 0);
    const paidByElchi = Number(paid?.sum ?? 0);

    return {
      cod_sent: codSent,
      cod_collected: codCollected,
      elchi_fee: elchiFee,
      paid_by_elchi: paidByElchi,
      /**
       * Elchi yig'gan, o'z tarifini ushlab qolgan, qolganini bizga berishi
       * kerak — shundan allaqachon to'lagani ayiriladi.
       */
      debt: codCollected - elchiFee - paidByElchi,
      unreported_count: Number(unreported?.cnt ?? 0),
    };
  }

  /** Elchi'dan olingan to'lovni qayd etish (M6 — qo'lda). */
  async addSettlementPayment(
    dto: { amount: number; paid_at?: number; note?: string },
    user?: JwtPayload,
  ): Promise<ElchiSettlementPaymentEntity> {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Summa musbat son bo'lishi kerak");
    }

    const paidAt = Number(dto.paid_at) || Date.now();
    /**
     * Kelajak sanani rad etamiz. Sabab oddiy: kelajakdagi to'lov qarzni
     * BUGUN kamaytirib ko'rsatadi — ya'ni panel Elchi bizga qarzdor emas deb
     * yolg'on aytadi. Kichik tekshiruv, lekin aynan pul ustida.
     */
    if (paidAt > Date.now() + 60_000) {
      throw new BadRequestException(
        "To'lov sanasi kelajakda bo'lishi mumkin emas",
      );
    }

    const payment = this.paymentRepo.create({
      amount: amount.toFixed(2),
      paid_at: paidAt,
      note: dto.note?.trim() || null,
      created_by: user?.id ?? null,
    });
    const saved = await this.paymentRepo.save(payment);

    await this.activityLog.log({
      entity_type: 'elchi_settlement_payment',
      entity_id: saved.id,
      action: 'elchi_payment_recorded',
      new_value: { amount, paid_at: paidAt, note: saved.note },
      description: `Elchi'dan olingan to'lov qayd etildi: ${amount.toLocaleString(
        'uz-UZ',
      )} so'm`,
      user,
    });

    return saved;
  }

  /** Xato kiritilgan to'lovni o'chirish (audit izi qoladi). */
  async deleteSettlementPayment(
    id: string,
    user?: JwtPayload,
  ): Promise<{ success: boolean }> {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) {
      throw new NotFoundException("To'lov yozuvi topilmadi");
    }

    await this.paymentRepo.delete({ id });

    await this.activityLog.log({
      entity_type: 'elchi_settlement_payment',
      entity_id: id,
      action: 'elchi_payment_deleted',
      old_value: {
        amount: Number(payment.amount),
        paid_at: payment.paid_at,
        note: payment.note,
      },
      description: `Elchi to'lov yozuvi o'chirildi: ${Number(
        payment.amount,
      ).toLocaleString('uz-UZ')} so'm`,
      user,
    });

    return { success: true };
  }

  // ===================== 5. BOSHQARUV =====================

  /**
   * Integratsiyani butunlay to'xtatish — "o'chirish" tugmasi.
   *
   * ⚠️ MA'LUMOT O'CHIRILMAYDI. Faqat bayroqlar `false` ga tushadi:
   * jo'natish ham, webhook ham, solishtirish ham to'xtaydi. Jadvallar joyida
   * qoladi, chunki ular buyurtma ↔ posilka bog'lanishini va pul izini
   * saqlaydi — ularsiz eski buyurtmalarning tarixi yo'qolardi.
   */
  async shutdown(user?: JwtPayload): Promise<ElchiConfigEntity> {
    const config = await this.configService.getOrCreate();
    config.is_active = false;
    config.webhook_enabled = false;
    config.reconcile_enabled = false;
    const saved = await this.configRepo.save(config);

    await this.activityLog.log({
      entity_type: 'elchi_config',
      entity_id: saved.id,
      action: 'elchi_shutdown',
      new_value: {
        is_active: false,
        webhook_enabled: false,
        reconcile_enabled: false,
      },
      description: "Elchi integratsiyasi butunlay to'xtatildi",
      user,
    });

    return saved;
  }
}
