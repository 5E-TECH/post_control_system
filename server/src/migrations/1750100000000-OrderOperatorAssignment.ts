import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BUYURTMAGA OPERATOR BIRIKTIRISH.
 *
 * Market yoki admin buyurtmani MA'LUM operatorga biriktira oladi, operator
 * esa uni o'z sahifasidan qabul qiladi.
 *
 *   operator_assigned_by — kim biriktirdi (null = operator o'zi yaratgan
 *                          yoki eski yozuv)
 *   operator_assigned_at — qachon biriktirildi
 *   operator_accepted_at — operator qabul qilgan vaqt (null = kutilmoqda)
 *
 * ⚠️ `operator_id` ustuni BU YERDA YARATILMAYDI — u bazada tarixan
 * `synchronize` bilan paydo bo'lgan va migratsiyasi yo'q. Shu bois quyida
 * u ham `IF NOT EXISTS` bilan kafolatlanadi: entity uni e'lon qiladi,
 * `synchronize: false` esa uni o'zi qo'shmaydi. Indeks ham xuddi shunday.
 *
 * ⚠️ BACKFILL SHART. Mavjud buyurtmalarda `operator_id` FAQAT yaratuvchi
 * operatorning o'zi bo'lgan (eski `order.service.ts` mantiqi), ya'ni ular
 * mazmunan «allaqachon qabul qilingan». Backfillsiz operatorning sahifasi
 * butun tarixi bilan «Qabul kutilmoqda» bo'lib to'lib ketadi.
 */
export class OrderOperatorAssignment1750100000000 implements MigrationInterface {
  name = 'OrderOperatorAssignment1750100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Ustunlar ──────────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "operator_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "operator_assigned_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "operator_assigned_at" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "operator_accepted_at" bigint`,
    );

    // ── Indekslar ─────────────────────────────────────────────────────
    // `operator_id` — operatorning «mening buyurtmalarim» so'rovi.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_OPERATOR_ID" ON "order" ("operator_id")`,
    );
    /**
     * «Qabul kutilmoqda» ro'yxati uchun QISMAN indeks: faqat biriktirilgan
     * va hali qabul qilinmagan qatorlar. Jadval o'sganda ham bu ro'yxat
     * kichik qoladi — to'liq indeks bu yerda ortiqcha bo'lardi.
     */
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_OPERATOR_PENDING"
         ON "order" ("operator_id")
       WHERE "operator_id" IS NOT NULL AND "operator_accepted_at" IS NULL`,
    );

    /**
     * ── Backfill (bo'laklab — katta jadvalda uzoq lock bo'lmasin) ──────
     *
     * ⚠️ `UPDATE ... RETURNING` ATAYLAB ISHLATILMAYDI. TypeORM `query()`
     * UPDATE uchun `[rows, affectedCount]` TUPLE qaytaradi, ya'ni
     * `res.length` har doim 2 bo'lib, halqa HECH QACHON tugamaydi
     * (birinchi urinishda aynan shunday bo'ldi). Shu bois tugash sharti
     * alohida `SELECT count(*)` bilan o'lchanadi — u oddiy massiv
     * qaytaradi va tuzoqqa tushmaydi.
     */
    const remaining = async (): Promise<number> => {
      const rows: Array<{ n: number }> = await queryRunner.query(
        `SELECT count(*)::int AS n FROM "order"
          WHERE "operator_id" IS NOT NULL AND "operator_accepted_at" IS NULL`,
      );
      return Number(rows?.[0]?.n ?? 0);
    };

    let total = 0;
    // Qo'shimcha to'siq: kutilmagan holatda ham cheksiz aylanmaydi.
    for (let guard = 0; guard < 1000; guard++) {
      const left = await remaining();
      if (left === 0) break;
      await queryRunner.query(`
        UPDATE "order" o
           SET "operator_accepted_at" = COALESCE(o."created_at", 1),
               "operator_assigned_at" = COALESCE(o."created_at", 1),
               "operator_assigned_by" = o."operator_id"
         WHERE o.id IN (
           SELECT id FROM "order"
            WHERE "operator_id" IS NOT NULL
              AND "operator_accepted_at" IS NULL
            LIMIT 5000
         )
      `);
      total += Math.min(left, 5000);
    }
    // eslint-disable-next-line no-console
    console.log(
      `[OPERATOR] ${total} ta eski buyurtma «qabul qilingan» deb belgilandi`,
    );
  }

  /**
   * ⚠️ Ustunlar O'CHIRILADI, lekin `operator_id` TEGILMAYDI — u bu
   * migratsiyadan oldin ham bor edi va uni o'chirish operator
   * komissiyasining butun tarixini yo'q qilardi.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ORDER_OPERATOR_PENDING"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "operator_accepted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "operator_assigned_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "operator_assigned_by"`,
    );
  }
}
