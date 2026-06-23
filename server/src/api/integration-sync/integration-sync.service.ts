import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, SelectQueryBuilder } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import {
  IntegrationSyncQueueEntity,
  SyncAction,
  SyncStatus,
} from 'src/core/entity/integration-sync-queue.entity';
import {
  ExternalIntegrationEntity,
  StatusMapping,
} from 'src/core/entity/external-integration.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { Order_status } from 'src/common/enums';
import { ExternalIntegrationService } from '../external-integration/external-integration.service';
import { successRes, catchError } from 'src/infrastructure/lib/response';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { JwtPayload } from 'src/common/utils/types/user.type';

// Retry delays (milliseconds)
const RETRY_DELAYS = [
  60 * 1000, // 1 daqiqa
  5 * 60 * 1000, // 5 daqiqa
  15 * 60 * 1000, // 15 daqiqa
];

// Bir sikLda nechta job olinadi
const BATCH_SIZE = 10;

// 'processing' holatida shuncha vaqtdan ortiq qotib qolgan job — "stale" deb
// hisoblanadi va qayta tiklanadi (server qayta ishga tushgan/crash bo'lgan).
// Bitta batch'ning eng yomon holatda davom etishidan (10 job × 15s timeout)
// xavfsiz kattaroq qilib olamiz — toki haqiqatda yo'ldagi job tiklanmasin.
const STALE_PROCESSING_MS = 10 * 60 * 1000; // 10 daqiqa

@Injectable()
export class IntegrationSyncService {
  private readonly logger = new Logger(IntegrationSyncService.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(IntegrationSyncQueueEntity)
    private readonly syncQueueRepo: Repository<IntegrationSyncQueueEntity>,
    @InjectRepository(ExternalIntegrationEntity)
    private readonly integrationRepo: Repository<ExternalIntegrationEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    private readonly httpService: HttpService,
    private readonly externalIntegrationService: ExternalIntegrationService,
    private readonly dataSource: DataSource,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Queue ga yangi sync job qo'shish
   * Bu metod order status o'zgarganda chaqiriladi
   */
  async queueStatusSync(
    orderId: string,
    action: SyncAction,
    oldStatus: string,
    newStatus: string,
  ): Promise<void> {
    try {
      // Buyurtmani olish
      const order = await this.orderRepo.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Sync skip: order topilmadi (orderId=${orderId})`);
        return;
      }
      if (!order.external_id) {
        // Tashqi buyurtma emas (external_id yo'q) — sync qilinmaydi.
        // Tashqi buyurtma bo'lishi kerak bo'lsa-yu external_id yozilmagan bo'lsa,
        // bu sababli sync jimgina o'tib ketmasligi uchun aniq log qoldiramiz.
        if (order.operator?.startsWith('external_')) {
          this.logger.warn(
            `Sync skip: external_id yo'q, lekin operator tashqi (orderId=${orderId}, operator=${order.operator})`,
          );
        }
        return;
      }

      // Operator dan integration slug ni olish (external_adosh → adosh)
      const integrationSlug = order.operator?.replace('external_', '');
      if (!integrationSlug) {
        this.logger.warn(
          `Sync skip: operator yo'q yoki noto'g'ri (orderId=${orderId}, external_id=${order.external_id})`,
        );
        return;
      }

      // Integration ni topish
      const integration = await this.integrationRepo.findOne({
        where: { slug: integrationSlug, is_active: true },
      });

      if (!integration) {
        this.logger.warn(`Integration topilmadi: ${integrationSlug}`);
        return;
      }

      // Status sync yoqilganligini tekshirish
      if (!integration.status_sync_config?.enabled) {
        this.logger.debug(`Status sync o'chirilgan: ${integration.name}`);
        return;
      }

      // Mapped external status
      const statusMapping = integration.status_mapping;
      const externalStatus = statusMapping?.[action] || newStatus;

      // Config dan qiymatlarni olish
      const config = integration.status_sync_config;
      const statusField = config.status_field || 'status';
      const includeOrderId = config.include_order_id_in_body ?? false;
      const orderIdField = config.order_id_field || 'order_id';

      // Payload yaratish
      const payload: Record<string, any> = {
        [statusField]: externalStatus,
      };

