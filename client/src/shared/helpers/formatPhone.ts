/**
 * O'zbekiston telefon raqamini formatlangan ko'rinishda qaytaradi.
 * Misol: "998901234567" → "+998 90 123 45 67"
 *
 * Manba telefon raqami quyidagicha bo'lishi mumkin:
 * - "998901234567"
 * - "+998901234567"
 * - "+998 90 123 45 67"
 * - "901234567"
 * Hammasi bir xil formatga keltiriladi.
 */
export const formatPhone = (raw?: string | null): string => {
  if (!raw) return "—";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  if (digits.length === 0) return "—";
  const m = digits.match(/^(\d{1,2})(\d{0,3})(\d{0,2})(\d{0,2})$/);
  if (!m) return `+998 ${digits}`;
  return `+998 ${[m[1], m[2], m[3], m[4]].filter(Boolean).join(" ")}`;
};
