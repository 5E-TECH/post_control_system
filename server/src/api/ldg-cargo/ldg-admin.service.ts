import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { LdgConfigEntity } from 'src/core/entity/ldg-config.entity';
import { LdgShipmentEntity } from 'src/core/entity/ldg-shipment.entity';
import { LdgWebhookLogEntity } from 'src/core/entity/ldg-webhook-log.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { LdgApiService } from './ldg-api.service';
import { LdgShipmentService } from './ldg-shipment.service';
import { LdgWebhookService } from './ldg-webhook.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtPayload } from 'src/common/utils/types/user.type';
import { Order_status } from 'src/common/enums';

const WEBHOOK_LOG_RETENTION_DAYS = 30;

// Faqat shu (faol) statusdagi buyurtmalar LDG'ga (qayta) jo'natiladi.
// Yakunlangan (SOLD/CANCELLED/...) buyurtmalar jo'natilmaydi — mismatch oldini olish.
const LDG_DISPATCHABLE_STATUSES: Order_status[] = [
  Order_status.NEW,
  Order_status.RECEIVED,
  Order_status.ON_THE_ROAD,
  Order_status.WAITING,
];

// Reconcile (pull) bir o'tishda nechta shipmentni tekshirishi
const RECONCILE_BATCH_LIMIT = 100;

// Ommaviy/auto qayta jo'natishda har bir so'rov orasidagi pauza (ms) —
// LDG rate-limitiga (429) urilmaslik uchun.
const REDISPATCH_DELAY_MS = 350;

// Auto-retry cron bir o'tishda nechta yuborilmagan shipmentni qayta jo'natadi.
const AUTO_RETRY_BATCH_LIMIT = 30;

// Auto-retry shu urinishlar soniga yetgach to'xtaydi — doimiy "buzuq" buyurtmalarni
// (masalan SOATO kodi yo'q → har safar 422) cheksiz qayta urinmaslik uchun.
// Bu limitdan oshganlar faqat qo'lda "Hammasini qayta jo'natish" orqali yuboriladi.
const AUTO_RETRY_MAX_ATTEMPTS = 8;

// LDG'da terminal (yakuniy) statuslar — bularni qayta so'rashning hojati yo'q
const TERMINAL_LDG_STATUSES = ['DELIVERED', 'CANCELLED', 'RETURNED'];

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Bulk redispatch jobning server tomonidagi (persistent) holati. */
export interface BulkRedispatchState {
  running: boolean;
  total: number;
  done: number;
  success: number;
  failed: number;
  started_at: number | null;
  finished_at: number | null;
  stop_requested: boolean;
  last_error: string | null;
}

@Injectable()
export class LdgAdminService {
  private readonly logger = new Logger(LdgAdminService.name);

  // Bulk redispatch — SERVER tomonida ishlaydigan, frontend refresh/navigatsiyadan
  // omon qoladigan job. Faqat qo'lda to'xtatilguncha (yoki tugaguncha) ishlaydi.
  private bulkJob: BulkRedispatchState = {
    running: false,
    total: 0,
    done: 0,
    success: 0,
    failed: 0,
    started_at: null,
    finished_at: null,
    stop_requested: false,
    last_error: null,
  };

  constructor(
    @InjectRepository(LdgConfigEntity)
    private readonly configRepo: Repository<LdgConfigEntity>,
    @InjectRepository(LdgShipmentEntity)
    private readonly shipmentRepo: Repository<LdgShipmentEntity>,
    @InjectRepository(LdgWebhookLogEntity)
    private readonly logRepo: Repository<LdgWebhookLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly apiService: LdgApiService,
    private readonly shipmentService: LdgShipmentService,
    private readonly webhookService: LdgWebhookService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * "Bitta qarashda hammasi" — sozlama to'liqligi checklist va asosiy statistika.
   * Frontend Dashboard tab shu javobni ko'rsatadi.
   */
  async getHealth() {
    const config = await this.configRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });

    let courierName: string | null = null;
    let courierExists = false;
    if (config?.ldg_courier_user_id) {
      const courier = await this.userRepo.findOne({
        where: { id: config.ldg_courier_user_id },
      });
      courierExists = !!courier;
      courierName = courier?.name ?? null;
    }

