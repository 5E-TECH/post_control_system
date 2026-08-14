import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI xarajat hisobotining oldindan hisoblangan snapshoti (davr bo'yicha).
 * Kunlik cron + startup hisoblab saqlaydi; ko'rish AI'siz. Har davrда bitta qator.
 */
export class AiFinanceReportSnapshot1749100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_finance_report_snapshot" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "period" varchar NOT NULL,
        "payload" jsonb NOT NULL,
        "computed_at" bigint NOT NULL,
        CONSTRAINT "PK_ai_finance_report_snapshot" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_AFRS_PERIOD" ON "ai_finance_report_snapshot" ("period")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "ai_finance_report_snapshot"`,
    );
  }
}
