import { InvestorService } from './investor.service';

// Mock reused-servislar: ATAYLAB maxfiy maydonlar bilan javob qaytaradi.
// Test isbotlaydi: investor-safe mapper ularni oqizmaydi.
const makeService = (over: Partial<any> = {}) => {
  const orderService: any = {
    getStats: jest.fn().mockResolvedValue({
      statusCode: 200,
      message: 'ok',
      data: {
        acceptedCount: 120,
        soldAndPaid: 90,
        cancelled: 10,
        profit: 5_000_000,
        from: 1000,
        to: 2000,
      },
    }),
    getRevenueStats: jest.fn().mockResolvedValue({
      statusCode: 200,
      message: 'ok',
      data: {
        data: [{ period: '2026-08-01', label: '1-avg', ordersCount: 5, revenue: 300000 }],
        summary: { totalRevenue: 300000, totalOrders: 5, avgRevenue: 60000 },
      },
    }),
    getTopMarkets: jest.fn().mockResolvedValue({
      statusCode: 200,
      message: 'ok',
      data: [
        { market_id: 'MKT-SECRET-1', market_name: 'Maxfiy Do\'kon', total_orders: 200, successful_orders: 180, success_rate: 90 },
      ],
    }),
    getTopCouriers: jest.fn().mockResolvedValue({
      statusCode: 200,
      message: 'ok',
      data: [
        { courier_id: 'CUR-SECRET-1', courier_name: 'Kuryer Ali', total_orders: 150, successful_orders: 140, success_rate: 93 },
      ],
    }),
    ...over.orderService,
  };
  const cashBoxService: any = {
    financialBalance: jest.fn().mockResolvedValue({
      statusCode: 200,
      message: 'ok',
      data: {
        currentSituation: 42_000_000,
        main: { balance: 40_000_000, balance_cash: 25_000_000, balance_card: 15_000_000, id: 'CASH-MAIN' },
        markets: {
          marketsTotalBalans: -3_000_000,
          allMarketCashboxes: [{ id: 'm1', balance: 3_000_000, card_id: 'CARD-SECRET' }],
        },
        couriers: {
          couriersTotalBalanse: 5_000_000,
          allCourierCashboxes: [{ id: 'c1', balance: 5_000_000 }],
        },
        difference: 2_000_000,
      },
    }),
    financialBalanceAnalytics: jest.fn().mockResolvedValue({
      statusCode: 200,
      message: 'ok',
      data: {
        positiveImpact: [
          { source_type: 'sell_profit', total_amount: 10_000_000 },
          { source_type: 'manual_income', total_amount: 500_000 },
        ],
        negativeImpact: [
          { source_type: 'salary', total_amount: 3_000_000 },
          { source_type: 'bills', total_amount: 1_000_000 },
          { source_type: 'manual_expense', total_amount: 500_000 },
        ],
        // topTransactions PII (created_by nomi) bilan — investor ko'rmasligi kerak.
        topTransactions: [{ id: 't1', created_by: { id: 'u1', name: 'Maxfiy Xodim' } }],
      },
    }),
    ...over.cashBoxService,
  };
  const regionService: any = {
    getAllRegionsStats: jest.fn().mockResolvedValue({
      statusCode: 200,
      message: 'ok',
      data: {
        regions: [
          { id: 'r1', name: 'Andijon', satoCode: '1703', districtsCount: 5, couriersCount: 3, totalOrders: 100, deliveredOrders: 80, cancelledOrders: 20, pendingOrders: 0, totalRevenue: 9_000_000, successRate: 80 },
        ],
        summary: { totalRegions: 1, totalOrders: 100, totalDelivered: 80, totalCancelled: 20, totalRevenue: 9_000_000, avgSuccessRate: 80 },
      },
    }),
    ...over.regionService,
  };
  // OrderEntity repo mock — grossSold query builder zanjiri.
  const orderRepo: any = {
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        select: () => qb,
        addSelect: () => qb,
        where: () => qb,
        andWhere: () => qb,
        getRawOne: jest.fn().mockResolvedValue({ gross: 50_000_000 }),
      };
      return qb;
    }),
    ...over.orderRepo,
  };
  return new InvestorService(orderService, cashBoxService, regionService, orderRepo);
};

// Chuqur (rekursiv) kalitlar to'plami — maxfiy maydon oqib ketmaganini tekshirish uchun.
const deepKeys = (obj: any, acc = new Set<string>()): Set<string> => {
  if (Array.isArray(obj)) obj.forEach((x) => deepKeys(x, acc));
  else if (obj && typeof obj === 'object')
    for (const k of Object.keys(obj)) {
      acc.add(k);
      deepKeys(obj[k], acc);
    }
  return acc;
};

const DENY = [
  'market_id', 'market_name', 'courier_id', 'courier_name',
  'allMarketCashboxes', 'allCourierCashboxes', 'card_id',
  'password', 'customer_phone', 'customer_name', 'salary_amount',
  'created_by', 'topTransactions', 'related_user', 'salary', 'bills',
];

