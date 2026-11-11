import { Operation_type } from 'src/common/enums';

/**
 * SOTUVDA KASSALARGA YOZILADIGAN IKKI OYOQ — yagona manba.
 *
 * ── MUAMMO (2026-11-11) ─────────────────────────────────────────────────
 *
 * `sellOrder` va `partlySold` narxni to'rt shoxga bo'lardi va har shoxda
 * yo'nalishni (`INCOME`/`EXPENSE`) QOTIRIB yozardi. «Tarifdan arzon» shoxi
 * (`price < courierTarif`) market oyog'ini doim `EXPENSE marketTarif − price`
 * deb yozardi — ya'ni market tarifi kuryer tarifidan KICHIK yoki TENG deb
 * faraz qilardi.
 *
 * Faraz buzilganda (kuryer tarifi > narx > market tarifi; eng aniq holat —
 * market tarifi 0) summa MANFIY chiqardi. `applyCashboxDelta` ning ishora
 * darvozasi buni rad etib, BUTUN sotuv rollback bo'lardi:
 *
 *     40 000 lik buyurtma, market tarifi 0, kuryer tarifi 45 000
 *     → «ishora ziddiyati — delta=40000 uchun 'income' kutilgan,
 *        lekin 'expense' berildi»
 *
 * Darvozadan OLDIN (2026-09-23 gacha) balans to'g'ri o'zgarar, tarix esa
 * TESKARI yo'nalishni ko'rsatardi — nuqson yashirin edi.
 *
 * ── QOIDA ───────────────────────────────────────────────────────────────
 *
 * Har oyoqning ISHORALI o'zgarishi BARCHA shoxda bitta formula:
 *
 *     market  delta = price − marketTarif
 *     courier delta = price − courierTarif
 *
 * Yo'nalish `delta` dan HOSIL QILINADI. Rollback (`rollbackOrderToWaiting`)
 * aynan shu formulani teskari yozadi — sotuv va rollback simmetrik qoladi.
 *
 * `to_be_paid` — marketga to'lanadigan musbat qism (`Math.max(..., 0)`),
 * oddiy sotuv bilan bir xil. Avval «arzon» shoxda u 0 qolardi, ya'ni
 * kassaga tushgan market puli to'lov navbatida ko'rinmasdi.
 */

export interface SellLegsInput {
  /** Mijozdan olingan summa. */
  price: number | null | undefined;
  /** Sotuv paytidagi (muzlatilgan yoki profil) market tarifi. */
  marketTariff: number | null | undefined;
  /** Sotuv paytidagi (muzlatilgan yoki profil) kuryer tarifi. */
  courierTariff: number | null | undefined;
}

export interface CashboxLeg {
  /** ISHORALI o'zgarish: musbat = kirim, manfiy = chiqim. */
  delta: number;
  /** `delta` dan hosil qilingan yo'nalish. */
  operation: Operation_type;
  /** Tarix uchun MUSBAT summa (`|delta|`). */
  amount: number;
}

/**
 * Izoh tanlash uchun: qaysi turdagi sotuv.
 *   · `zero`         — 0 so'mlik mahsulot
 *   · `below_tariff` — narx kamida bitta tarifdan kichik
 *   · `normal`       — narx ikkala tarifdan ham katta yoki teng
 */
export type SellLegsKind = 'zero' | 'below_tariff' | 'normal';

export interface SellLegs {
  kind: SellLegsKind;
  market: CashboxLeg;
  courier: CashboxLeg;
  /** Marketga to'lanadigan qism, `>= 0`. */
  to_be_paid: number;
}

const int = (v: unknown): number => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

/**
 * `delta = 0` uchun `INCOME` — rollback bilan bir xil konvensiya
 * (`delta >= 0 ? INCOME : EXPENSE`). Nol yozuv yo'nalishsiz, jamlagichlarga
 * ta'sir qilmaydi; lekin u YOZILISHI shart — marketplace daftari market
 * kassasiga yozilgan qatorga langar qiladi.
 */
export function legFromDelta(delta: number): CashboxLeg {
  const d = int(delta);
  return {
    delta: d,
    operation: d >= 0 ? Operation_type.INCOME : Operation_type.EXPENSE,
    amount: Math.abs(d),
  };
}

export function computeSellCashboxLegs(input: SellLegsInput): SellLegs {
  const price = int(input.price);
  const marketTariff = int(input.marketTariff);
  const courierTariff = int(input.courierTariff);

  const kind: SellLegsKind =
    price === 0
      ? 'zero'
      : price < courierTariff || price < marketTariff
        ? 'below_tariff'
        : 'normal';

  const marketDelta = price - marketTariff;

  return {
    kind,
    market: legFromDelta(marketDelta),
    courier: legFromDelta(price - courierTariff),
    to_be_paid: Math.max(marketDelta, 0),
  };
}
