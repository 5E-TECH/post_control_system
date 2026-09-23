/**
 * MARKET BILAN HISOB-KITOB — yagona manba.
 *
 * ── MUAMMO ──────────────────────────────────────────────────────────────
 *
 * Market kassasidan pul TO'RT manbadan yechiladi:
 *   1. sotuv tushumi (musbat)          `price − marketTarif`
 *   2. tarifdan arzon sotuv (manfiy)   o'sha formula, manfiy natijasi
 *   3. qo'shimcha xarajat (manfiy)     `extra_cost_net`
 *   4. bekor qilingan buyurtmadagi xarajat (manfiy)
 *
 * `paymentsToMarket` esa to'lovni FAQAT `to_be_paid − paid_amount`
 * bo'yicha tarqatadi, `to_be_paid` esa faqat 1-manbani (va uni ham
 * `Math.max(...,0)` bilan qisib) kuzatadi.
 *
 * Natijada `cash_box.balance` doimo `SUM(to_be_paid − paid_amount)` dan
 * KICHIK bo'ladi va marketga kassadagi HAMMA pulni to'lasangiz ham
 * navbat oxiridagi buyurtmalar yopilmay qoladi.
 *
 * ── QOIDA (foydalanuvchi qarori, 2026-09-23) ────────────────────────────
 *
 * Market hisobi — YUGURUVCHI BALANS. Har buyurtma ISHORALI hissa
 * qo'shadi, to'lov esa umumiy qoldiqqa nisbatan hisoblanadi:
 *
 *   · sotuv narxi tarifdan kam bo'lsa — farqni MARKET qoplaydi
 *     (kafolat almashtirishida ham, oddiy arzon buyurtmada ham)
 *   · bekor qilingan buyurtmadagi xarajatni ham MARKET to'laydi
 *   · PAID buyurtmaga keyin xarajat tushsa — keyingi to'lovdan ushlanadi
 *
 * ── NEGA SOF FUNKSIYA ───────────────────────────────────────────────────
 *
 * Ayni matematika hozir UCH joyda takrorlangan: `sellOrder` (4 ta CASE),
 * `partlySold` (aynan o'sha 4 ta CASE nusxasi) va `updateOrder`. Bittasi
 * tuzatilib ikkinchisi qolsa tafovut qayta to'planadi — shuning uchun
 * hisob BITTA joyda, testlanadigan sof funksiyada.
 */

export interface MarketSettlementInput {
  /** Buyurtma summasi (mijozdan olinadigan pul). */
  total_price: number | null | undefined;
  /**
   * Sotuv paytida MUZLATILGAN market tarifi.
   *
   * ⚠️ `users.tariff_home/center` dan EMAS: tarif sotuvdan keyin
   * o'zgarsa qayta hisoblash boshqa summa berib, daftar abadiy siljirdi
   * (bloker B5).
   */
  market_tariff: number | null | undefined;
  /** Shu buyurtma bo'yicha sof qo'shimcha xarajat (qo'shilgan − qaytarilgan). */
  extra_cost_net?: number | null | undefined;
}

const int = (v: unknown): number => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Market bu buyurtma bo'yicha QANCHA olishi kerak.
 *
 * @returns ISHORALI summa:
 *   musbat — biz marketga qarzdormiz;
 *   manfiy — market bizga qarzdor (tarifdan arzon sotuv yoki xarajat);
 *   nol    — hisob teng.
 *
 * ⚠️ `Math.max(..., 0)` ATAYLAB YO'Q. Aynan o'sha qisish tufayli
 * tarifdan arzon buyurtmaning qarzi hech qaysi buyurtmaga biriktirilmay,
 * kassada «egasiz» osilib qolardi.
 */
export function computeMarketSettlement(o: MarketSettlementInput): number {
  return int(o.total_price) - int(o.market_tariff) - int(o.extra_cost_net);
}

/**
 * Buyurtma market bilan hisob-kitobda OCHIQmi.
 *
 * ⚠️ STATUSGA QARAMAYDI — ataylab. Foydalanuvchi qaroriga ko'ra:
 *   · bekor qilingan buyurtmada ham xarajat qarzi qolishi mumkin;
 *   · PAID buyurtmaga keyin xarajat tushsa u yana ochiladi.
 * Ya'ni `PAID` endi «mijoz puli yopildi» degani, «market bilan hisob
 * yopildi» degani EMAS.
 */
