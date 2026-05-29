import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LDG ↔ Beepost status mismatch'ni alohida kuzatish uchun ustunlar.
 *
 * Mismatch: LDG terminal status (DELIVERED/CANCELLED/RETURNED) keladi-yu,
 * bizdagi order status u bilan to'qnashadi (masalan, biz SOLD deb belgilaganmiz,
 * LDG esa CANCELLED yuboradi). Bu real biznes muammosi — operator qo'lda
 * tekshirib ko'rishi shart.
 *
 * Additive — nullable, mavjud shipmentlar o'zgarmaydi.
 */
export class LdgShipmentMismatch1746800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ldg_shipment" ADD COLUMN IF NOT EXISTS "mismatch_at" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "ldg_shipment" ADD COLUMN IF NOT EXISTS "mismatch_reason" text`,
    );
    // Filter "Mismatch" UI uchun tezkor indeks
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_LDG_SHIPMENT_MISMATCH_AT" ON "ldg_shipment" ("mismatch_at") WHERE "mismatch_at" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_LDG_SHIPMENT_MISMATCH_AT"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ldg_shipment" DROP COLUMN IF EXISTS "mismatch_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ldg_shipment" DROP COLUMN IF EXISTS "mismatch_at"`,
    );
  }
}