    const senderComplete = !!(
      config?.sender_name &&
      config?.sender_phone &&
      config?.sender_region_sato &&
      config?.sender_district_sato &&
      config?.sender_address
    );

    const checklist = {
      api_key_set: !!config?.api_key,
      webhook_secret_set: !!config?.webhook_secret,
      tenant_domain_set: !!config?.tenant_domain,
      courier_set: courierExists,
      sender_complete: senderComplete,
      is_active: !!config?.is_active,
      is_sandbox: !!config?.is_sandbox,
    };

    const ready =
      checklist.api_key_set &&
      checklist.webhook_secret_set &&
      checklist.tenant_domain_set &&
      checklist.courier_set &&
      checklist.sender_complete;

    const [shipmentStats, webhookStats] = await Promise.all([
      this.getShipmentStats(),
      this.getWebhookStats(),
    ]);

    return {
      ready,
      courier_name: courierName,
      checklist,
      shipments: shipmentStats,
      webhooks: webhookStats,
      server_time: new Date().toISOString(),
      server_time_ms: Date.now(),
    };
  }

  async getShipmentStats() {
    const qb = this.shipmentRepo.createQueryBuilder('s');
    const total = await qb.getCount();
    const delivered = await this.shipmentRepo
      .createQueryBuilder('s')
      .where('UPPER(s.ldg_status) = :st', { st: 'DELIVERED' })
      .getCount();
    const withError = await this.shipmentRepo
      .createQueryBuilder('s')
      .where('s.last_error IS NOT NULL')
      .getCount();
    // Pending = LDG'ga jo'natilishi KUTILAYOTGAN (faol) buyurtmalar. Yakunlangan
    // (SOLD/CANCELLED/...) buyurtmalar endi jo'natilmaydi, shu sabab hisobga olinmaydi.
    const pending = await this.shipmentRepo
      .createQueryBuilder('s')
      .leftJoin('s.order', 'o')
      .where('s.ldg_order_id IS NULL')
      .andWhere('o.status IN (:...active)', {
        active: LDG_DISPATCHABLE_STATUSES,
      })
      .getCount();
    // LDG ↔ Beepost status to'qnashishi (real biznes muammosi)
    const mismatch = await this.shipmentRepo
      .createQueryBuilder('s')
      .where('s.mismatch_at IS NOT NULL')
      .getCount();

    return { total, delivered, with_error: withError, pending, mismatch };
  }

  async getWebhookStats() {
    const total = await this.logRepo.count();
    const success = await this.logRepo.count({ where: { status: 'success' } });
    const skipped = await this.logRepo.count({ where: { status: 'skipped' } });
    const failed = await this.logRepo.count({ where: { status: 'failed' } });
    const invalidSignature = await this.logRepo.count({
      where: { status: 'invalid_signature' },
    });

    const last = await this.logRepo.findOne({
      where: {},
      order: { received_at: 'DESC' },
    });

    return {
      total,
      success,
      skipped,
      failed,
      invalid_signature: invalidSignature,
      last_received_at: last?.received_at ?? null,
    };
  }

  /**
   * Webhook loglar — paginatsiya + status/event filtri.
   */
  async getWebhookLogs(query: {
    page?: number;
    limit?: number;
    status?: string;
    event_type?: string;
  }): Promise<PaginatedResult<LdgWebhookLogEntity>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const qb = this.logRepo
      .createQueryBuilder('log')
      .orderBy('log.received_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('log.status = :status', { status: query.status });
    }
    if (query.event_type) {
      qb.andWhere('log.event_type = :et', { et: query.event_type });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Jo'natmalar (shipments) — paginatsiya + filtr (has_error / delivered / pending).
   * Order va customer ma'lumotini ham qaytaramiz (frontend ko'rsatishi uchun).
   */
  async getShipments(query: {
    page?: number;
    limit?: number;
    filter?: 'all' | 'error' | 'delivered' | 'pending' | 'mismatch';
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

    if (query.filter === 'error') {
      qb.andWhere('s.last_error IS NOT NULL');
    } else if (query.filter === 'delivered') {
      qb.andWhere('UPPER(s.ldg_status) = :st', { st: 'DELIVERED' });
    } else if (query.filter === 'pending') {
      qb.andWhere('s.ldg_order_id IS NULL');
    } else if (query.filter === 'mismatch') {
      // Mismatch'larni avval — eng yangi mismatch tepada
      qb.andWhere('s.mismatch_at IS NOT NULL').orderBy(
        's.mismatch_at',
        'DESC',
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    const data = rows.map((s) => ({
      id: s.id,
      order_id: s.order_id,
      ldg_order_id: s.ldg_order_id,
      tracking_number: s.tracking_number,
      ldg_status: s.ldg_status,
      ldg_status_changed_at: s.ldg_status_changed_at,
      ldg_created_at: s.ldg_created_at,
      last_synced_at: s.last_synced_at,
      send_attempts: s.send_attempts,
      last_error: s.last_error,
      mismatch_at: s.mismatch_at,
      mismatch_reason: s.mismatch_reason,
      created_at: s.created_at,
      order_number: s.order?.order_number ?? null,
      order_status: s.order?.status ?? null,
      order_total_price: s.order?.total_price ?? null,
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
   * Mismatch'ni "hal qilindi" deb belgilash — admin qo'lda tekshirib chiqqach.
   * Mismatch maydonlarini tozalaydi (audit uchun activity_log saqlanadi).
   */
  /** LDG meta-amallari uchun audit anchor — singleton config'ning uuid id'si. */
  private async ldgConfigId(): Promise<string | null> {
    const c = await this.configRepo.findOne({
      where: {},
      select: ['id'],
      order: { created_at: 'ASC' },
    });
    return c?.id ?? null;
  }

  async resolveMismatch(
    orderId: string,
    user?: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    const shipment = await this.shipmentRepo.findOne({
      where: { order_id: orderId },
    });
    if (!shipment) {
      return { success: false, message: 'Shipment topilmadi' };
    }
    if (!shipment.mismatch_at) {
      return { success: false, message: 'Bu shipmentda mismatch yo\'q' };
    }
    const prevReason = shipment.mismatch_reason;
    shipment.mismatch_at = null;
    shipment.mismatch_reason = null;
    await this.shipmentRepo.save(shipment);
    // entity_type 'order' — enrichLogs order_number'ni avtomatik qo'shadi.
    this.activityLog.log({
      entity_type: 'order',
      entity_id: orderId,
      action: 'mismatch_resolved',
      old_value: { mismatch_reason: prevReason },
      description: `LDG nomuvofiqligi admin tomonidan hal qilindi`,
      user,
      metadata: { source: 'ldg' },
    });
    return { success: true, message: 'Mismatch hal qilindi deb belgilandi' };
  }

  /**
   * Xatoli (yoki hali yuborilmagan) shipmentni qayta LDG'ga jo'natish.
   */
  async redispatch(
    orderId: string,
    user?: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // actor uzatamiz — dispatch logi adminga tegishli ekanini ko'rsatadi.
      const shipment = await this.shipmentService.createShipmentForOrder(
        orderId,
        user,
      );
      return {
        success: true,
        message: `Qayta jo'natildi: ldg_order_id=${shipment.ldg_order_id ?? '-'}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  }

  /**
   * Hali LDG'ga muvaffaqiyatli yuborilmagan (yuborilmagan + xatoli) barcha
   * shipmentlarning order_id ro'yxati. Frontend "Hammasini qayta jo'natish"
   * tugmasi shu ro'yxatni olib, 10 tadan bo'lib redispatchBatch'ga yuboradi.
   */
  async getRetryCandidates(): Promise<string[]> {
    const rows = await this.shipmentRepo
      .createQueryBuilder('s')
      .leftJoin('s.order', 'o')
      .select('s.order_id', 'order_id')
      .where('s.ldg_order_id IS NULL')
      // Faqat faol buyurtmalar — yakunlanganlarni LDG'ga jo'natmaymiz.
      .andWhere('o.status IN (:...active)', {
        active: LDG_DISPATCHABLE_STATUSES,
      })
      .orderBy('s.created_at', 'ASC')
      .getRawMany<{ order_id: string }>();
    return rows.map((r) => r.order_id);
  }

  /**
   * Bir guruh (odatda 10 ta) buyurtmani ketma-ket, orasida pauza bilan qayta
   * jo'natadi. Pauza + LdgApiService'dagi 429 retry birgalikda LDG rate-limitini
   * keltirib chiqarmaslikni ta'minlaydi. Hech qachon throw qilmaydi — har bir
   * order natijasi alohida qaytariladi.
   */
  async redispatchBatch(
    orderIds: string[],
    user?: JwtPayload,
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    results: Array<{ order_id: string; success: boolean; message: string }>;
  }> {
    const ids = Array.isArray(orderIds) ? orderIds : [];
    const results: Array<{
      order_id: string;
      success: boolean;
      message: string;
    }> = [];
    let success = 0;
    let failed = 0;

    for (const orderId of ids) {
      const r = await this.redispatch(orderId, user);
      if (r.success) success++;
      else failed++;
      results.push({ order_id: orderId, success: r.success, message: r.message });
      await this.sleep(REDISPATCH_DELAY_MS);
    }

    return { total: ids.length, success, failed, results };
  }

  // ===== BULK REDISPATCH (server tomonida, persistent) =====

  /** Jorий bulk job holatini qaytaradi (frontend progress widget shu orqali poll qiladi). */
  getBulkRedispatchStatus(): BulkRedispatchState {
    return { ...this.bulkJob };
  }

  /**
   * Barcha yuborilmagan (faol) buyurtmalarni qayta jo'natishni BOSHLAYDI.
   * Job server tomonida ishlaydi — frontend yopilsa/refresh bo'lsa ham davom etadi,
   * faqat qo'lda to'xtatilguncha. So'rovlar global yozish navbati orqali (1s oraliq)
   * ketadi, shuning uchun LDG rate-limiti ham buzilmaydi.
   */
  // Bulk jobni boshlagan admin (per-order dispatch loglariga ulanadi).
  private bulkActor?: JwtPayload;

  async startBulkRedispatch(user?: JwtPayload): Promise<{
    started: boolean;
    message: string;
    status: BulkRedispatchState;
  }> {
    if (this.bulkJob.running) {
      return {
        started: false,
        message: 'Bulk jo\'natish allaqachon ishlamoqda',
        status: this.getBulkRedispatchStatus(),
      };
    }
    const ids = await this.getRetryCandidates();
    if (ids.length === 0) {
      return {
        started: false,
        message: 'Qayta jo\'natiladigan faol buyurtma yo\'q',
        status: this.getBulkRedispatchStatus(),
      };
    }
    this.bulkJob = {
      running: true,
      total: ids.length,
      done: 0,
      success: 0,
      failed: 0,
      started_at: Date.now(),
      finished_at: null,
      stop_requested: false,
      last_error: null,
    };
    this.bulkActor = user;
    // Bulk boshlanishini admin nomi bilan loglaymiz (har bir dispatch alohida ham loglanadi).
    const configId = await this.ldgConfigId();
    if (configId) {
      this.activityLog.log({
        entity_type: 'ldg_config',
        entity_id: configId,
        action: 'redispatch_bulk',
        new_value: { total: ids.length },
        description: `LDG ommaviy qayta jo'natish boshlandi (${ids.length} ta buyurtma)`,
        user,
        metadata: { source: 'ldg' },
      });
    }
    // Fire-and-forget — server tomonida davom etadi.
    void this.runBulkRedispatch(ids);
    return {
      started: true,
      message: `${ids.length} ta buyurtma jo'natilmoqda`,
      status: this.getBulkRedispatchStatus(),
    };
  }

  /** Ishlayotgan bulk jobни to'xtatish so'rovi (joriy so'rov tugagach to'xtaydi). */
  stopBulkRedispatch(): { stopped: boolean; message: string } {
    if (!this.bulkJob.running) {
      return { stopped: false, message: 'Bulk jo\'natish ishlamayapti' };
    }
    this.bulkJob.stop_requested = true;
    this.logger.warn('LDG bulk redispatch: to\'xtatish so\'raldi (qo\'lda)');
    return { stopped: true, message: 'To\'xtatilmoqda...' };
  }

  /** Bulk job ichki sikli — ketma-ket, throttle (global yozish navbati) bilan. */
  private async runBulkRedispatch(ids: string[]): Promise<void> {
    try {
      for (const orderId of ids) {
        if (this.bulkJob.stop_requested) {
          this.logger.warn(
            `LDG bulk redispatch to'xtatildi: ${this.bulkJob.done}/${this.bulkJob.total}`,
          );
          break;
        }
        try {
          const r = await this.redispatch(orderId, this.bulkActor);
          if (r.success) this.bulkJob.success++;
          else this.bulkJob.failed++;
        } catch (err) {
          this.bulkJob.failed++;
          this.bulkJob.last_error =
            err instanceof Error ? err.message : String(err);
        }
        this.bulkJob.done++;
      }
    } finally {
      this.bulkJob.running = false;
      this.bulkJob.finished_at = Date.now();
      this.logger.log(
        `LDG bulk redispatch tugadi: ${this.bulkJob.success} jo'natildi, ${this.bulkJob.failed} xato (${this.bulkJob.done}/${this.bulkJob.total})`,
      );
    }
  }

  // ===== AVTOMATIKA BOSHQARUVI (fon jarayonlari yoqish/o'chirish) =====

  /** Barcha fon jarayonlarining holati (Boshqaruv jadvali uchun). */
  async getAutomations() {
    const config = await this.configRepo.findOne({ where: {} });
    const [pendingActive] = await Promise.all([
      this.shipmentRepo
        .createQueryBuilder('s')
        .leftJoin('s.order', 'o')
        .where('s.ldg_order_id IS NULL')
        .andWhere('o.status IN (:...active)', {
          active: LDG_DISPATCHABLE_STATUSES,
        })
        .getCount(),
    ]);
    return {
      is_active: config?.is_active ?? false,
      webhook_enabled: config?.webhook_enabled ?? true,
      reconcile_enabled: config?.reconcile_enabled ?? true,
      auto_retry_enabled: config?.auto_retry_enabled ?? true,
      pending_active: pendingActive,
      bulk_redispatch: this.getBulkRedispatchStatus(),
    };
  }

  /** Bitta fon jarayonini yoqish/o'chirish. */
  async setAutomation(
    key: 'webhook_enabled' | 'reconcile_enabled' | 'auto_retry_enabled',
    value: boolean,
    user?: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    const allowed = ['webhook_enabled', 'reconcile_enabled', 'auto_retry_enabled'];
    if (!allowed.includes(key)) {
      return { success: false, message: 'Noma\'lum sozlama' };
    }
    const config = await this.configRepo.findOne({ where: {} });
    if (!config) {
      return { success: false, message: 'LDG sozlamasi topilmadi' };
    }
    const prev = config[key];
    config[key] = value;
    await this.configRepo.save(config);
    const KEY_LABEL: Record<string, string> = {
      webhook_enabled: 'Webhook',
      reconcile_enabled: 'Reconcile (tekshiruv)',
      auto_retry_enabled: 'Avto qayta urinish',
    };
    this.activityLog.log({
      entity_type: 'ldg_config',
      entity_id: config.id,
      action: 'automation_changed',
      old_value: { [key]: prev },
      new_value: { [key]: value },
      description: `LDG avtomatika: ${KEY_LABEL[key] || key} ${
        value ? 'yoqildi' : "o'chirildi"
      }`,
      user,
      metadata: { source: 'ldg' },
    });
    return {
      success: true,
      message: `${key} = ${value ? 'yoqildi' : 'o\'chirildi'}`,
    };
  }

  /** Webhook log'ni o'chirish (eski/keraksizlarni tozalash). */
  async deleteWebhookLog(
    deliveryId: string,
    user?: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    const r = await this.logRepo.delete({ delivery_id: deliveryId });
    if (!r.affected) {
      return { success: false, message: 'Webhook log topilmadi' };
    }
    const configId = await this.ldgConfigId();
    if (configId) {
      this.activityLog.log({
        entity_type: 'ldg_config',
        entity_id: configId,
        action: 'webhook_deleted',
        old_value: { delivery_id: deliveryId },
        description: `LDG webhook log o'chirildi (${deliveryId})`,
        user,
        metadata: { source: 'ldg', delivery_id: deliveryId },
      });
    }
    return { success: true, message: 'Webhook log o\'chirildi' };
  }

  /**
   * Saqlangan webhook log'ni qayta ishlash (skip/failed bo'lib qolganlar uchun).
   */
  async reprocessWebhook(deliveryId: string, user?: JwtPayload) {
    const result = await this.webhookService.reprocessFromLog(deliveryId);
    const configId = await this.ldgConfigId();
    if (configId) {
      this.activityLog.log({
        entity_type: 'ldg_config',
        entity_id: configId,
        action: 'webhook_reprocessed',
        new_value: { delivery_id: deliveryId },
        description: `LDG webhook qayta ishlandi (${deliveryId})`,
        user,
        metadata: { source: 'ldg', delivery_id: deliveryId },
      });
    }
    return result;
  }

  // ===== AUTO-RETRY (yuborilmaganlarni tizimning o'zi tuzatadi) =====

  /**
   * Hali yuborilmagan (ldg_order_id yo'q) va urinishlari limitdan oshmagan
   * shipmentlarni avtomatik qayta jo'natadi. Throttled (orasida pauza) — LDG
   * rate-limitini qayta keltirib chiqarmaydi. Vaqtinchalik xatolar (429,
   * tarmoq) shu yo'l bilan operator aralashuvisiz o'zi tuzaladi.
   */
  async autoRetryUnsentShipments(): Promise<{
    retried: number;
    success: number;
    failed: number;
  }> {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config?.is_active || !config?.auto_retry_enabled) {
      return { retried: 0, success: 0, failed: 0 };
    }

    const shipments = await this.shipmentRepo
      .createQueryBuilder('s')
      .leftJoin('s.order', 'o')
      .where('s.ldg_order_id IS NULL')
      .andWhere('s.send_attempts < :max', { max: AUTO_RETRY_MAX_ATTEMPTS })
      // Faqat faol buyurtmalar — yakunlanganlarni avtomatik qayta jo'natmaymiz.
      .andWhere('o.status IN (:...active)', {
        active: LDG_DISPATCHABLE_STATUSES,
      })
      .orderBy('s.send_attempts', 'ASC')
      .addOrderBy('s.created_at', 'ASC')
      .take(AUTO_RETRY_BATCH_LIMIT)
      .getMany();

    let success = 0;
    let failed = 0;

    for (const shipment of shipments) {
      const r = await this.redispatch(shipment.order_id);
      if (r.success) success++;
      else failed++;
      await this.sleep(REDISPATCH_DELAY_MS);
    }

    if (shipments.length > 0) {
      this.logger.log(
        `LDG auto-retry: ${shipments.length} ta yuborilmagan qayta urinildi, ${success} yuborildi, ${failed} xato`,
      );
    }

    return { retried: shipments.length, success, failed };
  }

  /**
   * Auto-retry cron — har 2 daqiqada yuborilmagan shipmentlarni qayta jo'natishga
   * urinadi. Bu "sistemaning o'zi tuzatishi" qatlami: 429 yoki tarmoq uzilishi
   * tufayli o'tmaganlar operator aralashuvisiz LDG'ga yetib boradi.
   */
  @Cron('30 */2 * * * *', { timeZone: 'Asia/Tashkent' })
  async autoRetryCron(): Promise<void> {
    try {
      await this.autoRetryUnsentShipments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`LDG auto-retry cron xatosi: ${msg}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===== RECONCILE (PULL) — webhook'ga qo'shimcha ishonchlilik qatlami =====

  /**
   * Bitta shipment statusini LDG'dan to'g'ridan-to'g'ri so'rab, order'ga qo'llaydi.
   * Webhook bilan bir xil markaziy mantiq (`applyStatusFromCode`) ishlatiladi.
   * Admin paneldan "LDG'dan tekshirish" tugmasi shu metodni chaqiradi.
   */
  async reconcileOne(
    orderId: string,
  ): Promise<{ success: boolean; message: string; ldg_status?: string }> {
    const shipment = await this.shipmentRepo.findOne({ where: { order_id: orderId } });
    if (!shipment) {
      return { success: false, message: 'Shipment topilmadi' };
    }
    if (!shipment.ldg_order_id) {
      return {
        success: false,
        message: 'Shipment hali LDG\'ga yuborilmagan (ldg_order_id yo\'q)',
      };
    }
    try {
      const resp = await this.apiService.getOrder(shipment.ldg_order_id);
      const code = resp.status?.code;
      if (!code) {
        return { success: false, message: 'LDG javobida status.code yo\'q' };
      }
      const result = await this.webhookService.applyStatusFromCode(
        shipment,
        code,
        new Date(),
      );
      return {
        success: result !== 'unknown_status',
        ldg_status: code,
        message:
          result === 'applied'
            ? `Status yangilandi: ${code}`
            : result === 'unchanged'
              ? `Status o'zgarmagan: ${code}`
              : `Noma'lum status code: ${code}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  }

  /**
   * Faol (terminal bo'lmagan) shipmentlarni LDG'dan ommaviy tekshirish.
   * Webhook o'tkazib yuborilgan/imzo xato bo'lgan holatlarda ham order statusi
   * baribir LDG bilan tenglashishini kafolatlaydi (eventual consistency).
   *
   * Har 5 daqiqada cron orqali, hamda admin paneldan qo'lda chaqirilishi mumkin.
   */
  async reconcileActiveShipments(): Promise<{
    checked: number;
    applied: number;
    unchanged: number;
    errors: number;
  }> {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config?.is_active || !config?.reconcile_enabled) {
      return { checked: 0, applied: 0, unchanged: 0, errors: 0 };
    }

    // Eng eski tekshirilgan (last_synced_at) birinchi — shu orqali barcha faol
    // shipmentlar navbatma-navbat qamrab olinadi, hech biri "qolib ketmaydi".
    const shipments = await this.shipmentRepo
      .createQueryBuilder('s')
      .where('s.ldg_order_id IS NOT NULL')
      .andWhere(
        '(s.ldg_status IS NULL OR UPPER(s.ldg_status) NOT IN (:...terminal))',
        { terminal: TERMINAL_LDG_STATUSES },
      )
      .orderBy('s.last_synced_at', 'ASC', 'NULLS FIRST')
      .take(RECONCILE_BATCH_LIMIT)
      .getMany();

    let applied = 0;
    let unchanged = 0;
    let errors = 0;

    for (const shipment of shipments) {
      try {
        const resp = await this.apiService.getOrder(shipment.ldg_order_id!);
        const code = resp.status?.code;
        if (!code) {
          errors++;
          continue;
        }
        const result = await this.webhookService.applyStatusFromCode(
          shipment,
          code,
          new Date(),
        );
        if (result === 'applied') applied++;
        else if (result === 'unchanged') unchanged++;
        else if (result === 'error') errors++;
      } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `LDG reconcile xatosi (order=${shipment.order_id}): ${msg}`,
        );
      } finally {
        // Status o'zgargan-o'zgarmaganidan qat'i nazar "tekshirildi" deb
        // belgilaymiz — shunda keyingi reconcile boshqa shipmentlarga o'tadi.
        await this.shipmentRepo
          .update(shipment.id, { last_synced_at: Date.now() })
          .catch(() => undefined);
      }
    }

    if (shipments.length > 0) {
      this.logger.log(
        `LDG reconcile: ${shipments.length} ta tekshirildi, ${applied} yangilandi, ${unchanged} o'zgarmagan, ${errors} xato`,
      );
    }

    return { checked: shipments.length, applied, unchanged, errors };
  }

  /**
   * Reconcile cron — har 5 daqiqada faol shipmentlarni LDG bilan tenglashtiradi.
   */
  @Cron('0 */5 * * * *', { timeZone: 'Asia/Tashkent' })
  async reconcileCron(): Promise<void> {
    try {
      await this.reconcileActiveShipments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`LDG reconcile cron xatosi: ${msg}`);
    }
  }

  /**
   * LDG bilan ulanishni test qilish (ma'lumot yaratmaydi).
   */
  async testConnection() {
    return this.apiService.testConnection();
  }

  /**
   * Eski webhook loglarni avtomatik tozalash — har kuni 03:30 (Asia/Tashkent).
   * Entity izohidagi "30 kunlik retention" va'dasini bajaradi.
   */
  @Cron('0 30 3 * * *', { timeZone: 'Asia/Tashkent' })
  async cleanupOldWebhookLogs(): Promise<void> {
    const cutoff = Date.now() - WEBHOOK_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    try {
      const result = await this.logRepo
        .createQueryBuilder()
        .delete()
        .where('received_at < :cutoff', { cutoff })
        .execute();
      if (result.affected) {
        this.logger.log(
          `LDG webhook log tozalash: ${result.affected} ta eski yozuv o'chirildi (>${WEBHOOK_LOG_RETENTION_DAYS} kun)`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`LDG webhook log tozalashda xato: ${msg}`);
    }
  }
}