export function isMarketSettlementOpen(
  market_net: number | null | undefined,
  paid_amount: number | null | undefined,
): boolean {
  return int(market_net) - int(paid_amount) !== 0;
}

/**
 * ═══════════════ TO'LOVNI BUYURTMALARGA TARQATISH ═══════════════
 *
 * ⚠️ NEGA SOF FUNKSIYA. Bu mantiq `paymentsToMarket` ichida inline
 * yozilgan edi va unga HECH QANDAY test yo'q edi — aynan shu sabab
 * «marketga hamma pulni to'lasam ham buyurtmalar yopilmaydi» nuqsoni
 * oylab sezilmadi. Endi u DB'siz testlanadi.
 */

export enum SettlementStatusAction {
  /** Hisob to'liq yopildi — buyurtma PAID bo'ladi. */
  CLOSE = 'close',
  /** Qisman yopildi — PARTLY_PAID. */
  PARTIAL = 'partial',
  /** Statusga tegilmaydi. */
  KEEP = 'keep',
}

export interface SettlementOrderInput {
  id: string;
  market_net: number | null | undefined;
  market_settled: number | null | undefined;
  paid_amount: number | null | undefined;
  /** `true` — status hozir `sold` yoki `partly_paid`. */
  is_open_status: boolean;
}

export interface SettlementOrderPlan {
  id: string;
  /** Yangi `market_settled` qiymati. */
  market_settled: number;
  /** Yangi `paid_amount` — MANFIY BO'LMAYDI. */
  paid_amount: number;
  status: SettlementStatusAction;
  /** `false` — bu qatorga umuman tegilmaydi. */
  changed: boolean;
}

/**
 * @param orders  navbat TARTIBIDA (manfiylar birinchi)
 * @param amount  to'lanayotgan summa
 * @returns rejalar va sarflanmay qolgan pul
 */
export function planMarketPayment(
  orders: SettlementOrderInput[],
  amount: number,
): { plans: SettlementOrderPlan[]; leftover: number } {
  let pool = int(amount);
  const plans: SettlementOrderPlan[] = [];

  for (const o of orders) {
    const net = int(o.market_net);
    const settled = int(o.market_settled);
    const paid = int(o.paid_amount);
    const remaining = net - settled;

    if (remaining < 0 && net < 0) {
      /**
       * MARKET BIZGA QARZDOR — qarz hisobga olinadi va hovuzni OSHIRADI.
       * `net < 0` sharti majburiy: `market_settled` `market_net` dan
       * oshib ketgan qator (boshqa oqim natijasi) «qarz» deb
       * hisoblansa, halqa yo'qdan pul yaratardi.
       */
      pool -= remaining; // remaining manfiy → pool oshadi
      plans.push({
        id: o.id,
        market_settled: net,
        paid_amount: paid,
        status: o.is_open_status
          ? SettlementStatusAction.CLOSE
          : SettlementStatusAction.KEEP,
        changed: true,
      });
    } else if (remaining < 0) {
      // Ortiqcha yopilgan — faqat normallashtiramiz, pulga TEGMAYMIZ.
      plans.push({
        id: o.id,
        market_settled: net,
        paid_amount: paid,
        status: o.is_open_status
          ? SettlementStatusAction.CLOSE
          : SettlementStatusAction.KEEP,
        changed: true,
      });
    } else if (remaining === 0) {
      // Hisob teng — faqat status qoldiq bo'lsa yopamiz.
      if (!o.is_open_status) continue;
      plans.push({
        id: o.id,
        market_settled: settled,
        paid_amount: paid,
        status: SettlementStatusAction.CLOSE,
        changed: true,
      });
    } else if (pool <= 0) {
      // Pul tugadi — qolgan MUSBAT qatorlarga tegmaymiz.
      continue;
    } else if (pool >= remaining) {
      pool -= remaining;
      plans.push({
        id: o.id,
        market_settled: net,
        paid_amount: paid + remaining,
        status: SettlementStatusAction.CLOSE,
        changed: true,
      });
    } else {
      plans.push({
        id: o.id,
        market_settled: settled + pool,
        paid_amount: paid + pool,
        status: SettlementStatusAction.PARTIAL,
        changed: true,
      });
      pool = 0;
    }
  }

  return { plans, leftover: pool };
}
