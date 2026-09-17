/**
 * MARKETPLACE INTEGRATSIYASI ENUMLARI.
 *
 * ⚠️ NEGA `common/enums/index.ts` DA EMAS. Repo konvensiyasi bo'yicha umumiy
 * enumlar o'sha faylda turadi, LEKIN bu enumlar FAQAT marketplace moduliga
 * tegishli va o'sha fayl ayni paytda boshqa ish (qo'shimcha xarajat tasdig'i)
 * tomonidan o'zgartirilyapti. Bitta faylga ikki tomondan tegish — keraksiz
 * merge to'qnashuvi. Modulga xos enumlar modul ichida turishi ham to'g'riroq.
 *
 * Kontrakt: `MARKETPLACE_PARTNER_API.md`
 * Reja: `docs/integrations/14-marketplace-beepost.md`
 */

/** Marketplace tomonidagi posilka statuslari (kontrakt §6.1). */
export enum MarketplaceParcelStatus {
  CREATED = 'CREATED',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  ACCEPTED_BY_BEEPOST = 'ACCEPTED_BY_BEEPOST',
  REJECTED_BY_BEEPOST = 'REJECTED_BY_BEEPOST',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  PARTLY_DELIVERED = 'PARTLY_DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNING = 'RETURNING',
  RETURNED = 'RETURNED',
  VOIDED = 'VOIDED',
}

/**
 * Posilkaning BIZNING tomondagi skan holati.
 *
 * ⚠️ Bu marketplace statusidan ATAYLAB ajratilgan: `scan_state` — operator
 * jarayoni (skanerlandi / qabul qilindi / rad etildi), `remote_status` esa
 * ularning tizimidagi holat. Ikkalasini bitta ustunga siqish keyinchalik
 * "qaysi status kimniki" degan chalkashlikni tug'dirardi.
 */
export enum MarketplaceScanState {
  /** Skanerlandi, lekin hali qabul qilinmadi — sessiya ichida turibdi. */
  SCANNED = 'scanned',
  /** Qabul qilindi — buyurtma yaratildi (`order_id` to'ldirilgan). */
  ACCEPTED = 'accepted',
  /** Operator rad etdi (buzilgan, bizniki emas, hududimiz emas). */
  REJECTED = 'rejected',
  /** Sessiya yopilmasdan eskirdi — CRON tozalaydi. */
  EXPIRED = 'expired',
}

/** Operator posilkani nega rad etdi (kontrakt §4.3). */
export enum MarketplaceRejectReason {
  DAMAGED = 'DAMAGED',
  NOT_OURS = 'NOT_OURS',
  OUT_OF_COVERAGE = 'OUT_OF_COVERAGE',
  MISSING_DATA = 'MISSING_DATA',
  DUPLICATE = 'DUPLICATE',
  OTHER = 'OTHER',
}

/** Skan sessiyasining holati. */
export enum MarketplaceScanSessionStatus {
  OPEN = 'open',
  ACCEPTED = 'accepted',
  ABANDONED = 'abandoned',
}

/** Chiquvchi hodisa turlari (kontrakt §9.2). */
export enum MarketplaceEventType {
  PARCEL_ACCEPTED = 'parcel.accepted',
  PARCEL_REJECTED = 'parcel.rejected',
  PARCEL_DISPATCHED = 'parcel.dispatched',
  PARCEL_OUT_FOR_DELIVERY = 'parcel.out_for_delivery',
  PARCEL_DELIVERED = 'parcel.delivered',
  PARCEL_PARTLY_DELIVERED = 'parcel.partly_delivered',
  PARCEL_CANCELLED = 'parcel.cancelled',
  PARCEL_RETURNING = 'parcel.returning',
  PARCEL_RETURNED = 'parcel.returned',
  PARCEL_ROLLED_BACK = 'parcel.rolled_back',
  PARCEL_EXTRA_COST_APPLIED = 'parcel.extra_cost_applied',
  PARCEL_EXTRA_COST_REVERSED = 'parcel.extra_cost_reversed',
  PARCEL_PRICE_CHANGED = 'parcel.price_changed',
  PARCEL_FEE_CHANGED = 'parcel.fee_changed',
  LEDGER_ENTRY = 'ledger.entry',
  LEDGER_SNAPSHOT = 'ledger.snapshot',
  SETTLEMENT_PAID = 'settlement.paid',
  WEBHOOK_TEST = 'webhook.test',
}

