import {
  assertMarketplaceTariffNotOverridden,
  detectFeeBasisChange,
} from './marketplace-guard.util';
import { Where_deliver } from 'src/common/enums';

const mpOrder = (over: any = {}) => ({
  integration_id: 'int-1',
  market_tariff: 50000,
  where_deliver: Where_deliver.CENTER,
  ...over,
});
const plainOrder = (over: any = {}) => ({
  integration_id: null,
  market_tariff: 40000,
  where_deliver: Where_deliver.CENTER,
  ...over,
});

describe('assertMarketplaceTariffNotOverridden', () => {
  it('marketplace buyurtmasida tarif o\'zgartirishni RAD ETADI', () => {
    // ⚠️ Bloker B8: aks holda operator 50 000 ni 30 000 qilib qo'ysa,
    // ikki daftar MOS keladi-yu, ikkalasi ham shartnomadan chetlashadi —
    // va hech qayerda xato chiqmaydi.
    expect(() =>
      assertMarketplaceTariffNotOverridden(mpOrder(), { market_tariff: 30000 }),
    ).toThrow(/qo'lda o'zgartirib bo'lmaydi/);
  });

  it('ODDIY market buyurtmasiga tegmaydi', () => {
    expect(() =>
      assertMarketplaceTariffNotOverridden(plainOrder(), { market_tariff: 30000 }),
    ).not.toThrow();
  });

  it('tarif berilmasa o\'tkazadi', () => {
    expect(() => assertMarketplaceTariffNotOverridden(mpOrder(), {})).not.toThrow();
    expect(() =>
      assertMarketplaceTariffNotOverridden(mpOrder(), { market_tariff: undefined }),
    ).not.toThrow();
  });

  it('AYNI qiymat qayta yuborilsa o\'tkazadi', () => {
    // Frontend butun obyektni qaytarib yuborishi normal — bu o'zgartirish emas.
    expect(() =>
      assertMarketplaceTariffNotOverridden(mpOrder(), { market_tariff: 50000 }),
    ).not.toThrow();
  });

  it('`courier_tariff` ni BLOKLAMAYDI', () => {
    // ⚠️ U bizning KURYERGA to'lovimiz va `net_to_marketplace` formulasiga
    // umuman kirmaydi — marketplace daftariga ta'siri yo'q.
    expect(() =>
      assertMarketplaceTariffNotOverridden(mpOrder(), { courier_tariff: 99999 }),
    ).not.toThrow();
  });
});

describe('detectFeeBasisChange', () => {
  it('markaz → uy o\'zgarishini aniqlaydi', () => {
    const r = detectFeeBasisChange(mpOrder(), { where_deliver: Where_deliver.ADDRESS });
    expect(r).toEqual({
      changed: true,
      from: Where_deliver.CENTER,
      to: Where_deliver.ADDRESS,
    });
  });

  it('o\'zgarmasa `changed: false`', () => {
    expect(detectFeeBasisChange(mpOrder(), { where_deliver: Where_deliver.CENTER }).changed)
      .toBe(false);
    expect(detectFeeBasisChange(mpOrder(), {}).changed).toBe(false);
  });

  it('oddiy market buyurtmasida hech qachon `changed` emas', () => {
    expect(
      detectFeeBasisChange(plainOrder(), { where_deliver: Where_deliver.ADDRESS }).changed,
    ).toBe(false);
  });
});
