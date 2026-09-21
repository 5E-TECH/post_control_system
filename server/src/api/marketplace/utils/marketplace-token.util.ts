import { normalizeQrToken } from 'src/infrastructure/lib/qr-token/normalize';

/**
 * MARKETPLACE QR TOKENINI NORMALIZATSIYA QILISH VA TEKSHIRISH.
 *
 * ⚠️ NEGA MAVJUD `normalizeQrToken` QAYTA ISHLATILADI, YANGISI YOZILMAYDI.
 * Biz saqlaydigan token keyinchalik BOSHQA skanerlar tomonidan qidiriladi:
 * kuryer skaneri (`receiveOrderByQrTokenForCourier`), pochta skaneri
 * (`checkPost`), bekor pochta skaneri. Ularning hammasi `normalizeQrToken`
 * bilan normalizatsiya qilib qidiradi.
 *
 * Agar bu yerda boshqacha normalizatsiya qilsak, posilka bazada TURADI,
 * lekin hech bir skaner uni TOPA OLMAYDI — ya'ni buyurtma abadiy
 * qotib qoladi. Reja §15 #5 dagi aynan shu tuzoq.
 *
 * Qo'shimcha: kontrakt token SHAKLINI ham belgilaydi (§4.2) —
 * `[A-Za-z0-9_-]`, 6–64 belgi. Shakl tekshiruvi axlat skanni ombordayoq
 * to'sadi, ularning API'siga behuda so'rov ketmaydi.
 */

/** Kontrakt §4.2: token uzunligi chegarasi. */
export const MP_TOKEN_MIN_LENGTH = 6;
export const MP_TOKEN_MAX_LENGTH = 64;

/**
 * Normalizatsiyadan KEYIN ruxsat etilgan belgilar.
 * `normalizeQrToken` lowercase qilgani uchun bu yerda katta harf yo'q.
 */
const ALLOWED = /^[a-z0-9_-]+$/;

export interface MarketplaceTokenCheck {
  /** Yorliqdagi ASL qiymat — ularga qaytarilganda aynan shu yuboriladi. */
  raw: string;
  /** Normalizatsiyalangan — bazaga shu yoziladi va skanerlar shuni qidiradi. */
  norm: string;
  valid: boolean;
  /** `valid: false` bo'lsa — operatorga ko'rsatiladigan sabab. */
  reason: string | null;
}

export function checkMarketplaceToken(
  input: string | null | undefined,
): MarketplaceTokenCheck {
  const raw = String(input ?? '').trim();
  const norm = normalizeQrToken(raw);

  if (!norm) {
    return { raw, norm, valid: false, reason: "QR kod bo'sh" };
  }
  if (norm.length < MP_TOKEN_MIN_LENGTH) {
    return {
      raw,
      norm,
      valid: false,
      reason: `QR kod juda qisqa (${norm.length} belgi, kamida ${MP_TOKEN_MIN_LENGTH} kerak)`,
    };
  }
  if (norm.length > MP_TOKEN_MAX_LENGTH) {
    return {
      raw,
      norm,
      valid: false,
      reason: `QR kod juda uzun (${norm.length} belgi, ko'pi ${MP_TOKEN_MAX_LENGTH})`,
    };
  }
  if (!ALLOWED.test(norm)) {
    return {
      raw,
      norm,
      valid: false,
      reason: "QR kodda ruxsat etilmagan belgi bor (faqat harf, raqam, `-`, `_`)",
    };
  }

  return { raw, norm, valid: true, reason: null };
}