/** Outbox qatorining holati. */
export enum MarketplaceOutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
  /**
   * QAYTA URINILMAYDI — 4xx kabi o'zgarmaydigan xato.
   *
   * ⚠️ `failed` DAN AJRATILGAN va bu MUHIM: `claim()` `failed` ni
   * `next_retry_at IS NULL` bo'lsa ham oladi. Ya'ni «qayta urinmaymiz»
   * deb belgilangan hodisa aslida har 30 soniyada qayta yuborilib,
   * urinish byudjetini yeb bitirardi va monitorda «xato» bo'lib
   * turaverardi. `dropped` — yakuniy holat, odam aralashuvi kerak.
   */
  DROPPED = 'dropped',
  /**
   * Yangiroq `seq` allaqachon yuborilgan — bu hodisa eskirgan.
   *
   * ⚠️ Bu `failed` DAN AJRATILGAN: `failed` "yubora olmadik, muammo bor"
   * degani, `superseded` esa "yuborish SHART EMAS" degani. Ikkalasini
   * aralashtirish monitorni yolg'on ogohlantirishlar bilan to'ldirardi.
   */
  SUPERSEDED = 'superseded',
  /**
   * Integratsiya o'chirilgan yoki sozlanmagan — yuborilmadi, lekin qator
   * SAQLANADI (sabab bilan). Reja §2.2: "jimgina o'tib ketish" eng yomon
   * variant, chunki keyin hech kim nima yo'qolganini bilmaydi.
   */
  SKIPPED = 'skipped',
}

/** Outbox qatori qaysi obyekt haqida. */
export enum MarketplaceAggregateType {
  PARCEL = 'parcel',
  LEDGER = 'ledger',
  SETTLEMENT = 'settlement',
}

/**
 * Har-sotuvchi daftar yozuvining turi.
 *
 * ⚠️ `SALE` summasi MANFIY bo'lishi mumkin — prepaid posilkada
 * (`COD = 0`, tarif baribir olinadi). Reja §7.10.
 */
export enum MarketplaceLedgerEntryType {
  SALE = 'sale',
  EXTRA_COST = 'extra_cost',
  CANCEL = 'cancel',
  CORRECTION = 'correction',
  ADJUSTMENT = 'adjustment',
  SETTLEMENT = 'settlement',
}

/** Marketplace'ga to'lov usuli. */
export enum MarketplaceSettlementMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  CARD = 'card',
}


/**
 * SLUG SIFATIDA ISHLATIB BO'LMAYDIGAN SO'ZLAR.
 *
 * ⚠️ NEGA. Ichki route'lar `marketplace/<literal>/...` shaklida, ommaviy
 * o'qish route'lari esa `marketplace/:slug/...`. Agar kimdir slug'ni
 * `scan-session` deb qo'ysa, `GET marketplace/scan-session/abc` ikki
 * marshrutga ham to'g'ri kelib, qaysi biri ishlashi ro'yxatga olish
 * tartibiga bog'liq bo'lib qolardi — ya'ni jimgina, tushuntirib bo'lmaydigan
 * xato.
 *
 * Integratsiya yaratish/tahrirlash ekrani shu ro'yxatni tekshirishi SHART.
 */
export const RESERVED_MARKETPLACE_SLUGS = [
  'scan-session',
  'parcels',
  'ledger',
  'events',
  'settlement',
  'webhook',
  'admin',
  'health',
  // Admin sozlash yo'llari: `marketplace/config/:slug`
  'config',
  'mismatches',
  'scan',
  'accept',
  'reconcile',
  'available',
] as const;

export function isReservedMarketplaceSlug(slug: string): boolean {
  return (RESERVED_MARKETPLACE_SLUGS as readonly string[]).includes(
    String(slug ?? '').trim().toLowerCase(),
  );
}
