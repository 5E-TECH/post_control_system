import { ValueTransformer } from 'typeorm';

/**
 * Postgres `bigint` ustunlari pg-driver tomonidan STRING ko'rinishida qaytariladi.
 * Bu transformer ularni JS `number` ga xavfsiz aylantiradi:
 *   - `null` / `undefined` qiymatlar `null` qaytariladi (jim 0 emas!)
 *   - `Number.MAX_SAFE_INTEGER` (2^53 - 1) dan oshib ketsa, xato tashlaydi
 *     (bu holat "kassa balansi 0 bo'lib qoldi" muammosini oldini oladi)
 *
 * Pul (tiyin/so'm) maydonlar uchun ham, timestamp uchun ham ishlatiladi.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: number | bigint | null | undefined): number | bigint | null => {
    if (value === null || value === undefined) return null;
    return value;
  },
  from: (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new Error(`bigintTransformer: invalid value "${value}"`);
    }
    if (n > Number.MAX_SAFE_INTEGER || n < Number.MIN_SAFE_INTEGER) {
      throw new Error(
        `bigintTransformer: value "${value}" exceeds JS safe integer range`,
      );
    }
    return n;
  },
};

/**
 * Default qiymatli ustunlar uchun (NOT NULL) — `null` o'rniga `0` qaytaradi.
 * Faqat `default: 0` belgilangan ustunlar uchun ishlating.
 */
export const bigintTransformerNonNull: ValueTransformer = {
  to: (value: number | bigint | null | undefined): number | bigint => {
    if (value === null || value === undefined) return 0;
    return value;
  },
  from: (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new Error(`bigintTransformer: invalid value "${value}"`);
    }
    if (n > Number.MAX_SAFE_INTEGER || n < Number.MIN_SAFE_INTEGER) {
      throw new Error(
        `bigintTransformer: value "${value}" exceeds JS safe integer range`,
      );
    }
    return n;
  },
};
