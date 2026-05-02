/**
 * Cyrillic → Latin transliteratsiya (case'ni saqlaydi).
 *
 * Foydalanish: skaner OS klaviatura layout'i Russian/Uzbek bo'lsa, Latin
 * harflar Cyrillic ekvivalentiga aylanadi (a→ф, b→и, ...). Bu funksiya
 * ularni qayta Latin'ga o'tkazadi, lekin **case'ni o'zgartirmaydi**
 * (today-orders external API'lariga case-sensitive bo'lishi mumkin).
 *
 * Caps Lock muammosi alohida hal qilinadi (UI banner bilan).
 *
 * Eslatma: hex tokenlar uchun `normalizeQrToken` ishlatiladi (lowercase qiladi).
 */

const RU_TO_EN_LOWER: Record<string, string> = {
  й: "q",
  ц: "w",
  у: "e",
  к: "r",
  е: "t",
  н: "y",
  г: "u",
  ш: "i",
  щ: "o",
  з: "p",
  х: "[",
  ъ: "]",
  ф: "a",
  ы: "s",
  в: "d",
  а: "f",
  п: "g",
  р: "h",
  о: "j",
  л: "k",
  д: "l",
  ж: ";",
  э: "'",
  я: "z",
  ч: "x",
  с: "c",
  м: "v",
  и: "b",
  т: "n",
  ь: "m",
  б: ",",
  ю: ".",
};

/**
 * Bitta belgini tekshiradi: Cyrillic bo'lsa Latin ekvivalentini qaytaradi,
 * aks holda original belgini qaytaradi. Case (katta/kichik) saqlanadi.
 */
export function transliterateChar(ch: string): string {
  const lower = ch.toLowerCase();
  const mapped = RU_TO_EN_LOWER[lower];
  if (!mapped) return ch;
  // Original case'ni qaytaramiz: agar input katta harf bo'lsa, output ham katta
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase()
    ? mapped.toUpperCase()
    : mapped;
}

/**
 * Butun string uchun: Cyrillic harflarni Latin'ga aylantiradi, case saqlanadi.
 */
export function transliterateLatin(input: string | null | undefined): string {
  if (!input) return "";
  let result = "";
  for (const ch of input.trim()) {
    result += transliterateChar(ch);
  }
  return result;
}

/**
 * Skaner buffer regex'i uchun: belgi qabul qilinishi mumkinmi (Latin harf,
 * raqam, yoki Cyrillic harf).
 */
export function isAcceptableScanChar(ch: string): boolean {
  if (ch.length !== 1) return false;
  if (/[a-zA-Z0-9]/.test(ch)) return true;
  // Cyrillic harflar — transliteratsiya orqali Latin'ga aylantirib qabul qilamiz
  if (RU_TO_EN_LOWER[ch.toLowerCase()]) return true;
  return false;
}
