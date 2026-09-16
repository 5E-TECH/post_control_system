import { ExtraCostAction, ExtraCostDecisionMode } from 'src/common/enums';

/**
 * QO'SHIMCHA XARAJAT SIYOSATI — "bu xarajat darhol yozilsinmi yoki market
 * tasdig'ini kutsinmi" degan savolga javob beradigan YAGONA joy.
 *
 * NEGA ALOHIDA, SOF FUNKSIYA. Qoida uch oqimda kerak (sotuv, bekor qilish,
 * qisman sotuv) va ularning ustiga tashqi kanallar (Elchi) qo'shiladi.
 * `extra-cost-limit.util.ts` da aynan shu sabab yozilgan: qoida har joyda
 * qaytadan yozilsa, vaqt o'tib ular AJRALIB ketadi va "kuryer eng bo'sh
 * yo'lni topib ishlatadi".
 *
 * Kelajakdagi barcha qoidalar (chegara bo'yicha eskalatsiya, hudud bo'yicha
 * istisno, kuryer ishonch reytingi...) FAQAT shu faylga qo'shiladi.
 */

/**
 * ⚠️ TASDIQLASH OQIMI TAYYORMI.
 *
 * `deferred` rejim pulni kassaga YOZMAYDI — u `extra_cost_request` jadvaliga
 * majburiyat sifatida tushishi va market tasdig'idan keyin to'lanishi kerak.
 * O'sha yozish/tasdiqlash oqimi Bosqich 3-5 da quriladi.
 *
 * SHU KONSTANTA `false` EKAN, `deferred` HECH QACHON QAYTARILMAYDI.
 *
 * ✅ 2026-09-16: `true` — Bosqich 3-5 qurildi (isbot yuklash, so'rov yozuvi,
 * tasdiqlash/rad etish, rekonsiliatsiya). Endi `deferred` xavfsiz: pul
 * `extra_cost_request` da majburiyat sifatida saqlanadi va market
 * tasdiqlaganda kassaga yoziladi.
 *
 * Nega shart: bayroqni yoqish yo'li allaqachon to'liq ochiq (admin UI →
 * `UpdateMarketDto` → `users` ustuni). Agar admin uni bugun yoqsa va
 * `deferred` qaytsa, chaqiruvchida `else` shoxi yo'qligi uchun pul
 * kassaga umuman yozilmaydi — LEKIN buyurtma izohida va activity-log'da
 * "qo'shimcha X so'm ushlab qolingan" deb turadi. Ya'ni kuryer pulni
 * JIMGINA yo'qotadi va uni keyin tiklab ham bo'lmaydi (so'rov qatori ham
 * yaratilmagan bo'ladi).
 *
 * Bosqich 4 (kechiktirish rejimi) yozilganda `true` ga o'zgartiriladi.
 * `extra-cost-policy.spec.ts` shu holatni qulflab turadi.
 */
export const EXTRA_COST_APPROVAL_FLOW_READY = true;

export type ExtraCostMode = 'immediate' | 'deferred';

export interface ExtraCostPolicy {
  /**
   * `immediate` — pul DARHOL ikki kassaga yoziladi (bugungi xulq).
   * `deferred`  — pul kassaga UMUMAN yozilmaydi, so'rov market tasdig'ini
   *               kutadi.
   */
  mode: ExtraCostMode;
  /** Kuryer foto isbot biriktirishi SHARTmi. */
  requireProof: boolean;
  /**
   * `immediate` bo'lsa — qaror qanday avtomatik qabul qilindi (audit uchun).
   * `deferred` bo'lsa — `null` (qarorni odam qabul qiladi).
   */
  decisionMode: ExtraCostDecisionMode | null;
  /** Nega shunday qaror qilindi — log va xato xabarlari uchun. */
  reason: string;
}

const IMMEDIATE = (
  decisionMode: ExtraCostDecisionMode,
  reason: string,
): ExtraCostPolicy => ({
  mode: 'immediate',
  requireProof: false,
  decisionMode,
  reason,
});

