import { InvestorLedgerService } from './investor-ledger.service';
import { toUzbekistanTimestamp } from 'src/common/utils/date.util';

// Chainable QB mock — getRawOne/getRawMany beradi.
const makeQb = (rawOne: any = {}, rawMany: any[] = []) => {
  const qb: any = {};
  qb.select = () => qb;
  qb.addSelect = () => qb;
  qb.where = () => qb;
  qb.andWhere = () => qb;
  qb.groupBy = () => qb;
  qb.getRawOne = jest.fn().mockResolvedValue(rawOne);
  qb.getRawMany = jest.fn().mockResolvedValue(rawMany);
  return qb;
};

const makeLedger = (over: any = {}) => {
  const capitalRepo: any = {
    find: jest.fn().mockResolvedValue([
      { amount: 1_000_000, contributed_at: 50, created_at: 50, note: null },
    ]),
    create: jest.fn((x) => x),
    save: jest.fn(),
    ...over.capitalRepo,
  };
  const withdrawalRepo: any = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x) => x),
    save: jest.fn(),
    ...over.withdrawalRepo,
  };
  const stakeRepo: any = {
    find: jest.fn().mockResolvedValue([
      { ownership_bps: 1000, profit_basis: 'net', effective_from: 100, effective_to: 200, created_at: 100, note: null },
      { ownership_bps: 2000, profit_basis: 'net', effective_from: 200, effective_to: null, created_at: 200, note: null },
    ]),
    findOne: jest.fn().mockResolvedValue({ ownership_bps: 2000, profit_basis: 'net' }),
    create: jest.fn((x) => x),
    save: jest.fn(),
    update: jest.fn(),
    ...over.stakeRepo,
  };
  const distRepo: any = {
    find: jest.fn().mockResolvedValue([
      { amount: 100_000, distributed_at: 250, created_at: 250, note: null },
    ]),
    create: jest.fn((x) => x),
    save: jest.fn(),
    ...over.distRepo,
  };
  const basisReqRepo: any = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x) => x),
    save: jest.fn(),
    delete: jest.fn(),
    ...over.basisReqRepo,
  };
  const fbhRepo: any = {
    createQueryBuilder: jest.fn(() => makeQb({ opex: '0' })),
    query: jest.fn().mockResolvedValue([]),
    ...over.fbhRepo,
  };
  const userRepo: any = { findOne: jest.fn(), find: jest.fn(), ...over.userRepo };
  const orderService: any = {
    getRevenueStats: jest.fn().mockResolvedValue({ data: { data: [] } }),
    ...over.orderService,
  };
  const dataSource: any = { transaction: jest.fn(), ...over.dataSource };
  const activityLog: any = { log: jest.fn() };
  return new InvestorLedgerService(
    capitalRepo, withdrawalRepo, stakeRepo, distRepo, basisReqRepo, fbhRepo,
    userRepo, orderService, dataSource, activityLog,
  );
};

