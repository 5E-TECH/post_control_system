import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `elchi_settlement_payment` — Elchi'dan olingan to'lovlar daftari (M6).
 *
 * Alohida migratsiya, `1749600000000` ichiga qo'shilmadi: o'sha migratsiya
 * allaqachon ishga tushgan muhitlar bo'lishi mumkin va tushgan migratsiyani
 * tahrirlash uni QAYTA ishga tushirmaydi — jadval jimgina paydo bo'lmasdan
 * qolardi.
 *
 * ⚠️ Bu jadval KASSA EMAS — u faqat solishtirish daftari. Batafsil sabab:
 * `elchi-settlement-payment.entity.ts` izohida.
 */
export class ElchiSettlementPayment1749600001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "elchi_settlement_payment" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "amount" numeric(14,2) NOT NULL,
        "paid_at" bigint NOT NULL,
        "note" text,
        "created_by" uuid
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ELCHI_SETTLEMENT_PAID_AT" ON "elchi_settlement_payment" ("paid_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ELCHI_SETTLEMENT_PAID_AT"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "elchi_settlement_payment"`,
    );
  }
}
