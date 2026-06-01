import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Buyurtmaga o'qiladigan global `order_number` (#100042) qo'shadi.
 *
 * UUID `id` qoladi — `order_number` faqat ko'rsatish / qidiruv / chek uchun
 * qulay, ketma-ket raqam. Postgres SEQUENCE orqali atomik generatsiya
 * (concurrency-safe; `MAX()+1` emas), 100000 dan boshlanadi → barqaror 6 xona.
 *
 * Qadamlar:
 *  1) `order_number_seq` sequence (100000 dan).
 *  2) ustun qo'shish (avval nullable — backfill uchun).
 *  3) mavjud buyurtmalarni `created_at` tartibida 100000, 100001, ... bilan
 *     to'ldirish (deterministik — ROW_NUMBER).
 *  4) sequence'ni eng katta raqamdan keyinga surish (keyingi nextval = max+1).
 *  5) ustunga DEFAULT nextval + NOT NULL (barcha insert yo'llari avtomatik).
 *  6) unikal index.
 */
export class OrderNumber1747000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Sequence
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START WITH 100000 INCREMENT BY 1`,
    );

    // 2) Ustun (avval nullable)
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "order_number" bigint`,
    );

    // 3) Backfill — created_at tartibida 100000 dan
    await queryRunner.query(`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) - 1 AS rn
        FROM "order"
      )
      UPDATE "order" o
      SET "order_number" = 100000 + ordered.rn
      FROM ordered
      WHERE o.id = ordered.id AND o."order_number" IS NULL
    `);

    // 4) Sequence'ni mavjud eng katta raqamdan keyinga surish
    await queryRunner.query(
      `SELECT setval('order_number_seq', (SELECT COALESCE(MAX("order_number"), 99999) FROM "order"))`,
    );

    // 5) DEFAULT nextval + NOT NULL
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "order_number" SET DEFAULT nextval('order_number_seq')`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "order_number" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER SEQUENCE "order_number_seq" OWNED BY "order"."order_number"`,
    );

    // 6) Unikal index
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ORDER_NUMBER" ON "order" ("order_number")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_NUMBER"`);
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "order_number" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "order_number"`,
    );
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "order_number_seq"`);
  }
}
