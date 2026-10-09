/**
 * SHTRAFNI BEKOR QILISH SABABLARI — YOPIQ RO'YXAT.
 *
 * ⚠️ NEGA ERKIN MATN EMAS. Qulflangan qaror: admin shtrafni bekor qila
 * oladi, lekin SABAB MAJBURIY. Erkin matn qoldirilsa, oylar o'tib «nega
 * bu shtraflar bekor qilingan» degan savolga javob «asosli sabab»,
 * «kelishildi», «ok» kabi ma'nosiz qatorlar bo'lardi — ya'ni majburiy
 * sabab shakli bajarilib, mazmuni yo'qolardi.
 *
 * Yopiq ro'yxat yana bir narsa beradi: bekor qilishlarni SABAB bo'yicha
 * sanash. Agar «tizim nosozligi» eng ko'p chiqsa, tuzatish kerak bo'lgan
 * narsa shtraf emas, tizimning o'zi.
 *
 * Izoh maydoni (`note`) qo'shimcha — u sababning O'RNINI bosmaydi.
 */
export const WAIVER_REASONS = [
  /** Kuryer aybi emas: posilka markazda/marketda ushlanib qolgan. */
  'blocked_by_post',
  /** Mijoz bilan bog'lanib bo'lmadi, market uzoq javob bermadi. */
  'blocked_by_market',
  /** Tizim nosozligi — ilova ishlamadi, holat noto'g'ri turdi. */
  'system_fault',
  /** Kuryer kasal / ta'tilda / favqulodda holat. */
  'courier_absent',
  /** Noto'g'ri sozlama tufayli yozilgan (qoida xato kiritilgan). */
  'wrong_rule',
  /** Rahbariyat qarori — alohida holat. */
  'management_decision',
] as const;

export type WaiverReason = (typeof WAIVER_REASONS)[number];
