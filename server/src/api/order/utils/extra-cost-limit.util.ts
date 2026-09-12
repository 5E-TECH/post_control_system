import { BadRequestException } from '@nestjs/common';
import { Where_deliver } from 'src/common/enums';

/**
 * QO'SHIMCHA XARAJAT SUMMASI CHEGARASI — yagona manba.
 *
 * NEGA ALOHIDA FAYL. Qoida uch joyda kerak (sotuv, bekor qilish, qisman
 * sotuv) va ular ustiga Elchi tomonidagi nusxa ham qo'shiladi. Qoida har
 * joyda qaytadan yozilsa, vaqt o'tib ular AJRALIB ketadi va kuryer eng
 * bo'sh yo'lni topib ishlatadi — pul chegarasi esa eng bo'sh joyi bo'yicha
 * ishlaydi.
 *
 * Tekshiruvda topilgan holat aynan shunday edi:
 *   sotuv          — PCS'da chegara bor, Elchi'da YO'Q
 *   bekor qilish   — PCS'da bor, Elchi'da YO'Q
 *   qisman sotuv   — IKKALASIDA HAM YO'Q
 */

/** Chegara hisobi natijasi — xato tashlamaydi, faqat hisoblaydi. */
export interface ExtraCostLimit {
  /** Ruxsat etilgan maksimal summa. */
  max: number;
  /** Umuman yozib bo'lmasa — sababi (aks holda `null`). */
  forbiddenReason: string | null;
}

/**
 * SOTUV (va qisman sotuv) uchun chegara.
 *
 *   1. UYGA yetkazishda qo'shimcha xarajat YOZILMAYDI — uyga yetkazish uchun
 *      kuryerga allaqachon yuqori tarif to'lanadi, ustiga xarajat yozish
 *      ikki marta to'lash bo'lardi.
 *
 *   2. MARKAZGA: xarajat + markaz tarifi UY tarifidan oshmasin. Ya'ni kuryer
 *      markazga olib borib ustiga xarajat yozsa ham, uyga yetkazishdan
 *      qimmatga tushmasin. Maksimum = `tariff_home − tariff_center`.
 *
 *   3. Ikki tarif TENG bo'lsa 2-qoida 0 beradi va bunday kuryer umuman
 *      xarajat yoza olmasdi. Bunda maksimum — o'z tarifining **50%**i.
 *      Nega yarim: to'liq tarif ruxsat etilsa, kuryer har buyurtmada xizmat
 *      haqini ikki baravar qilib olishi mumkin edi.
 */
export function sellExtraCostLimit(params: {
  whereDeliver: Where_deliver | null | undefined;
  tariffCenter: number | null | undefined;
  tariffHome: number | null | undefined;
}): ExtraCostLimit {
  const center = Math.max(0, Number(params.tariffCenter ?? 0) || 0);
  const home = Math.max(0, Number(params.tariffHome ?? 0) || 0);

  if (params.whereDeliver !== Where_deliver.CENTER) {
    return {
      max: 0,
      forbiddenReason:
        "Uyga yetkaziladigan buyurtmalarda qo'shimcha xarajat yozish mumkin " +
        'emas — uy tarifi allaqachon yuqori',
    };
  }

  const diff = home - center;
  // `Math.floor` — chegara butun so'm bo'lsin; kasrli chegara xato xabarida
  // tushunarsiz ko'rinadi va taqqoslashda chalkashlik beradi.
  const max = diff > 0 ? Math.floor(diff) : Math.floor(center / 2);

  return { max, forbiddenReason: null };
}

/**
 * BEKOR QILISH uchun chegara — sotuvdan ATAYLAB boshqacha.
 *
 * Kuryer borib qaytdi, vaqt va yoqilg'i sarfladi, lekin yetkazmadi. Shu bois
 * maksimum — o'sha buyurtma uchun belgilangan kuryer tarifi. Uyga/markazga
 * ajratilmaydi: harajat ikki holatda ham real.
 */
export function cancelExtraCostLimit(params: {
  courierTariff: number | null | undefined;
}): ExtraCostLimit {
  const tariff = Math.max(0, Number(params.courierTariff ?? 0) || 0);
  return { max: Math.floor(tariff), forbiddenReason: null };
}

/** Chegarani qo'llaydi va buzilsa o'zbekcha xato tashlaydi. */
export function assertExtraCostWithinLimit(
  extraCost: number,
  limit: ExtraCostLimit,
  context: { tariffCenter?: number; tariffHome?: number } = {},
): void {
  if (!(extraCost > 0)) return;

  if (limit.forbiddenReason) {
    throw new BadRequestException(limit.forbiddenReason);
  }

  if (extraCost > limit.max) {
    const detail =
      context.tariffCenter != null && context.tariffHome != null
        ? ` (markaz tarifi: ${context.tariffCenter.toLocaleString('uz-UZ')}, ` +
          `uy tarifi: ${context.tariffHome.toLocaleString('uz-UZ')})`
        : '';
    throw new BadRequestException(
      `Ortiqcha xarajat maksimal ${limit.max.toLocaleString('uz-UZ')} so'm ` +
        `bo'lishi mumkin${detail}`,
    );
  }
}
