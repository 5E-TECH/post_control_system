import { isIP } from 'node:net';

/**
 * CARRIER API — IP ALLOWLIST (yozishda tekshirish + so'rovda moslash).
 *
 * Elchi'dan ko'chirilgan (`libs/common/src/security/ip-allowlist-rule.ts` va
 * `apps/api-gateway/src/auth/ip-allowlist.util.ts`) — kontrakt ikkala tizimda
 * BIR XIL bo'lishi shart: kompaniya bitta ro'yxat beradi va u ikkala joyda
 * bir xil ishlashi kerak (CARRIER_API.md §2 "IP cheklovi").
 *
 * ── NEGA YOZISHDA TEKSHIRILADI ──────────────────────────────────────────
 *
 * Ro'yxat faqat `trim` qilinib saqlansa, moslovchi tushunmaydigan yozuv
 * (IPv6 CIDR, `1.2.3.4,5.6.7.8`, xato manzil, kanonik bo'lmagan IPv6
 * `2001:0db8::0001`) bazaga tushardi va HECH QACHON mos kelmasdi — operator
 * xato ko'rmasdi, kompaniya esa jimgina 403 olardi. Shu sabab har qoida
 * yozishda kanonik shaklga keltiriladi, tushunilmagani 400 bilan rad etiladi.
 *
 * ── NEGA SO'ROVDA HAM KANONIKLASHTIRILADI (Elchi'dan farq) ───────────────
 *
 * Elchi mijoz IP'sini Cloudflare'ning `CF-Connecting-IP` sarlavhasidan oladi
 * (u allaqachon kanonik). BeePost'da Cloudflare yo'q — IP `req.ip` dan
 * olinadi (`trust proxy 'loopback'` + nginx `X-Forwarded-For`), u esa
 * nginx yozgan shaklda keladi. Shuning uchun IPv6 mijoz manzili ham qoidalar
 * bilan bir xil kanonik shaklga keltirilib solishtiriladi.
 */

export const IP_ALLOWLIST_MAX_ENTRIES = 50;
const MAX_RULE_LENGTH = 64;

const stripMappedV4 = (value: string): string =>
  value.startsWith('::ffff:') && isIP(value.slice(7)) === 4
    ? value.slice(7)
    : value;

/** `isIP() === 4` dan o'tgan qiymat uchun — 32-bitli son. */
const ipv4ToIntUnsafe = (value: string): number =>
  value.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);

/** `::ffff:cb00:710a` (hex yozilgan IPv4-mapped) → `203.0.113.10`. */
const mappedHexToV4 = (canonical: string): string | null => {
  const m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
};

/**
 * Bitta qoidani kanonik shaklga keltiradi yoki `null` (tushunilmaydi).
 *
 * - IPv4: `203.0.113.10`
 * - IPv4 CIDR: `203.0.113.0/24` (0–32), faqat haqiqiy tarmoq manzili
 * - IPv6: kanonik qisqa shakl (`2001:0DB8::0001` → `2001:db8::1`)
 * - IPv4-mapped IPv6 (`::ffff:1.2.3.4`) → IPv4
 * - IPv6 CIDR — RAD: moslovchi uni qo'llab-quvvatlamaydi (kontrakt ham shunday).
 */
export function canonicalIpAllowlistRule(raw: unknown): string | null {
  const value = (typeof raw === 'string' ? raw : '').trim().toLowerCase();
  if (!value || value.length > MAX_RULE_LENGTH) return null;

  if (value.includes('/')) {
    const parts = value.split('/');
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) return null;
    const bits = Number(parts[1]);
    const network = stripMappedV4(parts[0]);
    if (isIP(network) !== 4 || bits < 0 || bits > 32) return null;
    /**
     * Host bitlari bo'lgan CIDR — RAD (`203.0.113.10/3` moslovchida
     * `192.0.0.0/3`, ya'ni IPv4'ning 1/8 qismi bo'lib ketardi, ro'yxatda esa
     * zararsiz ko'rinardi). Faqat haqiqiy tarmoq manzili qabul qilinadi.
     */
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((ipv4ToIntUnsafe(network) & mask) >>> 0 !== ipv4ToIntUnsafe(network)) {
      return null;
    }
    return `${network}/${bits}`;
  }

  const ip = stripMappedV4(value);
  const family = isIP(ip);
  if (family === 4) return ip;
  if (family === 6) {
    let canonical: string;
    try {
      canonical = new URL(`http://[${ip}]`).hostname.replace(/^\[|\]$/g, '');
    } catch {
      return null;
    }
    // Mijoz IP'sidagi `::ffff:` IPv4 ga aylantiriladi — qoida ham.
    if (canonical.startsWith('::ffff:')) return mappedHexToV4(canonical);
    // Eskirgan IPv4-compatible (`::203.0.113.10`) — hech qachon mos kelmaydi.
    if (/^::[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(canonical)) return null;
    return canonical;
  }
  return null;
}

