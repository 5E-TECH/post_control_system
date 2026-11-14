import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CARRIER API — ROLLBACK'NI AKKAUNT BO'YICHA YOQISH/O'CHIRISH.
 *
 * ── NEGA ────────────────────────────────────────────────────────────────
 *
 * Tashqi yetkazuvchi `POST /carrier/orders/:id/status` ga
 * `status: "rollback"` yuborib, o'zi yuborgan `sold`/`cancelled` natijani
 * bekor qila oladi (buyurtma `waiting` ga qaytadi, kassa yozuvi teskari
 * yoziladi). Ega qarori (2026-11-14): kompaniya bilan endi ishlay
 * boshlayapmiz — ishonch hosil bo'lguncha bu imkoniyat O'CHIQ turadi, xato
 * natijani BeePost operatori tuzatadi. Kerak bo'lsa admin bitta tugma bilan
 * akkaunt uchun yoqadi (`PATCH /api/v1/carrier-accounts/:id`
 * `{ rollback_enabled }`, admin paneldagi «Sozlamalar» bo'limi).
 *
 * ── SUKUT ───────────────────────────────────────────────────────────────
 *
 * `NOT NULL DEFAULT false` — mavjud qatorlar ham `false` bo'ladi (Postgres
 * 11+ da `ADD COLUMN ... DEFAULT <doimiy>` jadvalni qayta yozmaydi, qulf
 * qisqa). Ya'ni deploydan keyin HECH BIR kompaniyada rollback ishlamaydi —
 * bu ataylab.
 *
 * Migratsiya IDEMPOTENT (`IF NOT EXISTS`) va pulga tegmaydi. `down()`
 * ustunni olib tashlaydi: eski kod rollback'ni hammaga ochiq ishlatadi.
 */
export class CarrierRollbackToggle1751100001000 implements MigrationInterface {
  name = 'CarrierRollbackToggle1751100001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "carrier_account"
        ADD COLUMN IF NOT EXISTS "rollback_enabled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "carrier_account" DROP COLUMN IF EXISTS "rollback_enabled"
    `);
  }
}