describe('InvestorLedgerService', () => {
  it("computeDaily — TO'LIQ OpEx ayiriladi; jami = ulush% × sof foyda", async () => {
    const day = '2026-03-25';
    const svc = makeLedger({
      stakeRepo: {
        find: jest.fn().mockResolvedValue([
          { ownership_bps: 2000, profit_basis: 'net', effective_from: toUzbekistanTimestamp(day, false), effective_to: null },
        ]),
      },
      distRepo: { find: jest.fn().mockResolvedValue([]) },
      // OpEx BUTUN oraliq bo'yicha (buyurtmasiz kunda ham) — 375000
      fbhRepo: { query: jest.fn().mockResolvedValue([{ day, opex: '375000' }]) },
      orderService: {
        getRevenueStats: jest.fn().mockResolvedValue({
          data: { data: [{ period: day, label: '25.03', ordersCount: 5, revenue: 505000 }] },
        }),
      },
    });
    const r: any = await (svc as any).computeDaily('inv', day, day);
    expect(r.totals.revenue).toBe(505000);
    expect(r.totals.postProfit).toBe(130000); // 505000 − 375000
    expect(r.totals.investorShare).toBe(26000); // 20% × 130000
  });

  it("computeDaily — har kun O'ZINING ulush versiyasi bilan (vaqt-tortilgan)", async () => {
    const dayA = '2026-03-01';
    const dayB = '2026-03-02';
    const svc = makeLedger({
      stakeRepo: {
        find: jest.fn().mockResolvedValue([
          { ownership_bps: 1000, profit_basis: 'net', effective_from: toUzbekistanTimestamp(dayA, false), effective_to: toUzbekistanTimestamp(dayB, false) },
          { ownership_bps: 2000, profit_basis: 'net', effective_from: toUzbekistanTimestamp(dayB, false), effective_to: null },
        ]),
      },
      distRepo: { find: jest.fn().mockResolvedValue([]) },
      fbhRepo: { query: jest.fn().mockResolvedValue([]) }, // OpEx yo'q
      orderService: {
        getRevenueStats: jest.fn().mockResolvedValue({
          data: { data: [
            { period: dayA, label: '01.03', ordersCount: 2, revenue: 500000 },
            { period: dayB, label: '02.03', ordersCount: 3, revenue: 300000 },
          ] },
        }),
      },
    });
    const r: any = await (svc as any).computeDaily('inv', dayA, dayB);
    // dayA: 10% × 500000 = 50000; dayB: 20% × 300000 = 60000
    expect(r.totals.investorShare).toBe(110000);
    expect(r.days.find((d: any) => d.date === dayA).ownershipPct).toBe(10);
    expect(r.days.find((d: any) => d.date === dayB).ownershipPct).toBe(20);
  });

  it('INVARIANT: hero (getSummary) == kunlik jadval jami (getDailyBreakdown)', async () => {
    const day = '2026-03-25';
    const over = {
      stakeRepo: {
        find: jest.fn().mockResolvedValue([
          { ownership_bps: 2000, profit_basis: 'net', effective_from: toUzbekistanTimestamp(day, false), effective_to: null },
        ]),
      },
      distRepo: { find: jest.fn().mockResolvedValue([{ amount: 10000, distributed_at: toUzbekistanTimestamp(day, false), created_at: 0 }]) },
      fbhRepo: { query: jest.fn().mockResolvedValue([{ day, opex: '375000' }]) },
      orderService: {
        getRevenueStats: jest.fn().mockResolvedValue({
          data: { data: [{ period: day, label: '25.03', ordersCount: 5, revenue: 505000 }] },
        }),
      },
    };
    const svc = makeLedger(over);
    // Ikkalasi ham BUTUN DAVR (lifetime) — hero balansi filtrga bog'liq emas.
    const sum: any = await svc.getSummary('inv');
    const daily: any = await svc.getDailyBreakdown('inv');
    // Bir xil dvigatel → hero AYNAN kunlik jami bilan bir xil.
    expect(sum.data.accruedProfitShare).toBe(daily.data.totals.investorShare);
    expect(sum.data.netProfitLifetime).toBe(daily.data.totals.postProfit);
    expect(sum.data.accruedProfitShare).toBe(26000);
    expect(sum.data.distributionsPaid).toBe(10000);
    expect(sum.data.undistributed).toBe(16000); // 26000 − 10000
  });

  it('getSummary — ROI + profitBasis to\'g\'ri (kunlik dvigateldan)', async () => {
    const day = '2026-03-25';
    const svc = makeLedger({
      stakeRepo: {
        find: jest.fn().mockResolvedValue([
          { ownership_bps: 2000, profit_basis: 'net', effective_from: toUzbekistanTimestamp(day, false), effective_to: null },
        ]),
      },
      distRepo: { find: jest.fn().mockResolvedValue([{ amount: 100000, distributed_at: toUzbekistanTimestamp(day, false), created_at: 0 }]) },
      fbhRepo: { query: jest.fn().mockResolvedValue([]) }, // OpEx yo'q → sof = yalpi
      orderService: {
        getRevenueStats: jest.fn().mockResolvedValue({
          data: { data: [{ period: day, label: '25.03', ordersCount: 5, revenue: 550000 }] },
        }),
      },
    });
    const res: any = await svc.getSummary('inv');
    const d = res.data;
    expect(d.capitalInvested).toBe(1_000_000);
    expect(d.ownershipBps).toBe(2000);
    expect(d.profitBasis).toBe('net');
    expect(d.accruedProfitShare).toBe(110_000); // 20% × 550000
    expect(d.distributionsPaid).toBe(100_000);
    expect(d.accruedRoiPct).toBe(11); // 110000/1000000
    expect(d.realizedRoiPct).toBe(10); // 100000/1000000
    expect(d.netProfitLifetime).toBe(550_000);
  });

  it("capital 0 bo'lsa ROI null (NaN emas)", async () => {
    const svc = makeLedger({ capitalRepo: { find: jest.fn().mockResolvedValue([]) } });
    const res: any = await svc.getSummary('inv');
    expect(res.data.accruedRoiPct).toBeNull();
    expect(res.data.realizedRoiPct).toBeNull();
  });

  it('kapital qaytarish sof kapitalni kamaytiradi', async () => {
    const svc = makeLedger({
      capitalRepo: { find: jest.fn().mockResolvedValue([{ amount: 1_000_000, contributed_at: 50, created_at: 50 }]) },
      withdrawalRepo: { find: jest.fn().mockResolvedValue([{ amount: 300_000, withdrawn_at: 100, created_at: 100 }]) },
    });
    const res: any = await svc.getSummary('inv');
    expect(res.data.capitalContributed).toBe(1_000_000);
    expect(res.data.capitalWithdrawn).toBe(300_000);
    expect(res.data.capitalInvested).toBe(700_000);
  });

  it('recordWithdrawal joriy kapitaldan oshsa RAD etadi', async () => {
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      capitalRepo: { find: jest.fn().mockResolvedValue([{ amount: 500_000 }]) },
      withdrawalRepo: { find: jest.fn().mockResolvedValue([]), create: jest.fn((x) => x), save: jest.fn() },
    });
    await expect(
      svc.recordWithdrawal('inv', { amount: 600_000 } as any, { id: 'a' } as any),
    ).rejects.toThrow();
  });

  const ownershipTx = () => ({
    transaction: jest.fn(async (cb: any) =>
      cb({ getRepository: () => ({ update: jest.fn(), create: jest.fn((x) => x), save: jest.fn() }) }),
    ),
  });

  it('setOwnership: DASTLABKI ulushда (ochiq stake yo\'q) admin asosni erkin tanlaydi', async () => {
    const repoUpdate = jest.fn();
    const repoSave = jest.fn();
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      stakeRepo: { findOne: jest.fn().mockResolvedValue(null) },
      dataSource: {
        transaction: jest.fn(async (cb: any) =>
          cb({ getRepository: () => ({ update: repoUpdate, create: jest.fn((x) => x), save: repoSave }) }),
        ),
      },
    });
    const res: any = await svc.setOwnership('inv', { ownership_bps: 3000, profit_basis: 'gross' } as any, { id: 'admin' } as any);
    expect(repoUpdate).toHaveBeenCalled();
    expect(repoSave).toHaveBeenCalled();
    expect(res.data.profit_basis).toBe('gross');
  });

  it('setOwnership: MAVJUD investorда to\'g\'ridan-to\'g\'ri asos O\'ZGARMAYDI (tasdiq shart)', async () => {
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      stakeRepo: { findOne: jest.fn().mockResolvedValue({ ownership_bps: 1000, profit_basis: 'net' }) },
      dataSource: ownershipTx(),
    });
    // 'gross' so'ralsa ham joriy 'net' saqlanadi (asos loophole yopiq).
    const res: any = await svc.setOwnership('inv', { ownership_bps: 3000, profit_basis: 'gross' } as any, { id: 'admin' } as any);
    expect(res.data.profit_basis).toBe('net');
  });

  it('setOwnership: fromConsent bilan asos o\'zgaradi (investor tasdig\'i orqali)', async () => {
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      stakeRepo: { findOne: jest.fn().mockResolvedValue({ ownership_bps: 1000, profit_basis: 'net' }) },
      dataSource: ownershipTx(),
    });
    const res: any = await svc.setOwnership('inv', { ownership_bps: 1000, profit_basis: 'gross' } as any, { id: 'admin' } as any, { fromConsent: true });
    expect(res.data.profit_basis).toBe('gross');
  });

  it('setOwnership: BACKDATE (joriy ochiqdan oldinga) RAD etadi — tarixiy hisob himoyasi', async () => {
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      stakeRepo: { findOne: jest.fn().mockResolvedValue({ ownership_bps: 1000, profit_basis: 'net', effective_from: 1000 }) },
      dataSource: ownershipTx(),
    });
    await expect(
      svc.setOwnership('inv', { ownership_bps: 2000, effective_from: 500 } as any, { id: 'admin' } as any),
    ).rejects.toThrow();
  });

  it('setOwnership: DASTLABKI ulushни istalgan o\'tmish sanaga o\'rnatish mumkin (onboarding)', async () => {
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      stakeRepo: { findOne: jest.fn().mockResolvedValue(null) }, // ochiq ulush yo'q
      dataSource: ownershipTx(),
    });
    const res: any = await svc.setOwnership('inv', { ownership_bps: 1000, effective_from: 500, profit_basis: 'gross' } as any, { id: 'admin' } as any);
    expect(res.data.effective_from).toBe(500);
    expect(res.data.profit_basis).toBe('gross');
  });

  it('setOwnership investor bo\'lmaganda rad etadi', async () => {
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'x', role: 'admin' }) },
    });
    await expect(
      svc.setOwnership('x', { ownership_bps: 1000 } as any, { id: 'a' } as any),
    ).rejects.toThrow();
  });

  it('proposeBasisChange kutayotgan so\'rov yozadi (o\'zi o\'zgartirmaydi)', async () => {
    const save = jest.fn();
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      basisReqRepo: { findOne: jest.fn(), create: jest.fn((x) => x), save, delete: jest.fn() },
    });
    await svc.proposeBasisChange('inv', 'gross', { id: 'admin' } as any);
    expect(save).toHaveBeenCalled();
  });

  it('approveBasisRequest so\'rovni qo\'llaydi (setOwnership) va o\'chiradi', async () => {
    const del = jest.fn();
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      stakeRepo: { findOne: jest.fn().mockResolvedValue({ ownership_bps: 1000, profit_basis: 'net' }) },
      basisReqRepo: { findOne: jest.fn().mockResolvedValue({ requested_basis: 'gross' }), delete: del },
      dataSource: { transaction: jest.fn(async (cb: any) => cb({ getRepository: () => ({ update: jest.fn(), create: jest.fn((x) => x), save: jest.fn() }) })) },
    });
    const res: any = await svc.approveBasisRequest('inv', { id: 'inv' } as any);
    expect(res.data.profit_basis).toBe('gross');
    expect(del).toHaveBeenCalled();
  });

  it('approveBasisRequest so\'rov yo\'q bo\'lsa rad etadi', async () => {
    const svc = makeLedger({ basisReqRepo: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(svc.approveBasisRequest('inv', { id: 'inv' } as any)).rejects.toThrow();
  });
});
