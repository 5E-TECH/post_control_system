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
