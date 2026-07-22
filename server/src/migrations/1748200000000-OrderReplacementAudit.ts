import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Almashtirish (kafolat-swap) qaytarishi uchun AUDIT maydonlari.
 *
 * Eski (almashtirilayotgan) buyurtma statusi SOTILGAN qoladi (puli muzlatiladi),
 * shuning uchun "marketga qaytarildi" dalili status emas, maxsus maydonlar bilan
 * isbotlanadi:
 *   old_product_collected_at — kuryer eski mahsulotni mijozdan OLGAN vaqt.
 *   old_product_returned_at  — eski mahsulot MARKETGA QAYTARILGAN (qabul) vaqt.
 *   old_returned_by          — qabul qilgan admin/registrator ID si.
 *
 * Additiv va nullable — mavjud qatorlar o'zgarmaydi.
 */
export class OrderReplacementAudit1748200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "old_product_collected_at" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "old_returned_by" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "old_returned_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "old_product_collected_at"`,
    );
  }
}
