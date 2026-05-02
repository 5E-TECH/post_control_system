/**
 * QR token normalizatori — kuryer skanerini OS sozlamalaridan himoya qiladi.
 *
 * Muammolar:
 *   1. Caps Lock yoqiq bo'lsa, skaner "abc123" o'rniga "ABC123" yuboradi
 *   2. Klaviatura layout'i ruschada bo'lsa, "abc" o'rniga "фыв" keladi
 *
 * Token formati: 24 ta hex char [0-9a-f]. Faqat 6 ta harf (a-f) ishlatiladi —
 * ularning RU layout'dagi ekvivalenti bilan konflikt yo'q.
 *
 * Bu funksiya server tomondagi `normalizeQrToken` bilan AYNAN bir xil mantiqqa ega.
 */

const RU_TO_EN: Record<string, string> = {
  ф: "a",
  и: "b",
  с: "c",
  в: "d",
  у: "e",
  а: "f",
  й: "q",
  ц: "w",
  к: "r",
  е: "t",
  н: "y",
  г: "u",
  ш: "i",
  щ: "o",
  з: "p",
  х: "[",
  ъ: "]",
  ы: "s",
  п: "g",
  р: "h",
  о: "j",
  л: "k",
  д: "l",
  ж: ";",
  э: "'",
  я: "z",
  ч: "x",
  м: "v",
  т: "n",
  ь: "m",
  б: ",",
  ю: ".",
};

export function normalizeQrToken(input: string | null | undefined): string {
  if (!input) return "";
  let result = "";
  for (const ch of input.trim()) {
    const lower = ch.toLowerCase();
    result += RU_TO_EN[lower] ?? lower;
  }
  return result;
}
