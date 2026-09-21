import { Where_deliver } from 'src/common/enums';
import { EventMoney } from './marketplace-event.util';

/**
 * MARKETPLACE PUL HISOBI — kontrakt §7 formulalarining yagona manbai.
 *
 * ⚠️ NEGA SOF FUNKSIYA. Bu hisob to'rtta joyda kerak bo'ladi (sotuv, bekor,
 * qisman sotuv, rollback) va ularning ustiga daftar yozuvi hamda hodisa
 * payload'i quriladi. Har joyda qaytadan yozilsa, vaqt o'tib ular AJRALIB
 * ketadi — `extra-cost-limit.util.ts` dagi dars aynan shu.
 */

/**
 * Buyurtmaga QO'LLANGAN BeePost haqqi.
 *
 * ⚠️ `order.market_tariff` QABULDA MUZLATILGAN (blokerlar B7–B9). Shu bois
 * bu yerda joriy tarif jadvalidan qayta o'qilmaydi — muzlatilgan qiymat
 * ustun. `null` bo'lsa (marketplace bo'lmagan eski buyurtma) zaxira sifatida
 * berilgan tarifdan olinadi.
 */
export function resolveBeepostFee(
  order: { market_tariff: number | null; where_deliver: Where_deliver },
  fallbackTariff?: { tariff_center: number; tariff_home: number } | null,
): number {
  if (order.market_tariff != null) return Math.trunc(order.market_tariff);
  if (!fallbackTariff) return 0;
  return Math.trunc(
    order.where_deliver === Where_deliver.CENTER
      ? fallbackTariff.tariff_center
      : fallbackTariff.tariff_home,
  );
}

/**
 * Ishorani almashtiradi, LEKIN `-0` qaytarmaydi.
 *
 * ⚠️ JS'da `-0` bor va `JSON.stringify(-0) === '0'` — ya'ni simda zararsiz.
 * Lekin daftar yozuvi va taqqoslashlarda `-0 !== 0` xulqi (masalan
 * `Object.is`) kutilmagan natija berishi mumkin. Manbada tozalab qo'yamiz.
 */
function neg(v: number): number {
  const x = -Math.trunc(v);
  return x === 0 ? 0 : x;
}

export function feeBasis(whereDeliver: Where_deliver): 'center' | 'home' {
  return whereDeliver === Where_deliver.CENTER ? 'center' : 'home';
}

export interface SaleMoneyInput {
  collected_from_customer: number;
  beepost_fee: number;
  extra_cost?: number;
  product_amount?: number;
  delivery_amount?: number;
  prepaid?: boolean;
  tariff_version?: number | null;
  where_deliver: Where_deliver;
}

/**
 * SOTUV puli (kontrakt §7.3).
 *
 *   net_to_marketplace = collected − beepost_fee − extra_cost
 *
 * ⚠️ NATIJA MANFIY BO'LISHI MUMKIN VA BU NORMAL (qaror P8): prepaid
 * posilkada `COD = 0`, tarif esa baribir olinadi — marketplace BIZGA
 * qarzdor bo'ladi. `Math.max(0, ...)` QO'YILMAYDI: u bo'lsa prepaid yo'li
 * jimgina buzilib, daftar noto'g'ri tomonga ketardi.
 */
export function computeSaleMoney(input: SaleMoneyInput): EventMoney {
  const collected = Math.trunc(input.collected_from_customer);
  const fee = Math.trunc(input.beepost_fee);
  const extra = Math.trunc(input.extra_cost ?? 0);

  return {
    currency: 'UZS',
    product_amount: input.product_amount,
    delivery_amount: input.delivery_amount,
    collected_from_customer: collected,
    beepost_fee: fee,
    beepost_fee_basis: feeBasis(input.where_deliver),
    tariff_version: input.tariff_version ?? undefined,
    extra_cost: extra,
    prepaid: input.prepaid,
    net_to_marketplace: collected - fee - extra,
  };
}

/**
 * BEKOR QILISH puli (qaror P4 + P5).
 *
 * ⚠️ Yetkazish haqqi OLINMAYDI — `beepost_fee = 0`. Faqat kuryerning
 * haqiqiy xarajati (`extra_cost`) hisobga olinadi va u marketplace
 * hisobidan yechiladi (qaror P6).
 *
 * Qaytarish ham BEPUL (qaror P7) — `parcel.returning`/`returned`
 * hodisalari pul harakatisiz ketadi.
 */
export function computeCancelMoney(input: {
  extra_cost?: number;
  where_deliver: Where_deliver;
}): EventMoney {
  const extra = Math.trunc(input.extra_cost ?? 0);
  return {
    currency: 'UZS',
    collected_from_customer: 0,
    beepost_fee: 0,
    beepost_fee_basis: feeBasis(input.where_deliver),
    extra_cost: extra,
    net_to_marketplace: neg(extra),
  };
}

/**
 * QISMAN SOTUV puli (qaror O2 — bitta o'zgartirilgan buyurtma).
 *
 * `beepost_fee` TO'LIQ olinadi: yetkazish bajarilgan. Qaytgan mahsulot
 * uchun alohida qaytarish haqqi yo'q.
 */
export function computePartlyDeliveredMoney(input: {
  delivered_amount: number;
  returned_amount: number;
  beepost_fee: number;
  extra_cost?: number;
  tariff_version?: number | null;
  where_deliver: Where_deliver;
}): EventMoney {
  const delivered = Math.trunc(input.delivered_amount);
  const fee = Math.trunc(input.beepost_fee);
  const extra = Math.trunc(input.extra_cost ?? 0);

  return {
    currency: 'UZS',
    delivered_amount: delivered,
    returned_amount: Math.trunc(input.returned_amount),
    collected_from_customer: delivered,
    beepost_fee: fee,
    beepost_fee_basis: feeBasis(input.where_deliver),
    tariff_version: input.tariff_version ?? undefined,
    extra_cost: extra,
    net_to_marketplace: delivered - fee - extra,
  };
}

/**
 * ROLLBACK — avvalgi hodisaning TESKARISI.
 *
 * ⚠️ NEGA «teskari», «qayta hisoblash» EMAS. Bloker B5: `rollbackOrderToWaiting`
 * tariflarni JORIY foydalanuvchi qatoridan qayta o'qiydi. Tarif o'zgargandan
 * keyin rollback qilinsa, u asl sotuvdan BOSHQA summani qaytaradi va daftar
 * abadiy siljiydi. Bu yerda faqat ishora almashtiriladi.
 */
export function reverseMoney(original: EventMoney): EventMoney {
  const inv = (v: number | undefined) => (v === undefined ? undefined : neg(v));
  return {
    ...original,
    collected_from_customer: inv(original.collected_from_customer),
    beepost_fee: inv(original.beepost_fee),
    extra_cost: inv(original.extra_cost),
    delivered_amount: inv(original.delivered_amount),
    returned_amount: inv(original.returned_amount),
    net_to_marketplace: inv(original.net_to_marketplace),
  };
}
