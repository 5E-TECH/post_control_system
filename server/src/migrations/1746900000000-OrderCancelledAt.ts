import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Buyurtmaga `cancelled_at` (bekor qilingan vaqt) ustunini qo'shadi.
 *
 * Sabab: statistika "harakat sanasi" bo'yicha hisoblanishi kerak — bir necha kun
 * oldin yaratilgan buyurtma bugun bekor qilinsa, BUGUNGI bekor qilinganlar
 * statistikasiga tushishi kerak. Oldin bekor qilingan vaqt uchun maydon yo'q edi
 * va `updated_at` (ishonchsiz proksi) ishlatilardi.
 *
 * Additive — nullable. Eski (allaqachon bekor qilingan) buyurtmalar uchun
 * `cancelled_at` NULL bo'lib qoladi (ular harakat sanasi bo'yicha sanalmaydi,
 * lekin bu eski ma'lumot uchun maqbul).
 */
export class OrderCancelledAt1746900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "cancelled_at" bigint`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_CANCELLED_AT" ON "order" ("cancelled_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_STATUS_CANCELLED" ON "order" ("status", "cancelled_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ORDER_STATUS_CANCELLED"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_CANCELLED_AT"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "cancelled_at"`,
    );
  }
}
