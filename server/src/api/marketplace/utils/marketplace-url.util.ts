import { BadRequestException } from '@nestjs/common';

/**
 * SSRF QO'RIQCHISI — chiquvchi manzilni tekshirish.
 *
 * ⚠️ REPODA BUNDAY QO'RIQCHI YO'Q. Bugungi holat: `external_integration.api_url`
 * va `auth_url` da URL validatsiyasi UMUMAN yo'q, `HttpModule` esa 5 ta
 * redirect'ni kuzatadi. Ya'ni ADMIN (SUPERADMIN emas) integratsiyani
 * `http://169.254.169.254/...` ga yo'naltirib, server ichki tarmog'iga
 * so'rov yubortira oladi.
 *
 * Marketplace ulanishida bunga yo'l qo'yilmaydi.
 */

/** Ichki/xizmat manzillari — hech qachon chiqmaslik kerak. */
const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS/GCP metadata
  'metadata.google.internal',
]);

/**
 * IPv6 LITERAL ichki manzilmi.
 *
 * ⚠️ `new URL()` IPv6 hostni kvadrat qavs bilan beradi (`[::1]`), ya'ni
 * BLOCKED_HOSTS dagi `::1` bilan taqqoslash ishlamaydi. Bundan tashqari
 * `::ffff:127.0.0.1` (IPv4-mapped), `fd00::/8` (unique local) va
 * `fe80::/10` (link-local) ham ichki.
 */
function isPrivateIpv6(hostRaw: string): boolean {
  const h = hostRaw.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h.includes(':')) return false;
  if (h === '::1' || h === '::') return true;
  /**
   * IPv4-mapped manzil IKKI shaklda bo'ladi:
   *   · `::ffff:127.0.0.1`  — foydalanuvchi yozgani
   *   · `::ffff:7f00:1`     — `new URL()` NORMALLASHTIRGANI (o'n oltilik)
   *
   * ⚠️ Faqat birinchisini tekshirgan edik, ikkinchisi esa qo'riqchidan
   * o'tib ketardi — ya'ni `https://[::ffff:127.0.0.1]` bilan loopback'ga
   * so'rov yuborish mumkin edi.
   */
  const dotted = /::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (dotted) return isPrivateIpv4(dotted[1]);

  const hex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    const ipv4 = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
    return isPrivateIpv4(ipv4);
  }
  // Unique local (fc00::/7) va link-local (fe80::/10)
  if (/^f[cd]/.test(h)) return true;
  if (/^fe[89ab]/.test(h)) return true;
  return false;
}

function isPrivateIpv4(host: string): boolean {
  // ⚠️ Oxiridagi nuqta olib tashlanadi: `127.0.0.1.` ham AYNI manzil,
  // lekin regex unga mos kelmasdi va tekshiruvdan o'tib ketardi.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(
    host.replace(/\.$/, ''),
  );
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  return false;
}

/**
 * @param allowLocal Lokal sinov uchun (mock server `localhost:4010`).
 *   Faqat `MARKETPLACE_ALLOW_LOCAL_URL=1` bo'lganda yoqiladi — prod'da
 *   hech qachon.
 */
export function assertOutboundUrlSafe(
  rawUrl: string,
  allowLocal = process.env.MARKETPLACE_ALLOW_LOCAL_URL === '1',
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException(`Manzil noto'g'ri: ${rawUrl}`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BadRequestException(
      `Faqat http/https ruxsat etiladi (kelgani: ${url.protocol})`,
    );
  }
  if (url.protocol === 'http:' && !allowLocal) {
    throw new BadRequestException(
      'Marketplace manzili HTTPS bo\'lishi shart (kontrakt §4 talabi)',
    );
  }
  // URL ichidagi login/parol — kalit sizib chiqishining oson yo'li.
  if (url.username || url.password) {
    throw new BadRequestException('Manzilda login/parol bo\'lmasligi kerak');
  }

  // ⚠️ Oxiridagi nuqta (`localhost.`) DNS'da AYNI nom — ro'yxatdan
  // o'tib ketmasligi uchun kesiladi.
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    !allowLocal &&
    (BLOCKED_HOSTS.has(host) ||
      isPrivateIpv4(host) ||
      isPrivateIpv6(url.hostname))
  ) {
    throw new BadRequestException(
      `Ichki manzilga so'rov yuborib bo'lmaydi: ${host}`,
    );
  }

  return url;
}

/** Bazaviy manzil va yo'lni xavfsiz birlashtiradi (qo'sh `/` bo'lmasin). */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
