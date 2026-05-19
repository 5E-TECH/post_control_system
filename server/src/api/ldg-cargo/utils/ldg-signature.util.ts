import { createHmac, timingSafeEqual } from 'crypto';

/**
 * X-FCargo-Signature header parsing.
 * Format: `t=TIMESTAMP,d=DELIVERY_ID,v1=HMAC_HEX,v2=HMAC_HEX`
 *
 * - `t`  — Unix timestamp (sek), 5 daqiqa tolerance bilan tekshiriladi
 * - `d`  — delivery ID (X-FCargo-Delivery-ID bilan bir xil)
 * - `v1` — joriy secret bilan imzolangan HMAC hex
 * - `v2` — eski secret bilan imzolangan HMAC hex (key rotation davrida)
 */
export interface ParsedSignature {
  t: string | undefined;
  d: string | undefined;
  v1: string | undefined;
  v2: string | undefined;
}

export function parseSignatureHeader(header: string): ParsedSignature {
  const parts: ParsedSignature = {
    t: undefined,
    d: undefined,
    v1: undefined,
    v2: undefined,
  };
  if (!header) return parts;

  for (const kv of header.split(',')) {
    const trimmed = kv.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key === 't' || key === 'd' || key === 'v1' || key === 'v2') {
      parts[key] = value;
    }
  }
  return parts;
}

/**
 * Imzo tekshirish natijasi.
 *
 * `valid: false, reason: ...` qaytsa controller 401 qaytaradi va webhook log da
 * status='invalid_signature' deb saqlaydi.
 */
export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * X-FCargo-Signature ni tekshiradi.
 *
 * Algoritm (PHP referensidan ko'chirildi):
 *   base = `${t}.${d}.${rawBody}`
 *   v1   = hmac_sha256(currentSecret, base)
 *   v2   = hmac_sha256(previousSecret, base)
 *
 * Joriy secret va eski secret (rotatsiya davrida) — har ikkalasini ham sinaymiz.
 */
export function verifyLdgSignature(
  rawBody: string,
  signatureHeader: string,
  deliveryIdHeader: string,
  currentSecret: string,
  previousSecret: string | null,
): VerifyResult {
  const sig = parseSignatureHeader(signatureHeader);

  if (!sig.t || !sig.d || (!sig.v1 && !sig.v2)) {
    return { valid: false, reason: 'Sarlavha to\'liq emas' };
  }

  // delivery_id header bilan signature ichidagi `d` mos kelishi shart
  if (sig.d !== deliveryIdHeader) {
    return { valid: false, reason: 'delivery_id mos kelmadi' };
  }

  // Timestamp 5 daqiqa ichida bo'lishi shart (replay attack himoyasi)
  const tNum = Number(sig.t);
  if (!Number.isFinite(tNum)) {
    return { valid: false, reason: 'timestamp noto\'g\'ri' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tNum) > SIGNATURE_TOLERANCE_SECONDS) {
    return { valid: false, reason: 'timestamp eskirgan (5 daqiqadan oshgan)' };
  }

  // Base string: t.d.payload
  const base = `${sig.t}.${sig.d}.${rawBody}`;

  // v1 ni joriy secret bilan tekshirish
  if (sig.v1 && currentSecret) {
    const expected = createHmac('sha256', currentSecret).update(base).digest('hex');
    if (safeEqualHex(expected, sig.v1)) {
      return { valid: true };
    }
  }

  // v2 ni eski secret bilan tekshirish (key rotation davri)
  if (sig.v2 && previousSecret) {
    const expected = createHmac('sha256', previousSecret).update(base).digest('hex');
    if (safeEqualHex(expected, sig.v2)) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'imzo mos kelmadi' };
}

/**
 * Timing-safe hex string solishtirish.
 *
 * `crypto.timingSafeEqual` Buffer'lar uzunligi farq qilsa exception tashlaydi —
 * shuning uchun avval uzunlikni tekshiramiz.
 */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
