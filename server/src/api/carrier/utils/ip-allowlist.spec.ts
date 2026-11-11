/// <reference types="jest" />
import {
  IP_ALLOWLIST_MAX_ENTRIES,
  canonicalIpAllowlistRule,
  isIpAllowed,
  normalizeClientIp,
  normalizeIpAllowlistRules,
} from './ip-allowlist';

/**
 * Carrier IP allowlist — Elchi bilan BIR XIL qoidalar (kontrakt §2): IPv4,
 * IPv4 CIDR va aniq IPv6; IPv6 diapazon yo'q; bo'sh ro'yxat — cheklov yo'q.
 */
describe('canonicalIpAllowlistRule — yozishda tekshirish', () => {
  it("to'g'ri yozuvlar kanonik shaklga keltiriladi", () => {
    expect(canonicalIpAllowlistRule(' 203.0.113.10 ')).toBe('203.0.113.10');
    expect(canonicalIpAllowlistRule('203.0.113.0/24')).toBe('203.0.113.0/24');
    expect(canonicalIpAllowlistRule('0.0.0.0/0')).toBe('0.0.0.0/0');
    expect(canonicalIpAllowlistRule('2001:0DB8::0001')).toBe('2001:db8::1');
    expect(canonicalIpAllowlistRule('::ffff:203.0.113.10')).toBe(
      '203.0.113.10',
    );
  });

  it('⭐ moslovchi tushunmaydigan yozuv — null (jimgina saqlanmaydi)', () => {
    for (const bad of [
      '2001:db8::/32', // IPv6 diapazon
      '1.2.3.4,5.6.7.8',
      '1.2.3',
      '256.1.1.1',
      '1.2.3.4/33',
      '1.2.3.4/',
      'localhost',
      '',
      'x'.repeat(65),
      42,
      null,
    ]) {
      expect(canonicalIpAllowlistRule(bad)).toBeNull();
    }
  });

  it("host bitli CIDR rad etiladi (yolg'on keng diapazon ochilmasin)", () => {
    // `203.0.113.10/3` moslovchida 192.0.0.0/3 bo'lib ketardi.
    expect(canonicalIpAllowlistRule('203.0.113.10/3')).toBeNull();
    expect(canonicalIpAllowlistRule('203.0.113.10/24')).toBeNull();
    expect(canonicalIpAllowlistRule('203.0.113.10/32')).toBe('203.0.113.10/32');
  });

  it('hex IPv4-mapped — dotted IPv4; eskirgan IPv4-compatible — rad', () => {
    expect(canonicalIpAllowlistRule('::ffff:cb00:710a')).toBe('203.0.113.10');
    expect(canonicalIpAllowlistRule('::203.0.113.10')).toBeNull();
  });
});

describe("normalizeIpAllowlistRules — butun ro'yxat", () => {
  it("bo'sh qatorlar tashlanadi, takrorlar birlashadi, xatolar alohida", () => {
    const { rules, invalid } = normalizeIpAllowlistRules([
      '203.0.113.10',
      '  ',
      '203.0.113.10',
      '2001:DB8::1',
      'yomon',
      '2001:db8::/48',
    ]);
    expect(rules).toEqual(['203.0.113.10', '2001:db8::1']);
    expect(invalid).toEqual(['yomon', '2001:db8::/48']);
  });

  it('chegara konstantasi Elchi bilan bir xil (50)', () => {
    expect(IP_ALLOWLIST_MAX_ENTRIES).toBe(50);
  });
});

describe("normalizeClientIp — so'rov IP manzili", () => {
  it('IPv4-mapped IPv6 prefiksi kesiladi (Node dual-stack)', () => {
    expect(normalizeClientIp('::ffff:203.0.113.10')).toBe('203.0.113.10');
  });

  it("portli IPv4 kesiladi, bosh harf va bo'shliq tozalanadi", () => {
    expect(normalizeClientIp(' 203.0.113.10:5678 ')).toBe('203.0.113.10');
    expect(normalizeClientIp('2001:DB8:0:0::1')).toBe('2001:db8::1');
  });

  it("bo'sh / satr emas — bo'sh satr", () => {
    expect(normalizeClientIp(undefined)).toBe('');
    expect(normalizeClientIp('')).toBe('');
    expect(normalizeClientIp(123)).toBe('');
  });
});

describe('isIpAllowed — moslash', () => {
  it("⭐ ro'yxat BO'SH yoki NULL — ruxsat (cheklov yo'q)", () => {
    expect(isIpAllowed('198.51.100.1', null)).toBe(true);
    expect(isIpAllowed('198.51.100.1', [])).toBe(true);
    expect(isIpAllowed(undefined, undefined)).toBe(true);
  });

  it('aniq moslik va istalgan biri mos kelsa yetarli', () => {
    expect(isIpAllowed('203.0.113.10', ['198.51.100.1', '203.0.113.10'])).toBe(
      true,
    );
    expect(isIpAllowed('203.0.113.11', ['203.0.113.10'])).toBe(false);
  });

  it('IPv4 CIDR diapazoni, /32 bitta manzil, /0 hammasi', () => {
    expect(isIpAllowed('203.0.113.200', ['203.0.113.0/24'])).toBe(true);
    expect(isIpAllowed('203.0.114.1', ['203.0.113.0/24'])).toBe(false);
    expect(isIpAllowed('203.0.113.10', ['203.0.113.10/32'])).toBe(true);
    expect(isIpAllowed('8.8.8.8', ['0.0.0.0/0'])).toBe(true);
  });

  it('⭐ ::ffff: prefiksli mijoz IPv4 qoidaga mos keladi', () => {
    expect(isIpAllowed('::ffff:203.0.113.10', ['203.0.113.10'])).toBe(true);
    expect(isIpAllowed('::ffff:203.0.113.10', ['203.0.113.0/24'])).toBe(true);
  });

  it('IPv6 — kanonik shaklda solishtiriladi (yozilish farqi ahamiyatsiz)', () => {
    expect(isIpAllowed('2001:0db8:0000::0001', ['2001:db8::1'])).toBe(true);
    expect(isIpAllowed('2001:db8::2', ['2001:db8::1'])).toBe(false);
    // IPv6 manzil IPv4 diapazonga hech qachon tushmaydi.
    expect(isIpAllowed('2001:db8::1', ['0.0.0.0/0'])).toBe(false);
  });

  it("⭐ IP ANIQLANMASA va ro'yxat BOR — rad", () => {
    expect(isIpAllowed(undefined, ['203.0.113.10'])).toBe(false);
    expect(isIpAllowed('', ['0.0.0.0/0'])).toBe(false);
  });

  it("noto'g'ri yozilgan qoida hech narsaga mos kelmaydi (ochib yubormaydi)", () => {
    expect(isIpAllowed('203.0.113.10', ['203.0.113.10/99'])).toBe(false);
    expect(isIpAllowed('1e2.0.0.1', ['100.0.0.0/8'])).toBe(false);
  });
});
