import {
  computeMarketSettlement,
  isMarketSettlementOpen,
} from './market-settlement.util';

describe('computeMarketSettlement', () => {
  it('oddiy sotuv — market tushum oladi', () => {
    // 500 000 lik mahsulot, 50 000 tarif -> marketga 450 000
    expect(
      computeMarketSettlement({ total_price: 500_000, market_tariff: 50_000 }),
    ).toBe(450_000);
  });

  it('qo\'shimcha xarajat tushumdan ayriladi', () => {
    // Aynan shikoyat holati: kassaga 90 000 tushadi, buyurtma esa
    // 100 000 talab qilardi.
    expect(
      computeMarketSettlement({
        total_price: 160_000,
        market_tariff: 60_000,
        extra_cost_net: 10_000,
      }),
    ).toBe(90_000);
  });

  /**
   * ⚠️ ASOSIY XATTI-HARAKAT O'ZGARISHI.
   *
   * Eski kod bu yerda `Math.max(..., 0)` bilan 0 qaytarardi va
   * tarifdan arzon sotuvning qarzi hech qaysi buyurtmaga biriktirilmay,
   * market kassasida «egasiz» osilib qolardi.
   */
  it('0 so\'mlik buyurtma — market tarif qadar QARZDOR (manfiy)', () => {
    expect(
      computeMarketSettlement({ total_price: 0, market_tariff: 75_000 }),
    ).toBe(-75_000);
  });

  it('tarifdan arzon buyurtma — market farqni qoplaydi', () => {
    // 30 000 lik mahsulot, 50 000 tarif -> market 20 000 qarzdor
    expect(
      computeMarketSettlement({ total_price: 30_000, market_tariff: 50_000 }),
    ).toBe(-20_000);
  });

  it('bekor qilingan buyurtmada faqat xarajat qoladi', () => {
    // Bekorda tarif olinmaydi (qaror P4), lekin xarajat market zimmasida.
    expect(
      computeMarketSettlement({
        total_price: 0,
        market_tariff: 0,
        extra_cost_net: 10_000,
      }),
    ).toBe(-10_000);
  });

  it('xarajat tushumdan KO\'P bo\'lsa natija manfiy', () => {
    expect(
      computeMarketSettlement({
        total_price: 100_000,
        market_tariff: 50_000,
        extra_cost_net: 80_000,
      }),
    ).toBe(-30_000);
  });

  it('null va undefined 0 deb qabul qilinadi', () => {
    expect(
      computeMarketSettlement({ total_price: null, market_tariff: undefined }),
    ).toBe(0);
    expect(
      computeMarketSettlement({
        total_price: 100_000,
        market_tariff: 40_000,
        extra_cost_net: null,
      }),
    ).toBe(60_000);
  });

  it('kasr qiymat butunga qirqiladi (kassa ustunlari bigint)', () => {
    // ⚠️ Kasrli qiymat bigint ustunga INSERT xatosi berib, BUTUN sotuvni
    // rollback qilardi (mijoz oldida yiqilgan sotuv).
    expect(
      computeMarketSettlement({
        total_price: 100_000.7,
        market_tariff: 40_000.2,
        extra_cost_net: 0,
      }),
    ).toBe(60_000);
  });

  it('NaN/Infinity 0 ga aylanadi, natija buzilmaydi', () => {
    expect(
      computeMarketSettlement({
        total_price: Number.NaN,
        market_tariff: 50_000,
      }),
    ).toBe(-50_000);
    expect(
      computeMarketSettlement({
        total_price: Number.POSITIVE_INFINITY,
        market_tariff: 0,
      }),
    ).toBe(0);
  });
});

describe('isMarketSettlementOpen', () => {
  it('to\'liq to\'langan — yopiq', () => {
    expect(isMarketSettlementOpen(450_000, 450_000)).toBe(false);
  });

  it('qisman to\'langan — ochiq', () => {
    expect(isMarketSettlementOpen(450_000, 100_000)).toBe(true);
  });

  it('market QARZDOR (manfiy) — ochiq', () => {
    // Bu holat eski kodda navbatga UMUMAN tushmasdi.
    expect(isMarketSettlementOpen(-75_000, 0)).toBe(true);
  });

  it('nol hissa, nol to\'lov — yopiq', () => {
    expect(isMarketSettlementOpen(0, 0)).toBe(false);
  });

  it('null/undefined xavfsiz ishlanadi', () => {
    expect(isMarketSettlementOpen(null, null)).toBe(false);
    expect(isMarketSettlementOpen(undefined, 0)).toBe(false);
  });
});
