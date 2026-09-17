/**
 * `UPDATE ... RETURNING` NATIJASINI NORMALLASHTIRISH.
 *
 * ⚠️ TypeORM `query()` ikki XIL shakl qaytaradi (`PostgresQueryRunner.query`):
 *   - `SELECT`            → `rows` (oddiy massiv)
 *   - `UPDATE` / `DELETE` → `[rows, affectedCount]` (TUPLE)
 *
 * Farq jimgina va o'ta zararli: tuple holatida `rows[0].col` `undefined`
 * bo'ladi, `Number(undefined)` esa `NaN` beradi va u `bigint` ustunga
 * yozilganda butun INSERT yiqiladi — «invalid input syntax for type
 * bigint: "NaN"».
 *
 * ⚠️ MOCK'LANGAN UNIT TESTLAR BUNI KO'RMAYDI. Ular `query` dan oddiy
 * massiv qaytaradi, ya'ni prod'dagi tuple yo'li umuman sinalmaydi. Aynan
 * shuning uchun bu xato faqat haqiqiy bazaga qarshi uchdan-uchga sinovda
 * chiqdi. Yangi `UPDATE ... RETURNING` yozganda SHU util ishlatilsin.
 */
export function pgReturningRows<T = Record<string, unknown>>(raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number') {
    return raw[0] as T[];
  }
  return raw as T[];
}

/**
 * `RETURNING` dan kelgan raqamni XAVFSIZ o'qish.
 *
 * Postgres `bigint` ni STRING qilib qaytaradi. Qiymat yo'q yoki raqam
 * bo'lmasa — jimgina `NaN` yozish o'rniga tushunarli xato tashlaymiz:
 * NaN bazaga tushsa sabab manbadan ancha uzoqda ko'rinadi.
 */
export function pgReturningNumber(
  raw: unknown,
  column: string,
  context: string,
): number {
  const rows = pgReturningRows<Record<string, unknown>>(raw);
  if (!rows.length) {
    throw new Error(`${context}: "${column}" uchun qator qaytmadi`);
  }
  const value = Number(rows[0][column]);
  if (!Number.isFinite(value)) {
    throw new Error(
      `${context}: "${column}" raqam emas (kelgani: ${JSON.stringify(rows[0][column])})`,
    );
  }
  return value;
}
