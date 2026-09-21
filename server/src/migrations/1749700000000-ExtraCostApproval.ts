import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * QO'SHIMCHA XARAJAT: ISBOT + MARKET TASDIG'I — sxema.
 *
 * MUAMMO. Kuryer sotuv/bekor qilishda `extraCost` yozganda pul DARHOL ikki
 * kassadan chiqim qilinadi (market va kuryer). Market bu pulni ko'rmaydi ham,
 * tasdiqlamaydi ham — kuryerlar sababsiz xarajat yozmoqda.
 *
 * YECHIM. Har-market bayrog'i (`extra_cost_proof_required`). Yoqilgan bo'lsa
 * xarajat kassaga UMUMAN yozilmaydi — `extra_cost_request` ga foto isbot
 * bilan `pending` qator tushadi va pul faqat market tasdiqlaganda yoziladi.
 *
 * ⚠️ BU MIGRATION FAQAT SXEMA QO'SHADI — hech qanday xulq o'zgartirmaydi.
 * Ikkala yangi ustun ham DEFAULT bilan keladi (`false` / `0`), ya'ni barcha
 * mavjud marketlar bugungi oqimda qoladi. Jadvallar bo'sh yaratiladi.
 *
 * KASSAGA TEGMAYDI. `cashbox_history` va `cash_box` ga bir qator ham
 * qo'shilmaydi/o'zgartirilmaydi, shuning uchun CI'dagi
 * `db:check-cashbox --compare` darvozasi muammosiz o'tadi.
 *
 * `Source_type.EXTRA_COST` allaqachon mavjud (`common/enums/index.ts:45`) —
 * `cashbox_history_source_type_enum` ga `ALTER TYPE` KERAK EMAS.
 */
