import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kapital qaytarish jadvali — investor tikkan asosiy puldan qaytarib olishi
 * uchun (biznes egasi kelishuvi bilan). Jami kapital = Σ hissalar − Σ qaytarishlar.
 * FOYDA taqsimoti (investor_distribution)dan ALOHIDA.
 */
export class InvestorCapitalWithdrawal1748600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investor_capital_withdrawal" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "investor_id" uuid NOT NULL,
        "amount" bigint NOT NULL,
        "withdrawn_at" bigint NOT NULL,
        "note" varchar,
        "created_by" uuid,
        CONSTRAINT "PK_investor_capital_withdrawal" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ICW_AMOUNT_POS" CHECK ("amount" > 0),
        CONSTRAINT "FK_ICW_INVESTOR" FOREIGN KEY ("investor_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ICW_CREATED_BY" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ICW_INVESTOR" ON "investor_capital_withdrawal" ("investor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ICW_WITHDRAWN_AT" ON "investor_capital_withdrawal" ("withdrawn_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ICW_INVESTOR_DATE" ON "investor_capital_withdrawal" ("investor_id", "withdrawn_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "investor_capital_withdrawal"`,
    );
  }
}