      // Agar order_id body ga qo'shilishi kerak bo'lsa
      if (includeOrderId) {
        payload[orderIdField] = order.external_id;
      }

      // Queue ga qo'shish
      const syncJob = this.syncQueueRepo.create({
        order_id: orderId,
        integration_id: integration.id,
        action,
        old_status: oldStatus,
        new_status: newStatus,
        external_status: externalStatus,
        external_order_id: order.external_id,
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        payload,
      });

      await this.syncQueueRepo.save(syncJob);
      this.logger.log(
        `✅ Sync job qo'shildi: Order #${order.external_id}, Action: ${action}`,
      );

      // Worker ni trigger qilish (agar ishlamayotgan bo'lsa)
      this.triggerWorker();
    } catch (error) {
      this.logger.error(`Queue sync xatolik: ${error.message}`, error.stack);
    }
  }

  /**
   * Background worker ni trigger qilish
   */
  private triggerWorker(): void {
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Har 30 sekundda queue ni tekshirish
   */
  @Cron('*/30 * * * * *')
  async scheduledProcessQueue(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Queue ni processing qilish.
   *
   * Ishonchlilik kafolatlari:
   *  1) reclaimStaleProcessing — server qayta ishga tushgan/crash bo'lgan paytda
   *     'processing'da qotib qolgan joblarni qayta tiklaydi (aks holda ular
   *     abadiy yo'qoladi va buyurtma statusi tashqi saytga yetib bormaydi).
   *  2) claimJobs — joblarni DB darajasida ATOMIK olib, darrov 'processing'ga
   *     o'tkazadi (FOR UPDATE SKIP LOCKED). Bu bir nechta instans bir vaqtda
   *     ishlaganda ham bitta job ikki marta yuborilmasligini kafolatlaydi.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // 1) Qotib qolgan 'processing' joblarni tiklash
      await this.reclaimStaleProcessing();

      // 2) Navbatdan atomik ravishda batch olish
      const jobs = await this.claimJobs(BATCH_SIZE);

      if (jobs.length === 0) {
        return;
      }

      this.logger.log(`🔄 ${jobs.length} ta sync job topildi`);

      // Har bir job ni ketma-ket process qilish
      for (const job of jobs) {
        await this.processJob(job);
        // Joblar orasida kichik delay
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (error) {
      this.logger.error(`Queue processing xatolik: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 'processing' holatida juda uzoq qotib qolgan joblarni qayta tiklaydi.
   * Bunday joblar — server processJob o'rtasida qayta ishga tushgan/crash
   * bo'lgan paytda paydo bo'ladi. Urinish limiti tugamaganlarini 'pending'ga,
   * tugaganlarini 'failed'ga qaytaramiz.
   */
  private async reclaimStaleProcessing(): Promise<void> {
    const now = Date.now();
    const cutoff = now - STALE_PROCESSING_MS;

    const result = await this.syncQueueRepo
      .createQueryBuilder()
      .update(IntegrationSyncQueueEntity)
      .set({
        status: () =>
          `CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END`,
        next_retry_at: () => 'NULL',
        processing_started_at: () => 'NULL',
        last_error: () =>
          `COALESCE(last_error, 'Stale: server qayta ishga tushgan/crash paytida qotib qoldi')`,
        updated_at: () => String(now),
      })
      .where('status = :status', { status: 'processing' })
      .andWhere(
        '(processing_started_at IS NULL OR processing_started_at < :cutoff)',
        { cutoff },
      )
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.warn(
        `♻️ ${result.affected} ta qotib qolgan 'processing' job tiklandi`,
      );
    }
  }

  /**
   * Navbatdan ishlov berish uchun joblarni ATOMIK ravishda "egallab oladi":
   * tanlangan joblarni darrov 'processing'ga o'tkazadi va attempts'ni oshiradi.
   * FOR UPDATE SKIP LOCKED tufayli bir nechta instans bir-biriga xalaqit bermaydi.
   */
  private async claimJobs(
    limit: number,
  ): Promise<IntegrationSyncQueueEntity[]> {
    const now = Date.now();

    return this.dataSource.transaction(async (manager) => {
      // 1) Bo'sh joblarni qatorlarini lock bilan tanlash (boshqa instans
      //    egallaganlarini o'tkazib yuboradi). Relation join qilinmaydi —
      //    PostgreSQL outer join'da FOR UPDATE'ni rad etadi.
      const candidates = await manager
        .createQueryBuilder(IntegrationSyncQueueEntity, 's')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('s.status = :pending', { pending: 'pending' })
        .orWhere(
          '(s.status = :failed AND s.next_retry_at IS NOT NULL AND s.next_retry_at <= :now)',
          { failed: 'failed', now },
        )
        .orderBy('s.created_at', 'ASC')
        .take(limit)
        .getMany();

      if (candidates.length === 0) {
        return [];
      }

      const ids = candidates.map((c) => c.id);

      // 2) Atomik ravishda 'processing'ga o'tkazish + attempts oshirish
      await manager
        .createQueryBuilder()
        .update(IntegrationSyncQueueEntity)
        .set({
          status: () => `'processing'`,
          attempts: () => 'attempts + 1',
          processing_started_at: () => String(now),
          updated_at: () => String(now),
        })
        .whereInIds(ids)
        .execute();

      // 3) integration relation bilan qayta o'qish (endi joblar bizniki)
      return manager.find(IntegrationSyncQueueEntity, {
        where: { id: In(ids) },
        relations: ['integration'],
        order: { created_at: 'ASC' },
      });
    });
  }

  /**
   * Bitta job ni process qilish
   */
  private async processJob(job: IntegrationSyncQueueEntity): Promise<void> {
    const integration = job.integration;

    if (!integration || !integration.is_active) {
      job.status = 'failed';
      job.last_error = 'Integration topilmadi yoki faol emas';
      job.processing_started_at = null;
      await this.syncQueueRepo.save(job);
      return;
    }

    // ESLATMA: job allaqachon claimJobs() ichida ATOMIK ravishda 'processing'ga
    // o'tkazilgan va attempts oshirilgan. Bu yerda qaytadan o'zgartirmaymiz —
    // shu tariqa multi-instans xavfsizligi va attempts'ning to'g'ri sanalishi
    // saqlanadi.

    try {
      // Token olish
      const token =
        await this.externalIntegrationService.getValidToken(integration);

      // API endpoint ni tayyorlash
      const config = integration.status_sync_config;
      let endpoint = config.endpoint.replace('{id}', job.external_order_id);

      // Agar endpoint / bilan boshlanmasa, qo'shish
      if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
      }

      const url = integration.api_url.replace(/\/+$/, '') + endpoint;

      this.logger.log(
        `🌐 Sync request: ${config.method} ${url} | Order: #${job.external_order_id} | Payload: ${JSON.stringify(job.payload)}`,
      );

      // Headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (config.use_auth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Request yuborish
      const method = config.method.toLowerCase();
      let response;

      if (method === 'put') {
        response = await firstValueFrom(
          this.httpService.put(url, job.payload, { headers, timeout: 15000 }),
        );
      } else if (method === 'patch') {
        response = await firstValueFrom(
          this.httpService.patch(url, job.payload, { headers, timeout: 15000 }),
        );
      } else {
        response = await firstValueFrom(
          this.httpService.post(url, job.payload, { headers, timeout: 15000 }),
        );
      }

      // Muvaffaqiyatli
      job.status = 'success';
      job.synced_at = Date.now();
      job.last_response = response.data;
      job.last_error = null;
      job.processing_started_at = null;
      await this.syncQueueRepo.save(job);

      this.logger.log(
        `✅ Sync muvaffaqiyatli: Order #${job.external_order_id}`,
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message;

      job.last_error = errorMessage;
      job.last_response = axiosError.response?.data as Record<string, any>;
      job.processing_started_at = null;

      // 401 bo'lsa token ni yangilash kerak
      if (axiosError.response?.status === 401) {
        this.externalIntegrationService.clearTokenCache(integration.id);
      }

      // Retry limit tekshirish
      if (job.attempts >= job.max_attempts) {
        job.status = 'failed';
        job.next_retry_at = null;
        this.logger.error(
          `❌ Sync failed (max attempts): Order #${job.external_order_id}`,
        );
      } else {
        // Keyingi retry vaqtini hisoblash
        const delayIndex = Math.min(job.attempts - 1, RETRY_DELAYS.length - 1);
        job.next_retry_at = Date.now() + RETRY_DELAYS[delayIndex];
        job.status = 'failed';
        this.logger.warn(
          `⚠️ Sync retry ${job.attempts}/${job.max_attempts}: Order #${job.external_order_id}`,
        );
      }

      await this.syncQueueRepo.save(job);
    }
  }

  /**
   * Monitoring uchun umumiy query — sync job bilan birga buyurtmaning
   * mijozi, viloyati (district→region) va marketini ham olib keladi.
   * Maxfiy maydonlar tushib qolishi uchun faqat kerakli ustunlar tanlanadi.
   */
  private baseSyncQuery(): SelectQueryBuilder<IntegrationSyncQueueEntity> {
    return this.syncQueueRepo
      .createQueryBuilder('sync')
      .leftJoin('sync.integration', 'integration')
      .leftJoin('sync.order', 'order')
      .leftJoin('order.customer', 'customer')
      .leftJoin('order.district', 'district')
      .leftJoin('district.region', 'region')
      .leftJoin('order.market', 'market')
      .addSelect([
        'integration.id',
        'integration.name',
        'integration.slug',
        'order.id',
        'order.external_id',
        'order.order_number',
        'order.status',
        'order.total_price',
        'customer.id',
        'customer.name',
        'customer.phone_number',
        'district.id',
        'district.name',
        'region.id',
        'region.name',
        'market.id',
        'market.name',
      ]);
  }

  /**
   * Entity'ni frontend uchun qulay, tekis (flat) shaklga keltiradi —
   * mijoz/viloyat/market ma'lumotlari order ichida birga keladi.
   */
  private mapSyncJob(s: IntegrationSyncQueueEntity): Record<string, unknown> {
    const order = s.order;
    const district = order?.district;
    return {
      ...s,
      integration: s.integration
        ? {
            id: s.integration.id,
            name: s.integration.name,
            slug: s.integration.slug,
          }
        : null,
      order: order
        ? {
            id: order.id,
            external_id: order.external_id,
            order_number: order.order_number ?? null,
            status: order.status,
            total_price: order.total_price ?? null,
            customer: order.customer
              ? {
                  id: order.customer.id,
                  name: order.customer.name,
                  phone_number: order.customer.phone_number,
                }
              : null,
            district: district
              ? { id: district.id, name: district.name }
              : null,
            region: district?.region
              ? { id: district.region.id, name: district.region.name }
              : null,
            market: order.market
              ? { id: order.market.id, name: order.market.name }
              : null,
          }
        : null,
    };
  }

  /**
   * Failed sync joblarni olish (admin panel uchun)
   */
  async getFailedSyncs(integrationId?: string) {
    try {
      const queryBuilder = this.baseSyncQuery()
        .where('sync.status = :status', { status: 'failed' })
        .andWhere('sync.attempts >= sync.max_attempts')
        .orderBy('sync.created_at', 'DESC');

      if (integrationId) {
        queryBuilder.andWhere('sync.integration_id = :integrationId', {
          integrationId,
        });
      }

      const data = await queryBuilder.getMany();
      return successRes(data.map((s) => this.mapSyncJob(s)));
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Barcha sync joblarni olish (pagination bilan)
   */
  async getAllSyncs(
    page: number = 1,
    limit: number = 20,
    status?: SyncStatus,
    integrationId?: string,
  ) {
    try {
      const queryBuilder = this.baseSyncQuery().orderBy('sync.created_at', 'DESC');

      if (status) {
        queryBuilder.andWhere('sync.status = :status', { status });
      }

      if (integrationId) {
        queryBuilder.andWhere('sync.integration_id = :integrationId', {
          integrationId,
        });
      }

      const total = await queryBuilder.getCount();
      const rows = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      return successRes({
        data: rows.map((s) => this.mapSyncJob(s)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Buyurtma bo'yicha sync tarixini olish
   */
  async getSyncsByOrder(orderId: string) {
    try {
      const rows = await this.baseSyncQuery()
        .where('sync.order_id = :orderId', { orderId })
        .orderBy('sync.created_at', 'DESC')
        .getMany();
      return successRes(rows.map((s) => this.mapSyncJob(s)));
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Muvaffaqiyatli sync joblarni olish
   */
  async getSuccessfulSyncs(integrationId?: string, limit: number = 50) {
    try {
      const queryBuilder = this.baseSyncQuery()
        .where('sync.status = :status', { status: 'success' })
        .orderBy('sync.synced_at', 'DESC')
        .take(limit);

      if (integrationId) {
        queryBuilder.andWhere('sync.integration_id = :integrationId', {
          integrationId,
        });
      }

      const rows = await queryBuilder.getMany();
      return successRes(rows.map((s) => this.mapSyncJob(s)));
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Pending sync joblarni olish
   */
  async getPendingSyncs() {
    try {
      const rows = await this.baseSyncQuery()
        .where('sync.status IN (:...statuses)', {
          statuses: ['pending', 'processing'],
        })
        .orderBy('sync.created_at', 'ASC')
        .getMany();
      return successRes(rows.map((s) => this.mapSyncJob(s)));
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Sync statistikasi
   */
  async getSyncStats() {
    try {
      const [pending, processing, success, failed] = await Promise.all([
        this.syncQueueRepo.count({ where: { status: 'pending' } }),
        this.syncQueueRepo.count({ where: { status: 'processing' } }),
        this.syncQueueRepo.count({ where: { status: 'success' } }),
        this.syncQueueRepo.count({
          where: {
            status: 'failed',
          },
        }),
      ]);

      // Faqat max attempts ga yetgan failed larni hisoblash
      const permanentlyFailed = await this.syncQueueRepo
        .createQueryBuilder('sync')
        .where('sync.status = :status', { status: 'failed' })
        .andWhere('sync.attempts >= sync.max_attempts')
        .getCount();

      return successRes({
        pending,
        processing,
        success,
        failed,
        permanently_failed: permanentlyFailed,
        total: pending + processing + success + failed,
      });
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Bitta job ni qayta sync qilish (manual retry)
   */
  async retrySyncJob(jobId: string) {
    try {
      const job = await this.syncQueueRepo.findOne({
        where: { id: jobId },
        relations: ['integration'],
      });

      if (!job) {
        throw new NotFoundException('Sync job topilmadi');
      }

      // Reset qilish
      job.status = 'pending';
      job.attempts = 0;
      job.next_retry_at = null;
      job.last_error = null;

      await this.syncQueueRepo.save(job);

      // Worker ni trigger qilish
      this.triggerWorker();

      return successRes(
        { id: job.id },
        200,
        "Sync job qayta queue ga qo'shildi",
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Bir nechta job ni qayta sync qilish (bulk retry)
   */
  async bulkRetrySyncJobs(jobIds: string[]) {
    try {
      await this.syncQueueRepo.update(
        { id: In(jobIds) },
        {
          status: 'pending' as const,
          attempts: 0,
          next_retry_at: null as any,
          last_error: null as any,
        },
      );

      // Worker ni trigger qilish
      this.triggerWorker();

      return successRes(
        { count: jobIds.length },
        200,
        `${jobIds.length} ta sync job qayta queue ga qo'shildi`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Barcha failed joblarni qayta sync qilish
   */
  async retryAllFailedSyncs(integrationId?: string, actor?: JwtPayload) {
    try {
      const queryBuilder = this.syncQueueRepo
        .createQueryBuilder()
        .update(IntegrationSyncQueueEntity)
        .set({
          status: 'pending' as const,
          attempts: 0,
          next_retry_at: null as any,
          last_error: null as any,
        })
        .where('status = :status', { status: 'failed' })
        .andWhere('attempts >= max_attempts');

      if (integrationId) {
        queryBuilder.andWhere('integration_id = :integrationId', {
          integrationId,
        });
      }

      const result = await queryBuilder.execute();

      // Worker ni trigger qilish
      this.triggerWorker();

      // Integratsiya bo'yicha bo'lsa, integratsiyaga bog'lab loglaymiz.
      if (integrationId) {
        const integ = await this.integrationRepo.findOne({
          where: { id: integrationId },
        });
        this.activityLog.log({
          entity_type: 'integration',
          entity_id: integrationId,
          action: 'sync_retry',
          new_value: { name: integ?.name, count: result.affected },
          description: `${integ?.name || 'Integratsiya'}: ${result.affected} ta muvaffaqiyatsiz sync qayta navbatga qo'yildi`,
          user: actor,
        });
      }

      return successRes(
        { count: result.affected },
        200,
        `${result.affected} ta sync job qayta queue ga qo'shildi`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Sync job ni o'chirish
   */
  async deleteSyncJob(jobId: string, actor?: JwtPayload) {
    try {
      const job = await this.syncQueueRepo.findOne({
        where: { id: jobId },
        relations: ['integration'],
      });
      if (!job) {
        throw new NotFoundException('Sync job topilmadi');
      }

      await this.syncQueueRepo.delete(jobId);

      if (job.integration_id) {
        this.activityLog.log({
          entity_type: 'integration',
          entity_id: job.integration_id,
          action: 'sync_deleted',
          old_value: {
            name: job.integration?.name,
            sync_action: job.action,
            status: job.status,
          },
          description: `Sync job o'chirildi (${job.integration?.name || 'integratsiya'} — ${job.action})`,
          user: actor,
        });
      }

      return successRes(null, 200, "Sync job o'chirildi");
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Sync qilinmagan eski buyurtmalar sonini olish
   */
  async getUnsyncedOrdersCount(integrationId?: string) {
    try {
      const queryBuilder = this.orderRepo
        .createQueryBuilder('order')
        .where('order.external_id IS NOT NULL')
        .andWhere('order.operator LIKE :prefix', { prefix: 'external_%' })
        .andWhere('order.status IN (:...statuses)', {
          statuses: [Order_status.SOLD, Order_status.CANCELLED],
        });

      // Allaqachon muvaffaqiyatli sync qilinganlarni chiqarib tashlash
      queryBuilder.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM integration_sync_queue sq
          WHERE sq.order_id = order.id
          AND sq.status = 'success'
        )`,
      );

      if (integrationId) {
        // Integration slugini olish
        const integration = await this.integrationRepo.findOne({
          where: { id: integrationId },
        });
        if (integration) {
          queryBuilder.andWhere('order.operator = :operator', {
            operator: `external_${integration.slug}`,
          });
        }
      }

      const count = await queryBuilder.getCount();
      return successRes({ count });
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Eski buyurtmalarni sync queue ga qo'shish
   */
  async syncOldOrders(integrationId?: string) {
    try {
      const queryBuilder = this.orderRepo
        .createQueryBuilder('order')
        .where('order.external_id IS NOT NULL')
        .andWhere('order.operator LIKE :prefix', { prefix: 'external_%' })
        .andWhere('order.status IN (:...statuses)', {
          statuses: [Order_status.SOLD, Order_status.CANCELLED],
        });

      // Allaqachon muvaffaqiyatli sync qilinganlarni chiqarib tashlash
      queryBuilder.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM integration_sync_queue sq
          WHERE sq.order_id = order.id
          AND sq.status = 'success'
        )`,
      );

      // Allaqachon pending/processing holatda bo'lganlarni ham chiqarib tashlash
      queryBuilder.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM integration_sync_queue sq
          WHERE sq.order_id = order.id
          AND sq.status IN ('pending', 'processing')
        )`,
      );

      if (integrationId) {
        const integration = await this.integrationRepo.findOne({
          where: { id: integrationId },
        });
        if (integration) {
          queryBuilder.andWhere('order.operator = :operator', {
            operator: `external_${integration.slug}`,
          });
        }
      }

      const orders = await queryBuilder
        .orderBy('order.created_at', 'ASC')
        .getMany();

      let queuedCount = 0;

      for (const order of orders) {
        // Status ga qarab action ni aniqlash
        let action: SyncAction;
        if (order.status === Order_status.SOLD) {
          action = 'sold';
        } else {
          action = 'canceled';
        }

        await this.queueStatusSync(
          order.id,
          action,
          order.status, // old_status sifatida hozirgi status
          order.status, // new_status ham hozirgi status
        );
        queuedCount++;
      }

      // Worker ni trigger qilish
      if (queuedCount > 0) {
        this.triggerWorker();
      }

      this.logger.log(
        `📦 ${queuedCount} ta eski buyurtma sync queue ga qo'shildi`,
      );

      return successRes(
        { queued: queuedCount, total_found: orders.length },
        200,
        `${queuedCount} ta eski buyurtma sync queue ga qo'shildi`,
      );
    } catch (error) {
      return catchError(error);
    }
  }
}
