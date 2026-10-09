/**
 * APPARAT SKANERI UCHUN FOKUS FILTRI.
 *
 * Skanerlar klaviatura-wedge sifatida ishlaydi: belgilarni `document.activeElement`
 * ga «yozadi». Shuning uchun skaner tinglovchilari matn maydoniga yozilayotgan
 * belgilarni O'TKAZIB YUBORISHI kerak — aks holda xodim izoh yozayotganda har
 * harf token sifatida talqin qilinardi.
 *
 * ⚠️ AVVAL FILTR `tagName === "INPUT"` EDI — VA BU PRODUCTION NUQSONI BERDI.
 *
 * antd `Checkbox` ichida haqiqiy `<input type="checkbox">` bor, antd `Select`
 * esa bosilganda ichki `<input type="search" readOnly>` ni ATAYLAB fokuslaydi
 * va variant tanlangandan KEYIN ham fokusni o'zida ushlab qoladi. Ikkalasi ham
 * topshirish ekranining ASOSIY ro'yxatida: xodim yorlig'i yirtilgan posilkani
 * qo'lda belgilaydi va sababini tanlaydi — ya'ni epik ATAYLAB qurgan oqim.
 * Shundan keyin skaner JIM o'lardi: apparat bip qiladi, ekranda esa hech narsa
 * qo'shilmaydi va «Skaner tayyor» yozib turaveradi. Xodim skanerni buzilgan deb
 * o'ylardi; tiklanish yagona yo'li — sahifaning bo'sh joyiga bosish, lekin buni
 * ekran aytmasdi.
 *
 * Loyihada bu saboq allaqachon bor: `marketplace-intake` har 700 ms da fokusni
 * qaytarib turadi, chunki «maydon ko'rinmaydi, shuning uchun operator uni
 * yo'qotganini SEZMAYDI».
 *
 * Shuning uchun endi element TURIga qaraladi: faqat HAQIQATAN matn qabul
 * qiladigan maydon skanerni to'sadi.
 *
 * ⚠️ PIN maydoni (`type="text"`, readOnly emas) HAMON to'sadi — bu ataylab:
 * xodim PIN terayotganda raqamlar maydonga tushishi kerak.
 */

/** Matn QABUL QILMAYDIGAN `input` turlari — skanerni to'smaydi. */
const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "file",
  "range",
  "color",
  "image",
]);

export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!target || !(target as HTMLElement).tagName) return false;
  const el = target as HTMLElement;

  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;

  const input = el as HTMLInputElement;
  if (NON_TEXT_INPUT_TYPES.has(input.type)) return false;
  // antd `Select` ning ichki inputi qidiruv o'chiq paytda `readOnly` —
  // unga yozib bo'lmaydi, demak skanerni to'sishi ham mantiqsiz.
  if (input.readOnly || input.disabled) return false;

  return true;
}
