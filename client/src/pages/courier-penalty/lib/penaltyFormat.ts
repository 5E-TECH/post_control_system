/**
 * SHTRAF EKRANI — KO'RINISH YORDAMCHILARI (YAGONA MANBA).
 *
 * ⚠️ SANA FORMATI QO'LDA. `toLocaleDateString()` brauzer tiliga qarab
 * `10/9/2026` (oy-kun) ko'rsatardi — o'zbek/rus adminlari uni 10-sentyabr
 * deb o'qib, kechikish sanasini teskari tushunardi. `DD.MM.YYYY` esa
 * uchala tilda ham bir xil va noaniqliksiz.
 */

export function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function formatDateTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${formatDate(ms)}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** `<input type="date">` uchun `YYYY-MM-DD`. */
export function toDateInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Kun boshi / oxiri — millisekundda (server ms kutadi). */
export function dayStartMs(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}
export function dayEndMs(value: string): number {
  return new Date(`${value}T23:59:59.999`).getTime();
}

/**
 * Kechikish darajasi — RANG MA'LUMOTDAN KELIB CHIQADI, bezak emas.
 *
 * `late_days` allaqachon muhlatdan KEYINGI kunlar soni, ya'ni 1 ham
 * «kechikdi» degani. Shuning uchun uchta pog'ona: endigina kechikkan,
 * sezilarli, va qo'ng'iroq qilish shart bo'lgan daraja.
 */
export type LateTone = "mild" | "warn" | "severe";

export function lateTone(lateDays: number): LateTone {
  if (lateDays >= 8) return "severe";
  if (lateDays >= 3) return "warn";
  return "mild";
}

export const lateToneClass: Record<LateTone, string> = {
  mild: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  warn: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  severe: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

/**
 * Daftardagi summaning YO'NALISHI.
 *
 * ⚠️ ISHORA O'ZI YETARLI EMAS. Daftarda shtraf `+20 000`, bekor qilish
 * `−20 000` bo'lib saqlanadi — lekin admin «plyus» ni «kuryer yutdi» deb
 * o'qishi mumkin. Aslida plyus kuryerning QARZI oshgani. Shuning uchun
 * raqam yonida yo'nalish so'zi ko'rsatiladi.
 */
export type MoneyDirection = "debt_up" | "debt_down" | "none";

export function moneyDirection(amount: number): MoneyDirection {
  if (amount > 0) return "debt_up";
  if (amount < 0) return "debt_down";
  return "none";
}
