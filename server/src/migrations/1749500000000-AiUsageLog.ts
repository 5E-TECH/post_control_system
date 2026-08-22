import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AI (Claude) real xarajat jurnali — ai_usage_log. Har Anthropic so'rovi uchun
 * token sarfi + hisoblangan narx (USD va so'm). AI dashboard shu jadvaldan
 * "buyurtmaga o'rtacha necha so'm" va "Elchin har promptga qancha sarflaydi"ni
 * chiqaradi. Yozuv fire-and-forget — AI oqimini hech qachon buzmaydi.
 */
export class AiUsageLog1749500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_usage_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "feature" varchar(40) NOT NULL,
        "request_area" varchar(16) NOT NULL DEFAULT 'other',
        "model" varchar(48) NOT NULL,
        "input_tokens" integer NOT NULL DEFAULT 0,
        "output_tokens" integer NOT NULL DEFAULT 0,
        "cache_creation_tokens" integer NOT NULL DEFAULT 0,
        "cache_read_tokens" integer NOT NULL DEFAULT 0,
        "steps" integer NOT NULL DEFAULT 1,
        "cost_usd" numeric(12,6) NOT NULL DEFAULT 0,
        "cost_uzs" bigint NOT NULL DEFAULT 0,
        "usd_uzs_rate" numeric(12,2) NOT NULL DEFAULT 0,
        "order_id" uuid,
        "user_id" uuid,
        "conversation_id" uuid,
        CONSTRAINT "PK_ai_usage_log" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AIUSAGE_CREATED" ON "ai_usage_log" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AIUSAGE_FEATURE_CREATED" ON "ai_usage_log" ("feature", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AIUSAGE_AREA_CREATED" ON "ai_usage_log" ("request_area", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AIUSAGE_ORDER" ON "ai_usage_log" ("order_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_AIUSAGE_ORDER"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_AIUSAGE_AREA_CREATED"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_AIUSAGE_FEATURE_CREATED"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_AIUSAGE_CREATED"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_usage_log"`);
  }
}
