/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';
import type { EntityManager } from 'typeorm';
import { Operation_type, Source_type } from 'src/common/enums';
import { applyCashboxDelta } from 'src/common/database/cashbox-delta.util';
import type { CashEntity } from 'src/core/entity/cash-box.entity';
import { computeSellCashboxLegs, legFromDelta } from './sell-cashbox-legs.util';
import {
  computeMarketSettlement,
  planMarketPayment,
  SettlementStatusAction,
} from './market-settlement.util';

/**
 * `sellOrder`/`partlySold` dagi `updateCashbox` bilan AYNAN bir xil yo'l.
 * @returns DB ga (`UPDATE ... balance + $1`) yuborilgan ISHORALI delta.
 */
async function writeLeg(
  operation: Operation_type,
  amount: number,
): Promise<number> {
  const query = jest.fn<Promise<unknown>, [string, unknown[]]>(() =>
    Promise.resolve([{ balance: '0' }]),
  );
  const manager = {
    query,
    create: (_e: unknown, o: object) => o,
    save: (_e: unknown, o: object) => Promise.resolve({ ...o, id: 'h1' }),
  } as unknown as EntityManager;
  const delta = operation === Operation_type.INCOME ? amount : -amount;
  await applyCashboxDelta(manager, {
    cashbox: { id: 'cb' } as CashEntity,
    delta,
    operation,
    source_type: Source_type.SELL,
    amount,
    created_by: 'courier',
  });
  return query.mock.calls[0][1][0] as number;
}

