/// <reference types="jest" />
import { QueryRunner } from 'typeorm';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CashboxHistoryEntity } from 'src/core/entity/cashbox-history.entity';
import { Operation_type, Source_type } from 'src/common/enums';
import { ExtraCostApplierService } from './extra-cost-applier.service';

/**
 * QO'SHIMCHA XARAJAT APPLIER — REGRESSIYA QULFI.
 *
 * Bu testning maqsadi "kod ishlayaptimi" emas, balki **pul yo'li AVVALGIDEK
 * qolganini** qulflash. Applier uch nusxadagi mantiqni birlashtirdi:
 *
 *   `sellOrder`   — `updateCashbox` closure (Promise.all bilan, EXPENSE ×2)
 *   `partlySold`  — o'sha closure aynan nusxasi
 *   `cancelOrder` — qo'lda yozilgan 45 qator (courier avval, market keyin)
 *
 * Uchalasi ham bir xil natija berardi: ikkala kassadan X ayiriladi va ikkita
 * `EXPENSE`/`extra_cost` tarix yozuvi tug'iladi, `balance_after` esa har
 * kassaning O'Z yangi balansi bo'ladi. Shu shartnoma mana shu yerda qotiriladi.
 */

type SavedRow = CashEntity | CashboxHistoryEntity;

/** `queryRunner.manager` ning eng kichik, lekin haqiqiy xulqli taqlidi. */
function makeQueryRunner() {
  const saveOrder: SavedRow[] = [];
  let historySeq = 0;

  const manager = {
    create: (_entity: unknown, data: Record<string, unknown>) => {
      // TypeORM `create` — oddiy obyekt yasaydi; DB `id` ni INSERT'da beradi,
      // bu yerda uni oldindan qo'yamiz (applier `id` ni qaytaradi).
      return { id: `hist-${++historySeq}`, ...data } as CashboxHistoryEntity;
    },
    save: jest.fn((row: SavedRow) => {
      // Snapshot: keyingi mutatsiyalar tarixni buzmasin.
      saveOrder.push(JSON.parse(JSON.stringify(row)) as SavedRow);
      return Promise.resolve(row);
    }),
  };

  return { queryRunner: { manager } as unknown as QueryRunner, saveOrder };
}

const cashbox = (id: string, balance: number) =>
  ({ id, balance }) as CashEntity;

const ORDER_ID = 'order-1';
const MARKET_ID = 'market-1';
const COURIER_ID = 'courier-1';

async function apply(amount: number, extra: Record<string, unknown> = {}) {
  const svc = new ExtraCostApplierService();
  const { queryRunner, saveOrder } = makeQueryRunner();
  const marketCashbox = cashbox('cb-market', 1_000_000);
  const courierCashbox = cashbox('cb-courier', 500_000);

  const result = await svc.applyInline(queryRunner, {
    marketCashbox,
    courierCashbox,
    orderId: ORDER_ID,
    amount,
    comment: 'Taksi puli',
    createdBy: COURIER_ID,
    marketId: MARKET_ID,
    courierId: COURIER_ID,
    ...extra,
  });

  return { result, saveOrder, marketCashbox, courierCashbox };
}

