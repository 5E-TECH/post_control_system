/**
 * QR token normalizatori — kuryer skanerini OS sozlamalaridan himoya qiladi.
 *
 * Muammolar:
 *   1. Caps Lock yoqiq bo'lsa, skaner "abc123" o'rniga "ABC123" yuboradi
 *   2. Klaviatura layout'i ruschada bo'lsa, "abc" o'rniga "фыв" keladi
 *
 * Token formati: 24 ta hex char [0-9a-f] (qarang qr.token.ts).
 * Hex faqat 6 ta harfdan iborat (a-f) — ularning RU layout'dagi ekvivalenti
 * mavjud va bir-birlariga konflikt qilmaydi.
 */

// QWERTY (en) ↔ ЙЦУКЕН (ru) layout'dagi a-f harflarining mapping'i.
// Skaner Latin "a" yuborganda, RU layout aktivligida OS "ф" ni chiqaradi.
// Boshqa harflar uchun ham mapping bor, lekin biz hex tokenda ishlatmaymiz.
const RU_TO_EN: Record<string, string> = {
  ф: 'a',
  и: 'b',
  с: 'c',
  в: 'd',
  у: 'e',
  а: 'f',
  // ehtimollikdan past, lekin to'liq qoplash uchun:
  й: 'q',
  ц: 'w',
  к: 'r',
  е: 't',
  н: 'y',
  г: 'u',
  ш: 'i',
  щ: 'o',
  з: 'p',
  х: '[',
  ъ: ']',
  ы: 's',
  п: 'g',
  р: 'h',
  о: 'j',
  л: 'k',
  д: 'l',
  ж: ';',
  э: "'",
  я: 'z',
  ч: 'x',
  м: 'v',
  т: 'n',
  ь: 'm',
  б: ',',
  ю: '.',
};

/**
 * Skanerlangan QR token'ni standart shaklga keltiradi:
 *  - tashqi bo'shliqlarni olib tashlaydi
 *  - kirill (RU) belgilarini Latin'ga konvertatsiya qiladi
 *  - barchasini lowercase qiladi (Caps Lock himoyasi)
 *
 * Hex token har doim lowercase saqlangani uchun bu transformatsiya
 * mavjud token'lar bilan to'liq mos.
 */
export function normalizeQrToken(input: string | null | undefined): string {
  if (!input) return '';
  let result = '';
  // toLowerCase'ni alohida bajaramiz — Cyrillic "Ф" ham mapping'da bo'lsin
  for (const ch of input.trim()) {
    const lower = ch.toLowerCase();
    result += RU_TO_EN[lower] ?? lower;
  }
  return result;
}
