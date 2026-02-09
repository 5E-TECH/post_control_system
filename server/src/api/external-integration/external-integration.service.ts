import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';
import {
  ExternalIntegrationEntity,
  DEFAULT_FIELD_MAPPING,
  DEFAULT_STATUS_MAPPING,
  DEFAULT_STATUS_SYNC_CONFIG,
} from 'src/core/entity/external-integration.entity';
import { IntegrationSyncHistoryEntity } from 'src/core/entity/integration-sync-history.entity';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';
import { successRes, catchError } from 'src/infrastructure/lib/response';

// Token cache interfeysi
interface TokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class ExternalIntegrationService {
  // Token cache - har bir integratsiya uchun alohida
  private tokenCache: Map<string, TokenCache> = new Map();

  constructor(
    @InjectRepository(ExternalIntegrationEntity)
    private readonly repo: Repository<ExternalIntegrationEntity>,
    @InjectRepository(IntegrationSyncHistoryEntity)
    private readonly historyRepo: Repository<IntegrationSyncHistoryEntity>,
    private readonly httpService: HttpService,
  ) {}

  // Barcha integratsiyalarni olish
  async findAll() {
    try {
      const data = await this.repo.find({
        relations: ['market'],
        order: { created_at: 'DESC' },
      });
      return successRes(data);
    } catch (error) {
      return catchError(error);
    }
  }

  // Faqat faol integratsiyalarni olish
  async findActive() {
    try {
      const data = await this.repo.find({
        where: { is_active: true },
        relations: ['market'],
        order: { name: 'ASC' },
      });
      return successRes(data);
    } catch (error) {
      return catchError(error);
    }
  }

  // ID bo'yicha topish
  async findOne(id: string) {
    try {
      const data = await this.repo.findOne({
        where: { id },
        relations: ['market'],
      });

      if (!data) {
        throw new NotFoundException('Integratsiya topilmadi');
      }

      return successRes(data);
    } catch (error) {
      return catchError(error);
    }
  }

  // Slug bo'yicha topish
  async findBySlug(slug: string) {
    try {
      const data = await this.repo.findOne({
        where: { slug },
        relations: ['market'],
      });

      if (!data) {
        throw new NotFoundException('Integratsiya topilmadi');
      }

      return successRes(data);
    } catch (error) {
      return catchError(error);
    }
  }

  // Yangi integratsiya yaratish
  async create(dto: CreateIntegrationDto) {
    try {
      // Slug unique tekshirish
      const exists = await this.repo.findOne({ where: { slug: dto.slug } });
      if (exists) {
        throw new BadRequestException('Bu slug allaqachon mavjud');
      }

      // Default field mapping bilan birlashtirish
      const fieldMapping = {
        ...DEFAULT_FIELD_MAPPING,
        ...(dto.field_mapping || {}),
      };

      // Default status mapping bilan birlashtirish
      const statusMapping = {
        ...DEFAULT_STATUS_MAPPING,
        ...(dto.status_mapping || {}),
      };

      // Default status sync config bilan birlashtirish
      const statusSyncConfig = {
        ...DEFAULT_STATUS_SYNC_CONFIG,
        ...(dto.status_sync_config || {}),
      };

      const integration = this.repo.create({
        ...dto,
        field_mapping: fieldMapping,
        status_mapping: statusMapping,
        status_sync_config: statusSyncConfig,
        is_active: dto.is_active ?? true,
      });

      await this.repo.save(integration);

      // Market bilan qaytarish
      const result = await this.repo.findOne({
        where: { id: integration.id },
        relations: ['market'],
      });

      return successRes(result, 201, 'Integratsiya muvaffaqiyatli yaratildi');
    } catch (error) {
      return catchError(error);
    }
  }

  // Integratsiyani yangilash
  async update(id: string, dto: UpdateIntegrationDto) {
    try {
      const integration = await this.repo.findOne({ where: { id } });

      if (!integration) {
        throw new NotFoundException('Integratsiya topilmadi');
      }

      // Slug o'zgartirilayotgan bo'lsa, unique tekshirish
      if (dto.slug && dto.slug !== integration.slug) {
        const exists = await this.repo.findOne({ where: { slug: dto.slug } });
        if (exists) {
          throw new BadRequestException('Bu slug allaqachon mavjud');
        }
      }

      // Field mapping ni birlashtirish
      if (dto.field_mapping) {
        dto.field_mapping = {
          ...integration.field_mapping,
          ...dto.field_mapping,
        };
      }

      // Status mapping ni birlashtirish
      if (dto.status_mapping) {
        dto.status_mapping = {
          ...integration.status_mapping,
          ...dto.status_mapping,
        };
      }

      // Status sync config ni birlashtirish
      if (dto.status_sync_config) {
        dto.status_sync_config = {
          ...integration.status_sync_config,
          ...dto.status_sync_config,
        };
      }

      await this.repo.update(id, dto);

      const result = await this.repo.findOne({
        where: { id },
        relations: ['market'],
      });

      return successRes(result, 200, 'Integratsiya muvaffaqiyatli yangilandi');
    } catch (error) {
      return catchError(error);
    }
  }

