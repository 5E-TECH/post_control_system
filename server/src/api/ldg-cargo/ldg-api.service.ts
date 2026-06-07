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
import { AxiosError, AxiosRequestConfig } from 'axios';
import { LdgConfigEntity } from 'src/core/entity/ldg-config.entity';
import {
  LdgCreateOrderRequestDto,
  LdgCreateOrderResponseDto,
} from './dto/ldg-create-order.dto';

/**
 * LDG javob envelope (har endpoint shu shaklda qaytaradi):
 *   { success: bool, data: ..., message: string|null, request_id: string }
 */
interface LdgEnvelope<T> {
  success: boolean;
  data: T;
  message: string | null;
  request_id: string;
}

// 429 (Too Many Attempts) yoki vaqtinchalik server xatolarida nechta marta
// qayta uriniladi (asl urinishdan tashqari). Jami = 1 + MAX_RETRIES urinish.
const MAX_RETRIES = 3;
// Qaysi HTTP statuslarda qayta urinish mantiqiy (vaqtinchalik xatolar).
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
// Backoff'ning yuqori chegarasi — bitta so'rovni juda uzoq bloklamaslik uchun.
const MAX_BACKOFF_MS = 8000;

@Injectable()
export class LdgApiService {
  private readonly logger = new Logger(LdgApiService.name);

  constructor(
    @InjectRepository(LdgConfigEntity)
    private readonly configRepo: Repository<LdgConfigEntity>,
    private readonly http: HttpService,
  ) {}

  /**
   * LDG sozlamalarini olib keladi. Hech bo'lmaganda bir qator turishi shart
   * (init paytida default qator yaratiladi).
   */
  async getConfig(): Promise<LdgConfigEntity> {
    const config = await this.configRepo.findOne({
      where: {},
      order: { created_at: 'ASC' },
    });
    if (!config) {
      throw new ServiceUnavailableException(
        'LDG sozlamalari topilmadi. Avval LDG sozlamalarini kiriting.',
      );
    }
    return config;
  }

