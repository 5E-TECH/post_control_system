/**
 * KASSA TARIXI MANBA TURLARINING O'ZBEKCHA NOMLARI.
 *
 * ── NEGA BITTA JOYDA ────────────────────────────────────────────────────
 *
 * Avval ayni lug'at IKKI faylda nusxalangan edi:
 *   client/src/pages/payments/index.tsx                  (sourceTypeLabels)
 *   client/src/pages/payments/components/paymentHistory.tsx (getSourceTypeLabel)
 *
 * Ikkalasida ham 11 ta yozuv bor edi, bazada esa 15 xil qiymat. Ikki
 * nusxa bo'lgani uchun biriga yorliq qo'shilsa ikkinchisi eskirib
 * qolardi — `rollback_correction` qo'shilganda aynan shunday bo'lishi
 * mumkin edi.
 *
 * ── NIMA BUZILGAN EDI ───────────────────────────────────────────────────
 *
 * Yorliq topilmasa kod `|| sourceType` bilan BAZADAGI TEXNIK NOMNI
 * ko'rsatardi. Asosiy kassaning 71 qatoridan 12 tasi (17%) shu sababli
 * ekranda `investor_payout` / `investor_allocate` deb inglizcha
 * chiqardi.
 *
 * ⚠️ Bu ro'yxat `cashbox_history_source_type_enum` ning BARCHA 15
 * qiymatini qamrab olishi SHART. Backend tomonidagi nusxa:
 * `server/src/api/cash-box/cash-box.service.ts` (Excel eksporti uchun) —
 * ikkisi bir xil so'zlarni ishlatadi.
 */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  // ── Kundalik oqim ────────────────────────────────────────────────
  courier_payment: "Kuryer to'lovi",
  market_payment: "Market to'lovi",
  sell: 'Sotuv',
  cancel: 'Bekor qilish',
  extra_cost: "Qo'shimcha xarajat",

  // ── Tuzatishlar ──────────────────────────────────────────────────
  correction: 'Tuzatish',
  /** Sotuvni orqaga qaytarish tuzatishi — 2026-09-23 da ajratilgan. */
  rollback_correction: 'Sotuv qaytarildi',

  // ── Qo'lda kiritiladigan ─────────────────────────────────────────
  manual_income: "Qo'lda kirim",
  manual_expense: "Qo'lda chiqim",
  salary: 'Maosh',
  bills: "To'lovlar",

  // ── Investor ─────────────────────────────────────────────────────
  investor_payout: "Investorga to'lov",
  /**
   * ⚠️ Quyidagi uchtasi ESKI ma'lumot. Bazadagi enumda bor va real
   * qatorlar mavjud (asosiy kassada `investor_allocate` — 5 qator,
   * 2026-03), lekin hozirgi kodda ularni YOZADIGAN joy yo'q.
   * Yorliq baribir kerak: aks holda eski qatorlar ekranda inglizcha
   * texnik nom bilan chiqadi.
   */
  investor_allocate: 'Investorga taqsimlandi',
  investor_earning: 'Investor foydasi',
  investor_refund: 'Investorga qaytarildi',
};

/**
 * Manba turining o'zbekcha nomi.
 *
 * ⚠️ Noma'lum tur kelsa TEXNIK NOMNI qaytaradi — jimgina bo'sh satr
 * EMAS. Shunda yangi tur qo'shilib, yorliq unutilsa, u ekranda
 * ko'rinib turadi va tezda sezamiz.
 */
export const sourceTypeLabel = (sourceType?: string | null): string =>
  (sourceType && SOURCE_TYPE_LABELS[sourceType]) || sourceType || '—';
