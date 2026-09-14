import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Elchi chiquvchi webhook imzosini tekshirish.
 *
 * ALGORITM (Elchi kodidan tasdiqlangan — `libs/common/src/webhook/hmac.ts`):
 *
 *   signature = HMAC_SHA256(secret, rawBody).hex()
 *   header    = `X-Elchi-Signature: <signature>`
 *
 * LDG'dan FARQI: sxema ancha sodda — `t=`/`d=`/`v1=` qismlari YO'Q, timestamp
 * ham YO'Q. Ya'ni **imzoning o'zi takror (replay) himoyasini bermaydi**:
 * o'zgarmagan so'rovni cheksiz qayta yuborsa bo'ladi.
 *
 * Shu bois takror himoyasi BOSHQA qatlamda: `elchi_webhook_log.event_id`
 * PRIMARY KEY (Elchi payloadida keladigan UUID). Imzo faqat "kim yubordi"
 * savoliga javob beradi.
 *
 * XOM TANA MAJBURIY: imzo aynan Elchi yuborgan baytlar ustidan hisoblanadi.
 * `JSON.parse` → `JSON.stringify` aylanishi kalit tartibini yoki bo'shliqni
 * o'zgartirishi mumkin va hash boshqa chiqadi. Shuning uchun webhook yo'li
 * uchun `express.raw()` sozlanadi (`app.service.ts`).
 */
export interface ElchiVerifyResult {
  valid: boolean;
  reason?: string;
  /** Rotatsiya oynasida eski sekret bilan to'g'ri chiqdi — monitoring uchun. */
  usedPreviousSecret?: boolean;
}

export function verifyElchiSignature(
  rawBody: string,
  signatureHeader: string,
  currentSecret: string | null,
  previousSecret: string | null,
): ElchiVerifyResult {
  const provided = String(signatureHeader ?? '')
    .trim()
    // Ba'zi tizimlar `sha256=` prefiksi bilan yuboradi — bardoshli bo'lamiz.
    .replace(/^sha256=/i, '');

  if (!provided) {
    return { valid: false, reason: "imzo sarlavhasi yo'q" };
  }
  if (!currentSecret && !previousSecret) {
    return { valid: false, reason: 'webhook sekreti sozlanmagan' };
  }

  if (currentSecret) {
    const expected = createHmac('sha256', currentSecret)
      .update(rawBody, 'utf8')
      .digest('hex');
    if (safeEqualHex(expected, provided)) {
      return { valid: true };
    }
  }

  // Kalit rotatsiyasi oynasi — eski sekret bilan ham sinaymiz.
  if (previousSecret) {
    const expected = createHmac('sha256', previousSecret)
      .update(rawBody, 'utf8')
      .digest('hex');
    if (safeEqualHex(expected, provided)) {
      return { valid: true, usedPreviousSecret: true };
    }
  }

  return { valid: false, reason: 'imzo mos kelmadi' };
}

/**
 * Timing-safe hex solishtirish.
 *
 * `timingSafeEqual` uzunliklar farq qilsa exception tashlaydi — avval uzunlikni
 * tekshiramiz. Hex bo'lmagan satr `Buffer.from(..., 'hex')`da jimgina qisqaradi,
 * shuning uchun formatni ham tekshiramiz.
 */
function safeEqualHex(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  if (!/^[0-9a-f]+$/i.test(provided)) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex'),
    );
  } catch {
    return false;
  }
}
