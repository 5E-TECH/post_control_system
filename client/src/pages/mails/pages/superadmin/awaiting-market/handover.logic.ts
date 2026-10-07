import { MANUAL_OVERRIDE_REASONS } from "../../../../../shared/api/hooks/useMarketHandover";
import type { ManualOverride } from "../../../../../shared/api/hooks/useMarketHandover";

/**
 * TOPSHIRISH QOIDALARI — komponentdan ajratilgan, chunki bu MAHSULOT
 * QOIDASI va u test bilan qulflanishi kerak:
 *
 *   · jismonan SKANERLANGAN posilka DARHOL topshiriladi, sababsiz —
 *     skan o'zi «mol qo'limda» degan dalil;
 *   · QO'LDA belgilangan posilka uchun YOPIQ ro'yxatdan sabab MAJBURIY —
 *     "yorliq o'qilmadi" dalili aynan shu, va u ALOHIDA tasdiqlanadi.
 *
 * ⚠️ Qo'lda belgilash market ruxsatini EMAS, faqat posilka yorlig'ini
 * chetlab o'tadi: u sessiya ICHIDA, market QR'i bilan ochilgan oynada
 * bo'ladi.
 *
 * ⚠️ PARTIYA TUGMASI YO'Q. Avval skanerlangani to'planib, oxirida
 * «Marketga topshirish (N)» bosilardi. Bu ortiqcha qadam edi: skan
 * qilindi — demak posilka xodim qo'lida va marketga berildi. Tugma
 * faqat xatoga joy qoldirardi (xodim bosmasdan chiqib ketsa, hamma
 * skan bekorga ketardi). Endi har skan O'ZI topshiradi.
 */

/** Sababi hali tanlanmagan qo'lda belgilangan posilkalar. */
export function missingReasonIds(
  manualIds: string[],
  reasons: Record<string, string>,
): string[] {
  return manualIds.filter((id) => !isValidManualReason(reasons[id]));
}

/**
 * Sabab YOPIQ ro'yxatdan ekanini tekshiradi.
 *
 * ⚠️ Backend `@IsIn(MARKET_HANDOVER_MANUAL_REASONS)` bilan tekshiradi va
 * tarjima qilingan matn 422 beradi. Shuning uchun client AYNAN shu
 * qiymatlarni yuboradi — yorliq tarjimasi EMAS.
 */
export function isValidManualReason(reason?: string | null): boolean {
  if (!reason) return false;
  return (MANUAL_OVERRIDE_REASONS as readonly string[]).includes(reason);
}

/** Serverga yuboriladigan `manual_overrides` yuki. */
export function buildManualOverrides(
  manualIds: string[],
  reasons: Record<string, string>,
): ManualOverride[] {
  return manualIds
    .filter((id) => isValidManualReason(reasons[id]))
    .map((id) => ({ order_id: id, reason: reasons[id] }));
}

/**
 * QO'LDA belgilangan BITTA posilkani topshirish mumkinmi.
 *
 * ⚠️ Partiya emas, QATOR darajasida: har qator o'z sababi bilan alohida
 * tasdiqlanadi, shunda xodim qaysi posilka nega qo'lda o'tganini
 * ko'rib turadi (partiya tugmasida bu ko'rinmasdi).
 */
export function canHandOverManual(params: {
  authorized: boolean;
  reason?: string | null;
}): boolean {
  return params.authorized && isValidManualReason(params.reason);
}
