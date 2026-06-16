import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asosiy (MAIN) kassada VIRTUAL KARTALAR tizimi.
 *
 *   1. `cashbox_card` jadvali — MAIN kassa ichidagi virtual kartalar.
 *      INVARIANT: SUM(cashbox_card.balance) === cash_box.balance_card.
 *   2. `cashbox_card_movement` jadvali — kartalararo va naqd↔karta ichki
 *      ko'chirma/konvertatsiya jurnali (kirim/chiqim emas, balance'ni
 *      o'zgartirmaydi).
 *   3. `cashbox_history.card_id` — kartali yozuv qaysi kartaga tegishli ekani.
 *   4. Har bir MAIN kassa uchun himoyalangan "Asosiy karta" (is_default=true)
 *      yaratiladi va joriy `balance_card` shu kartaga seed qilinadi — shunda
 *      invariant 1-kundan to'g'ri bo'ladi.
 *
 * Partial unique index har bir kassada aynan bitta default karta bo'lishini
 * kafolatlaydi.
 */
export class CashboxVirtualCards1747700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) cashbox_card jadvali
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashbox_card" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "name" varchar NOT NULL,
        "balance" bigint NOT NULL DEFAULT 0,
        "cashbox_id" uuid NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_cashbox_card" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cashbox_card_cashbox" FOREIGN KEY ("cashbox_id")
          REFERENCES "cash_box"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CASHBOX_CARD_CASHBOX_ID" ON "cashbox_card" ("cashbox_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CASHBOX_CARD_ACTIVE" ON "cashbox_card" ("is_active")`,
    );
    // Har bir kassada aynan bitta default karta
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CASHBOX_CARD_DEFAULT" ON "cashbox_card" ("cashbox_id") WHERE "is_default" = true`,
    );

    // 2) cashbox_card_movement jadvali
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "cashbox_card_movement_type_enum" AS ENUM ('card_to_card', 'card_to_cash', 'cash_to_card');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cashbox_card_movement" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "type" "cashbox_card_movement_type_enum" NOT NULL,
        "cashbox_id" uuid NOT NULL,
        "from_card_id" uuid,
        "to_card_id" uuid,
        "amount" bigint NOT NULL,
        "balance_after_from" bigint,
        "balance_after_to" bigint,
        "comment" varchar,
        "created_by" uuid NOT NULL,
        CONSTRAINT "PK_cashbox_card_movement" PRIMARY KEY ("id"),
        CONSTRAINT "FK_card_movement_cashbox" FOREIGN KEY ("cashbox_id")
          REFERENCES "cash_box"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_card_movement_from" FOREIGN KEY ("from_card_id")
          REFERENCES "cashbox_card"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_card_movement_to" FOREIGN KEY ("to_card_id")
          REFERENCES "cashbox_card"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_card_movement_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CARD_MOVEMENT_CASHBOX_ID" ON "cashbox_card_movement" ("cashbox_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CARD_MOVEMENT_CREATED_AT" ON "cashbox_card_movement" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CARD_MOVEMENT_TYPE" ON "cashbox_card_movement" ("type")`,
    );

    // 3) cashbox_history.card_id
    await queryRunner.query(
      `ALTER TABLE "cashbox_history" ADD COLUMN IF NOT EXISTS "card_id" uuid`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cashbox_history" ADD CONSTRAINT "FK_cashbox_history_card"
          FOREIGN KEY ("card_id") REFERENCES "cashbox_card"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // 4) Har bir MAIN kassa uchun default "Asosiy karta" yaratish va
    //    joriy balance_card ni unga seed qilish (invariant t0 da to'g'ri).
    await queryRunner.query(`
      INSERT INTO "cashbox_card" ("id", "created_at", "updated_at", "name", "balance", "cashbox_id", "is_default", "is_active", "sort_order")
      SELECT
        uuid_generate_v4(),
        (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
        (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
        'Asosiy karta',
        COALESCE(cb."balance_card", 0),
        cb."id",
        true,
        true,
        0
      FROM "cash_box" cb
      WHERE cb."cashbox_type" = 'main'
        AND NOT EXISTS (
          SELECT 1 FROM "cashbox_card" c
          WHERE c."cashbox_id" = cb."id" AND c."is_default" = true
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "cashbox_history" DROP CONSTRAINT "FK_cashbox_history_card";
      EXCEPTION WHEN undefined_object THEN null; END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "cashbox_history" DROP COLUMN IF EXISTS "card_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cashbox_card_movement"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "cashbox_card_movement_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cashbox_card"`);
  }
}
