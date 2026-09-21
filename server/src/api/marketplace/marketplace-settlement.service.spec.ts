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
      // ⚠️ TUPLE — `UPDATE ... RETURNING` ning haqiqiy shakli.
      if (/UPDATE "cash_box"/.test(s)) return [[{ balance: '100' }], 1];
      if (/next_ledger_seq/.test(s)) return [[{ next_ledger_seq: '7' }], 1];
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
    // ⚠️ Qarz endi AYNAN shu `cashbox_balance` dan olinadi — sotuvchilar
    // yig'indisidan emas (to'lov yaxlit va `seller_id` siz yoziladi).
    verifyInvariant: jest.fn(async () => ({
      ok: true,
      ledger_sum: 42_350_000,
      cashbox_balance: 42_350_000,
      diff: 0,
    })),
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
    reference: 'TXN-1',
    ...over,
  }, USER);

describe('MarketplaceSettlementService.pay', () => {
  it("to'lovni amalga oshiradi: ikki kassa + daftar + hodisa", async () => {
    const { svc, saved, ledger } = build();
    const r = await pay(svc);

    expect(r.amount).toBe(8_520_000);
    /**
     * ⚠️ BITTA daftar yozuvi, `seller_id` SIZ.
     *
     * To'lov YAXLIT: marketplace pulni oladi va o'z sotuvchilariga
     * O'ZI tarqatadi (qaror 2026-09-17). Shu sabab to'lov hech bir
     * sotuvchiga yozilmaydi — u umumiy qarzni kamaytiradi.
     */
    expect(ledger.appendEntry).toHaveBeenCalledTimes(1);
    const entry = ledger.appendEntry.mock.calls[0][1] as any;
    expect(entry.seller_id).toBeNull();
    expect(entry.amount).toBe(-8_520_000);
    expect(entry.cashbox_history_id).toBeTruthy();

    const ev = saved.find((x) => x.event_type === 'settlement.paid');
    expect(ev).toBeDefined();
    // Taqsimot YUBORILMAYDI — ular kimga qancha berishni posilka
    // hodisalaridagi `seller_id` dan biladi.
    expect(ev.payload.settlement.allocation).toBeUndefined();
    expect(ev.payload.settlement.amount).toBe(8_520_000);
    // Hisob-kitob posilkaga bog'liq emas.
    expect(ev.payload.parcel).toBeUndefined();
    expect(ev.aggregate_type).toBe('settlement');
  });



  it('manfiy yoki nol summani rad etadi', async () => {
    const { svc, qr } = build();
    await expect(pay(svc, { amount: 0 })).rejects.toThrow(BadRequestException);
    await expect(pay(svc, { amount: -5 })).rejects.toThrow(/musbat/);
    // Validatsiya tranzaksiyadan OLDIN — qr umuman ochilmaydi.
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();
  });
});

describe('MarketplaceSettlementService.suggestAllocation', () => {
  it('QARZ kassadan olinadi, sotuvchilar ro\'yxati QAYTARILMAYDI', async () => {
    /**
     * ⚠️ Biz ularning sotuvchilarini BILMAYMIZ va ular bizga faqat ID
     * yuborishi mumkin. `SLR-77` qatorini adminga ko'rsatish foydasiz
     * shovqin — u bu ID kimligini bilmaydi.
     *
     * Adminga YAGONA son kerak: ularga qancha qarzdormiz. U esa
     * MARKET KASSASIDAN olinadi (to'lov yaxlit va daftarga `seller_id`
     * siz yozilgani uchun sotuvchilar yig'indisidan hisoblab bo'lmaydi).
     */
    const { svc } = build();
    const r: any = await svc.suggestAllocation('uzum');

    expect(r.total_payable).toBe(42_350_000); // kassa balansi
    expect(r.sellers).toBeUndefined();
    expect(r.negative_sellers).toBeUndefined();
    expect(r.invariant.ok).toBe(true);
  });
});
