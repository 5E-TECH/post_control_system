import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { ValueTransformer } from 'typeorm';

/**
 * SEKRETLARNI BAZADA SHIFRLANGAN HOLDA SAQLASH (AES-256-GCM).
 *
 * NEGA KERAK. Bugungi holat: `external_integration.api_key`, `password`,
 * `elchi_config.api_key`, `webhook_secret` — hammasi OCHIQ MATN `varchar`.
 * `GET /external-integration/active` ularni TO'LIQ qaytaradi va bu endpoint
 * REGISTRATOR roliga ham ochiq. Ya'ni hamkor kaliti bazaga kirish huquqi
 * bo'lgan HAR KIMGA va API javobiga ochiq.
 *
 * Marketplace integratsiyasida bu qabul qilinmaydi: kalit bilan ularning
 * tizimiga yozish mumkin (posilka qabul qilish, hodisa yuborish).
 *
 * ⚠️ NEGA GCM, CBC EMAS. GCM autentifikatsiyalangan: shifrmatn o'zgartirilsa
 * deshifrlash XATO beradi. CBC'da o'zgartirilgan shifrmatn jimgina axlat
 * qaytaradi va u kalit sifatida ishlatilib, tushunarsiz 401 larga olib kelardi.
 *
 * Format: `v1:<iv_base64>:<tag_base64>:<ciphertext_base64>`
 * Versiya prefiksi — kelajakda kalit/algoritm almashtirilsa eski qatorlarni
 * tanib olish uchun (migratsiyasiz o'tish).
 */

const ALGO = 'aes-256-gcm';
const PREFIX = 'v1';
const IV_LEN = 12; // GCM uchun tavsiya etilgan uzunlik

/**
 * Shifrlash kaliti. `MARKETPLACE_SECRET_KEY` (yoki umumiy `SECRET_ENC_KEY`)
 * ENV dan olinadi va SHA-256 bilan 32 baytga keltiriladi.
 *
 * ⚠️ Kalit yo'q bo'lsa — `null` qaytariladi va transformer shifrlamaydi
 * (ochiq matn saqlaydi + ogohlantirish). Bu ATAYLAB: kalitsiz server
 * ko'tarilmasligi butun tizimni yiqitardi, holbuki muammo faqat bitta
 * integratsiyaga tegishli. Kalit yo'qligi sozlash ekranida ko'rsatiladi.
 */
function resolveKey(): Buffer | null {
  const raw =
    process.env.MARKETPLACE_SECRET_KEY || process.env.SECRET_ENC_KEY || '';
  if (!raw || raw.trim().length < 16) return null;
  return createHash('sha256').update(raw.trim()).digest();
}

let warned = false;
function warnOnce(): void {
  if (warned) return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn(
    '[encrypted.transformer] MARKETPLACE_SECRET_KEY o\'rnatilmagan — ' +
      'sekretlar OCHIQ MATN saqlanadi. Ishga tushirishdan oldin .env ga qo\'shing.',
  );
}

export function encryptSecret(plain: string): string {
  const key = resolveKey();
  if (!key) {
    warnOnce();
    return plain;
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  // Shifrlanmagan (eski yoki kalitsiz yozilgan) qiymat — o'zini qaytaradi.
  if (!stored.startsWith(`${PREFIX}:`)) return stored;

  const key = resolveKey();
  if (!key) {
    warnOnce();
    // Shifrlangan qiymat bor, lekin kalit yo'q — jimgina axlat qaytarishdan
    // ko'ra ochiq xato yaxshi (aks holda 401 sababini hech kim topa olmaydi).
    throw new Error(
      'Sekret shifrlangan, lekin MARKETPLACE_SECRET_KEY o\'rnatilmagan',
    );
  }

  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error('encrypted.transformer: format buzilgan');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * TypeORM ustun transformeri.
 *
 * ⚠️ `null` va bo'sh satr SHIFRLANMAYDI — aks holda "sekret yo'q" holati
 * "sekret bor, lekin bo'sh" ga aylanardi va sozlash tekshiruvlari
 * (`api_key IS NOT NULL`) noto'g'ri ishlardi.
 */
export const encryptedTransformer: ValueTransformer = {
  to: (value: string | null | undefined): string | null => {
    if (value === null || value === undefined || value === '') return null;
    return encryptSecret(String(value));
  },
  from: (value: string | null | undefined): string | null => {
    if (value === null || value === undefined || value === '') return null;
    return decryptSecret(String(value));
  },
};
