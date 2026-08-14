import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elchin suhbatlari (sessiyalar) — alohida chat ochish + tarix ro'yxati uchun.
 * ai_finance_conversation jadvali + ai_finance_chat.conversation_id. Mavjud
 * yozishmalar har foydalanuvchi uchun bitta "Eski suhbat"ga ko'chiriladi.
 */
export class AiFinanceConversation1749300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_finance_conversation" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "user_id" uuid NOT NULL,
        "title" varchar NOT NULL,
        CONSTRAINT "PK_ai_finance_conversation" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AFCONV_USER_UPDATED" ON "ai_finance_conversation" ("user_id", "updated_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "ai_finance_chat" ADD COLUMN IF NOT EXISTS "conversation_id" uuid`,
    );

    // Mavjud (conversation_id yo'q) yozishmalarni har foydalanuvchi uchun bitta
    // suhbatga to'plab qo'yamiz — hech narsa yo'qolmasin.
    await queryRunner.query(`
      INSERT INTO "ai_finance_conversation" ("id", "created_at", "updated_at", "user_id", "title")
      SELECT gen_random_uuid(), MIN("created_at"), MAX("created_at"), "user_id", 'Eski suhbat'
      FROM "ai_finance_chat"
      WHERE "conversation_id" IS NULL
      GROUP BY "user_id"
    `);
    await queryRunner.query(`
      UPDATE "ai_finance_chat" c
      SET "conversation_id" = conv."id"
      FROM "ai_finance_conversation" conv
      WHERE c."conversation_id" IS NULL
        AND c."user_id" = conv."user_id"
        AND conv."title" = 'Eski suhbat'
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_AFC_CONV" ON "ai_finance_chat" ("conversation_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_AFC_CONV"`);
    await queryRunner.query(
      `ALTER TABLE "ai_finance_chat" DROP COLUMN IF EXISTS "conversation_id"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "ai_finance_conversation"`,
    );
  }
}