  // Integratsiyani o'chirish
  async remove(id: string) {
    try {
      const integration = await this.repo.findOne({ where: { id } });

      if (!integration) {
        throw new NotFoundException('Integratsiya topilmadi');
      }

      await this.repo.delete(id);

      return successRes(null, 200, 'Integratsiya muvaffaqiyatli o\'chirildi');
    } catch (error) {
      return catchError(error);
    }
  }

  // Login qilib token olish (login-based auth uchun)
  private async loginAndGetToken(integration: ExternalIntegrationEntity): Promise<string> {
    if (!integration.auth_url || !integration.username || !integration.password) {
      throw new BadRequestException('Login konfiguratsiyasi to\'liq emas');
    }

    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.post(
          integration.auth_url,
          {
            username: integration.username,
            password: integration.password,
          },
          { timeout: 10000 },
        ),
      );

      const token = response.data?.access_token || response.data?.token;
      if (!token) {
        throw new BadRequestException('Token javobda topilmadi');
      }

      // Token ni cache qilish (55 daqiqa)
      this.tokenCache.set(integration.id, {
        token,
        expiresAt: Date.now() + 55 * 60 * 1000,
      });

      return token;
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      throw new BadRequestException(
        `Login xatoligi: ${axiosError.response?.data?.message || axiosError.message}`,
      );
    }
  }

  // Integratsiya uchun valid token olish
  async getValidToken(integration: ExternalIntegrationEntity): Promise<string | null> {
    // API key auth bo'lsa, api_key ni qaytarish
    if (integration.auth_type === 'api_key') {
      return integration.api_key || null;
    }

    // Login-based auth bo'lsa
    const cached = this.tokenCache.get(integration.id);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    // Yangi token olish
    return this.loginAndGetToken(integration);
  }

  // Token cache ni tozalash (401 xatolik uchun)
  clearTokenCache(integrationId: string): void {
    this.tokenCache.delete(integrationId);
  }

  // Majburiy yangi token olish (401 xatolik uchun)
  async refreshToken(integration: ExternalIntegrationEntity): Promise<string | null> {
    if (integration.auth_type === 'api_key') {
      return integration.api_key || null;
    }

    // Cache ni tozalash
    this.tokenCache.delete(integration.id);

    // Yangi token olish
    return this.loginAndGetToken(integration);
  }

  // Ulanishni tekshirish
  async testConnection(id: string) {
    try {
      const integration = await this.repo.findOne({ where: { id } });

      if (!integration) {
        throw new NotFoundException('Integratsiya topilmadi');
      }

      // Token olish (auth_type ga qarab)
      let token: string | null = null;
      try {
        token = await this.getValidToken(integration);
      } catch (tokenError) {
        return successRes({
          success: false,
          message: tokenError.message || 'Token olishda xatolik',
        });
      }

      // Login-based auth bo'lsa, token olindi = muvaffaqiyatli
      // (api_url ga so'rov yuborish shart emas, chunki u QR qidirish uchun)
      if (integration.auth_type === 'login') {
        return successRes({
          success: true,
          message: 'Login muvaffaqiyatli! Token olindi.',
          token_preview: token ? `${token.substring(0, 20)}...` : null,
        });
      }

      // API key auth bo'lsa, api_url ga so'rov yuborish
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(integration.api_url, {
          headers,
          timeout: 10000,
        }),
      );

      return successRes({
        success: true,
        status: response.status,
        message: 'Ulanish muvaffaqiyatli',
        data_count: Array.isArray(response.data?.data)
          ? response.data.data.length
          : Array.isArray(response.data)
            ? response.data.length
            : null,
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      return successRes(
        {
          success: false,
          message: axiosError.message || 'Ulanishda xatolik',
          error: axiosError.response?.data || null,
        },
        200,
      );
    }
  }

  // Oxirgi sinxronlash vaqtini yangilash
  async updateLastSync(id: string, ordersCount: number) {
    try {
      // Hozirgi integratsiyani olish
      const integration = await this.repo.findOne({ where: { id } });

      if (integration) {
        // Qiymatlarni yangilash
        integration.last_sync_at = Date.now();
        integration.total_synced_orders = (integration.total_synced_orders || 0) + ordersCount;

        await this.repo.save(integration);
        console.log(`✅ Integration sync updated: ${integration.name}, orders: +${ordersCount}, total: ${integration.total_synced_orders}`);
      }
    } catch (error) {
      console.error('❌ Last sync update error:', error);
    }
  }

  // Integratsiya entity sini to'g'ridan-to'g'ri olish (OrderService uchun)
  async getIntegrationEntity(id: string): Promise<ExternalIntegrationEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['market'],
    });
  }

  /**
   * Har kuni soat 04:00 da (O'zbekiston vaqti) sinxronlangan buyurtmalar sonini 0 ga tushirish
   * Timezone aniq ko'rsatilgan - server qaysi timezone'da bo'lishidan qat'iy nazar ishlaydi
   * Cron format: sekund daqiqa soat kun oy hafta_kuni
   */
  @Cron('0 0 4 * * *', { timeZone: 'Asia/Tashkent' })
  async resetDailySyncedOrders() {
    try {
      // 1️⃣ Barcha integratsiyalarni olish
      const integrations = await this.repo.find();

      // 2️⃣ Hozirgi vaqtni millisekund formatda olish
      const syncDate = Date.now();

      // 3️⃣ Har bir integratsiya uchun tarixga yozish
      const historyRecords: IntegrationSyncHistoryEntity[] = [];
      for (const integration of integrations) {
        if (integration.total_synced_orders > 0) {
          const history = this.historyRepo.create({
            integration_id: integration.id,
            integration_name: integration.name,
            synced_orders: integration.total_synced_orders,
            sync_date: syncDate,
          });
          historyRecords.push(history);
        }
      }

      // 4️⃣ Tarixni saqlash
      if (historyRecords.length > 0) {
        await this.historyRepo.save(historyRecords);
        console.log(
          `📊 [CRON] ${historyRecords.length} ta integratsiya tarixi saqlandi (${new Date(syncDate).toISOString()})`,
        );
      }

      // 5️⃣ Barcha integratsiyalarni 0 ga tushirish
      const result = await this.repo.update(
        {}, // barcha integratsiyalar
        { total_synced_orders: 0 },
      );

      console.log(
        `🔄 [CRON] Kunlik sinxronlash hisobi yangilandi: ${result.affected} ta integratsiya 0 ga tushirildi (${new Date().toISOString()})`,
      );
    } catch (error) {
      console.error('❌ [CRON] Kunlik reset xatoligi:', error);
    }
  }

  /**
   * Barcha integratsiyalarni qo'lda 0 ga tushirish (CRON job bilan bir xil)
   * Bu metod qo'lda chaqirilganda ham xuddi CRON job kabi ishlaydi
   */
  async resetAllSyncedOrders() {
    try {
      // CRON job bilan bir xil mantiq
      const integrations = await this.repo.find();
      const syncDate = Date.now();

      // Tarixga yozish
      const historyRecords: IntegrationSyncHistoryEntity[] = [];
      for (const integration of integrations) {
        if (integration.total_synced_orders > 0) {
          const history = this.historyRepo.create({
            integration_id: integration.id,
            integration_name: integration.name,
            synced_orders: integration.total_synced_orders,
            sync_date: syncDate,
          });
          historyRecords.push(history);
        }
      }

      if (historyRecords.length > 0) {
        await this.historyRepo.save(historyRecords);
      }

      // Barcha integratsiyalarni 0 ga tushirish
      const result = await this.repo.update({}, { total_synced_orders: 0 });

      console.log(
        `🔄 [MANUAL-ALL] Barcha integratsiyalar 0 ga tushirildi: ${result.affected} ta (${new Date().toISOString()})`,
      );

      return successRes(
        {
          affected: result.affected,
          history_saved: historyRecords.length,
        },
        200,
        `${result.affected} ta integratsiya 0 ga tushirildi`,
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Bitta integratsiya sinxronlangan buyurtmalar sonini qo'lda 0 ga tushirish
   */
  async resetSyncedOrders(id: string) {
    try {
      const integration = await this.repo.findOne({ where: { id } });

      if (!integration) {
        throw new NotFoundException('Integratsiya topilmadi');
      }

      // Agar 0 dan katta bo'lsa, tarixga yozish
      if (integration.total_synced_orders > 0) {
        const history = this.historyRepo.create({
          integration_id: integration.id,
          integration_name: integration.name,
          synced_orders: integration.total_synced_orders,
          sync_date: Date.now(),
        });
        await this.historyRepo.save(history);
      }

      // 0 ga tushirish
      await this.repo.update(id, { total_synced_orders: 0 });

      console.log(`🔄 [MANUAL] ${integration.name} sinxronlangan buyurtmalar soni 0 ga tushirildi`);

      return successRes(
        { previous_count: integration.total_synced_orders },
        200,
        'Sinxronlangan buyurtmalar soni 0 ga tushirildi',
      );
    } catch (error) {
      return catchError(error);
    }
  }

  /**
   * Integratsiya sinxronlash tarixini olish
   */
  async getSyncHistory(integrationId?: string, limit: number = 30) {
    try {
      const queryBuilder = this.historyRepo
        .createQueryBuilder('history')
        .orderBy('history.sync_date', 'DESC')
        .take(limit);

      if (integrationId) {
        queryBuilder.where('history.integration_id = :integrationId', {
          integrationId,
        });
      }

      const data = await queryBuilder.getMany();
      return successRes(data);
    } catch (error) {
      return catchError(error);
    }
  }
}
