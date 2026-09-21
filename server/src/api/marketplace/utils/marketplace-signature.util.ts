import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * CHIQUVCHI SO'ROVNI IMZOLASH (kontrakt §3.2).
 *
 *   base_string = "{t}.{raw_body}"
 *   signature   = HMAC_SHA256(secret, base_string)  → kichik harfli hex
 *   header      = "t={t},v1={sig}[,v2={sig_eski}]"
 *
 * ⚠️ `raw_body` — TANANING XOM SATRI. JSON'ni parse qilib qayta
 * `stringify` qilish MUMKIN EMAS: bitta probel farq qilsa imzo mos
 * kelmaydi. Shuning uchun chaqiruvchi avval `JSON.stringify` qiladi va
 * AYNI SATRNI ham imzolashga, ham tanaga beradi.
 *
 * ⚠️ PCS hozirgacha HECH NARSA imzolamaydi — Elchi'da HMAC faqat KIRUVCHI
 * tomonda. Bu yangi imkoniyat.
 */

export interface SignedHeaders {
  'X-BeePost-Signature': string;
  'X-Request-Id': string;
}

export function buildSignatureHeader(
  secret: string,
  rawBody: string,
  opts?: { previousSecret?: string | null; nowSec?: number },
): string {
  const t = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const base = `${t}.${rawBody}`;
  const v1 = createHmac('sha256', secret).update(base).digest('hex');

  // Ikki kalitli aylantirish oynasi: eski kalit ham qo'shiladi, shunda
  // ular qaysi biriga o'tganidan qat'i nazar imzo qabul qilinadi.
  if (opts?.previousSecret) {
    const v2 = createHmac('sha256', opts.previousSecret)
      .update(base)
      .digest('hex');
    return `t=${t},v1=${v1},v2=${v2}`;
  }
  return `t=${t},v1=${v1}`;
}

/**
 * KIRUVCHI imzoni tekshirish.
 *
 * ⚠️ v1 da ular bizga YOZMAYDI (qaror O5) — shuning uchun bu funksiya
 * hozircha faqat O'Z imzomizni sinovda tekshirish uchun ishlatiladi.
 * Kelajakda kiruvchi kanal ochilsa tayyor turadi.
 */
export function verifySignatureHeader(
  header: string | null | undefined,
  rawBody: string,
  secrets: Array<string | null | undefined>,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
): { ok: boolean; reason: string | null } {
  if (!header) return { ok: false, reason: 'imzo sarlavhasi yo\'q' };

  const parts: Record<string, string> = {};
  for (const kv of header.split(',')) {
    const i = kv.indexOf('=');
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }

  const t = Number(parts.t);
  if (!Number.isFinite(t)) return { ok: false, reason: '`t` yo\'q yoki son emas' };

  const drift = Math.abs(nowSec - t);
  if (drift > toleranceSec) {
    return { ok: false, reason: `vaqt oynasidan tashqarida (${drift}s)` };
  }

  const base = `${t}.${rawBody}`;

  // ⚠️ HAR SEKRET HAR MAYDONGA qarshi tekshiriladi (`v1` VA `v2`), pozitsiya
  // bo'yicha EMAS.
  //
  // Nega muhim — lokal e2e sinovda aynan shu xato topilgan. Pozitsion
  // tekshiruvda (`secrets[0] → v1`, `secrets[1] → v2`) aylantirish
  // ISHLAMAYDI: jo'natuvchi yangi kalitni `v1` ga, eskisini `v2` ga qo'yadi,
  // qabul qiluvchi esa hali faqat ESKI kalitni biladi va uni `v1` ga qarshi
  // solishtirib rad etadi. Aylantirishning butun maqsadi — tomonlar
  // BIR VAQTDA kalit almashtirmasligi; pozitsion tekshiruv shuni buzadi.
  //
  // Narxi: ko'pi bilan 2 sekret × 2 maydon = 4 ta HMAC. E'tiborsiz.
  const fields = ['v1', 'v2'];
  for (const secret of secrets) {
    if (!secret) continue;
    const want = createHmac('sha256', secret).update(base).digest('hex');
    const b = Buffer.from(want, 'hex');
    for (const field of fields) {
      const given = parts[field];
      if (!given) continue;
      let a: Buffer;
      try {
        a = Buffer.from(given, 'hex');
      } catch {
        continue;
      }
      // Doimiy vaqtli taqqoslash — imzo uzunligi bo'yicha sizib chiqmasin.
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return { ok: true, reason: null };
      }
    }
  }
  return { ok: false, reason: 'imzo mos kelmadi' };
}