describe('Applier — pul harakati', () => {
  it('TC1: IKKALA kassadan ham X ayiriladi (ikkisi ham CHIQIM)', async () => {
    const { marketCashbox, courierCashbox } = await apply(10_000);
    // Market kassasi = pochtaning marketga qarzi -> kamaysa market to'ladi
    expect(marketCashbox.balance).toBe(990_000);
    // Kuryer kassasi = kuryerning pochtaga qarzi -> kamaysa kuryerga to'lov
    expect(courierCashbox.balance).toBe(490_000);
  });

  it('TC2: aynan 4 ta yozuv — 2 kassa saqlash + 2 tarix', async () => {
    const { saveOrder } = await apply(10_000);
    expect(saveOrder).toHaveLength(4);
  });

  it('TC3: tarix yozuvlari EXPENSE/extra_cost va source_id = buyurtma', async () => {
    const { saveOrder } = await apply(7_500);
    const histories = saveOrder.filter((r) => 'operation_type' in r);

    expect(histories).toHaveLength(2);
    for (const h of histories) {
      expect(h.operation_type).toBe(Operation_type.EXPENSE);
      expect(h.source_type).toBe(Source_type.EXTRA_COST);
      expect(h.source_id).toBe(ORDER_ID);
      expect(h.amount).toBe(7_500);
      expect(h.comment).toBe('Taksi puli');
      expect(h.created_by).toBe(COURIER_ID);
    }
  });

  it("TC4: `balance_after` HAR KASSANING O'Z yangi balansi", async () => {
    // Eng nozik joy: ikki kassa bitta tranzaksiyada yangilanadi va
    // snapshotlar almashib qolsa, kassa tarixi jimgina yolg'on bo'ladi.
    const { saveOrder } = await apply(10_000);
    const histories = saveOrder.filter((r) => 'operation_type' in r);

    const marketHist = histories.find((h) => h.cashbox_id === 'cb-market');
    const courierHist = histories.find((h) => h.cashbox_id === 'cb-courier');

    expect(marketHist?.balance_after).toBe(990_000);
    expect(courierHist?.balance_after).toBe(490_000);
  });

  it("TC5: `source_user_id` narigi tomonni ko'rsatadi (kassa tarixidagi 'kim bilan')", async () => {
    const { saveOrder } = await apply(10_000);
    const histories = saveOrder.filter((r) => 'operation_type' in r);

    // Market yozuvida KURYER, kuryer yozuvida MARKET.
    expect(
      histories.find((h) => h.cashbox_id === 'cb-market')?.source_user_id,
    ).toBe(COURIER_ID);
    expect(
      histories.find((h) => h.cashbox_id === 'cb-courier')?.source_user_id,
    ).toBe(MARKET_ID);
  });

  it('TC6: ikkala tarix yozuvining ID si qaytariladi (idempotentlik langari)', async () => {
    const { result } = await apply(10_000);
    expect(result.marketHistoryId).toBeTruthy();
    expect(result.courierHistoryId).toBeTruthy();
    expect(result.marketHistoryId).not.toBe(result.courierHistoryId);
  });
});

describe('Applier — summa qoidalari', () => {
  it('TC7: kasrli summa BUTUNGA kesiladi (bigint ustun)', async () => {
    const { marketCashbox, saveOrder } = await apply(5000.9);
    expect(marketCashbox.balance).toBe(995_000);
    const h = saveOrder.find(
      (r) => 'operation_type' in r,
    ) as CashboxHistoryEntity;
    expect(h.amount).toBe(5000);
  });

  it("TC8: 0 summa RAD ETILADI — bo'sh kassa yozuvi yaratilmasin", async () => {
    await expect(apply(0)).rejects.toThrow(/musbat butun son/);
  });

  it('TC9: manfiy summa RAD ETILADI — teskari yozuv pul yaratardi', async () => {
    await expect(apply(-1000)).rejects.toThrow(/musbat butun son/);
  });

  it("TC10: xato bo'lganda HECH QANDAY yozuv qilinmaydi", async () => {
    const svc = new ExtraCostApplierService();
    const { queryRunner, saveOrder } = makeQueryRunner();
    await expect(
      svc.applyInline(queryRunner, {
        marketCashbox: cashbox('cb-market', 1_000_000),
        courierCashbox: cashbox('cb-courier', 500_000),
        orderId: ORDER_ID,
        amount: 0,
        comment: '',
        createdBy: COURIER_ID,
        marketId: MARKET_ID,
        courierId: COURIER_ID,
      }),
    ).rejects.toThrow();
    expect(saveOrder).toHaveLength(0);
  });
});

describe('Applier — payment_date', () => {
  it("TC11: berilmasa maydon UMUMAN qo'shilmaydi (bugungi xulq)", async () => {
    const { saveOrder } = await apply(10_000);
    const h = saveOrder.find(
      (r) => 'operation_type' in r,
    ) as CashboxHistoryEntity;
    expect(h.payment_date).toBeUndefined();
  });

  it("TC12: berilsa O'ZBEKISTON sanasi yoziladi, UTC emas", async () => {
    // 2026-09-15 21:00 UTC = 2026-09-16 02:00 Toshkentda.
    // UTC ishlatilsa "15-sentabr" bo'lib, kechki sotuv kunlik hisobotda
    // "kechagi" bo'lib ko'rinardi.
    const ms = Date.UTC(2026, 8, 15, 21, 0, 0);
    const { saveOrder } = await apply(10_000, { paymentDate: ms });
    const h = saveOrder.find(
      (r) => 'operation_type' in r,
    ) as CashboxHistoryEntity;
    expect(h.payment_date).toBe('2026-09-16');
  });
});

