/**
 * FOYDALANUVCHI TELEFONINI YAGONA KO'RINISHGA KELTIRISH.
 *
 * ⚠️ NEGA SERVERDA. Normallashtirish loyihada faqat ikki joyda bor edi:
 * brauzerdagi forma va Telegram botining `normalizePhone` i. Panel
 * endpointlari esa DTO'dan kelgan XOM qiymatni qidirib, xom holicha
 * saqlardi. Natijada API'ga to'g'ridan-to'g'ri `998901234567` yuborilsa,
 * u bazadagi `+998901234567` bilan MOS KELMASDI — takroriylik tekshiruvi
 * jimgina aylanib o'tilardi va bir odamning ikki xil yozilgan raqami
 * paydo bo'lardi.
 *
 * ⚠️ Bu funksiya QAT'IY emas: u faqat KO'RINISHNI birxillashtiradi
 * (bo'shliq/qavs/tire olib tashlanadi, `+` qo'shiladi). Raqamning
 * to'g'riligini tekshirish DTO validatsiyasining ishi — bu yerda
 * tekshirilsa, mavjud yozuvlar bilan ishlash (qidirish, yangilash)
 * buzilardi.
 */
export function normalizeUserPhone(input: string | null | undefined): string {
  const raw = String(input ?? '').trim();
  if (!raw) return raw;

  // Raqam bo'lmagan hamma narsa tashlanadi: "+998 (90) 123-45-67" kabi
  // ko'rinishlar ham bitta shaklga tushadi.
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;

  return `+${digits}`;
}
