import { BadRequestException } from '@nestjs/common';
import { assertOutboundUrlSafe, joinUrl } from './marketplace-url.util';

/** Prod holati: lokal manzillarga ruxsat YO'Q. */
const check = (url: string) => assertOutboundUrlSafe(url, false);

describe('SSRF qo\'riqchisi', () => {
  it('oddiy HTTPS manzilga ruxsat beradi', () => {
    expect(check('https://api.uzmarket.uz/bp/v1').hostname).toBe(
      'api.uzmarket.uz',
    );
  });

  it('HTTP ni rad etadi', () => {
    expect(() => check('http://api.uzmarket.uz')).toThrow(BadRequestException);
  });

  it('manzildagi login/parolni rad etadi', () => {
    // URL ichidagi kredensial — kalit sizib chiqishining eng oson yo'li.
    expect(() => check('https://user:pass@api.uzmarket.uz')).toThrow(
      BadRequestException,
    );
  });

  it('ichki IPv4 manzillarni to\'sadi', () => {
    for (const h of [
      '127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.1',
      '169.254.169.254', // bulut metadata
    ]) {
      expect(() => check(`https://${h}`)).toThrow(BadRequestException);
    }
  });

  it('IPv6 LITERAL ichki manzillarni to\'sadi', () => {
    // ⚠️ `new URL()` IPv6 hostni kvadrat qavs bilan beradi (`[::1]`),
    // shuning uchun oddiy satr taqqoslash ishlamasdi.
    for (const h of [
      '[::1]',
      '[::ffff:127.0.0.1]', // IPv4-mapped
      '[fd00::1]', // unique local
      '[fe80::1]', // link-local
    ]) {
      expect(() => check(`https://${h}`)).toThrow(BadRequestException);
    }
  });

  it('OXIRIDAGI NUQTALI hostni ham to\'sadi', () => {
    // `localhost.` DNS'da AYNI nom, lekin ro'yxatdan o'tib ketardi.
    expect(() => check('https://localhost.')).toThrow(BadRequestException);
    expect(() => check('https://127.0.0.1.')).toThrow(BadRequestException);
  });

  it('tashqi IPv6 manzilga ruxsat beradi', () => {
    expect(() => check('https://[2001:4860:4860::8888]')).not.toThrow();
  });

  it('yaroqsiz manzilni rad etadi', () => {
    expect(() => check('allaqanday')).toThrow(BadRequestException);
    expect(() => check('ftp://api.uzmarket.uz')).toThrow(BadRequestException);
  });
});

describe('joinUrl', () => {
  it("qo'sh `/` yasamaydi", () => {
    expect(joinUrl('https://a.uz/', '/bp/v1/ping')).toBe(
      'https://a.uz/bp/v1/ping',
    );
    expect(joinUrl('https://a.uz', 'bp/v1/ping')).toBe(
      'https://a.uz/bp/v1/ping',
    );
  });
});
