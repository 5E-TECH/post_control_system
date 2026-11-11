import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  CARRIER_ERROR_CODES,
  CarrierPrincipal,
  carrierHttpError,
} from '../carrier-error-codes';
import {
  CarrierAccountService,
  CarrierKeyValidation,
} from '../carrier-account.service';
import { isIpAllowed, normalizeClientIp } from '../utils/ip-allowlist';

/**
 * Kalit yo'q va kalit noma'lum — AYNI matn (kontrakt §3: 401 "X-Api-Key yo'q
 * yoki yaroqsiz"). Ajratilsa tashqaridan qaysi kalit qachon o'chirilganini
 * taxmin qilish osonlashardi.
 */
export const CARRIER_INVALID_KEY_MESSAGE = "X-Api-Key yo'q yoki yaroqsiz";

/** Bizning kalit 68 belgi; bundan uzuni bazaga umuman bormaydi. */
const MAX_API_KEY_LENGTH = 256;

export interface CarrierGuardRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  /** Express: so'rovning ASL yo'li (query bilan) — routerlar o'zgartirmaydi. */
  originalUrl?: string;
  url?: string;
  carrier?: CarrierPrincipal;
}

/** Kanonik prefiksdagi oxirgi segment — nginx bloki `location /api/v1/carrier/`. */
const CARRIER_PATH_SEGMENT = '/carrier/';

/**
 * Yo'l KANONIKmi: `/carrier/` gacha bo'lgan qism (shu segment bilan) faqat
 * kichik harflarda (`/api/v1/carrier/...`).
 *
 * NEGA. Express marshrutlari registrga sezgir EMAS — `/api/v1/CARRIER/ping`
 * ham shu controllerga tushadi. nginx `location /api/v1/carrier/` esa
 * registrga sezgir prefiks: katta harfli yo'l umumiy `/api/` blokiga
 * tushadi. O'sha blok `X-Forwarded-For` ni qayta yozmasa, mijoz yuborgan
 * sarlavha o'zgarmay keladi va `trust proxy 'loopback'` uni `req.ip` qiladi
 * — IP ro'yxati soxta manzil bilan o'tib ketardi. Ilova nginx sozlamasiga
 * tayanmasin: kanonik bo'lmagan yo'l 404 (marshrut "yo'q"), hech qanday
 * kalit/baza ishi qilinmaydi. Kichik harfli yo'lning qolgan qismi
 * (`/carrier/PING`) xavfsiz — u baribir carrier blokiga tushadi.
 */
export function isCanonicalCarrierPath(
  request: Pick<CarrierGuardRequest, 'originalUrl' | 'url'> | undefined,
): boolean {
  const path = String(request?.originalUrl ?? request?.url ?? '').split('?')[0];
  const idx = path.toLowerCase().indexOf(CARRIER_PATH_SEGMENT);
  if (idx < 0) return false;
  const prefix = path.slice(0, idx + CARRIER_PATH_SEGMENT.length);
  return prefix === prefix.toLowerCase();
}

/** Kanonik bo'lmagan yo'l — 404 (kontrakt konverti filtrda: `trace_id`). */
export function assertCanonicalCarrierPath(
  request: Pick<CarrierGuardRequest, 'originalUrl' | 'url'> | undefined,
): void {
  if (!isCanonicalCarrierPath(request)) {
    throw carrierHttpError(
      404,
      "Yo'l topilmadi — Carrier API manzili faqat kichik harflarda: /api/v1/carrier/…",
    );
  }
}

