import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LDG qayta topshirish (re-delivery) uchun: `ldg_shipment.post_id`.
 *
 * Har bir jo'natish urinishi (post) bog'lanadi. Buyurtma qaytarilib qayta
 * jo'natilganda yangi post bilan keladi — post_id farqi bo'yicha biz buni
 * "yangi urinish" deb tushunamiz va LDG'ga qaytadan dispatch qilamiz
 * (eski idempotentlik buni bloklar edi).
 *
 * Additive — nullable, mavjud shipmentlar o'zgarmaydi.
 */
export class LdgShipmentPostId1746700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ldg_shipment" ADD COLUMN IF NOT EXISTS "post_id" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ldg_shipment" DROP COLUMN IF EXISTS "post_id"`,
    );
  }
}
