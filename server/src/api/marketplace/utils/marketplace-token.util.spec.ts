import { checkMarketplaceToken } from './marketplace-token.util';
import { normalizeQrToken } from 'src/infrastructure/lib/qr-token/normalize';

describe('checkMarketplaceToken', () => {
  it("aralash registrli tokenni lowercase qiladi", () => {
    // Reja §15 #5: bugungi oqim `UZM-9600-AbCdEf` ni VERBATIM saqlaydi,
    // keyingi skanerlar esa lowercase qidiradi va TOPA OLMAYDI.
    const r = checkMarketplaceToken('UZM-9600-AbCdEf');
    expect(r.valid).toBe(true);
    expect(r.norm).toBe('uzm-9600-abcdef');
    // Asl qiymat SAQLANADI — ularga qaytarilganda aynan shu yuboriladi.
    expect(r.raw).toBe('UZM-9600-AbCdEf');
  });

  it('PCS skanerlari bilan AYNI natija beradi', () => {
    // ⚠️ Eng muhim test: agar bu ikkisi ajralsa, posilka bazada turadi,
    // lekin kuryer/pochta skaneri uni topa olmaydi.
    for (const t of ['UZM-8842-1', 'uzm-9100-2', 'ABC-123_XY', 'UZM-9600-AbCdEf']) {
      expect(checkMarketplaceToken(t).norm).toBe(normalizeQrToken(t));
    }
  });

  it("tashqi bo'shliqni olib tashlaydi", () => {
    expect(checkMarketplaceToken('  UZM-8842-1  ').norm).toBe('uzm-8842-1');
  });

  it("bo'sh tokenni rad etadi", () => {
    for (const v of ['', '   ', null, undefined]) {
      const r = checkMarketplaceToken(v);
      expect(r.valid).toBe(false);
      expect(r.reason).toMatch(/bo'sh/);
    }
  });

  it('juda qisqa va juda uzun tokenni rad etadi', () => {
    expect(checkMarketplaceToken('ab1').valid).toBe(false);
    expect(checkMarketplaceToken('a'.repeat(65)).valid).toBe(false);
    // Chegaradagi qiymatlar — ruxsat etiladi.
    expect(checkMarketplaceToken('abc123').valid).toBe(true);
    expect(checkMarketplaceToken('a'.repeat(64)).valid).toBe(true);
  });

  it("ruxsat etilmagan belgini rad etadi", () => {
    // Bo'shliq, nuqta, slash — skaner axlati yoki noto'g'ri yorliq.
    for (const bad of ['uzm 8842', 'uzm.8842', 'uzm/8842', 'uzm#88']) {
      const r = checkMarketplaceToken(bad);
      expect(r.valid).toBe(false);
      expect(r.reason).toMatch(/ruxsat etilmagan/);
    }
  });

  it('RU klaviatura layoutidagi skanni Latinga qaytaradi', () => {
    // Operator klaviaturasi ruschada bo'lsa skaner kirill yuboradi.
    // `normalizeQrToken` buni qaytaradi — biz uni qayta ishlatamiz.
    const r = checkMarketplaceToken('фис123');
    expect(r.valid).toBe(true);
    expect(r.norm).toBe('abc123');
  });
});


describe('isReservedMarketplaceSlug', () => {
  const { isReservedMarketplaceSlug } = require('../marketplace.enums');

  it("route segmentiga to'g'ri keladigan slug'larni band deb biladi", () => {
    // ⚠️ Slug `scan-session` bo'lsa, `GET marketplace/scan-session/abc`
    // ichki va ommaviy marshrutlarga ham mos kelib, qaysi biri ishlashi
    // ro'yxatga olish tartibiga bog'liq bo'lib qolardi.
    for (const s of ['scan-session', 'ledger', 'events', 'parcels', 'settlement']) {
      expect(isReservedMarketplaceSlug(s)).toBe(true);
    }
  });

  it('registrdan qat\'i nazar ishlaydi', () => {
    expect(isReservedMarketplaceSlug('  LEDGER ')).toBe(true);
  });

  it('oddiy slug\'larga ruxsat beradi', () => {
    for (const s of ['uzum', 'olcha', 'my-market']) {
      expect(isReservedMarketplaceSlug(s)).toBe(false);
    }
  });
});
