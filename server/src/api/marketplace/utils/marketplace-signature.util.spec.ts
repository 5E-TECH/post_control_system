import {
  buildSignatureHeader,
  verifySignatureHeader,
} from './marketplace-signature.util';
import { assertOutboundUrlSafe, joinUrl } from './marketplace-url.util';

const SECRET = 'mock-secret-v1';
const OLD = 'mock-secret-v0';

describe('buildSignatureHeader / verifySignatureHeader', () => {
  it("o'zi yasagan imzoni o'zi tasdiqlaydi", () => {
    const body = JSON.stringify({ qr_token: 'UZM-8842-1' });
    const h = buildSignatureHeader(SECRET, body, { nowSec: 1_789_500_000 });
    expect(h).toMatch(/^t=1789500000,v1=[0-9a-f]{64}$/);

    const r = verifySignatureHeader(h, body, [SECRET], 300, 1_789_500_010);
    expect(r.ok).toBe(true);
  });

  it("tana bir belgi o'zgarsa imzo YIQILADI", () => {
    // ⚠️ Aynan shu sabab xom satr imzolanadi: JSON'ni qayta stringify
    // qilish (kalit tartibi/probel) imzoni jimgina buzardi.
    const body = JSON.stringify({ a: 1 });
    const h = buildSignatureHeader(SECRET, body, { nowSec: 1_789_500_000 });
    const r = verifySignatureHeader(h, JSON.stringify({ a: 2 }), [SECRET], 300, 1_789_500_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/mos kelmadi/);
  });

  it('vaqt oynasidan tashqaridagi imzoni rad etadi', () => {
    const body = '{}';
    const h = buildSignatureHeader(SECRET, body, { nowSec: 1_789_500_000 });
    // 301 soniya keyin — oyna 300.
    const r = verifySignatureHeader(h, body, [SECRET], 300, 1_789_500_301);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/vaqt oynasidan/);
  });

  it('ikki kalitli aylantirishda ESKI kalit ham qabul qilinadi', () => {
    const body = '{}';
    const h = buildSignatureHeader(SECRET, body, {
      previousSecret: OLD,
      nowSec: 1_789_500_000,
    });
    expect(h).toMatch(/v1=[0-9a-f]{64},v2=[0-9a-f]{64}/);

    // Qabul qiluvchi hali ESKI kalitda bo'lsa ham imzo o'tadi — uzilish yo'q.
    //
    // ⚠️ REGRESSIYA QULFI. Avval tekshiruv POZITSION edi (`secrets[0] → v1`),
    // ya'ni faqat eski kalitni biladigan tomon `v1` ni tekshirib rad etardi —
    // aylantirishning butun maqsadi buzilardi. Lokal e2e sinovda topilgan.
    // Endi har sekret HAR MAYDONGA qarshi tekshiriladi.
    expect(verifySignatureHeader(h, body, [OLD], 300, 1_789_500_000).ok).toBe(true);
    // Yangi kalitni biladigan tomon ham o'tadi.
    expect(verifySignatureHeader(h, body, [SECRET], 300, 1_789_500_000).ok).toBe(true);
    // Ikkalasini biladigan tomon ham.
    expect(verifySignatureHeader(h, body, [SECRET, OLD], 300, 1_789_500_000).ok).toBe(true);
    // Uchinchi, notanish kalit — rad etiladi.
    expect(verifySignatureHeader(h, body, ['begona'], 300, 1_789_500_000).ok).toBe(false);
  });

  it("imzosiz yoki buzuq sarlavhani rad etadi", () => {
    expect(verifySignatureHeader(null, '{}', [SECRET]).ok).toBe(false);
    expect(verifySignatureHeader('axlat', '{}', [SECRET]).ok).toBe(false);
    expect(verifySignatureHeader('t=abc,v1=xx', '{}', [SECRET]).ok).toBe(false);
  });
});

describe('assertOutboundUrlSafe', () => {
  it('oddiy HTTPS manzilga ruxsat beradi', () => {
    expect(assertOutboundUrlSafe('https://api.uzum.uz/bp/v1', false).hostname)
      .toBe('api.uzum.uz');
  });

  it('ICHKI manzillarni to\'sadi (SSRF)', () => {
    // ⚠️ Bugungi kodda bu tekshiruv UMUMAN yo'q — admin integratsiyani
    // bulut metadata xizmatiga yo'naltirib qo'yishi mumkin edi.
    for (const bad of [
      'https://localhost/x',
      'https://127.0.0.1/x',
      'https://10.1.2.3/x',
      'https://192.168.0.5/x',
      'https://172.16.0.1/x',
      'https://169.254.169.254/latest/meta-data',
      'https://metadata.google.internal/x',
    ]) {
      expect(() => assertOutboundUrlSafe(bad, false)).toThrow();
    }
  });

  it('HTTP va URL ichidagi parolni rad etadi', () => {
    expect(() => assertOutboundUrlSafe('http://api.uzum.uz', false)).toThrow(/HTTPS/);
    expect(() => assertOutboundUrlSafe('https://user:pass@api.uzum.uz', false))
      .toThrow(/login\/parol/);
  });

  it("noto'g'ri protokolni rad etadi", () => {
    expect(() => assertOutboundUrlSafe('file:///etc/passwd', false)).toThrow();
    expect(() => assertOutboundUrlSafe('axlat', false)).toThrow();
  });

  it('lokal sinov rejimida localhost ruxsat etiladi', () => {
    // Mock server bilan ishlash uchun — faqat ENV bayrog'i bilan.
    expect(assertOutboundUrlSafe('http://localhost:4010', true).port).toBe('4010');
  });
});

describe('joinUrl', () => {
  it("qo'sh slashsiz birlashtiradi", () => {
    expect(joinUrl('https://a.uz/', '/bp/v1/ping')).toBe('https://a.uz/bp/v1/ping');
    expect(joinUrl('https://a.uz', 'bp/v1/ping')).toBe('https://a.uz/bp/v1/ping');
  });
});
