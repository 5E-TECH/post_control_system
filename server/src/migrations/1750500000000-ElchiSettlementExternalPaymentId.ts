import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `elchi_settlement_payment.external_payment_id` — avtomatik (webhook)
 * yozuvlar uchun DEDUP kaliti.
 *
 * ── NEGA ──────────────────────────────────────────────────────────────────
 * Elchi bizga pul to'laganda (market to'lovi) endi `settlement.payment`
 * webhookini yuboradi va biz uni AVTOMATIK yozamiz. Webhook outbox'i
 * kafolatsiz (at-least-once) — ayni to'lov ikki marta kelishi mumkin.
 * Elchi tomonidagi to'lov id'sini shu ustunga yozamiz va NULL bo'lmagan
 * qiymatlar ustidan NOYOB indeks qo'yamiz: ikkinchi kelish jimgina
 * rad etiladi, daftar bittagina yozuvda qoladi.
 *
 * Qo'lda kiritilgan yozuvlarda NULL bo'ladi. Postgres'da NOYOB indeks
 * NULL'larni O'ZARO TENG HISOBLAMAYDI — shu bois ko'plab qo'lda yozuvlar
 * (barchasi NULL) bemalol yashaydi, faqat tashqi id'li yozuvlar noyob
 * bo'ladi. Aynan kerakli xatti-harakat.
 */
export class ElchiSettlementExternalPaymentId1750500000000
  implements MigrationInterface
{
  name = 'ElchiSettlementExternalPaymentId1750500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "elchi_settlement_payment"
         ADD COLUMN IF NOT EXISTS "external_payment_id" text`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ELCHI_SETTLEMENT_EXTERNAL_PAYMENT"
         ON "elchi_settlement_payment" ("external_payment_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_ELCHI_SETTLEMENT_EXTERNAL_PAYMENT"`,
    );
    await queryRunner.query(
      `ALTER TABLE "elchi_settlement_payment" DROP COLUMN IF EXISTS "external_payment_id"`,
    );
  }
}
