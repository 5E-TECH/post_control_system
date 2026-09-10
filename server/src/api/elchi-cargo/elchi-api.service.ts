import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosRequestConfig, Method } from 'axios';
import { ElchiConfigEntity } from 'src/core/entity/elchi-config.entity';
import {
  ElchiCancelShipmentResponse,
  ElchiCreateShipmentRequest,
  ElchiCreateShipmentResponse,
  ElchiDistrict,
  ElchiPingResponse,
  ElchiProvisionMarketRequest,
  ElchiProvisionMarketResponse,
  ElchiRegion,
  ElchiShipmentStatusResponse,
  ElchiTariffResponse,
} from './dto/elchi-api.dto';

// Vaqtinchalik xatolarda qayta uriniladi (asl urinishdan tashqari).
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const MAX_BACKOFF_MS = 8000;

/**
 * BARCHA Elchi so'rovlari orasidagi minimal pauza.
 *
 * Elchi hamkor bo'yicha rate-limit qo'yadi (standart 120 so'rov/daqiqa ≈ 2/s).
 * 600 ms pauza bizni ~100/daqiqa darajasida ushlab turadi — qancha oqim
 * (dispatch, reconcile CRON, qo'lda qayta jo'natish) parallel ishlamasin,
 * limitdan oshmaymiz. LDG'da aynan shu dars 429 xatolari orqali o'rganilgan:
 * bitta global navbat — yagona ishonchli yechim.
 */
const ELCHI_REQUEST_GAP_MS = 600;

/** Elchi'ning HTTP timeouti bizdan uzun bo'lishi mumkin — posilka yaratish og'ir. */
const DEFAULT_TIMEOUT_MS = 15_000;
const CREATE_SHIPMENT_TIMEOUT_MS = 70_000;

@Injectable()
export class ElchiApiService {
  private readonly logger = new Logger(ElchiApiService.name);

  /** Global ketma-ket navbat — bir vaqtda faqat bitta so'rov ketadi. */
  private requestQueue: Promise<unknown> = Promise.resolve();

  constructor(
    @InjectRepository(ElchiConfigEntity)
    private readonly configRepo: Repository<ElchiConfigEntity>,
    private readonly http: HttpService,
  ) {}

  // ===================== SOZLAMA =====================

  /** Singleton sozlama qatori. */
  async getConfig(): Promise<ElchiConfigEntity> {
    const config = await this.configRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (!config) {
      throw new ServiceUnavailableException(
        'Elchi sozlamalari topilmadi. Avval Elchi sozlamalarini kiriting.',
      );
    }
    return config;
  }

