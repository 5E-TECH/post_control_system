import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { createHash } from 'crypto';
import config from 'src/config';
import { normalizeClientIp } from '../utils/ip-allowlist';
import { assertCanonicalCarrierPath } from './carrier-api-key.guard';
import { carrierThrottleTtlMs } from './carrier-throttler.guard';

/** Sukut: bitta IP'dan daqiqasiga 600 so'rov (barcha `/carrier/*`, kalitdan oldin). */
export const CARRIER_IP_THROTTLE_DEFAULT_LIMIT = 600;

/**
 * Amaldagi limit — HAR SO'ROVDA config'dan (akkaunt limiti bilan bir xil
 * naqsh). Noto'g'ri qiymat throttler'da 0 (hamma 429) yoki NaN (500) bo'lib
 * ketmasin — ikkinchi devor.
 */
export const carrierIpThrottleLimit = (): number => {
  const value = config.CARRIER_IP_THROTTLE_LIMIT;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? value
    : CARRIER_IP_THROTTLE_DEFAULT_LIMIT;
};

/**
 * AUTENTIFIKATSIYADAN OLDINGI LIMIT — bitta IP, barcha carrier endpointlari.
 *
 * NEGA. `CarrierThrottlerGuard` akkaunt bo'yicha sanaydi, ya'ni kalit
 * guard'idan KEYIN turadi: kalitsiz yoki noto'g'ri kalitli so'rov 401/403
 * bilan undan oldin qaytadi va HECH QACHON 429 olmaydi. PCS'da global
 * (`APP_GUARD`) throttler yo'q (`app.module.ts`), Elchi'da esa bor
 * (`ClientIpThrottlerGuard`). Natija: tasodifiy `bpc_…` kalitlar oqimi
 * har so'rovda sha256 + bazaga so'rov + WARN log qatori yozdirardi
 * (log fayli aylantirilmaydi). Shu guard birinchi turadi:
 * `@UseGuards(CarrierIpThrottlerGuard, CarrierApiKeyGuard, CarrierThrottlerGuard)`.
 *
 * Limit akkaunt limitidan ancha katta (sukut 600/daq): bitta chiquvchi IP
 * ortida bir nechta akkaunt bo'lishi mumkin; qonuniy provayder bu chegaraga
 * akkaunt limiti (120) tufayli yetmaydi.
 *
 * Avval yo'l kanonikligi tekshiriladi (`assertCanonicalCarrierPath`): katta
 * harfli yo'l nginx carrier blokini chetlab o'tadi va `req.ip` soxta
 * bo'lishi mumkin — har soxta IP uchun alohida savat ochilib limit
 * aylanib o'tilmasin.
 *
 * Kalit `CarrierApi-…` savatidan alohida (`CarrierApiIp-…`), saqlash —
 * throttler xotirasi (bitta jarayon, hujjatlangan R6 xavfi).
 */
@Injectable()
export class CarrierIpThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    assertCanonicalCarrierPath(context.switchToHttp().getRequest());
    return super.canActivate(context);
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const ip = normalizeClientIp((req as { ip?: string })?.ip);
    return Promise.resolve(`ip-${ip || 'unknown'}`);
  }

  protected generateKey(
    _context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    return createHash('sha256')
      .update(`CarrierApiIp-${name}-${suffix}`)
      .digest('hex');
  }

  protected handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const ttl = carrierThrottleTtlMs();
    return super.handleRequest({
      ...requestProps,
      limit: carrierIpThrottleLimit(),
      ttl,
      blockDuration: ttl,
    });
  }
}
