import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
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
import { ExternalIntegrationService } from '../external-integration/external-integration.service';
import { successRes, catchError } from 'src/infrastructure/lib/response';

// Retry delays (milliseconds)
const RETRY_DELAYS = [
  60 * 1000,      // 1 daqiqa
  5 * 60 * 1000,  // 5 daqiqa
  15 * 60 * 1000, // 15 daqiqa
];

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

      if (!order || !order.external_id) {
        // Tashqi buyurtma emas, sync qilish shart emas
        return;
      }

      // Operator dan integration slug ni olish (external_adosh → adosh)
      const integrationSlug = order.operator?.replace('external_', '');
      if (!integrationSlug) {
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
      const statusMapping = integration.status_mapping as StatusMapping;
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
      this.logger.log(`✅ Sync job qo'shildi: Order #${order.external_id}, Action: ${action}`);

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
   * Queue ni processing qilish
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = Date.now();

      // Pending yoki retry vaqti kelgan joblarni olish
      const jobs = await this.syncQueueRepo.find({
        where: [
          { status: 'pending' },
          {
            status: 'failed',
            next_retry_at: LessThanOrEqual(now),
          },
        ],
        relations: ['integration'],
        order: { created_at: 'ASC' },
        take: 10, // Bir vaqtda 10 tagacha
      });

      if (jobs.length === 0) {
        this.isProcessing = false;
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
   * Bitta job ni process qilish
   */
  private async processJob(job: IntegrationSyncQueueEntity): Promise<void> {
    const integration = job.integration;

    if (!integration || !integration.is_active) {
      job.status = 'failed';
      job.last_error = 'Integration topilmadi yoki faol emas';
      await this.syncQueueRepo.save(job);
      return;
    }

    // Job ni processing holatiga o'tkazish
    job.status = 'processing';
    job.attempts += 1;
    await this.syncQueueRepo.save(job);

    try {
      // Token olish
      const token = await this.externalIntegrationService.getValidToken(integration);

      // API endpoint ni tayyorlash
      const config = integration.status_sync_config;
      let endpoint = config.endpoint.replace('{id}', job.external_order_id);

      // Agar endpoint / bilan boshlanmasa, qo'shish
      if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
      }

      const url = integration.api_url.replace(/\/+$/, '') + endpoint;

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
      await this.syncQueueRepo.save(job);

      this.logger.log(`✅ Sync muvaffaqiyatli: Order #${job.external_order_id}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message;

      job.last_error = errorMessage;
      job.last_response = axiosError.response?.data as Record<string, any>;

      // 401 bo'lsa token ni yangilash kerak
      if (axiosError.response?.status === 401) {
        this.externalIntegrationService.clearTokenCache(integration.id);
      }

      // Retry limit tekshirish
      if (job.attempts >= job.max_attempts) {
        job.status = 'failed';
        job.next_retry_at = null;
        this.logger.error(`❌ Sync failed (max attempts): Order #${job.external_order_id}`);
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
   * Failed sync joblarni olish (admin panel uchun)
   */
  async getFailedSyncs(integrationId?: string) {
    try {
      const queryBuilder = this.syncQueueRepo
        .createQueryBuilder('sync')
        .leftJoinAndSelect('sync.integration', 'integration')
        .leftJoinAndSelect('sync.order', 'order')
        .where('sync.status = :status', { status: 'failed' })
        .andWhere('sync.attempts >= sync.max_attempts')
        .orderBy('sync.created_at', 'DESC');

      if (integrationId) {
        queryBuilder.andWhere('sync.integration_id = :integrationId', {
          integrationId,
        });
      }

      const data = await queryBuilder.getMany();
      return successRes(data);
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
      const queryBuilder = this.syncQueueRepo
        .createQueryBuilder('sync')
        .leftJoinAndSelect('sync.integration', 'integration')
        .leftJoinAndSelect('sync.order', 'order')
        .orderBy('sync.created_at', 'DESC');

      if (status) {
        queryBuilder.andWhere('sync.status = :status', { status });
      }

      if (integrationId) {
        queryBuilder.andWhere('sync.integration_id = :integrationId', {
          integrationId,
        });
      }

      const total = await queryBuilder.getCount();
      const data = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      return successRes({
        data,
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
      const data = await this.syncQueueRepo.find({
        where: { order_id: orderId },
        relations: ['integration'],
        order: { created_at: 'DESC' },
      });
      return successRes(data);
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Muvaffaqiyatli sync joblarni olish
   */
  async getSuccessfulSyncs(integrationId?: string, limit: number = 50) {
    try {
      const queryBuilder = this.syncQueueRepo
        .createQueryBuilder('sync')
        .leftJoinAndSelect('sync.integration', 'integration')
        .leftJoinAndSelect('sync.order', 'order')
        .where('sync.status = :status', { status: 'success' })
        .orderBy('sync.synced_at', 'DESC')
        .take(limit);

      if (integrationId) {
        queryBuilder.andWhere('sync.integration_id = :integrationId', {
          integrationId,
        });
      }

      const data = await queryBuilder.getMany();
      return successRes(data);
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Pending sync joblarni olish
   */
  async getPendingSyncs() {
    try {
      const data = await this.syncQueueRepo.find({
        where: [
          { status: 'pending' },
          { status: 'processing' },
        ],
        relations: ['integration', 'order'],
        order: { created_at: 'ASC' },
      });
      return successRes(data);
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

      return successRes({ id: job.id }, 200, 'Sync job qayta queue ga qo\'shildi');
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
  async retryAllFailedSyncs(integrationId?: string) {
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
  async deleteSyncJob(jobId: string) {
    try {
      const result = await this.syncQueueRepo.delete(jobId);

      if (result.affected === 0) {
        throw new NotFoundException('Sync job topilmadi');
      }

      return successRes(null, 200, 'Sync job o\'chirildi');
    } catch (error) {
      return catchError(error);
    }
  }
}
