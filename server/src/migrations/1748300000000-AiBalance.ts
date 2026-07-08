import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Market AI-balansi (prepaid hamyon):
 *  - users.ai_enabled          — admin kaliti (AI market uchun ochiq/yopiq)
 *  - users.ai_balance          — oldindan to'langan balans (so'm)
 *  - users.ai_price_per_order  — market bo'yicha narx (null = global default)
 *  - ai-transaction            — to'ldirish/ishlatish/refund tarixi (audit)
 *
 * Registrator/admin bu limitga tobe emas (bot AI'sini faqat market/operator
 * ishlatadi; ular market balansidan yechadi).
 */
export class AiBalance1748300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "ai_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "ai_balance" bigint NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "ai_price_per_order" bigint
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai-transaction" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "market_id" uuid NOT NULL,
        "type" varchar NOT NULL,
        "amount" bigint NOT NULL,
        "balance_after" bigint NOT NULL,
        "note" varchar,
        "actor" varchar,
        "order_id" uuid,
        CONSTRAINT "PK_ai_transaction" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AI_TX_MARKET" ON "ai-transaction" ("market_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai-transaction"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "ai_price_per_order",
        DROP COLUMN IF EXISTS "ai_balance",
        DROP COLUMN IF EXISTS "ai_enabled"
    `);
  }
}
