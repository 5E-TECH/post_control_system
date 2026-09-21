import { applyCashboxDelta } from './cashbox-delta.util';
import { Operation_type, Source_type } from 'src/common/enums';

function makeManager(returning: unknown) {
  const saved: any[] = [];
  return {
    saved,
    lastSql: '',
    lastParams: [] as any[],
    query: jest.fn(async function (this: any, sql: string, params: any[]) {
      (this as any).lastSql = sql;
      (this as any).lastParams = params;
      return returning;
    }),
    create: jest.fn((_e: any, v: any) => ({ ...v })),
    save: jest.fn(async (_e: any, v: any) => {
      const row = { id: `h-${saved.length + 1}`, ...v };
      saved.push(row);
      return row;
    }),
  };
}

const box = (balance = 1_000_000) => ({ id: 'cb-1', balance }) as any;

const input = (over: any = {}) => ({
  cashbox: over.cashbox ?? box(),
  delta: over.delta ?? 150000,
  operation: Operation_type.INCOME,
  source_type: Source_type.SELL,
  amount: over.amount ?? 150000,
  created_by: 'u-1',
  ...over,
});

describe('applyCashboxDelta', () => {
  it('balansni DB da hisoblaydi, xotirada emas', async () => {
    // ⚠️ Bloker B1. Bugungi kod `balance += delta; save()` qiladi — ikki
    // parallel sotuvda biri ikkinchisini jimgina o'chirib yuboradi.
    const m = makeManager([{ balance: '1150000' }]);
    const r = await applyCashboxDelta(m as any, input());

    expect(m.lastSql).toMatch(/SET "balance" = "balance" \+ \$1/);
    expect(m.lastSql).toMatch(/RETURNING "balance"/);
    expect(m.lastParams[0]).toBe(150000);
    expect(r.balance_after).toBe(1150000);
  });

  it("tarixga DB TASDIQLAGAN balansni yozadi", async () => {
    // Orada boshqa sotuv o'tgan bo'lsa ham `balance_after` haqiqiy bo'ladi:
    // DB 1 400 000 qaytardi (bizning taxminimiz 1 150 000 bo'lardi).
    const m = makeManager([{ balance: '1400000' }]);
    await applyCashboxDelta(m as any, input());
    expect(m.saved[0].balance_after).toBe(1400000);
  });

  it('xotiradagi obyektni ham yangilaydi', async () => {
    const cb = box(1_000_000);
    const m = makeManager([{ balance: '1150000' }]);
    await applyCashboxDelta(m as any, input({ cashbox: cb }));
    // Chaqiruvchi keyin qarz hisobida shu obyektni o'qisa eskirgan
    // qiymat olmasin.
    expect(cb.balance).toBe(1150000);
  });

  it('manfiy delta — chiqim', async () => {
    const m = makeManager([{ balance: '950000' }]);
    const r = await applyCashboxDelta(m as any, input({
      delta: -50000, amount: 50000, operation: Operation_type.EXPENSE,
    }));
    expect(m.lastParams[0]).toBe(-50000);
    expect(r.balance_after).toBe(950000);
    // Tarixda summa har doim MUSBAT ko'rinadi.
    expect(m.saved[0].amount).toBe(50000);
  });

  it('TypeORM ning `[rows, count]` shaklini ham tushunadi', async () => {
    // ⚠️ Busiz `rows[0].balance` `undefined` bo'lib, `Number(undefined)=NaN`
    // orqali bigint ustunga INSERT yiqilardi.
    const m = makeManager([[{ balance: '1150000' }], 1]);
    const r = await applyCashboxDelta(m as any, input());
    expect(r.balance_after).toBe(1150000);
  });

  it('kassa topilmasa aniq xato', async () => {
    const m = makeManager([]);
    await expect(applyCashboxDelta(m as any, input())).rejects.toThrow(
      /kassa topilmadi/,
    );
  });

  it("balans o'qilmasa NaN yozmaydi, xato tashlaydi", async () => {
    const m = makeManager([{ notBalance: 'x' }]);
    await expect(applyCashboxDelta(m as any, input())).rejects.toThrow(
      /balans o'qilmadi/,
    );
    expect(m.saved).toHaveLength(0); // tarix yozilmadi
  });

  it("ixtiyoriy maydonlarni faqat berilganda qo'shadi", async () => {
    const m = makeManager([{ balance: '10' }]);
    await applyCashboxDelta(m as any, input({
      source_id: 'ord-1', source_user_id: 'cour-1', comment: 'izoh',
      payment_date: '2026-09-16',
    }));
    const h = m.saved[0];
    expect(h.source_id).toBe('ord-1');
    expect(h.source_user_id).toBe('cour-1');
    expect(h.payment_date).toBe('2026-09-16');
    expect(h).not.toHaveProperty('payment_method');
  });
});
