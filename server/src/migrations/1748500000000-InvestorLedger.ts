import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Investor (ulushdor) equity ledger — Faza 3.
 *
 *  - users_role_enum'ga 'investor' qiymati (INVESTOR roli DB darajasida).
 *  - investor_capital_contribution  — kiritilgan kapital (append-only)
 *  - investor_ownership_stake       — versiyalangan ulush (basis points)
 *  - investor_distribution          — to'langan taqsimotlar (append-only)
 *  - IDX_FBH_SOURCE_CREATED         — davr bo'yicha sof foyda so'rovini tezlashtiradi
 *
 * DIQQAT: `ALTER TYPE ... ADD VALUE` yangi qiymatni AYNAN SHU tranzaksiyada
 * ishlatib bo'lmaydi — bu migration hech qanday investor userni INSERT qilmaydi,
 * shuning uchun xavfsiz. Pul bigint (UZS), float yo'q.
 */
export class InvestorLedger1748500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Rol enumiga 'investor' (idempotent).
    await queryRunner.query(
      `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'investor'`,
    );

    // 2) Kapital hissalari.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investor_capital_contribution" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "investor_id" uuid NOT NULL,
        "amount" bigint NOT NULL,
        "contributed_at" bigint NOT NULL,
        "note" varchar,
        "created_by" uuid,
        CONSTRAINT "PK_investor_capital_contribution" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ICC_AMOUNT_POS" CHECK ("amount" > 0),
        CONSTRAINT "FK_ICC_INVESTOR" FOREIGN KEY ("investor_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ICC_CREATED_BY" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ICC_INVESTOR" ON "investor_capital_contribution" ("investor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ICC_CONTRIBUTED_AT" ON "investor_capital_contribution" ("contributed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ICC_INVESTOR_DATE" ON "investor_capital_contribution" ("investor_id", "contributed_at")`,
    );

    // 3) Versiyalangan egalik ulushi.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investor_ownership_stake" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "investor_id" uuid NOT NULL,
        "ownership_bps" integer NOT NULL,
        "effective_from" bigint NOT NULL,
        "effective_to" bigint,
        "note" varchar,
        "created_by" uuid,
        CONSTRAINT "PK_investor_ownership_stake" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_IOS_BPS_RANGE" CHECK ("ownership_bps" >= 0 AND "ownership_bps" <= 10000),
        CONSTRAINT "FK_IOS_INVESTOR" FOREIGN KEY ("investor_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_IOS_CREATED_BY" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_IOS_INVESTOR" ON "investor_ownership_stake" ("investor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_IOS_INVESTOR_FROM" ON "investor_ownership_stake" ("investor_id", "effective_from")`,
    );
    // Har investorda faqat BITTA ochiq (effective_to IS NULL) ulush qatori.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_IOS_OPEN_STAKE" ON "investor_ownership_stake" ("investor_id") WHERE "effective_to" IS NULL`,
    );

    // 4) Taqsimotlar (to'lovlar).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investor_distribution" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "investor_id" uuid NOT NULL,
        "amount" bigint NOT NULL,
        "distributed_at" bigint NOT NULL,
        "period_start" bigint,
        "period_end" bigint,
        "note" varchar,
        "created_by" uuid,
        CONSTRAINT "PK_investor_distribution" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_IDIST_AMOUNT_POS" CHECK ("amount" > 0),
        CONSTRAINT "FK_IDIST_INVESTOR" FOREIGN KEY ("investor_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_IDIST_CREATED_BY" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_IDIST_INVESTOR" ON "investor_distribution" ("investor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_IDIST_DISTRIBUTED_AT" ON "investor_distribution" ("distributed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_IDIST_INVESTOR_DATE" ON "investor_distribution" ("investor_id", "distributed_at")`,
    );

    // 5) financial_balance_history — davr bo'yicha sof foyda uchun kompozit index.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_FBH_SOURCE_CREATED" ON "financial_balance_history" ("source_type", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_FBH_SOURCE_CREATED"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "investor_distribution"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "investor_ownership_stake"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "investor_capital_contribution"`,
    );
    // Eslatma: Postgres enum qiymatini ('investor') o'chirib bo'lmaydi — qoladi (zararsiz).
  }
}
