import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elchin (moliyaviy AI) yozishmalar tarixi — har foydalanuvchi, savol-javob.
 */
export class AiFinanceChat1749200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_finance_chat" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "user_id" uuid NOT NULL,
        "question" text NOT NULL,
        "answer" text NOT NULL,
        "tools" jsonb,
        "file_name" varchar,
        CONSTRAINT "PK_ai_finance_chat" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AFC_USER_CREATED" ON "ai_finance_chat" ("user_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_finance_chat"`);
  }
}
