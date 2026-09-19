import { Status } from 'src/common/enums';
import { UserEntity } from 'src/core/entity/users.entity';

/**
 * MARKET DARVOZASI — operator o'z marketidan ORTIQ huquqqa ega bo'lmasligi.
 *
 * Admin marketni bloklaganda u bilan ishlash to'xtaydi. Lekin operator
 * alohida `users` qatori bo'lgani uchun uning `status` i o'zgarmaydi —
 * ya'ni u eski paroli bilan kirib, buyurtma yaratishda davom etardi.
 *
 * ⚠️ NEGA YOZUV EMAS, DARVOZA.
 *
 * Marketni bloklaganda uning operatorlariga `status = inactive` yozib
 * qo'yish oson, lekin blokdan CHIQARISHDA orqaga qaytarib bo'lmaydi:
 * AYNAN shu ustunga market ham yozadi (`updateOperator` — market o'z
 * operatorini vaqtincha to'xtatadi). Bazada «bu blokni kim qo'ygan»
 * degan ma'lumot YO'Q, shuning uchun market blokdan chiqarilganda
 * kaskad uni bilmasdan OCHIB yuborardi.
 *
 * Shu bois operator qatoriga umuman tegilmaydi: haqiqat manbai BITTA —
 * market qatori, u har kirishda va har amalda o'qiladi. Natijada
 * `operator.status` faqat MARKETNING niyati, `market.status` faqat
 * ADMINNING niyati bo'lib qoladi va ular bir-birining ustiga yozmaydi.
 *
 * ⚠️ `market_id = NULL` ham RAD ETILADI. `users.market` munosabati
 * `onDelete: 'SET NULL'` — ya'ni market qattiq o'chirilsa operatorning
 * `market_id` si NULL bo'lib qoladi. «Marketsiz = erkin» degan talqin
 * marketni o'chirishni operatorni OZOD QILISHGA aylantirardi.
 */
export const MARKET_BLOCKED_MESSAGE = 'Your market has been blocked';

/** Bot va WebApp uchun — foydalanuvchi ko'radigan o'zbekcha matn. */
export const MARKET_BLOCKED_MESSAGE_UZ =
  "⛔️ Marketingiz bloklangan. Administrator bilan bog'laning.";

/**
 * Market qatori ishlashga yaroqlimi.
 *
 * Sof funksiya — bazaga murojaat qilmaydi, shuning uchun uni to'g'ridan
 * -to'g'ri sinash mumkin va chaqiruvchi market qatorini qayerdan
 * olishini o'zi hal qiladi (ko'pincha u allaqachon o'qilgan bo'ladi).
 */
export function isMarketUsable(
  market: Pick<UserEntity, 'status' | 'is_deleted'> | null | undefined,
): boolean {
  // Topilmadi — market qattiq o'chirilgan.
  if (!market) return false;
  // Yumshoq o'chirish.
  if (market.is_deleted) return false;
  return market.status !== Status.INACTIVE;
}
