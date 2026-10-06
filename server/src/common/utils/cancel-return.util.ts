import { IsNull, Not } from 'typeorm';
import { CancelReturnStage, Order_status } from 'src/common/enums';

/**
 * BEKOR QAYTARISH BOSQICHI — YAGONA MANBA.
 *
 * Bekor qilingan posilkaning ikki bosqichli tasdig'i yangi `Order_status`
 * qiymati QO'SHMASDAN dalil ustunlarida saqlanadi (batafsil izoh:
 * `src/migrations/1750700000000-CancelReturnMarketHandover.ts`). Ya'ni
 * `cancelled (sent)` statusi IKKI MA'NOGA ega bo'ladi:
 *
 *     center_received_at IS NULL      → kuryerda / yo'lda
 *     center_received_at IS NOT NULL  → markazda, market kutilmoqda
 *
 * ⚠️ Shu shartni HAR BIR navbat, filtr, hisobot va cron AYNAN shu
 * fayldan olishi SHART. Repoda status ro'yxatlari 15+ joyda dublikat
 * bo'lgani uchun allaqachon drift bor (masalan `courierStat` ning
 * `cancelledStatuses` ro'yxatida `CANCELLED_SENT` yo'q) — ikki ma'noli
 * statusni qo'lda takrorlash o'sha xatoni ko'paytiradi.
 *
 * Shu sabab bu yerda uch shakl beriladi va boshqa joyda shart QAYTA
 * YOZILMAYDI:
 *   · `cancelReturnStage(order)`      — xotiradagi obyekt uchun;
 *   · `awaitingMarketWhere()`         — TypeORM `find`/`update` uchun;
 *   · `awaitingMarketSql(alias)`      — QueryBuilder/xom SQL uchun.
 */

/** Bosqichni hisoblash uchun kerakli minimal maydonlar. */
export interface CancelReturnFields {
  status?: Order_status | string | null;
  center_received_at?: number | string | null;
  market_handover_at?: number | string | null;
}

/**
 * Buyurtma bekor-qaytarish zanjirining qaysi bosqichida.
 *
 * `null` — buyurtma bu zanjirda EMAS (hali sotilmagan/kutilayotgan, yoki
 * bekor qilinib hali kuryer pochtaga topshirmagan).
 *
 * ⚠️ `market_handover_at` birinchi tekshiriladi: rollback statusni orqaga
 * qaytarsa-yu dalil ustunlari tozalanmasa, buyurtma «marketda» bo'lib
 * ko'rinishi KERAK EMAS — shuning uchun rollback ustunlarni ham tozalaydi
 * (order.service.ts `rollbackOrderToWaiting`).
 */
export function cancelReturnStage(
  order: CancelReturnFields | null | undefined,
): CancelReturnStage | null {
  if (!order) return null;

  // Dalil ustunlari STATUSDAN USTUN turadi. Sabab: almashtirish (kafolat-swap)
  // qatorlari zanjirdan o'tadi-yu, STATUSI SOTILGAN bo'lib qoladi (puli
  // muzlatilgan, moliyaviy reversal yo'q). Ya'ni "qayerda" savoliga status
  // javob bermaydi — dalil beradi.
  if (order.market_handover_at != null) {
    return CancelReturnStage.WITH_MARKET;
  }
  if (order.center_received_at != null) {
    return CancelReturnStage.AT_CENTER;
  }
  if (order.status === Order_status.CANCELLED_SENT) {
    return CancelReturnStage.WITH_COURIER;
  }
  // Dalilsiz CLOSED — LEGACY qator (oqim joriy etilishidan oldin yopilgan).
  // Mol qayerda ekani bizga MA'LUM EMAS, shuning uchun uni "markazda" deb
  // navbatga chiqarmaymiz: soxta dalil auditni buzadi.
  if (order.status === Order_status.CLOSED) {
    return CancelReturnStage.WITH_MARKET;
  }
  return null;
}

/**
 * «Markazda — market kutilmoqda» sharti, TypeORM `where` shaklida.
 *
 * ⚠️ STATUS SHARTI ATAYLAB YO'Q. `center_received_at` ni faqat markazga
 * qabul qilish yo'llari yozadi (`receiveCanceledPost`, `receiveWithScaner`),
 * ya'ni uning o'zi "bu buyurtma qaytarish zanjirida va markazda" degani.
 * Statusni qo'shsak almashtirish qatorlari (SOTILGAN qoladi) navbatdan
 * tushib qolardi — aynan ular uchun ham market ruxsati kerak.
 *
 * Har chaqiruvda YANGI obyekt qaytariladi — umumiy obyekt bo'lsa chaqiruvchi
 * uni o'zgartirib boshqa joyni jimgina buzishi mumkin.
 *
 * TypeORM soft-delete'ni (`deleted_at`) `find`/QueryBuilder da O'ZI
 * filtrlaydi. Xom SQL uchun `awaitingMarketSql()` ni ishlat.
 */
export function awaitingMarketWhere() {
  return {
    center_received_at: Not(IsNull()),
    market_handover_at: IsNull(),
  };
}

/** «Kuryerda / yo'lda» — bekor pochtada, markaz hali qabul qilmagan. */
export function withCourierWhere() {
  return {
    status: Order_status.CANCELLED_SENT,
    center_received_at: IsNull(),
  };
}

/**
 * «Markazda — market kutilmoqda» sharti, SQL fragmenti.
 *
 * Parametr talab qilmaydi (status shartsiz) — shuning uchun boshqa
 * so'rovdagi `:status` bilan urishib ketish xavfi ham yo'q.
 *
 * @param alias jadval aliasi (QueryBuilder'dagi nom, masalan `'o'`)
 * @param withSoftDeleteGuard xom SQL uchun `deleted_at IS NULL` qo'shiladi.
 *   QueryBuilder'da KERAK EMAS (TypeORM o'zi qo'shadi).
 */
export function awaitingMarketSql(alias: string, withSoftDeleteGuard = false) {
  const base =
    `${alias}.center_received_at IS NOT NULL` +
    ` AND ${alias}.market_handover_at IS NULL`;
  return withSoftDeleteGuard ? `${base} AND ${alias}.deleted_at IS NULL` : base;
}