export function resolveExtraCostPolicy(params: {
  /** So'ralayotgan summa (0 yoki manfiy bo'lsa siyosat umuman ishlamaydi). */
  amount: number | null | undefined;
  market: {
    extra_cost_proof_required?: boolean | null;
    extra_cost_auto_approve_under?: number | null;
  } | null;
  courier: {
    /** `'elchi'` / `'ldg'` — bizning UI'dan foydalanmaydigan tashqi aktor. */
    external_provider?: string | null;
  } | null;
  actionType: ExtraCostAction;
}): ExtraCostPolicy {
  const amount = Math.trunc(Number(params.amount ?? 0) || 0);

  // ── 1. Summa yo'q → hech narsa bo'lmaydi ────────────────────────────────
  //
  // Bu tekshiruv BIRINCHI turishi SHART. Bulk amallar (`bulkSellOrders`,
  // `bulkCancelOrders`) va LDG oqimlarining uchalasi `extraCost: 0` uzatadi —
  // shu darvoza tufayli ular butunlay tegilmagan holda qoladi.
  if (amount <= 0) {
    return IMMEDIATE(
      ExtraCostDecisionMode.AUTO_RULE,
      "Qo'shimcha xarajat yo'q",
    );
  }

  // ── 2. TASHQI PROVAYDER (Elchi) → har doim darhol ──────────────────────
  //
  // Elchi kuryeri bizning ilovadan foydalanmaydi va foto biriktira olmaydi.
  // Agar darvoza uni ham qamrasa, ikki yomon natijadan biri bo'lardi:
  // yetkazilgan posilkalar `WAITING` holatida qotib qolardi, yoki webhook
  // qayta-urinish mantig'i xarajatni jimgina yo'qotardi.
  //
  // Market bundan XABARDOR qilinadi (sozlama matni + alohida tab).
  if (params.courier?.external_provider) {
    return IMMEDIATE(
      ExtraCostDecisionMode.EXTERNAL_AUTO,
      `Tashqi kargo (${params.courier.external_provider}) — tasdiq talab qilinmaydi`,
    );
  }

  // ── 3. Bayroq o'chiq market → bugungi xulq, 0% o'zgarish ───────────────
  if (params.market?.extra_cost_proof_required !== true) {
    return IMMEDIATE(
      ExtraCostDecisionMode.AUTO_RULE,
      'Market uchun isbot talab qilinmaydi',
    );
  }

  // ── 4. Yashirin chegirma (`price_cut`) → isbot HA, kechiktirish YO'Q ───
  //
  // Kuryer mahsulot sonini o'zgartirmasdan narxni tushirsa, pul natijasi
  // qo'shimcha xarajat bilan AYNAN bir xil bo'ladi. Shuning uchun isbot va
  // chegara qo'llanadi, LEKIN pul kechiktirilmaydi: kechiktirish uchun to'liq
  // narxni kassaga yozib, keyin farqni alohida qaytarish kerak bo'lardi — bu
  // `to_be_paid`, `paid_amount`, `autoPay`, `SELL_PROFIT` va operator
  // daromadi hisobini butunlay o'zgartiradi, ya'ni jonli sotuv matematikasini
  // buzish xavfi.
  //
  // v1 da "ko'rinmas + chegarasiz + isbotsiz" uchligining uchalasi ham
  // yopiladi — xavfning asosiy qismi shu.
  if (params.actionType === ExtraCostAction.PRICE_CUT) {
    return {
      mode: 'immediate',
      requireProof: true,
      decisionMode: ExtraCostDecisionMode.AUTO_RULE,
      reason: 'Narx pasaytirish — isbot majburiy, lekin pul kechiktirilmaydi',
    };
  }

  // ⚠️ Tasdiqlash oqimi hali qurilmagan bo'lsa, `deferred` ga TUSHMAYMIZ —
  // aks holda pul kassaga ham, so'rov jadvaliga ham yozilmay yo'qoladi.
  if (!EXTRA_COST_APPROVAL_FLOW_READY) {
    return {
      mode: 'immediate',
      requireProof: true,
      decisionMode: ExtraCostDecisionMode.AUTO_RULE,
      reason: 'Tasdiqlash oqimi hali ulanmagan — xarajat darhol yoziladi',
    };
  }

  // ── 5. Avtomatik tasdiq chegarasi ──────────────────────────────────────
  //
  // Market kunlik ish yukini kamaytirish uchun kichik summalarni tasdiqsiz
  // o'tkazishi mumkin. ISBOT BARIBIR TALAB QILINADI — chegara faqat
  // "kim qaror qiladi"ni o'zgartiradi, "dalil kerakmi"ni emas.
  const autoUnder = Math.trunc(
    Number(params.market?.extra_cost_auto_approve_under ?? 0) || 0,
  );
  if (autoUnder > 0 && amount < autoUnder) {
    return {
      mode: 'immediate',
      requireProof: true,
      decisionMode: ExtraCostDecisionMode.AUTO_RULE,
      reason: `Summa avtomatik tasdiq chegarasidan kichik (${autoUnder})`,
    };
  }

  // ── 6. Asosiy holat: market tasdig'i kutiladi ──────────────────────────
  return {
    mode: 'deferred',
    requireProof: true,
    decisionMode: null,
    reason: "Market tasdig'i kutilmoqda",
  };
}
