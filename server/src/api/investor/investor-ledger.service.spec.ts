import { InvestorLedgerService } from './investor-ledger.service';

// Chainable QueryBuilder mock — getRawMany berilgan qatorlarni qaytaradi.
const makeQb = (rows: any[]) => {
  const qb: any = {};
  qb.select = () => qb;
  qb.addSelect = () => qb;
  qb.where = () => qb;
  qb.groupBy = () => qb;
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
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
      { ownership_bps: 1000, effective_from: 100, effective_to: 200, created_at: 100, note: null },
      { ownership_bps: 2000, effective_from: 200, effective_to: null, created_at: 200, note: null },
    ]),
    findOne: jest.fn().mockResolvedValue({ ownership_bps: 2000 }),
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
  const fbhRepo: any = { createQueryBuilder: jest.fn(() => makeQb([])), ...over.fbhRepo };
  const userRepo: any = { findOne: jest.fn(), find: jest.fn(), ...over.userRepo };
  const dataSource: any = { transaction: jest.fn(), ...over.dataSource };
  const activityLog: any = { log: jest.fn() };
  return new InvestorLedgerService(
    capitalRepo, withdrawalRepo, stakeRepo, distRepo, fbhRepo, userRepo, dataSource, activityLog,
  );
};

describe('InvestorLedgerService', () => {
  it("netProfitBetween = SELL_PROFIT − (SALARY+BILLS+MANUAL_EXPENSE); manual_income/correction e'tiborsiz", async () => {
    const rows = [
      { source_type: 'sell_profit', pos: '10000000', neg: '0' },
      { source_type: 'salary', pos: '0', neg: '3000000' },
      { source_type: 'bills', pos: '0', neg: '1000000' },
      { source_type: 'manual_expense', pos: '0', neg: '500000' },
      { source_type: 'manual_income', pos: '500000', neg: '0' },
      { source_type: 'correction', pos: '200000', neg: '0' },
    ];
    const svc = makeLedger({ fbhRepo: { createQueryBuilder: () => makeQb(rows) } });
    const np = await svc.netProfitBetween(0, 100);
    expect(np).toBe(10_000_000 - (3_000_000 + 1_000_000 + 500_000)); // 5.5M
  });

  it("netProfitBetween: to <= from bo'lsa 0", async () => {
    const svc = makeLedger();
    expect(await svc.netProfitBetween(100, 100)).toBe(0);
    expect(await svc.netProfitBetween(200, 100)).toBe(0);
  });

  it('accruedProfitShare — mid-period stake change vaqt-tortiladi', async () => {
    const svc = makeLedger();
    // Har sub-davr O'SHA paytdagi ulush bilan: [100,200)@10%, [200,300)@20%
    jest
      .spyOn(svc, 'netProfitBetween')
      .mockImplementation(async (from: number) =>
        from === 100 ? 500_000 : from === 200 ? 300_000 : 0,
      );
    const accrued = await (svc as any).accruedProfitShare('inv', 100, 300);
    // floor(500000*1000/10000) + floor(300000*2000/10000) = 50000 + 60000
    expect(accrued).toBe(110_000);
  });

  it('getSummary — ROI (accrued va realized) to\'g\'ri hisoblanadi', async () => {
    const svc = makeLedger();
    jest
      .spyOn(svc, 'netProfitBetween')
      .mockImplementation(async (from: number) =>
        from === 100 ? 500_000 : from === 200 ? 300_000 : from === 0 ? 800_000 : 0,
      );
    const res: any = await svc.getSummary('inv'); // range = [0, now]
    const d = res.data;
    expect(d.capitalInvested).toBe(1_000_000);
    expect(d.ownershipBps).toBe(2000);
    expect(d.ownershipPct).toBe(20);
    expect(d.accruedProfitShare).toBe(110_000);
    expect(d.distributionsPaid).toBe(100_000);
    expect(d.undistributed).toBe(10_000);
    expect(d.accruedRoiPct).toBe(11); // 110000/1000000*100
    expect(d.realizedRoiPct).toBe(10); // 100000/1000000*100
    expect(d.netProfitForRange).toBe(800_000);
  });

  it("capital 0 bo'lsa ROI null (NaN emas)", async () => {
    const svc = makeLedger({ capitalRepo: { find: jest.fn().mockResolvedValue([]) } });
    jest.spyOn(svc, 'netProfitBetween').mockResolvedValue(0);
    const res: any = await svc.getSummary('inv');
    expect(res.data.accruedRoiPct).toBeNull();
    expect(res.data.realizedRoiPct).toBeNull();
  });

  it('kapital qaytarish sof kapitalni kamaytiradi (contributed − withdrawn)', async () => {
    const svc = makeLedger({
      capitalRepo: {
        find: jest.fn().mockResolvedValue([{ amount: 1_000_000, contributed_at: 50, created_at: 50 }]),
      },
      withdrawalRepo: {
        find: jest.fn().mockResolvedValue([{ amount: 300_000, withdrawn_at: 100, created_at: 100 }]),
      },
    });
    jest.spyOn(svc, 'netProfitBetween').mockResolvedValue(0);
    const res: any = await svc.getSummary('inv');
    expect(res.data.capitalContributed).toBe(1_000_000);
    expect(res.data.capitalWithdrawn).toBe(300_000);
    expect(res.data.capitalInvested).toBe(700_000); // 1M − 300k
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

  it('recordWithdrawal kapital yetsa yozadi', async () => {
    const save = jest.fn();
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      capitalRepo: { find: jest.fn().mockResolvedValue([{ amount: 500_000 }]) },
      withdrawalRepo: { find: jest.fn().mockResolvedValue([]), create: jest.fn((x) => x), save },
    });
    await svc.recordWithdrawal('inv', { amount: 200_000 } as any, { id: 'a' } as any);
    expect(save).toHaveBeenCalled();
  });

  it("setOwnership joriy ochiq qatorni yopadi va yangi qo'shadi (tranzaksiya)", async () => {
    const repoUpdate = jest.fn();
    const repoSave = jest.fn();
    const repoCreate = jest.fn((x) => x);
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'inv', role: 'investor' }) },
      dataSource: {
        transaction: jest.fn(async (cb: any) =>
          cb({
            getRepository: () => ({ update: repoUpdate, create: repoCreate, save: repoSave }),
          }),
        ),
      },
    });
    await svc.setOwnership('inv', { ownership_bps: 3000 } as any, { id: 'admin' } as any);
    expect(repoUpdate).toHaveBeenCalled(); // eski ochiq yopildi
    expect(repoSave).toHaveBeenCalled(); // yangi ochiq qo'shildi
  });

  it("setOwnership investor bo'lmaganda rad etadi", async () => {
    const svc = makeLedger({
      userRepo: { findOne: jest.fn().mockResolvedValue({ id: 'x', role: 'admin' }) },
    });
    await expect(
      svc.setOwnership('x', { ownership_bps: 1000 } as any, { id: 'a' } as any),
    ).rejects.toThrow();
  });
});