  /**
   * So'rov yuborish uchun sozlama tayyor ekanini tekshiradi.
   *
   * MASTER KILL-SWITCH bu yerda TEKSHIRILMAYDI — u dispatch qatlamining ishi
   * (`is_active=false` bo'lganda ham operator "ulanishni tekshirish" tugmasini
   * bosa olishi kerak, aks holda sozlashni yakunlab bo'lmaydi).
   */
  private async requireCredentials(): Promise<{
    baseUrl: string;
    apiKey: string;
    config: ElchiConfigEntity;
  }> {
    const config = await this.getConfig();
    const baseUrl = String(config.api_base_url ?? '').trim();
    const apiKey = String(config.api_key ?? '').trim();
    if (!baseUrl) {
      throw new ServiceUnavailableException('Elchi API manzili kiritilmagan');
    }
    if (!apiKey) {
      throw new ServiceUnavailableException('Elchi API kaliti kiritilmagan');
    }
    return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, config };
  }

  // ===================== TRANSPORT =====================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** So'rovni global navbatga qo'yadi (limitdan oshmaslik kafolati). */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.requestQueue.then(task, task);
    // Zanjirni xatoda ham uzmaymiz; har so'rovdan keyin pauza.
    this.requestQueue = run.then(
      () => this.sleep(ELCHI_REQUEST_GAP_MS),
      () => this.sleep(ELCHI_REQUEST_GAP_MS),
    );
    return run;
  }

  /**
   * Elchi javob qobig'ini ochadi.
   *
   * Elchi `{ statusCode, message, data }` qaytaradi, lekin qatlamlar (gateway
   * interceptorlari) qo'shimcha o'ram qo'shishi mumkin. Shu bois HIMOYALANGAN
   * ochish: `data.data` → `data` → xom. Elchi kodining o'zi ham xuddi shunday
   * qiladi (`findOrderByQrToken`), ya'ni bu ehtiyotkorlik asossiz emas.
   */
  private unwrap<T>(body: unknown): T {
    const candidates = [
      (body as { data?: { data?: unknown } })?.data?.data,
      (body as { data?: unknown })?.data,
      body,
    ];
    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null) {
        return candidate as T;
      }
    }
    return body as T;
  }

  /**
   * Elchi Partner API ga so'rov. Navbat + retry (429/5xx) + backoff.
   *
   * Biznes xatolari (4xx, 429 dan tashqari) QAYTA URINILMAYDI va yuqoriga
   * o'zining status kodi bilan uzatiladi — masalan sotilgan posilkani bekor
   * qilishda Elchi 409 beradi va chaqiruvchi buni ma'noli ishlashi kerak.
   */
  private async request<T>(
    method: Method,
    path: string,
    options?: { body?: unknown; timeoutMs?: number },
  ): Promise<T> {
    const { baseUrl, apiKey } = await this.requireCredentials();
    const url = `${baseUrl}${path}`;

    return this.enqueue(async () => {
      let lastError: unknown;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        const config: AxiosRequestConfig = {
          method,
          url,
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          data: options?.body,
          timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        };

        try {
          const response = await firstValueFrom(this.http.request(config));
          return this.unwrap<T>(response.data);
        } catch (error) {
          lastError = error;
          const axiosError = error as AxiosError;
          const status = axiosError.response?.status;

          // Biznes xatosi — qayta urinmaymiz, statusni saqlab uzatamiz.
          if (status && !RETRYABLE_STATUSES.includes(status)) {
            throw new HttpException(
              this.describeError(axiosError, `Elchi API xatosi (${status})`),
              status,
            );
          }

          if (attempt === MAX_RETRIES) break;

          const backoff = Math.min(
            MAX_BACKOFF_MS,
            500 * Math.pow(2, attempt),
          );
          this.logger.warn(
            `Elchi ${method} ${path} — ${status ?? 'tarmoq xatosi'}, ` +
              `${backoff}ms dan keyin qayta urinish (${attempt + 1}/${MAX_RETRIES})`,
          );
          await this.sleep(backoff);
        }
      }

      const axiosError = lastError as AxiosError;
      throw new ServiceUnavailableException(
        this.describeError(axiosError, 'Elchi API javob bermadi'),
      );
    });
  }

  /** Elchi xato javobidan o'qishga qulay xabar yasaydi. */
  private describeError(error: AxiosError, fallback: string): string {
    const body = error?.response?.data as
      | { message?: string; error?: string }
      | undefined;
    const detail =
      (typeof body?.message === 'string' && body.message) ||
      (typeof body?.error === 'string' && body.error) ||
      error?.message;
    return detail ? `${fallback}: ${detail}` : fallback;
  }

  // ===================== ENDPOINTLAR =====================

  /** Ulanishni tekshirish. Sozlash ekranidagi "Tekshirish" tugmasi shuni chaqiradi. */
  async ping(): Promise<ElchiPingResponse> {
    return this.request<ElchiPingResponse>('GET', '/partner/ping');
  }

  /** Elchi viloyatlari (`sato_code` bilan — avtomatik moslash uchun). */
  async getRegions(): Promise<ElchiRegion[]> {
    const res = await this.request<ElchiRegion[]>('GET', '/partner/regions');
    return Array.isArray(res) ? res : [];
  }

  /** Elchi tumanlari (`sato_code` bilan). */
  async getDistricts(regionId?: string): Promise<ElchiDistrict[]> {
    const query = regionId
      ? `?region_id=${encodeURIComponent(regionId)}`
      : '';
    const res = await this.request<ElchiDistrict[]>(
      'GET',
      `/partner/districts${query}`,
    );
    return Array.isArray(res) ? res : [];
  }

  /**
   * Elchi tomonidagi market tarifini o'qish.
   *
   * TEKSHIRUV uchun: PCS'dagi virtual kuryer tarifi bilan solishtiriladi.
   * Ikkisi bitta narsani (Elchi yetkazish haqi) ikki joyda ifodalaydi va TENG
   * bo'lishi shart — aks holda har buyurtmada jimgina farq to'planadi (M4).
   */
  async getTariff(
    elchiMarketId: string,
    whereDeliver: 'center' | 'address',
  ): Promise<ElchiTariffResponse> {
    const query =
      `?elchi_market_id=${encodeURIComponent(elchiMarketId)}` +
      `&where_deliver=${encodeURIComponent(whereDeliver)}`;
    return this.request<ElchiTariffResponse>('GET', `/partner/tariff${query}`);
  }

  /**
   * "BeePost" market akkauntini ochish (bir martalik sozlash, idempotent).
   * Tarif MAJBURIY — yuborilmasa Elchi 0 qo'yadi va bepul yetkazadi (M4).
   */
  async provisionMarket(
    body: ElchiProvisionMarketRequest,
  ): Promise<ElchiProvisionMarketResponse> {
    return this.request<ElchiProvisionMarketResponse>(
      'POST',
      '/partner/markets',
      { body },
    );
  }

  /**
   * Posilka yaratish. Idempotent: `external_order_id` (bizning buyurtma UUID)
   * bo'yicha takroriy jo'natish yangi posilka ochmaydi.
   *
   * Timeout ataylab uzun: Elchi tomonda bu chaqiruv mijoz yaratish + buyurtma
   * yaratish + pul sozlashni ketma-ket bajaradi. Erta uzilish XAVFLI —
   * qayta urinish dublikat yaratishi mumkin (idempotentlik yozuvi hali
   * saqlanmagan bo'lsa).
   */
  async createShipment(
    body: ElchiCreateShipmentRequest,
  ): Promise<ElchiCreateShipmentResponse> {
    return this.request<ElchiCreateShipmentResponse>(
      'POST',
      '/partner/shipments',
      { body, timeoutMs: CREATE_SHIPMENT_TIMEOUT_MS },
    );
  }

  /**
   * Posilka holatini so'rash — yo'qolgan webhookni tutish uchun (reconcile).
   * `:id` = Elchi posilka id'si, bizning `external_order_id` EMAS.
   */
  async getShipment(
    elchiShipmentId: string,
  ): Promise<ElchiShipmentStatusResponse> {
    return this.request<ElchiShipmentStatusResponse>(
      'GET',
      `/partner/shipments/${encodeURIComponent(elchiShipmentId)}`,
    );
  }

  /** Posilkani bekor qilish. Yetkazilgan bo'lsa Elchi **409** qaytaradi. */
  async cancelShipment(
    elchiShipmentId: string,
  ): Promise<ElchiCancelShipmentResponse> {
    return this.request<ElchiCancelShipmentResponse>(
      'POST',
      `/partner/shipments/${encodeURIComponent(elchiShipmentId)}/cancel`,
    );
  }
}
