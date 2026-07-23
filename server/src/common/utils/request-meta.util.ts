import { Request } from 'express';

/**
 * So'rov (HTTP request) kontekstidan audit uchun kerakli metama'lumotlarni
 * (haqiqiy mijoz IP manzili, User-Agent, mijoz yuborgan qurilma ID/nomi) ajratadi.
 *
 * Bu YAGONA manba — login oqimi ham, boshqa har qanday amal ham shu yordamchidan
 * foydalanishi kerak, aks holda IP/qurilma turli joyda turlicha olinadi.
 */

/**
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`) va IPv6 loopback (`::1`) ni oddiy IPv4
 * ko'rinishiga keltiradi. Loglar toza va taqqoslanadigan bo'lishi uchun.
 */
export function normalizeIp(ip: string): string {
  if (!ip) return '';
  let v = ip.trim();
  const lower = v.toLowerCase();
  if (lower.startsWith('::ffff:')) v = v.slice(7); // ::ffff:1.2.3.4 -> 1.2.3.4
  if (v === '::1') v = '127.0.0.1';
  return v;
}

function isLoopback(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.');
}

/**
 * Reverse-proxy (nginx) orqasidagi HAQIQIY mijoz IP manzilini oladi.
 *
 * MUHIM: bootstrap'da `app.set('trust proxy', 'loopback')` o'rnatilgani uchun
 * Express `req.ip` X-Forwarded-For zanjiridagi to'g'ri (soxtalashtirib
 * bo'lmaydigan) mijoz manzilini qaytaradi — chunki faqat loopback (nginx)
 * hop'iga ishoniladi. Zaxira sifatida nginx yuborishi mumkin bo'lgan
 * `X-Real-IP` va X-Forwarded-For'ning ENG O'NGDAGI (nginx qo'shgan, ishonchli)
 * qiymati ham tekshiriladi.
 *
 * ⚠️ Agar nginx `X-Forwarded-For` yoki `X-Real-IP` header'ini UMUMAN yubormasa,
 * IP baribir loopback bo'lib qoladi — bu kod emas, nginx sozlamasi muammosi.
 */
export function getClientIp(req?: Request): string {
  if (!req) return '';
  const headers = (req.headers || {}) as Record<
    string,
    string | string[] | undefined
  >;

  const candidates: string[] = [];

  // 1) Express hisoblab bergan IP (trust proxy 'loopback' bilan — eng ishonchli).
  const reqIp = (req as any).ip as string | undefined;
  if (reqIp) candidates.push(reqIp);

  // 2) nginx `X-Real-IP` — bitta qiymat, to'g'ridan-to'g'ri $remote_addr'dan.
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) candidates.push(realIp);

  // 3) `X-Forwarded-For` — ENG O'NGDAGI qiymat nginx qo'shgan haqiqiy peer'dir.
  //    Eng CHAPDAGI qiymatni mijoz o'zi soxtalashtirishi mumkin — ishlatilmaydi.
  const xff = headers['x-forwarded-for'];
  const xffStr = Array.isArray(xff) ? xff.join(',') : xff;
  if (xffStr) {
    const parts = xffStr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length) candidates.push(parts[parts.length - 1]);
  }

  // Loopback bo'lmagan birinchi manzilni qaytaramiz (haqiqiy mijoz).
  for (const raw of candidates) {
    const norm = normalizeIp(raw);
    if (norm && !isLoopback(norm)) return norm;
  }

  // Hammasi loopback bo'lsa (nginx real-IP yubormayapti) — bor qiymatni beramiz.
  return candidates.length ? normalizeIp(candidates[0]) : '';
}

export interface RequestMeta {
  ip: string;
  user_agent: string;
  /** Mijoz (frontend) yuboradigan barqaror qurilma identifikatori (localStorage UUID). */
  device_id?: string;
  /**
   * Ixtiyoriy, inson o'qiy oladigan qurilma nomi (`X-Device-Name`).
   * ⚠️ Hozircha frontend BUNI YUBORMAYDI — qurilma yorlig'i UI'da `user_agent`'dan
   * hosil qilinadi ("Mobil · macOS · Safari"). Bu maydon kelajakda foydalanuvchi
   * o'zi nomlaydigan qurilmalar uchun tayyor turadi (mavjud bo'lsagina saqlanadi).
   */
  device_name?: string;
}

/** Bitta joydan header'larni o'qiydigan yagona yordamchi (URL-encoded qiymatlarni dekodlaydi). */
function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = headers[name];
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (!val) return undefined;
  // Frontend non-ASCII (kirill/o'zbekcha) qiymatlarni encodeURIComponent bilan
  // yuboradi — header'lar faqat latin1'ni qo'llagani uchun.
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

/**
 * Audit-log metama'lumotini bitta joyda yig'adi: IP, User-Agent va (agar mijoz
 * yuborsa) qurilma ID/nomi. Login oqimi ham, kelajakdagi request-kontekst
 * (AsyncLocalStorage) ham shu yordamchidan foydalanishi kerak.
 */
export function extractRequestMeta(req?: Request): RequestMeta {
  if (!req) return { ip: '', user_agent: '' };
  const headers = (req.headers || {}) as Record<
    string,
    string | string[] | undefined
  >;
  return {
    ip: getClientIp(req),
    user_agent: (headers['user-agent'] as string) || '',
    device_id: readHeader(headers, 'x-device-id'),
    device_name: readHeader(headers, 'x-device-name'),
  };
}