/**
 * CARRIER API AUTENTIFIKATSIYASI (JWT EMAS) — `X-Api-Key: bpc_…`.
 *
 * Tartib (Elchi `carrier-api-key.guard.ts` bilan bir xil, kontrakt §2–§3):
 *   0. yo'l kanonik emas (`/api/v1/CARRIER/…`) → 404 (BeePost qo'shimchasi)
 *   1. kalit yo'q                         → 401
 *   2. kalitni tekshirib bo'lmadi (DB)     → 503 CARRIER_KEY_CHECK_UNAVAILABLE
 *   3. kalit topilmadi                    → 401 (1-band bilan AYNI matn)
 *   4. akkaunt o'chiq (`is_active=false`)   → 403
 *   5. IP ro'yxatda yo'q                   → 403 (aniqlangan IP xabarda)
 *   6. bog'langan kuryer faol emas         → 403 CARRIER_COURIER_INACTIVE
 *   7. `request.carrier` to'ldiriladi
 *
 * ⚠️ IP (5) kuryer holatidan (6) OLDIN: ruxsatsiz manzildan sizib chiqqan
 * kalit bilan kuryer faol-faol emasligini bilib bo'lmasin.
 *
 * ⚠️ MIJOZ IP — FAQAT `req.ip`. BeePost `trust proxy 'loopback'` bilan
 * ishlaydi: `req.ip` nginx carrier bloki yozgan `X-Forwarded-For` dagi
 * haqiqiy manzil, uzoqdagi mijoz uni soxtalashtira olmaydi — FAQAT kanonik
 * yo'lda (0-band). Elchi'dagi `CF-Connecting-IP`
 * KO'CHIRILMAGAN — BeePost oldida Cloudflare yo'q, ya'ni bu sarlavhani har
 * kim yozib, IP cheklovini aylanib o'ta olardi.
 *
 * ⚠️ 503 (2) — 401 EMAS: kontraktda 401 "kalit yaroqsiz, qayta urinmang".
 * Vaqtinchalik baza uzilishida kompaniya statuslarni tashlab yubormasin —
 * 503 "ayni Idempotency-Key bilan qayta urining" degani.
 */
@Injectable()
export class CarrierApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(CarrierApiKeyGuard.name);

  constructor(private readonly accounts: CarrierAccountService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CarrierGuardRequest>();

    // IP qarori (5-band) `req.ip` ga tayanadi — u faqat kanonik yo'lda
    // (nginx carrier bloki) ishonchli. `CarrierIpThrottlerGuard` ham buni
    // birinchi tekshiradi; bu yerda — guard tartibi o'zgarsa ham himoya.
    assertCanonicalCarrierPath(request);

    const apiKey = extractApiKey(request.headers);
    if (!apiKey) {
      throw carrierHttpError(401, CARRIER_INVALID_KEY_MESSAGE);
    }

    let validation: CarrierKeyValidation | null;
    try {
      validation = await this.accounts.validateKey(apiKey);
    } catch (err) {
      this.logger.error(
        `carrier kalitini tekshirib bo'lmadi: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
      throw carrierHttpError(
        503,
        "API kalitni tekshirib bo'lmadi — birozdan keyin qayta urining",
        CARRIER_ERROR_CODES.KEY_CHECK_UNAVAILABLE,
      );
    }

    if (!validation) {
      throw carrierHttpError(401, CARRIER_INVALID_KEY_MESSAGE);
    }
    const { account, courierActive } = validation;

    if (!account.is_active) {
      throw carrierHttpError(403, 'Carrier akkaunt faol emas');
    }

    if (!isIpAllowed(request.ip, account.ip_allowlist)) {
      throw carrierHttpError(
        403,
        `IP ruxsat etilmagan: ${normalizeClientIp(request.ip) || 'aniqlanmadi'}`,
      );
    }

    if (!courierActive) {
      throw carrierHttpError(
        403,
        "Bog'langan kuryer faol emas — BeePost operatoriga murojaat qiling",
        CARRIER_ERROR_CODES.COURIER_INACTIVE,
      );
    }

    request.carrier = {
      id: account.id,
      name: account.name,
      courier_user_id: account.courier_user_id,
    };
    this.accounts.touchLastUsed(account.id);
    return true;
  }
}

/** `x-api-key` (Node sarlavhalarni kichik harfda beradi), bo'shliqsiz. */
function extractApiKey(
  headers: CarrierGuardRequest['headers'] | undefined,
): string | null {
  const raw = headers?.['x-api-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (!key || key.length > MAX_API_KEY_LENGTH) return null;
  return key;
}