describe('computeSellCashboxLegs', () => {
  /**
   * ⚠️ JONLI NUQSON (2026-11-11): #346748 va #344967.
   *
   * 40 000 lik buyurtma, market tarifi 0, kuryer tarifi narxdan yuqori.
   * Avval «arzon» shox market oyog'ini `EXPENSE (0 − 40 000)` deb yozib,
   * ishora darvozasi sotuvni yiqitardi.
   */
  it('kuryer tarifi > narx > market tarifi — market KIRIM oladi', () => {
    const legs = computeSellCashboxLegs({
      price: 40_000,
      marketTariff: 0,
      courierTariff: 45_000,
    });
    expect(legs.kind).toBe('below_tariff');
    expect(legs.market).toEqual({
      delta: 40_000,
      operation: Operation_type.INCOME,
      amount: 40_000,
    });
    expect(legs.courier).toEqual({
      delta: -5_000,
      operation: Operation_type.EXPENSE,
      amount: 5_000,
    });
    expect(legs.to_be_paid).toBe(40_000);
  });

  it('oraliq holat — market tarifi 0 emas', () => {
    const legs = computeSellCashboxLegs({
      price: 28_000,
      marketTariff: 25_000,
      courierTariff: 30_000,
    });
    expect(legs.market.operation).toBe(Operation_type.INCOME);
    expect(legs.market.amount).toBe(3_000);
    expect(legs.courier.operation).toBe(Operation_type.EXPENSE);
    expect(legs.courier.amount).toBe(2_000);
    expect(legs.to_be_paid).toBe(3_000);
  });

  /**
   * Eski to'rt shoxning TO'G'RI ishlagan natijalari o'zgarmasligi shart.
   */
  describe('eski shoxlar bilan moslik', () => {
    it("CASE 1 — 0 so'mlik: ikkala kassadan to'liq tarif chiqim", () => {
      const legs = computeSellCashboxLegs({
        price: 0,
        marketTariff: 30_000,
        courierTariff: 25_000,
      });
      expect(legs.kind).toBe('zero');
      expect(legs.market).toMatchObject({
        operation: Operation_type.EXPENSE,
        amount: 30_000,
      });
      expect(legs.courier).toMatchObject({
        operation: Operation_type.EXPENSE,
        amount: 25_000,
      });
      expect(legs.to_be_paid).toBe(0);
    });

    it('CASE 2 — narx ikkala tarifdan kichik: ikkalasi chiqim', () => {
      const legs = computeSellCashboxLegs({
        price: 10_000,
        marketTariff: 30_000,
        courierTariff: 25_000,
      });
      expect(legs.kind).toBe('below_tariff');
      expect(legs.market).toMatchObject({
        operation: Operation_type.EXPENSE,
        amount: 20_000,
      });
      expect(legs.courier).toMatchObject({
        operation: Operation_type.EXPENSE,
        amount: 15_000,
      });
      expect(legs.to_be_paid).toBe(0);
    });

    it('CASE 3 — kuryer tarifi <= narx < market tarifi', () => {
      const legs = computeSellCashboxLegs({
        price: 27_000,
        marketTariff: 30_000,
        courierTariff: 25_000,
      });
      expect(legs.kind).toBe('below_tariff');
      expect(legs.market).toMatchObject({
        operation: Operation_type.EXPENSE,
        amount: 3_000,
      });
      expect(legs.courier).toMatchObject({
        operation: Operation_type.INCOME,
        amount: 2_000,
      });
      expect(legs.to_be_paid).toBe(0);
    });

    it('CASE 4 — oddiy sotuv: ikkalasi kirim', () => {
      const legs = computeSellCashboxLegs({
        price: 150_000,
        marketTariff: 30_000,
        courierTariff: 25_000,
      });
      expect(legs.kind).toBe('normal');
      expect(legs.market).toMatchObject({
        operation: Operation_type.INCOME,
        amount: 120_000,
      });
      expect(legs.courier).toMatchObject({
        operation: Operation_type.INCOME,
        amount: 125_000,
      });
      expect(legs.to_be_paid).toBe(120_000);
    });

    it("kuryer tarifi > market tarifi, narx ikkalasidan katta — o'zgarmaydi", () => {
      const legs = computeSellCashboxLegs({
        price: 100_000,
        marketTariff: 25_000,
        courierTariff: 30_000,
      });
      expect(legs.kind).toBe('normal');
      expect(legs.market.amount).toBe(75_000);
      expect(legs.courier.amount).toBe(70_000);
      expect(legs.to_be_paid).toBe(75_000);
    });
  });

  it('null/undefined tariflar 0 deb olinadi (eski `price < null` bilan bir xil)', () => {
    const legs = computeSellCashboxLegs({
      price: 50_000,
      marketTariff: null,
      courierTariff: undefined,
    });
    expect(legs.kind).toBe('normal');
    expect(legs.market.amount).toBe(50_000);
    expect(legs.courier.amount).toBe(50_000);
  });

  it("nol delta yo'nalishsiz, lekin MUSBAT summa bilan qaytadi", () => {
    expect(legFromDelta(0)).toEqual({
      delta: 0,
      operation: Operation_type.INCOME,
      amount: 0,
    });
  });

  /**
   * ⚠️ ASOSIY KAFOLAT: hech qanday tarif/narx kombinatsiyasi ishora
   * darvozasidan yiqilmaydi va kassaga AYNAN `narx − tarif` yoziladi
   * (rollback shu formulani teskari yozadi — simmetriya).
   */
  it("hamma kombinatsiya applyCashboxDelta dan o'tadi va delta = narx − tarif", async () => {
    const values = [0, 10_000, 25_000, 28_000, 30_000, 40_000, 45_000, 150_000];
    for (const price of values) {
      for (const marketTariff of values) {
        for (const courierTariff of values) {
          const legs = computeSellCashboxLegs({
            price,
            marketTariff,
            courierTariff,
          });
          const m = await writeLeg(legs.market.operation, legs.market.amount);
          const c = await writeLeg(legs.courier.operation, legs.courier.amount);
          expect(m).toBe(price - marketTariff);
          expect(c).toBe(price - courierTariff);
          expect(legs.to_be_paid).toBe(Math.max(price - marketTariff, 0));
        }
      }
    }
  });
});

