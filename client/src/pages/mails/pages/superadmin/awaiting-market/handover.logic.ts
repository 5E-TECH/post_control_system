import { MANUAL_OVERRIDE_REASONS } from "../../../../../shared/api/hooks/useMarketHandover";
import type { ManualOverride } from "../../../../../shared/api/hooks/useMarketHandover";

/**
 * TOPSHIRISH TANLOVI QOIDALARI — komponentdan ajratilgan, chunki bu
 * MAHSULOT QOIDASI va u test bilan qulflanishi kerak:
 *
 *   · jismonan SKANERLANGAN posilka sababsiz topshiriladi;
 *   · QO'LDA belgilangan posilka uchun YOPIQ ro'yxatdan sabab MAJBURIY —
 *     "yorliq o'qilmadi" dalili aynan shu.
 *
 * ⚠️ Qo'lda belgilash market ruxsatini EMAS, faqat posilka yorlig'ini
 * chetlab o'tadi: u sessiya ICHIDA, market QR'i bilan ochilgan oynada
 * bo'ladi.
 */

/** Tanlanganlardan qo'lda belgilanganlari (skanerlanmaganlari). */
export function manualSelection(
  selectedIds: string[],
  scannedIds: Set<string>,
): string[] {
  return selectedIds.filter((id) => !scannedIds.has(id));
}

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

/** Topshirish tugmasi faolmi. */
export function canSubmitBatch(params: {
  authorized: boolean;
  selectedIds: string[];
  scannedIds: Set<string>;
  reasons: Record<string, string>;
}): boolean {
  const { authorized, selectedIds, scannedIds, reasons } = params;
  if (!authorized || selectedIds.length === 0) return false;
  return (
    missingReasonIds(manualSelection(selectedIds, scannedIds), reasons)
      .length === 0
  );
}