/** Butun ro'yxat: kanonik qoidalar (takrorsiz) va tushunilmagan yozuvlar. */
export function normalizeIpAllowlistRules(list: readonly unknown[]): {
  rules: string[];
  invalid: string[];
} {
  const rules: string[] = [];
  const invalid: string[] = [];
  for (const item of list) {
    const text = typeof item === 'string' ? item.trim() : '';
    if (!text) continue;
    const rule = canonicalIpAllowlistRule(text);
    if (rule === null) {
      invalid.push(text.slice(0, MAX_RULE_LENGTH));
    } else if (!rules.includes(rule)) {
      rules.push(rule);
    }
  }
  return { rules, invalid };
}

/**
 * IPv4 ni 32-bitli songa aylantiradi; yaroqsiz bo'lsa `null`.
 *
 * `Number` emas, aniq tekshiruv: `Number('1e2')` 100 beradi, ya'ni
 * "1e2.0.0.1" kabi yozuv jimgina o'tib ketardi.
 */
function ipv4ToInt(value: string): number | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    result = result * 256 + n;
  }
  return result;
}

/**
 * So'rov IP'sini qoidalar bilan bir xil shaklga keltiradi.
 *
 * - `::ffff:203.0.113.10` → `203.0.113.10`. Node IPv4 ulanishni dual-stack
 *   soketda shunday beradi; xom solishtirilsa ro'yxatdagi `203.0.113.10` bilan
 *   MOS KELMASDI — to'g'ri sozlangan allowlist ham kompaniyani bloklardi.
 * - `203.0.113.10:5678` (portli IPv4) → `203.0.113.10`.
 * - IPv6 → kanonik qisqa shakl.
 * - Tushunilmagan qiymat — o'zgarishsiz (403 xabarida ko'rinsin), lekin u
 *   hech qaysi kanonik qoidaga teng bo'lmaydi.
 */
export function normalizeClientIp(value: unknown): string {
  const raw = (typeof value === 'string' ? value : '').trim().toLowerCase();
  if (!raw) return '';
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(raw);
  const ip = withPort ? withPort[1] : raw;
  // Mijoz manzili hech qachon diapazon bo'lmaydi.
  if (ip.includes('/')) return ip;
  return canonicalIpAllowlistRule(ip) ?? ip;
}

/** Bitta qoidaga moslik. Qoida — aniq IP yoki IPv4 CIDR. */
function matchesRule(ip: string, rawRule: string): boolean {
  const rule =
    canonicalIpAllowlistRule(rawRule) ?? rawRule.trim().toLowerCase();
  if (!rule) return false;

  if (!rule.includes('/')) {
    // Aniq moslik — IPv6 ham shu yo'l bilan (ikkalasi ham kanonik).
    return rule === ip;
  }

  const [network, bitsRaw] = rule.split('/');
  if (!/^\d{1,2}$/.test(bitsRaw ?? '')) return false;
  const bits = Number(bitsRaw);
  if (bits < 0 || bits > 32) return false;

  const netInt = ipv4ToInt(network);
  const ipInt = ipv4ToInt(ip);
  if (netInt === null || ipInt === null) return false;

  // `/0` — hammasi. `>>> 0` ishorasiz siljish: `<< 32` aniqlanmagan xulq.
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (netInt & mask) >>> 0 === (ipInt & mask) >>> 0;
}

/**
 * So'rov IP'si ruxsat etilganmi.
 *
 * ⚠️ RO'YXAT BO'SH/NULL — cheklov YO'Q (`true`). Ataylab: kompaniyalarning
 * ko'pchiligida statik IP bo'lmaydi; bo'sh ro'yxatni "hech kimga ruxsat yo'q"
 * deb tushunish ulanishni bir zumda o'chirib qo'yardi (kontrakt §2).
 *
 * ⚠️ IP ANIQLANMASA va ro'yxat BOR — `false`. Cheklov qo'yilgan joyda
 * "IP'ni bilmadim, o'tkazib yuboraman" degan xulq cheklovni ma'nosiz qilardi.
 */
export function isIpAllowed(
  clientIp: unknown,
  rules: readonly string[] | null | undefined,
): boolean {
  const list = (Array.isArray(rules) ? rules : []).filter(
    (item): item is string => typeof item === 'string' && !!item.trim(),
  );
  if (!list.length) return true;

  const ip = normalizeClientIp(clientIp);
  if (!ip) return false;

  return list.some((rule) => matchesRule(ip, rule));
}