export class ExtraCostApproval1749700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== 1) MARKET BAYROQLARI ====================
    // Additiv, DEFAULT'li — mavjud qatorlar o'zgarmaydi.
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "extra_cost_proof_required" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "extra_cost_auto_approve_under" bigint NOT NULL DEFAULT 0
    `);

    // ==================== 2) ENUM TIPLARI ====================
    // TypeORM standart nomi: <jadval>_<ustun>_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "extra_cost_request_action_type_enum" AS ENUM
          ('sell', 'cancel', 'partly_sold', 'price_cut');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "extra_cost_request_status_enum" AS ENUM
          ('awaiting_proof', 'pending', 'approved', 'rejected', 'void', 'reversed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "extra_cost_request_decision_mode_enum" AS ENUM
          ('market', 'admin_override', 'auto_rule', 'auto_backstop', 'external_auto', 'system_void');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "extra_cost_request_category_enum" AS ENUM
          ('taxi', 'lift', 'loading', 'revisit', 'customer_request', 'other');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ==================== 3) SO'ROVLAR JADVALI ====================
    //
    // `order_id` da ON DELETE RESTRICT (CASCADE emas): buyurtma tizimda
    // soft-delete qilinadi, ya'ni CASCADE amalda hech qachon ishlamaydi.
    // RESTRICT kelajakda kimdir hard-delete yozib qo'ysa, pul tarixini
    // jimgina yo'q qilishdan himoya qiladi.
    //
    // `reviewed_by` da SET NULL: qaror qabul qilgan xodim o'chirilsa,
    // qarorning O'ZI qolishi shart — faqat kim qilgani noma'lum bo'ladi.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "extra_cost_request" (
        "id"                      uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at"              bigint NOT NULL,
        "updated_at"              bigint NOT NULL,

        "order_id"                uuid NOT NULL,
        "post_id"                 uuid,
        "courier_id"              uuid NOT NULL,
        "market_id"               uuid NOT NULL,

        "action_type"             "extra_cost_request_action_type_enum" NOT NULL,
        "amount"                  bigint NOT NULL,
        "limit_max"               bigint NOT NULL DEFAULT 0,
        "courier_tariff_snapshot" bigint NOT NULL DEFAULT 0,
        "order_number"            bigint NOT NULL,
        "order_total_price"       bigint NOT NULL DEFAULT 0,
        "where_deliver"           varchar,
        "district_name"           varchar,
        "order_action_at"         bigint NOT NULL,
        "category"                "extra_cost_request_category_enum" NOT NULL,
        "reason"                  text,
        "proof_ids"               jsonb NOT NULL DEFAULT '[]'::jsonb,

        "status"                  "extra_cost_request_status_enum" NOT NULL DEFAULT 'pending',
        "decision_mode"           "extra_cost_request_decision_mode_enum",
        "reviewed_by"             uuid,
        "reviewed_at"             bigint,
        "review_note"             text,

        "settled_at"              bigint,
        "market_history_id"       uuid,
        "courier_history_id"      uuid,

        "escalated_at"            bigint,
        "voided_at"               bigint,
        "seen_by_courier_at"      bigint,
        "resubmit_of"             uuid,
        "dup_proof_count"         integer NOT NULL DEFAULT 0,

        CONSTRAINT "PK_extra_cost_request" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ECR_AMOUNT_POSITIVE" CHECK ("amount" > 0),
        CONSTRAINT "FK_ECR_ORDER" FOREIGN KEY ("order_id")
          REFERENCES "order"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_ECR_COURIER" FOREIGN KEY ("courier_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ECR_MARKET" FOREIGN KEY ("market_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ECR_REVIEWED_BY" FOREIGN KEY ("reviewed_by")
          REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ECR_RESUBMIT_OF" FOREIGN KEY ("resubmit_of")
          REFERENCES "extra_cost_request"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ECR_MARKET_HIST" FOREIGN KEY ("market_history_id")
          REFERENCES "cashbox_history"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ECR_COURIER_HIST" FOREIGN KEY ("courier_history_id")
          REFERENCES "cashbox_history"("id") ON DELETE SET NULL
      )
    `);

    // ==================== 4) ISBOT FAYLLARI JADVALI ====================
    //
    // `request_id` da SET NULL: so'rov o'chirilsa (amalda bo'lmaydi, lekin)
    // fayl yozuvi qolib, orfan-tozalash CRON uni diskdan ham olib tashlaydi.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "extra_cost_proof" (
        "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at"  bigint NOT NULL,
        "updated_at"  bigint NOT NULL,

        "courier_id"  uuid NOT NULL,
        "stored_name" varchar NOT NULL,
        "rel_path"    varchar NOT NULL,
        "mime"        varchar NOT NULL,
        "size_bytes"  integer NOT NULL,
        "sha256"      char(64) NOT NULL,
        "request_id"  uuid,
        "bound_at"    bigint,

        CONSTRAINT "PK_extra_cost_proof" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ECP_COURIER" FOREIGN KEY ("courier_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ECP_REQUEST" FOREIGN KEY ("request_id")
          REFERENCES "extra_cost_request"("id") ON DELETE SET NULL
      )
    `);

    // ==================== 5) INDEKSLAR ====================

    // Bir buyurtmada bir vaqtda faqat BITTA ochiq so'rov.
    // Bu POYGANI DB darajasida to'sadi: ikki brauzer oynasidan bir vaqtda
    // yuborilgan sotuv ikkita `pending` qator yarata olmaydi.
    // ⚠️ Kodda ham oldindan tekshiruv bo'ladi — indeks OXIRGI devor,
    // birinchi to'siq emas (foydalanuvchi 500 emas, o'zbekcha 400 ko'rsin).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ECR_ORDER_OPEN"
        ON "extra_cost_request" ("order_id")
        WHERE "status" IN ('awaiting_proof', 'pending')
    `);

    // Bitta kassa yozuvi ikki so'rovga bog'lanmasin — ikki marta to'lashning
    // ikkinchi devori (birinchisi — atomik status darvozasi).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ECR_MARKET_HIST"
        ON "extra_cost_request" ("market_history_id")
        WHERE "market_history_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ECR_COURIER_HIST"
        ON "extra_cost_request" ("courier_history_id")
        WHERE "courier_history_id" IS NOT NULL
    `);

    // Ro'yxat so'rovlari (market sahifasi / kuryer sahifasi).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ECR_MARKET_STATUS"
        ON "extra_cost_request" ("market_id", "status", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ECR_COURIER_STATUS"
        ON "extra_cost_request" ("courier_id", "status", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ECR_ORDER"
        ON "extra_cost_request" ("order_id")
    `);
    // Admin arbitraj navbati — faqat muddati o'tganlar.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ECR_ESCALATED"
        ON "extra_cost_request" ("escalated_at")
        WHERE "escalated_at" IS NOT NULL
    `);

    // Dublikat isbot aniqlash.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ECP_COURIER_HASH"
        ON "extra_cost_proof" ("courier_id", "sha256")
    `);
    // Orfan tozalash CRON'i — faqat bog'lanmagan fayllar.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ECP_UNBOUND"
        ON "extra_cost_proof" ("created_at")
        WHERE "request_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ECP_UNBOUND"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ECP_COURIER_HASH"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ECR_ESCALATED"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ECR_ORDER"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ECR_COURIER_STATUS"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ECR_MARKET_STATUS"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ECR_COURIER_HIST"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ECR_MARKET_HIST"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ECR_ORDER_OPEN"`);

    // `extra_cost_proof` avval — u `extra_cost_request` ga FK bilan bog'langan.
    await queryRunner.query(`DROP TABLE IF EXISTS "extra_cost_proof"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "extra_cost_request"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "extra_cost_request_category_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "extra_cost_request_decision_mode_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "extra_cost_request_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "extra_cost_request_action_type_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "extra_cost_auto_approve_under"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "extra_cost_proof_required"`,
    );
  }
}
