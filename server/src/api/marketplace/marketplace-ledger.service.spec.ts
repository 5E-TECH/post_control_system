import { MarketplaceLedgerService } from './marketplace-ledger.service';
import { MarketplaceLedgerEntryType } from './marketplace.enums';

const INT = 'int-1';

function makeManager(opts: {
  existing?: any;
  cashboxBalanceAfter?: number;
  lastSeller?: number | null;
  lastEntry?: any;
} = {}) {
  let seq = 0;
  const saved: any[] = [];
  return {
    saved,
    seqCalls: 0,
    query: jest.fn(async function (this: any, sql: string) {
      if (/UPDATE "marketplace_integration"/.test(sql)) {
        seq += 1;
        return [{ next_ledger_seq: String(seq) }];
      }
      if (/FROM "cashbox_history"/.test(sql)) {
        return opts.cashboxBalanceAfter === undefined
          ? []
          : [{ balance_after: String(opts.cashboxBalanceAfter) }];
      }
      if (/seller_balance_after/.test(sql)) {
        return opts.lastSeller == null ? [] : [{ seller_balance_after: String(opts.lastSeller) }];
      }
      return [];
    }),
    findOne: jest.fn(async (_e: any, q: any) => {
      if (q?.where?.cashbox_history_id) return opts.existing ?? null;
      return opts.lastEntry ?? null;
    }),
    create: jest.fn((_e: any, v: any) => ({ ...v })),
    save: jest.fn(async (_e: any, v: any) => {
      const row = { id: `le-${saved.length + 1}`, ...v };
      saved.push(row);
      return row;
    }),
  };
}

const svc = () => new MarketplaceLedgerService({} as any, {} as any, {} as any);

describe('MarketplaceLedgerService.appendEntry', () => {
  it('yozuv qo\'shadi va DB TASDIQLAGAN balansni oladi', async () => {
    const m = makeManager({ cashboxBalanceAfter: 42_350_000, lastSeller: 5_000_000 });
    const e = await svc().appendEntry(m as any, {
      integration_id: INT,
      entry_type: MarketplaceLedgerEntryType.SALE,
      amount: 145000,
      seller_id: 'SLR-77',
      cashbox_history_id: 'ch-1',
      tariff_version: 3,
    });

    // ⚠️ `balance_after` xotiradagi taxmin EMAS — `cashbox_history` dan
    // o'qiladi, ya'ni kassa haqiqatda nima yozganiga tayanadi.
    expect(e.balance_after).toBe(42_350_000);
    expect(e.seller_balance_after).toBe(5_145_000);
    expect(e.seq).toBe(1);
    expect(e.tariff_version).toBe(3);
  });

  it('AYNI kassa yozuvi ikkinchi marta qator YARATMAYDI', async () => {
    // ⚠️ Idempotentlik langari. Tekshiruv INSERT'dan OLDIN: unique
    // buzilishi Postgres'da butun tranzaksiyani «aborted» qilib,
    // chaqiruvchining KASSA yozuvini ham yo'qotardi.
    const existing = { id: 'le-old', amount: 145000 };
    const m = makeManager({ existing });
    const e = await svc().appendEntry(m as any, {
      integration_id: INT,
      entry_type: MarketplaceLedgerEntryType.SALE,
      amount: 145000,
      cashbox_history_id: 'ch-1',
    });

    expect(e).toBe(existing);
    expect(m.save).not.toHaveBeenCalled();
    // `seq` ham SARFLANMAYDI — takroriy chaqiruv raqamlarda teshik qoldirmasin.
    expect(m.query).not.toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE "marketplace_integration"/),
      expect.anything(),
    );
  });

  it('MANFIY summani qabul qiladi (prepaid, bekor)', async () => {
    // Qaror P8: prepaid posilkada marketplace BIZGA qarzdor bo'ladi.
    const m = makeManager({ cashboxBalanceAfter: -50_000, lastSeller: 0 });
    const e = await svc().appendEntry(m as any, {
      integration_id: INT,
      entry_type: MarketplaceLedgerEntryType.SALE,
      amount: -50000,
      seller_id: 'SLR-81',
      cashbox_history_id: 'ch-2',
    });
    expect(e.amount).toBe(-50000);
    expect(e.seller_balance_after).toBe(-50000);
  });

  it("sotuvchi jamlanmasini oldingi yozuvdan davom ettiradi", async () => {
    const m = makeManager({ cashboxBalanceAfter: 100, lastSeller: 900 });
    const e = await svc().appendEntry(m as any, {
      integration_id: INT,
      entry_type: MarketplaceLedgerEntryType.EXTRA_COST,
      amount: -100,
      seller_id: 'SLR-77',
      cashbox_history_id: 'ch-3',
    });
    expect(e.seller_balance_after).toBe(800);
  });

  it('teskari yozuvda `reverses_entry_id` saqlanadi', async () => {
    // ⚠️ Faqat `entry_type` bo'yicha hisoblash YETARLI EMAS: `CORRECTION`
    // juftligi ham sotuv reversali, ham ortiqcha xarajat reversali uchun
    // ishlatiladi va sodda so'rov ikki marta sanardi.
    const m = makeManager({ cashboxBalanceAfter: 0, lastSeller: 145000 });
    const e = await svc().appendEntry(m as any, {
      integration_id: INT,
      entry_type: MarketplaceLedgerEntryType.CORRECTION,
      amount: -145000,
      seller_id: 'SLR-77',
      cashbox_history_id: 'ch-4',
      reverses_entry_id: 'le-1',
    });
    expect(e.reverses_entry_id).toBe('le-1');
    expect(e.seller_balance_after).toBe(0); // 145000 - 145000
  });

  it('kassaga tegmaydigan yozuvda oldingi balans saqlanadi', async () => {
    const m = makeManager({ lastEntry: { balance_after: 42_000_000 }, lastSeller: 0 });
    const e = await svc().appendEntry(m as any, {
      integration_id: INT,
      entry_type: MarketplaceLedgerEntryType.ADJUSTMENT,
      amount: 0,
      note: 'texnik yozuv',
    });
    expect(e.balance_after).toBe(42_000_000);
  });

  it("integratsiya topilmasa aniq xato beradi", async () => {
    const m = makeManager();
    m.query = jest.fn(async (sql: string) =>
      /UPDATE "marketplace_integration"/.test(sql) ? [] : [],
    ) as any;
    await expect(
      svc().appendEntry(m as any, {
        integration_id: 'yoq',
        entry_type: MarketplaceLedgerEntryType.SALE,
        amount: 1,
      }),
    ).rejects.toThrow(/daftar seq/);
  });
});