  /**
   * LDG ga POST /orders so'rovi.
   * Idempotency-Key: orderning bizdagi UUID si — takroriy yuborish bir xil
   * javobni qaytaradi (LDG bizning idempotency mexanizmiga ishonadi).
   */
  async createOrder(
    body: LdgCreateOrderRequestDto,
    idempotencyKey: string,
  ): Promise<LdgCreateOrderResponseDto> {
    return this.request<LdgCreateOrderResponseDto>('POST', '/orders', body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  /**
   * LDG ga GET /orders/{id} so'rovi — shipment statusini sinxronlash uchun.
   */
  async getOrder(ldgOrderId: number): Promise<LdgCreateOrderResponseDto> {
    return this.request<LdgCreateOrderResponseDto>(
      'GET',
      `/orders/${ldgOrderId}`,
    );
  }

  /**
   * LDG ga POST /orders/{id}/cancel so'rovi.
   */
  async cancelOrder(ldgOrderId: number): Promise<void> {
    await this.request<unknown>('POST', `/orders/${ldgOrderId}/cancel`);
  }

  /**
   * LDG GET /statuses — yengil "ping" so'rovi. Ulanishni tekshirish uchun
   * ishlatiladi (ma'lumot yaratmaydi). `is_active` false bo'lsa ham ishlaydi —
   * chunki sozlamani yoqishdan oldin test qilish kerak.
   */
  async getStatuses(): Promise<unknown> {
    return this.request<unknown>('GET', '/statuses', undefined, {}, {
      skipActiveCheck: true,
    });
  }

  /**
   * Ulanishni tekshiradi: config to'liqligini va LDG bilan real ulanishni.
   * Hech qanday ma'lumot yaratmaydi. Natija UI'da ko'rsatiladi.
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    status_count?: number;
  }> {
    const config = await this.getConfig();
    if (!config.api_key || !config.tenant_domain) {
      return {
        success: false,
        message: 'API kalit yoki tenant domen sozlanmagan',
      };
    }
    try {
      const data = await this.getStatuses();
      const count = Array.isArray(data) ? data.length : undefined;
      return {
        success: true,
        message: count
          ? `Ulanish muvaffaqiyatli (${count} ta status topildi)`
          : 'Ulanish muvaffaqiyatli',
        status_count: count,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  }

  /**
   * Universal so'rov yuboruvchi — auth headerlarni qo'shadi, envelope ni unwrap qiladi,
   * xatolarni izchil HttpException ga aylantiradi.
   *
   * Vaqtinchalik xatolarda (429 "Too Many Attempts", 5xx, tarmoq uzilishi) so'rov
   * eksponensial backoff bilan avtomatik qayta uriniladi. Shu tufayli LDG rate-limit
   * urganda ham operator aralashuvisiz o'zi tuzaladi. `Retry-After` header bo'lsa,
   * unga rioya qilamiz (lekin MAX_BACKOFF_MS bilan cheklab).
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    extraConfig: AxiosRequestConfig = {},
    options: { skipActiveCheck?: boolean } = {},
  ): Promise<T> {
    const config = await this.getConfig();

    if (!options.skipActiveCheck && !config.is_active) {
      throw new ServiceUnavailableException('LDG integratsiyasi faol emas');
    }
    if (!config.api_key || !config.tenant_domain) {
      throw new ServiceUnavailableException(
        'LDG API kalit yoki tenant domen sozlanmagan',
      );
    }

    const url = `${config.api_base_url}${path}`;
    const reqConfig: AxiosRequestConfig = {
      ...extraConfig,
      method,
      url,
      data: body,
      headers: {
        'X-API-Key': config.api_key,
        'X-Tenant-Domain': config.tenant_domain,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(extraConfig.headers ?? {}),
      },
      timeout: 30000,
    };

    for (let attempt = 0; ; attempt++) {
      try {
        const response = await firstValueFrom(
          this.http.request<LdgEnvelope<T>>(reqConfig),
        );
        const env = response.data;
        if (!env.success) {
          // Biznes/envelope xatosi — bu vaqtinchalik emas, qayta urinmaymiz.
          this.logger.error(
            `LDG API xatosi (${method} ${path}): ${env.message ?? 'noma\'lum'}, request_id=${env.request_id}`,
          );
          throw new HttpException(
            env.message ?? 'LDG xatolik qaytardi',
            response.status,
          );
        }
        return env.data;
      } catch (err) {
        // Envelope biznes xatosi — qayta urinmaymiz.
        if (err instanceof HttpException) throw err;

        const axiosErr = err as AxiosError<Record<string, unknown>>;
        const status = axiosErr.response?.status;

        // Vaqtinchalik xatomi? (429/5xx yoki tarmoq uzilishi — status yo'q)
        const isRetryable = status
          ? RETRYABLE_STATUSES.includes(status)
          : true;

        if (isRetryable && attempt < MAX_RETRIES) {
          const retryAfter = axiosErr.response?.headers?.['retry-after'] as
            | string
            | undefined;
          const wait = this.backoffMs(attempt, retryAfter);
          this.logger.warn(
            `LDG ${method} ${path} ${status ?? 'tarmoq xatosi'} — ${wait}ms dan keyin qayta uriniladi (urinish ${attempt + 1}/${MAX_RETRIES})`,
          );
          await this.sleep(wait);
          continue;
        }

        // Urinishlar tugadi yoki xato vaqtinchalik emas — izchil xatoga aylantiramiz.
        throw this.toHttpException(axiosErr, method, path, body);
      }
    }
  }

  /** Backoff hisoblash: Retry-After (sekund) bo'lsa unga, aks holda eksponensialga. */
  private backoffMs(attempt: number, retryAfterHeader?: string): number {
    const retryAfter = Number(retryAfterHeader);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.min(retryAfter * 1000, MAX_BACKOFF_MS);
    }
    return Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS); // 1s, 2s, 4s, ...
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Axios xatosini LDG javob formatlarini hisobga olib HttpException ga aylantiradi. */
  private toHttpException(
    axiosErr: AxiosError<Record<string, unknown>>,
    method: string,
    path: string,
    body?: unknown,
  ): HttpException {
    const status = axiosErr.response?.status;
    const ldgEnv = (axiosErr.response?.data ?? {}) as Record<string, unknown>;

    // LDG xato javobi 2 ta formatda kelishi mumkin:
    //   1) Validation: { message, errors: { field: [msgs] } }
    //   2) Business:   { error: { code, message, details: { errors: [...] } } }
    const ldgError = (ldgEnv.error ?? null) as
      | {
          code?: string;
          message?: string;
          details?: { errors?: unknown };
        }
      | null;

    const message =
      ldgError?.message ??
      (typeof ldgEnv.message === 'string' ? ldgEnv.message : axiosErr.message);
    const reqId =
      typeof ldgEnv.request_id === 'string' ? ldgEnv.request_id : 'n/a';
    const errCode = ldgError?.code ? ` [${ldgError.code}]` : '';
    const errors = ldgError?.details?.errors ?? ldgEnv.errors;
    const errorsStr = errors ? `\n  errors=${JSON.stringify(errors)}` : '';

    this.logger.error(
      `LDG so'rov muvaffaqiyatsiz: ${method} ${path} - ${status ?? 'no-status'}${errCode} - ${message} (req=${reqId})${errorsStr}`,
    );

    // Body'ni ham log qilamiz (debug uchun) — sezgir maydonlar yo'q
    if (status === 422 && body) {
      this.logger.error(`LDG so'rov body (422 debug): ${JSON.stringify(body)}`);
    }

    if (status) {
      return new HttpException(message ?? 'LDG xatolik', status);
    }
    return new ServiceUnavailableException(
      `LDG bilan ulanish muvaffaqiyatsiz: ${message}`,
    );
  }
}
