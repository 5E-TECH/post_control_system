import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LDG reconcile poller'ning to'liq qamrovini ta'minlaydi.
 *
 * Muammo: reconcile har 5 daqiqada faqat 100 ta faol shipmentni
 * `ldg_status_changed_at` bo'yicha oladi. Status o'zgarmagan (unchanged)
 * shipmentlarda bu vaqt yangilanmagani uchun ular har safar ro'yxat boshida
 * qolib, 100 dan keyingilar HECH QACHON tekshirilmasdi.
 *
 * Yechim: `last_synced_at` — reconcile har bir shipmentni tekshirgan vaqtni
 * yozadi (status o'zgarsa ham, o'zgarmasa ham). Reconcile endi shu ustun
 * bo'yicha eng eski tekshirilganidan tartiblaydi → barcha shipmentlar
 * navbatma-navbat qamrab olinadi.
 */
export class LdgShipmentLastSynced1747500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ldg_shipment"
      ADD COLUMN IF NOT EXISTS "last_synced_at" bigint
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LDG_SHIPMENT_LAST_SYNCED"
      ON "ldg_shipment" ("last_synced_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_LDG_SHIPMENT_LAST_SYNCED"
    `);
    await queryRunner.query(`
      ALTER TABLE "ldg_shipment"
      DROP COLUMN IF EXISTS "last_synced_at"
    `);
  }
}