describe('InvestorService — investor-safe mapping (PII/maxfiy oqmasligi)', () => {
  it('getCashPosition faqat skalyar jamlanma qaytaradi, per-entity massivlar YO\'Q', async () => {
    const res: any = await makeService().getCashPosition();
    const d = res.data;
    expect(d).toEqual({
      netCashPosition: 42_000_000,
      cash: 25_000_000,
      card: 15_000_000,
      mainBalance: 40_000_000,
      couriersTotal: 5_000_000,
      marketsTotal: -3_000_000,
      asOf: expect.any(Number),
    });
    const keys = deepKeys(d);
    expect(keys.has('allMarketCashboxes')).toBe(false);
    expect(keys.has('allCourierCashboxes')).toBe(false);
    expect(keys.has('card_id')).toBe(false);
  });

  it('getLeaderboards anonim — id/ism YO\'Q, faqat rank + ko\'rsatkichlar', async () => {
    const res: any = await makeService().getLeaderboards();
    const keys = deepKeys(res.data);
    for (const bad of ['market_id', 'market_name', 'courier_id', 'courier_name']) {
      expect(keys.has(bad)).toBe(false);
    }
    expect(res.data.markets[0]).toEqual({ rank: 1, totalOrders: 200, successfulOrders: 180, successRate: 90 });
    expect(res.data.couriers[0]).toEqual({ rank: 1, totalOrders: 150, successfulOrders: 140, successRate: 93 });
  });

  it('getOverview safe maydonlar + sof foyda (TO\'LIQ marja − OpEx)', async () => {
    const res: any = await makeService().getOverview();
    expect(res.data).toEqual({
      acceptedCount: 120,
      soldAndPaid: 90,
      cancelled: 10,
      profit: -4_200_000, // sof foyda = 300k marja − 4.5M OpEx
      grossProfit: 300_000, // getRevenueStats summasi (TO'LIQ marja, getStats EMAS)
      totalOpEx: 4_500_000,
      from: 1000,
      to: 2000,
    });
  });

  it('getOrderFlow success/return darajasini hisoblaydi', async () => {
    const res: any = await makeService().getOrderFlow();
    expect(res.data.successRate).toBe(90); // 90/(90+10)
    expect(res.data.returnRate).toBe(10);
  });

  it("getNetProfit = grossProfit − totalOpEx, xarajat komponentlari OSHKOR EMAS", async () => {
    const res: any = await makeService().getNetProfit();
    expect(res.data).toEqual({
      grossProfit: 300_000, // getRevenueStats summasi (TO'LIQ marja, getStats EMAS)
      totalOpEx: 4_500_000, // 3M salary + 1M bills + 0.5M manual_expense
      netProfit: -4_200_000, // 300k − 4.5M
      from: null,
      to: null,
    });
    const keys = deepKeys(res.data);
    for (const bad of ["salary", "bills", "manualExpense", "created_by", "topTransactions", "name"]) {
      expect(keys.has(bad)).toBe(false);
    }
  });

  it("getOpEx faqat BITTA yig'ma raqam qaytaradi", async () => {
    const res: any = await makeService().getOpEx();
    expect(res.data).toEqual({ totalOpEx: 4_500_000, from: null, to: null });
  });

  it("getUnitEconomics: revenuePerOrder va takeRatePct", async () => {
    const res: any = await makeService().getUnitEconomics();
    expect(res.data.grossSold).toBe(50_000_000);
    expect(res.data.totalProfit).toBe(300_000); // getRevenueStats summasi (TO'LIQ marja)
    expect(res.data.soldOrders).toBe(90);
    expect(res.data.revenuePerOrder).toBe(Math.round(300_000 / 90));
    expect(res.data.takeRatePct).toBe(0.6); // 300k/50M*100
  });

  it("getRevenue seriyasiga growth% qo'shiladi (oldingi 0/yo'q -> null)", async () => {
    const res: any = await makeService({
      orderService: {
        getRevenueStats: jest.fn().mockResolvedValue({
          statusCode: 200,
          message: "ok",
          data: {
            data: [
              { period: "p1", label: "p1", ordersCount: 1, revenue: 100 },
              { period: "p2", label: "p2", ordersCount: 2, revenue: 150 },
              { period: "p3", label: "p3", ordersCount: 3, revenue: 0 },
            ],
            summary: { totalRevenue: 250, totalOrders: 6, avgRevenue: 83 },
          },
        }),
      },
    }).getRevenue();
    const pts = res.data.data;
    expect(pts[0].growthPct).toBeNull();
    expect(pts[1].growthPct).toBe(50); // (150-100)/100*100
    expect(pts[2].growthPct).toBe(-100); // (0-150)/150*100
  });

  it('barcha endpointlar birgalikda hech qanday DENY-kalitni oqizmaydi', async () => {
    const s = makeService();
    const results = await Promise.all([
      s.getOverview(), s.getRevenue(), s.getOrderFlow(), s.getRegions(),
      s.getLeaderboards(), s.getCashPosition(),
      s.getNetProfit(), s.getOpEx(), s.getUnitEconomics(),
    ]);
    for (const r of results as any[]) {
      const keys = deepKeys(r.data);
      for (const bad of DENY) expect(keys.has(bad)).toBe(false);
    }
  });
});
