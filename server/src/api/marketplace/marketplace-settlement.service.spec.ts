import { BadRequestException } from '@nestjs/common';
import { MarketplaceSettlementService } from './marketplace-settlement.service';
import { MarketplaceSettlementMethod } from './marketplace.enums';
import { JwtPayload } from 'src/common/utils/types/user.type';

const USER = { id: 'admin-1', role: 'admin' } as JwtPayload;
const INTEGRATION = { id: 'int-1', slug: 'uzum', name: 'Uzum', market_id: 'market-1' };

function build(opts: { integration?: any; balances?: any[] } = {}) {
  const saved: any[] = [];
  const sql: string[] = [];
  const manager = {
    findOne: jest.fn(async (entity: any, q: any) => {
      const n = entity?.name ?? '';
      if (n === 'CashEntity') {
        return q?.where?.cashbox_type === 'main'
          ? { id: 'main-1', balance: 9_000_000 }
          : { id: 'mcb-1', balance: 42_350_000 };
      }
      return null;
    }),
    create: jest.fn((_e: any, v: any) => ({ ...v })),
    save: jest.fn(async (a: any, b?: any) => {
      const v = b ?? a;
      const row = { id: v.id ?? `row-${saved.length + 1}`, ...v };
      saved.push(row);
      return row;
    }),
    update: jest.fn(async () => ({})),
    query: jest.fn(async (s: string) => {
      sql.push(s);
      if (/UPDATE "cash_box"/.test(s)) return [{ balance: '100' }];
      if (/next_ledger_seq/.test(s)) return [{ next_ledger_seq: '7' }];
      return [];
    }),
  };
  const qr = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    manager,
  };
  const ledger = {
    appendEntry: jest.fn(async (_m: any, i: any) => ({
      id: 'le-1', balance_after: 2_350_000, ...i,
    })),
    balancesBySeller: jest.fn(async () => opts.balances ?? []),
    verifyInvariant: jest.fn(async () => ({ ok: true, ledger_sum: 0, cashbox_balance: 0, diff: 0 })),
  };
  const repo = (found: any) => ({ findOne: jest.fn(async () => found) });
  const svc = new MarketplaceSettlementService(
    repo(opts.integration === undefined ? INTEGRATION : opts.integration) as any,
    repo(null) as any,
    { createQueryRunner: () => qr } as any,
    ledger as any,
    { enqueueParcelEvent: jest.fn() } as any,
  );
  return { svc, manager, saved, sql, ledger, qr };
}

const pay = (svc: MarketplaceSettlementService, over: any = {}) =>
  svc.pay('uzum', {
    amount: 8_520_000,
    method: MarketplaceSettlementMethod.BANK_TRANSFER,
    allocation: [
      { seller_id: 'SLR-77', amount: 5_120_000 },
      { seller_id: 'SLR-81', amount: 3_400_000 },
    ],
    reference: 'TXN-1',
    ...over,
  }, USER);

describe('MarketplaceSettlementService.pay', () => {
  it("to'lovni amalga oshiradi: ikki kassa + daftar + hodisa", async () => {
    const { svc, saved, ledger } = build();
    const r = await pay(svc);

    expect(r.amount).toBe(8_520_000);
    // Daftarda BITTA umumiy yozuv — kassada ham bitta chiqim bor.
    // `SUM(daftar) == kassa balansi` invarianti shu bilan saqlanadi.
    expect(ledger.appendEntry).toHaveBeenCalledTimes(1);
    expect((ledger.appendEntry.mock.calls[0][1] as any).amount).toBe(-8_520_000);

    const ev = saved.find((x) => x.event_type === 'settlement.paid');
    expect(ev).toBeDefined();
    expect(ev.payload.settlement.allocation).toHaveLength(2);
    // Hisob-kitob posilkaga bog'liq emas.
    expect(ev.payload.parcel).toBeUndefined();
    expect(ev.aggregate_type).toBe('settlement');
  });

  it('TAQSIMOT yig\'indisi summaga teng bo\'lmasa RAD ETADI', async () => {
    // ⚠️ Aks holda marketplace sotuvchilarga noto'g'ri taqsimlaydi va farq
    // hech qayerda ko'rinmaydi — eng yomon turdagi xato.
    const { svc } = build();
    await expect(
      pay(svc, { allocation: [{ seller_id: 'SLR-77', amount: 1 }] }),
    ).rejects.toThrow(/teng emas/);
  });

  it("taqsimotsiz to'lovni RAD ETADI", async () => {
    // Marketplace kimga qancha berishni shundan biladi.
    const { svc } = build();
    await expect(pay(svc, { allocation: [] })).rejects.toThrow(/taqsimot/i);
  });

  it('manfiy yoki nol summani rad etadi', async () => {
    const { svc } = build();
    await expect(pay(svc, { amount: 0, allocation: [{ seller_id: 'A', amount: 0 }] }))
      .rejects.toThrow(BadRequestException);
    await expect(
      pay(svc, { amount: 100, allocation: [{ seller_id: 'A', amount: 100 }, { seller_id: 'B', amount: 0 }] }),
    ).rejects.toThrow(/musbat/);
  });

  it('xatoda tranzaksiyani QAYTARADI', async () => {
    const { svc, qr } = build();
    await expect(pay(svc, { allocation: [{ seller_id: 'A', amount: 1 }] })).rejects.toThrow();
    // Validatsiya tranzaksiyadan OLDIN — qr umuman ochilmaydi.
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();
  });
});

describe('MarketplaceSettlementService.suggestAllocation', () => {
  it("faqat MUSBAT qoldiqlarni taklif qiladi", async () => {
    // ⚠️ Manfiy qoldiq (prepaid posilkalar sabab) — sotuvchining BIZGA
    // qarzi. Unga to'lash noto'g'ri bo'lardi.
    const { svc } = build({
      balances: [
        { seller_id: 'SLR-77', balance: 5_120_000, entries: 40 },
        { seller_id: 'SLR-81', balance: -50_000, entries: 3 },
        { seller_id: null, balance: 1000, entries: 1 },
      ],
    });
    const r = await svc.suggestAllocation('uzum');

    expect(r.sellers).toHaveLength(1);
    expect(r.sellers[0].seller_id).toBe('SLR-77');
    expect(r.total_payable).toBe(5_120_000);
    expect(r.negative_sellers).toHaveLength(1);
    expect(r.negative_sellers[0].seller_id).toBe('SLR-81');
  });
});
