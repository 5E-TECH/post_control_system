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
  return new InvestorService(orderService, cashBoxService, regionService);
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

  it('getOverview safe maydonlar + raqamga coerce', async () => {
    const res: any = await makeService().getOverview();
    expect(res.data).toEqual({
      acceptedCount: 120, soldAndPaid: 90, cancelled: 10, profit: 5_000_000, from: 1000, to: 2000,
    });
  });

  it('getOrderFlow success/return darajasini hisoblaydi', async () => {
    const res: any = await makeService().getOrderFlow();
    expect(res.data.successRate).toBe(90); // 90/(90+10)
    expect(res.data.returnRate).toBe(10);
  });

  it('barcha endpointlar birgalikda hech qanday DENY-kalitni oqizmaydi', async () => {
    const s = makeService();
    const results = await Promise.all([
      s.getOverview(), s.getRevenue(), s.getOrderFlow(), s.getRegions(), s.getLeaderboards(), s.getCashPosition(),
    ]);
    for (const r of results as any[]) {
      const keys = deepKeys(r.data);
      for (const bad of DENY) expect(keys.has(bad)).toBe(false);
    }
  });
});