/**
 * ATOMIK YO'L (tasdiqlash) — `UPDATE ... RETURNING` natijasining SHAKLI.
 *
 * ⚠️ HAQIQIY BAZADA TOPILGAN XATO. TypeORM postgres drayveri
 * `UPDATE ... RETURNING` uchun `[[qatorlar], affected]` qaytaradi, `SELECT`
 * uchun esa `[qatorlar]`. Farq hisobga olinmasa `rows[0].balance` →
 * `undefined` → `Number(undefined)` = `NaN` → bigint ustunga INSERT yiqiladi:
 *
 *     invalid input syntax for type bigint: "NaN"
 *
 * Ya'ni market "Tasdiqlash" bosganda 500 olardi va PUL HECH QACHON
 * yozilmasdi. Unit testlar buni ko'rmagan — faqat real DB ko'rsatgan.
 */
function makeAtomicQr(returning: unknown) {
  const saved: CashboxHistoryEntity[] = [];
  let seq = 0;
  const manager = {
    query: jest.fn(() => Promise.resolve(returning)),
    create: (_e: unknown, d: Record<string, unknown>) =>
      ({ id: `h-${++seq}`, ...d }) as CashboxHistoryEntity,
    save: jest.fn((row: CashboxHistoryEntity) => {
      saved.push(row);
      return Promise.resolve(row);
    }),
  };
  return { queryRunner: { manager } as unknown as QueryRunner, saved };
}

const atomicParams = {
  marketCashboxId: 'cb-market',
  courierCashboxId: 'cb-courier',
  orderId: ORDER_ID,
  amount: 10_000,
  comment: 'Tasdiqlandi',
  createdBy: 'market-1',
  marketId: MARKET_ID,
  courierId: COURIER_ID,
};

describe("Applier — atomik yo'l (tasdiqlash)", () => {
  it("TC13: `[[rows], affected]` shakli TO'G'RI o'qiladi", async () => {
    const svc = new ExtraCostApplierService();
    const { queryRunner, saved } = makeAtomicQr([[{ balance: '990000' }], 1]);
    await svc.applyAtomic(queryRunner, atomicParams);
    expect(saved).toHaveLength(2);
    expect(saved[0].balance_after).toBe(990000);
  });

  it('TC14: oddiy `[rows]` shakli ham ishlaydi', async () => {
    const svc = new ExtraCostApplierService();
    const { queryRunner, saved } = makeAtomicQr([{ balance: '777' }]);
    await svc.applyAtomic(queryRunner, atomicParams);
    expect(saved[0].balance_after).toBe(777);
  });

  it("TC15: kassa topilmasa (bo'sh natija) XATO — jimgina o'tmaydi", async () => {
    const svc = new ExtraCostApplierService();
    const { queryRunner, saved } = makeAtomicQr([[], 0]);
    await expect(svc.applyAtomic(queryRunner, atomicParams)).rejects.toThrow(
      /kassa topilmadi/,
    );
    expect(saved).toHaveLength(0);
  });

  it("TC16: balans o'qilmasa (NaN) XATO — bigint INSERT yiqilmasin", async () => {
    const svc = new ExtraCostApplierService();
    const { queryRunner } = makeAtomicQr([[{ balance: 'salom' }], 1]);
    await expect(svc.applyAtomic(queryRunner, atomicParams)).rejects.toThrow(
      /balansni o'qib bo'lmadi/,
    );
  });

  it('TC17: `balance_after` DB qaytargan qiymatdan olinadi, taxmindan emas', async () => {
    // Parallel sotuv balansni o'zgartirgan bo'lsa ham, tarixda DB tasdiqlagan
    // haqiqiy raqam turishi kerak.
    const svc = new ExtraCostApplierService();
    const { queryRunner, saved } = makeAtomicQr([[{ balance: '-500' }], 1]);
    await svc.applyAtomic(queryRunner, atomicParams);
    expect(saved[0].balance_after).toBe(-500);
  });

  it('TC18: 0/manfiy summa RAD ETILADI', async () => {
    const svc = new ExtraCostApplierService();
    const { queryRunner } = makeAtomicQr([[{ balance: '0' }], 1]);
    await expect(
      svc.applyAtomic(queryRunner, { ...atomicParams, amount: 0 }),
    ).rejects.toThrow(/musbat butun son/);
  });
});
