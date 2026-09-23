import {
  computeMarketSettlement,
  isMarketSettlementOpen,
  planMarketPayment,
  SettlementStatusAction,
  type SettlementOrderInput,
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

describe('planMarketPayment', () => {
  const ord = (
    id: string,
    net: number,
    settled = 0,
    paid = 0,
    is_open_status = true,
  ): SettlementOrderInput => ({
    id,
    market_net: net,
    market_settled: settled,
    paid_amount: paid,
    is_open_status,
  });

  /**
   * ⚠️ FOYDALANUVCHI SHIKOYATINING AYNAN O'ZI.
   *
   * Eski mantiq `to_be_paid` bo'yicha ishlar va 295 000 talab qilardi
   * (145 000 + 0 + 150 000). Kassada esa 210 000 bor edi — 85 000 lik
   * buyurtma ABADIY ochiq qolardi.
   */
  it("kassadagi hamma pul HAMMA buyurtmani yopadi (xarajat + tarifdan arzon)", () => {
    const orders = [
      ord('B', -75_000), // 0 so'mlik — market qarzdor (navbatda BIRINCHI)
      ord('A', 145_000), // oddiy sotuv
      ord('C', 140_000), // 150 000 − 10 000 xarajat
    ];
    // Kassa = 145 000 − 75 000 + 140 000 = 210 000
    const { plans, leftover } = planMarketPayment(orders, 210_000);

    expect(leftover).toBe(0);
    expect(plans).toHaveLength(3);
    for (const p of plans) {
      expect(p.status).toBe(SettlementStatusAction.CLOSE);
    }
    // Qarz `paid_amount` ga TUSHMAYDI — u «To'langan» deb ko'rsatiladi.
    expect(plans.find((p) => p.id === 'B')).toMatchObject({
      market_settled: -75_000,
      paid_amount: 0,
    });
    expect(plans.find((p) => p.id === 'A')).toMatchObject({
      market_settled: 145_000,
      paid_amount: 145_000,
    });
  });

  it("manfiy qator hovuzni OSHIRADI — pul tugagan bo'lsa ham ishlanadi", () => {
    const { plans, leftover } = planMarketPayment([ord('X', -50_000)], 0);
    expect(leftover).toBe(50_000);
    expect(plans[0].market_settled).toBe(-50_000);
  });

  it('pul yetmasa oxirgi buyurtma QISMAN yopiladi', () => {
    const { plans, leftover } = planMarketPayment(
      [ord('A', 100_000), ord('B', 100_000)],
      150_000,
    );
    expect(leftover).toBe(0);
    expect(plans[0]).toMatchObject({
      status: SettlementStatusAction.CLOSE,
      market_settled: 100_000,
      paid_amount: 100_000,
    });
    expect(plans[1]).toMatchObject({
      status: SettlementStatusAction.PARTIAL,
      market_settled: 50_000,
      paid_amount: 50_000,
    });
  });

  it('pul tugagach qolgan MUSBAT qatorlarga tegilmaydi', () => {
    const { plans } = planMarketPayment(
      [ord('A', 100_000), ord('B', 100_000), ord('C', 100_000)],
      100_000,
    );
    // A yopildi, B va C ga tegilmadi.
    expect(plans.map((p) => p.id)).toEqual(['A']);
  });

  /**
   * ⚠️ `net < 0` DARVOZASI. `market_settled` `market_net` dan oshib
   * ketgan qator (`paymentsFromCourier` buyurtmani `to_be_paid` bo'yicha
   * yopadi, `market_net` esa xarajat qadar kichik) «qarz» deb
   * hisoblansa, halqa YO'QDAN PUL yaratardi.
   */
  it('ortiqcha yopilgan qator pul YARATMAYDI, faqat normallashadi', () => {
    // net 100 000, lekin 150 000 yopilgan → remaining = −50 000
    const { plans, leftover } = planMarketPayment(
      [ord('X', 100_000, 150_000, 150_000)],
      0,
    );
    expect(leftover).toBe(0); // ← hovuz OSHMADI
    expect(plans[0].market_settled).toBe(100_000);
    expect(plans[0].paid_amount).toBe(150_000); // paid_amount TEGILMADI
  });

  /**
   * ⚠️ REGRESSIYA QO'RIQCHISI. Tarifdan arzon eski buyurtmalarda hisob
   * ham, to'lov ham 0 — lekin status hamon `sold`. Eski halqa ularni
   * PAID qilardi; yangi halqa ham qilishi SHART, aks holda ular
   * abadiy `sold` bo'lib qolardi.
   */
  it("hisobi 0, lekin statusi ochiq bo'lgan buyurtma YOPILADI", () => {
    const { plans } = planMarketPayment([ord('Z', 0, 0, 0, true)], 0);
    expect(plans).toHaveLength(1);
    expect(plans[0].status).toBe(SettlementStatusAction.CLOSE);
  });

  it('hisobi 0 va statusi allaqachon yopiq — TEGILMAYDI', () => {
    const { plans } = planMarketPayment([ord('Z', 0, 0, 0, false)], 100_000);
    expect(plans).toHaveLength(0);
  });

  it("bo'sh navbatda pul to'liq qaytadi", () => {
    const { plans, leftover } = planMarketPayment([], 500_000);
    expect(plans).toHaveLength(0);
    expect(leftover).toBe(500_000);
  });

  it("ortiqcha to'lov qoldiq sifatida qaytadi", () => {
    const { leftover } = planMarketPayment([ord('A', 100_000)], 250_000);
    expect(leftover).toBe(150_000);
  });

  it("hovuz manfiylardan to'lgach musbatlarni yopadi (tartib muhim)", () => {
    // Faqat 10 000 to'lansa ham, −90 000 qarz hovuzni 100 000 ga yetkazadi.
    const { plans, leftover } = planMarketPayment(
      [ord('QARZ', -90_000), ord('A', 100_000)],
      10_000,
    );
    expect(leftover).toBe(0);
    expect(plans.every((p) => p.status === SettlementStatusAction.CLOSE)).toBe(true);
  });
});
