/**
 * Pagination konstantalari
 * Barcha servislar uchun yagona joy
 */
export const PAGINATION = {
  /** Default limit - agar ko'rsatilmasa */
  DEFAULT_LIMIT: 10,

  /** Maksimal limit - oddiy so'rovlar uchun */
  MAX_LIMIT: 100,

  /** fetchAll uchun maksimal limit - Excel export va boshqalar uchun */
  MAX_FETCH_ALL: 5000,

  /** Default offset */
  DEFAULT_OFFSET: 0,
} as const;

/**
 * Limit ni xavfsiz qilish uchun helper funksiya
 * @param limit - so'rovdan kelgan limit
 * @param fetchAll - barcha ma'lumotlarni olish kerakmi
 * @returns xavfsiz limit qiymati
 */
export function getSafeLimit(limit?: number, fetchAll?: boolean): number {
  if (fetchAll) {
    return PAGINATION.MAX_FETCH_ALL;
  }

  if (!limit || limit <= 0) {
    return PAGINATION.DEFAULT_LIMIT;
  }

  return Math.min(limit, PAGINATION.MAX_LIMIT);
}

/**
 * Offset ni xavfsiz qilish uchun helper funksiya
 * @param offset - so'rovdan kelgan offset
 * @returns xavfsiz offset qiymati
 */
export function getSafeOffset(offset?: number): number {
  if (!offset || offset < 0) {
    return PAGINATION.DEFAULT_OFFSET;
  }

  return offset;
}