/**
 * SOTUVDAN «TO'LANDI» GACHA — tuzatish to'lov oqimiga halaqit bermasin.
 *
 * Marketga to'lov `planMarketPayment` (`market_net`/`market_settled`)
 * va CLICK_TO_MARKET (`to_be_paid`) orqali yopiladi. Ikkalasi ham bir xil
 * summani ko'rishi SHART — aks holda biri buyurtmani 0 so'mga «to'langan»
 * qilib, market puli kassada egasiz qolardi.
 */
describe("sotuvdan keyin market to'lovi buyurtmani yopadi", () => {
  // Jonli holat: 40 000, market tarifi 0, kuryer tarifi narxdan yuqori.
  const price = 40_000;
  const marketTariff = 0;
  const legs = computeSellCashboxLegs({
    price,
    marketTariff,
    courierTariff: 45_000,
  });
  const marketNet = computeMarketSettlement({
    total_price: price,
    market_tariff: marketTariff,
  });

  it('to_be_paid market_net va kassa kirimi bilan bir xil', () => {
    expect(legs.to_be_paid).toBe(marketNet);
    expect(legs.market.delta).toBe(marketNet);
  });

  it("to'liq to'lov — PAID, qoldiq yo'q", () => {
    const { plans, leftover } = planMarketPayment(
      [
        {
          id: 'o1',
          market_net: marketNet,
          market_settled: 0,
          paid_amount: 0,
          is_open_status: true,
        },
      ],
      legs.market.delta,
    );
    expect(plans).toEqual([
      expect.objectContaining({
        id: 'o1',
        market_settled: 40_000,
        paid_amount: 40_000,
        status: SettlementStatusAction.CLOSE,
      }),
    ]);
    expect(leftover).toBe(0);
  });

  it("bo'lib to'lash — avval PARTLY_PAID, keyin PAID", () => {
    const first = planMarketPayment(
      [
        {
          id: 'o1',
          market_net: marketNet,
          market_settled: 0,
          paid_amount: 0,
          is_open_status: true,
        },
      ],
      15_000,
    ).plans[0];
    expect(first.status).toBe(SettlementStatusAction.PARTIAL);

    const second = planMarketPayment(
      [
        {
          id: 'o1',
          market_net: marketNet,
          market_settled: first.market_settled,
          paid_amount: first.paid_amount,
          is_open_status: true,
        },
      ],
      25_000,
    ).plans[0];
    expect(second.status).toBe(SettlementStatusAction.CLOSE);
    expect(second.paid_amount).toBe(40_000);
  });
});

/**
 * ULANISH QULFI — `sellOrder` va `partlySold` util'dan foydalanadi.
 *
 * Ikki metod avval to'rt shoxning BIR XIL nusxasini saqlardi va nuqson
 * ikkalasida ham bor edi. Biri qaytadan qo'lda yozilsa, `tsc` ham, bu
 * util testlari ham sezmaydi — shu sabab manba matni o'qiladi.
 */
describe("sotuv yo'llari — util ulanishi", () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'order.service.ts'),
    'utf8',
  );
  const methodBody = (name: string): string => {
    const start = src.indexOf(`  async ${name}(`);
    if (start === -1) throw new Error(`metod topilmadi: ${name}`);
    const next = src.indexOf('\n  async ', start + 10);
    return src.slice(start, next === -1 ? src.length : next);
  };

  it.each(['sellOrder', 'partlySold'])(
    '%s kassa oyoqlarini computeSellCashboxLegs dan oladi',
    (method) => {
      const body = methodBody(method);
      expect(body).toContain('computeSellCashboxLegs(');
      // Qotirilgan yo'nalishli eski shox qaytmasin.
      expect(body).not.toMatch(/marketTarif\s*-\s*price/);
      expect(body).not.toMatch(/courierTarif\s*-\s*price/);
    },
  );
});
