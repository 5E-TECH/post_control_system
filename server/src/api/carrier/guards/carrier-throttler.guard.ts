import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import { createHash } from 'crypto';
import config from 'src/config';

/** Sukut: daqiqasiga 120 so'rov — BUTUN carrier akkaunti uchun (kontrakt §2). */
export const CARRIER_THROTTLE_DEFAULT_LIMIT = 120;
export const CARRIER_THROTTLE_DEFAULT_TTL_MS = 60_000;

const positiveIntOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? value
    : fallback;

/**
 * Amaldagi limit — HAR SO'ROVDA config'dan o'qiladi (modul yuklanishida
 * qotib qolmaydi). Config qiymati allaqachon tekshirilgan
 * (`positiveIntEnv`), bu yerdagi tekshiruv — ikkinchi devor: noto'g'ri son
 * throttler'da 0 (hamma 429) yoki NaN (500) bo'lib ketmasin.
 */
export const carrierThrottleLimit = (): number =>
  positiveIntOr(config.CARRIER_THROTTLE_LIMIT, CARRIER_THROTTLE_DEFAULT_LIMIT);
export const carrierThrottleTtlMs = (): number =>
  positiveIntOr(
    config.CARRIER_THROTTLE_TTL_MS,
    CARRIER_THROTTLE_DEFAULT_TTL_MS,
  );

/**
 * Controller uchun `@Throttle(CARRIER_THROTTLE)` — Elchi bilan bir xil
 * (resolvable qiymatlar, throttler 6.5.0 `resolveValue` ularni har so'rovda
 * chaqiradi). Guard limitni baribir o'zi qo'llaydi (pastda), dekorator
 * hujjat va Elchi bilan moslik uchun.
 */
export const CARRIER_THROTTLE = {
  default: { limit: carrierThrottleLimit, ttl: carrierThrottleTtlMs },
};

/**
 * PER-CARRIER RATE LIMIT (Elchi `carrier-throttler.guard.ts` porti).
 *
 * So'rov `request.carrier.id` bo'yicha sanaladi — bir kompaniyaning limiti
 * boshqasiga ta'sir qilmaydi. Shuning uchun guard `CarrierApiKeyGuard` dan
 * KEYIN turishi shart (`@UseGuards(CarrierApiKeyGuard, CarrierThrottlerGuard)`).
 * Carrier aniqlanmagan bo'lsa (nazariy) — `req.ip`: BeePost'da u
 * `trust proxy 'loopback'` tufayli soxtalashtirib bo'lmaydigan manzil.
 *
 * ⚠️ KALIT ENDPOINTSIZ. Standart `generateKey` —
 * `${Class}-${handler}-${name}-${tracker}`, ya'ni har endpoint o'z
 * 120/min savatiga ega bo'lardi (6 endpoint ≈ 720/min), kontraktda esa
 * "akkaunt uchun 120/min, barcha endpointlar birgalikda". Endi bitta
 * carrier — bitta savat.
 *
 * ⚠️ LIMIT GUARD ICHIDA MAJBURLANADI (`handleRequest`). PCS'da
 * `ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])` global sukuti bor;
 * controllerdagi `@Throttle` unutilsa yoki bitta handler boshqa qiymat bersa,
 * umumiy savatga ikki xil limit tushardi. Shu sabab limit/ttl doim config'dan.
 *
 * Xotiradagi saqlash (throttler sukuti) — bitta PCS jarayoni uchun to'g'ri;
 * bir nechta instansiyada har biri o'z hisobini yuritadi (hujjatlangan xavf).
 */
@Injectable()
export class CarrierThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const carrierId = (req as { carrier?: { id?: string } })?.carrier?.id;
    if (carrierId) {
      return Promise.resolve(`carrier-${carrierId}`);
    }
    const ip = (req as { ip?: string })?.ip;
    return Promise.resolve(ip ? `ip-${ip}` : 'unknown');
  }

  protected generateKey(
    _context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    return createHash('sha256')
      .update(`CarrierApi-${name}-${suffix}`)
      .digest('hex');
  }

  protected handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const ttl = carrierThrottleTtlMs();
    return super.handleRequest({
      ...requestProps,
      limit: carrierThrottleLimit(),
      ttl,
      blockDuration: ttl,
    });
  }
}
