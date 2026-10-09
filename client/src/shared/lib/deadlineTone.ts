/**
 * MUDDAT SANOG'I — KO'RINISH MANTIQI (YAGONA MANBA).
 *
 * ⚠️ NEGA ALOHIDA FAYL. Sanoq ikki joyda ko'rinadi: yuqoridagi umumiy
 * banner va har buyurtma yonidagi nishon. Ohang (rang) va matn ikki joyda
 * alohida yozilsa, ular ajralib ketadi — banner «shoshilinch» deb qizil
 * turib, nishon yashil ko'rsatishi mumkin edi. Kuryer bunday ekranga
 * ishonmaydi.
 *
 * Chegaralar `returnStage.ts` dagi `returnAgeTone` naqshiga mos: ohang
 * MA'LUMOTdan kelib chiqadi, bezak emas.
 */

export type DeadlineTone = 'safe' | 'soon' | 'today' | 'late';

/** Nishon va banner uchun kerakli minimal maydonlar. */
export interface CourierDeadlineRowLike {
  ms_left: number;
  days_left: number | null;
  late_days: number;
  due_today: boolean;
  penalty_now: number;
  deadline_at: number;
  deadline_days: number;
  immune: boolean;
}

export interface DeadlineRow {
  ms_left: number;
  days_left: number | null;
  late_days: number;
  due_today: boolean;
  penalty_now: number;
  penalty_tomorrow: number;
  penalty_max: number;
  immune: boolean;
}

/**
 * Ohang:
 *   `late`  — muddat o'tgan, shtraf allaqachon o'sib boryapti
 *   `today` — bugun oxirgi kun, ertaga shtraf boshlanadi
 *   `soon`  — 2 kun yoki kamroq qoldi
 *   `safe`  — hali vaqt bor
 */
export function deadlineTone(row: Pick<DeadlineRow, 'late_days' | 'due_today' | 'days_left'>): DeadlineTone {
  if (row.late_days > 0) return 'late';
  if (row.due_today) return 'today';
  if (row.days_left != null && row.days_left <= 2) return 'soon';
  return 'safe';
}

/**
 * Qolgan vaqt matni uchun xom qiymatlar.
 *
 * ⚠️ SOAT HAM KERAK. Oxirgi sutkada «0 kun qoldi» deb yozish mantiqsiz va
 * xavfli: kuryer «bugun ulgurmasam ham hech narsa bo'lmaydi» deb o'ylardi.
 * Bir kundan kam qolganda soat ko'rsatiladi.
 */
export function deadlineCountdown(msLeft: number): {
  unit: 'days' | 'hours' | 'minutes' | 'passed';
  value: number;
} {
  if (msLeft <= 0) return { unit: 'passed', value: 0 };
  const hours = msLeft / 3_600_000;
  if (hours >= 24) return { unit: 'days', value: Math.floor(hours / 24) };
  if (hours >= 1) return { unit: 'hours', value: Math.floor(hours) };
  return { unit: 'minutes', value: Math.max(1, Math.floor(msLeft / 60_000)) };
}

/** Ming ajratkichli summa — `1 234 567` ko'rinishida. */
export function formatSum(value: number): string {
  return Math.round(Number(value) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Bannerning shoshilinchlik darajasi.
 *
 * ⚠️ KECHIKKANLAR BIRINCHI O'RINDA. «Bugun tugaydi» — ogohlantirish,
 * kechikkan esa PUL ALLAQACHON KETYAPTI. Ikkalasi bir vaqtda bo'lsa
 * bannerda kechikkani ko'rsatiladi, aks holda kuryer o'sib borayotgan
 * zararni payqamay qolardi.
 */
export function bannerTone(summary: {
  overdue: number;
  due_today: number;
}): DeadlineTone | null {
  if (summary.overdue > 0) return 'late';
  if (summary.due_today > 0) return 'today';
  return null;
}
