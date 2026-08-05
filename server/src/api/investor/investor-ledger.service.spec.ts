import { InvestorLedgerService } from './investor-ledger.service';

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
  const fbhRepo: any = {
    createQueryBuilder: jest.fn(() => makeQb({ opex: '0' })),
    ...over.fbhRepo,
  };
  const userRepo: any = { findOne: jest.fn(), find: jest.fn(), ...over.userRepo };
  const orderService: any = {
    getStats: jest.fn().mockResolvedValue({ data: { profit: 0 } }),
    ...over.orderService,
  };
  const dataSource: any = { transaction: jest.fn(), ...over.dataSource };
  const activityLog: any = { log: jest.fn() };
  return new InvestorLedgerService(
    capitalRepo, withdrawalRepo, stakeRepo, distRepo, fbhRepo, userRepo,
    orderService, dataSource, activityLog,
  );
};

describe('InvestorLedgerService', () => {
  it('grossProfitBetween = buyurtma-asosli (getStats.profit)', async () => {
    const svc = makeLedger({
      orderService: { getStats: jest.fn().mockResolvedValue({ data: { profit: 665000 } }) },
    });
    expect(await svc.grossProfitBetween(0, 100)).toBe(665000);
  });

  it('opexBetween = FBH salary+bills+manual_expense magnitudasi', async () => {
    const svc = makeLedger({
      fbhRepo: { createQueryBuilder: () => makeQb({ opex: '390000' }) },
    });
    expect(await svc.opexBetween(0, 100)).toBe(390000);
  });

  it('netProfitBetween = yalpi − OpEx', async () => {
    const svc = makeLedger({
      orderService: { getStats: jest.fn().mockResolvedValue({ data: { profit: 665000 } }) },
      fbhRepo: { createQueryBuilder: () => makeQb({ opex: '390000' }) },
    });
    expect(await svc.netProfitBetween(0, 100)).toBe(275000); // 665k − 390k
  });

  it("profitBetween: 'gross' → yalpi, 'net' → sof", async () => {
    const svc = makeLedger({
      orderService: { getStats: jest.fn().mockResolvedValue({ data: { profit: 665000 } }) },
      fbhRepo: { createQueryBuilder: () => makeQb({ opex: '390000' }) },
    });
    expect(await svc.profitBetween(0, 100, 'gross')).toBe(665000);
    expect(await svc.profitBetween(0, 100, 'net')).toBe(275000);
  });

  it('accruedProfitShare — mid-period stake change vaqt-tortiladi (basis bo\'yicha)', async () => {
    const svc = makeLedger();
    jest.spyOn(svc, 'profitBetween').mockImplementation(async (from: number) =>
      from === 100 ? 500_000 : from === 200 ? 300_000 : 0,
    );
    const accrued = await (svc as any).accruedProfitShare('inv', 100, 300);
    // floor(500000*1000/10000) + floor(300000*2000/10000) = 50000 + 60000
    expect(accrued).toBe(110_000);
  });

  it('getSummary — ROI + profitBasis to\'g\'ri', async () => {
    const svc = makeLedger();
    jest.spyOn(svc, 'profitBetween').mockImplementation(async (from: number) =>
      from === 100 ? 500_000 : from === 200 ? 300_000 : 0,
    );
    jest.spyOn(svc, 'netProfitBetween').mockImplementation(async (from: number) =>
      from === 0 ? 800_000 : 0,
    );
    const res: any = await svc.getSummary('inv');
    const d = res.data;
    expect(d.capitalInvested).toBe(1_000_000);
    expect(d.ownershipBps).toBe(2000);
    expect(d.profitBasis).toBe('net');
    expect(d.accruedProfitShare).toBe(110_000);
    expect(d.distributionsPaid).toBe(100_000);
    expect(d.accruedRoiPct).toBe(11);
    expect(d.realizedRoiPct).toBe(10);
    expect(d.netProfitForRange).toBe(800_000);
  });

  it("capital 0 bo'lsa ROI null (NaN emas)", async () => {
    const svc = makeLedger({ capitalRepo: { find: jest.fn().mockResolvedValue([]) } });
    jest.spyOn(svc, 'profitBetween').mockResolvedValue(0);
    jest.spyOn(svc, 'netProfitBetween').mockResolvedValue(0);
    const res: any = await svc.getSummary('inv');
    expect(res.data.accruedRoiPct).toBeNull();
    expect(res.data.realizedRoiPct).toBeNull();
  });

  it('kapital qaytarish sof kapitalni kamaytiradi', async () => {
    const svc = makeLedger({
      capitalRepo: { find: jest.fn().mockResolvedValue([{ amount: 1_000_000, contributed_at: 50, created_at: 50 }]) },
      withdrawalRepo: { find: jest.fn().mockResolvedValue([{ amount: 300_000, withdrawn_at: 100, created_at: 100 }]) },
    });
    jest.spyOn(svc, 'profitBetween').mockResolvedValue(0);
    jest.spyOn(svc, 'netProfitBetween').mockResolvedValue(0);
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

  it('setOwnership joriy ochiqni yopib yangi (basis bilan) qo\'shadi', async () => {
    const repoUpdate = jest.fn();
    const repoSave = jest.fn();
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      stakeRepo: { findOne: jest.fn().mockResolvedValue({ ownership_bps: 1000, profit_basis: 'net' }) },
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

  it('setOwnership investor bo\'lmaganda rad etadi', async () => {
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'x', role: 'admin' }) },
    });
    await expect(
      svc.setOwnership('x', { ownership_bps: 1000 } as any, { id: 'a' } as any),
    ).rejects.toThrow();
  });
});
