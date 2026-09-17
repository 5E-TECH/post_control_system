import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MARKETPLACE STATUS XARITASI.
 *
 * Har hamkorning status lug'ati boshqacha bo'lishi mumkin: so'z
 * (`delivered`), raqam (`7`), kod (`ST-07`) yoki umuman boshqa narsa.
 * Uni koddan taxmin qilib bo'lmaydi — shuning uchun admin panelidan
 * QO'LDA kiritiladi.
 *
 * `{ "<bizning kanonik status>": "<ularning qiymati>" }`
 * Bo'sh bo'lsa — bizning kanonik nomlar o'zgarishsiz ishlatiladi.
 */
export class MarketplaceStatusMap1749900000000 implements MigrationInterface {
  name = 'MarketplaceStatusMap1749900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marketplace_integration"
        ADD COLUMN IF NOT EXISTS "status_map" jsonb
    `);

    /**
     * ⚠️ BITTA OPERATORGA — BITTA OCHIQ SESSIYA, DB darajasida.
     *
     * `openSession` «topib ko'r, bo'lmasa yarat» naqshi bilan ishlaydi.
     * Operator ikki tabda (yoki planshet + kompyuter) bir vaqtda ochsa,
     * IKKI ochiq sessiya paydo bo'lardi va posilkalar ikki qopga bo'linib
     * ketardi — biri qabul qilinib, ikkinchisi qulflangan holda qolardi.
     *
     * Qisman unique indeks: faqat OCHIQ sessiyalarga tegishli, yopilganlar
     * cheklovga tushmaydi.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_MP_SESSION_OPEN_PER_OPERATOR"
        ON "marketplace_scan_session" ("integration_id", "operator_id")
        WHERE "status" = 'open'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marketplace_integration"
        DROP COLUMN IF EXISTS "status_map"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_MP_SESSION_OPEN_PER_OPERATOR"
    `);
  }
}
