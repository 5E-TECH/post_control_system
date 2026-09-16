import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MARKETPLACE INTEGRATSIYASI — 1-bosqich poydevori.
 *
 * Yaratiladigan jadvallar (reja §4.1):
 *   1. marketplace_integration   — ulanish sozlamasi (bitta marketplace = bitta qator)
 *   2. marketplace_tariff        — VERSIYALANGAN kelishilgan tarif (B7-B9)
 *   3. marketplace_seller        — sotuvchilar reestri ko'zgusi
 *   4. marketplace_parcel        — posilka ko'zgusi + skan staging (eng muhimi)
 *   5. marketplace_scan_session  — operator skan sessiyasi (server tomonda)
 *   6. marketplace_outbox        — tranzaksion outbox (B3)
 *   7. marketplace_ledger_entry  — har-sotuvchi yordamchi daftar (P1)
 *   8. marketplace_settlement    — marketplace'ga to'lov + taqsimot
 *
 * `order` jadvaliga 3 ustun + indekslar (reja §4.4, bloker B4).
 *
 * ⚠️ MAVJUD USTUNLAR O'ZGARTIRILMAYDI. DROP yo'q, TYPE CHANGE yo'q.
 * Kassa balanslariga TEGILMAYDI — CI `db:check-cashbox --compare` darvozasi
 * muammosiz o'tadi.
 *
 * Migratsiya IDEMPOTENT: `IF NOT EXISTS` tufayli qayta ishga tushirilsa
 * xato bermaydi.
 *
 * ⚠️ `gen_random_uuid()` ishlatiladi (`uuid_generate_v4()` EMAS) — u
 * Postgres 13+ da o'rnatilgan va `CREATE EXTENSION` talab qilmaydi. Repoda
 * ikkala naqsh ham bor; yangi migratsiyalar shu birinchisiga o'tgan.
 *
 * Batafsil: docs/integrations/14-marketplace-beepost.md
 */
export class MarketplaceIntegration1749800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════ 1. marketplace_integration ═══════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_integration" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "name" varchar(100) NOT NULL,
        "slug" varchar(50) NOT NULL,
        "api_base_url" varchar,
        "api_key" varchar,
        "signing_secret" varchar,
        "signing_secret_previous" varchar,
        "inbound_api_key" varchar,
        "ip_allowlist" jsonb,
        "market_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "request_timeout_ms" int NOT NULL DEFAULT 15000,
        "is_sandbox" boolean NOT NULL DEFAULT false,
        "settlement_period_days" int NOT NULL DEFAULT 7,
        "last_ping_at" bigint,
        "last_reconcile_at" bigint,
        "last_settlement_at" bigint,
        "next_ledger_seq" bigint NOT NULL DEFAULT 0,
        CONSTRAINT "FK_MP_INTEGRATION_MARKET" FOREIGN KEY ("market_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_MP_INTEGRATION_SLUG" ON "marketplace_integration" ("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_INTEGRATION_ACTIVE" ON "marketplace_integration" ("is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_INTEGRATION_MARKET" ON "marketplace_integration" ("market_id")`,
    );

    // ═══════════════ 2. marketplace_tariff ═══════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_tariff" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "integration_id" uuid NOT NULL,
        "version" int NOT NULL DEFAULT 1,
        "tariff_center" bigint NOT NULL DEFAULT 0,
        "tariff_home" bigint NOT NULL DEFAULT 0,
        "effective_from" bigint NOT NULL,
        "effective_to" bigint,
        "created_by" uuid,
        "note" text,
        CONSTRAINT "FK_MP_TARIFF_INTEGRATION" FOREIGN KEY ("integration_id")
          REFERENCES "marketplace_integration"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_TARIFF_INTEGRATION" ON "marketplace_tariff" ("integration_id")`,
    );
    // Bir vaqtda faqat BITTA amaldagi tarif versiyasi bo'lishi mumkin.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_MP_TARIFF_CURRENT"
        ON "marketplace_tariff" ("integration_id")
        WHERE "effective_to" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_MP_TARIFF_VERSION"
        ON "marketplace_tariff" ("integration_id", "version")
    `);

    // ═══════════════ 3. marketplace_seller ═══════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_seller" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "integration_id" uuid NOT NULL,
        "external_seller_id" varchar(120) NOT NULL,
        "name" varchar(200),
        "phone" varchar(32),
        "is_active" boolean NOT NULL DEFAULT true,
        "is_unknown" boolean NOT NULL DEFAULT false,
        "synced_at" bigint,
        CONSTRAINT "FK_MP_SELLER_INTEGRATION" FOREIGN KEY ("integration_id")
          REFERENCES "marketplace_integration"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_MP_SELLER_EXTERNAL" UNIQUE ("integration_id", "external_seller_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_SELLER_INTEGRATION" ON "marketplace_seller" ("integration_id")`,
    );

    // ═══════════════ 4. marketplace_scan_session ═══════════════
    // (parcel dan OLDIN — parcel unga FK bilan bog'lanadi)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_scan_session" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "integration_id" uuid NOT NULL,
        "operator_id" uuid NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'open',
        "scanned_count" int NOT NULL DEFAULT 0,
        "accepted_count" int NOT NULL DEFAULT 0,
        "rejected_count" int NOT NULL DEFAULT 0,
        "accept_idempotency_key" uuid,
        "accepted_at" bigint,
        "closed_at" bigint,
        CONSTRAINT "FK_MP_SESSION_INTEGRATION" FOREIGN KEY ("integration_id")
          REFERENCES "marketplace_integration"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_MP_SESSION_OPERATOR" FOREIGN KEY ("operator_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_SESSION_OPERATOR" ON "marketplace_scan_session" ("operator_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_SESSION_INTEGRATION" ON "marketplace_scan_session" ("integration_id", "status")`,
    );
    // Qabul idempotentligi — ikki marta bosilsa ikkinchi partiya yaratilmaydi.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_MP_SESSION_IDEMPOTENCY"
        ON "marketplace_scan_session" ("accept_idempotency_key")
        WHERE "accept_idempotency_key" IS NOT NULL
    `);

    // ═══════════════ 5. marketplace_parcel ═══════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_parcel" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "integration_id" uuid NOT NULL,
        "external_parcel_id" varchar(120) NOT NULL,
        "external_order_id" varchar(120) NOT NULL,
        "parcel_index" int NOT NULL DEFAULT 1,
        "parcel_count" int NOT NULL DEFAULT 1,
        "qr_token_raw" varchar(128) NOT NULL,
        "qr_token_norm" varchar(128) NOT NULL,
        "seller_id" varchar(120),
        "raw_payload" jsonb,
        "declared_product_amount" bigint NOT NULL DEFAULT 0,
        "declared_delivery_amount" bigint NOT NULL DEFAULT 0,
        "cod_amount" bigint NOT NULL DEFAULT 0,
        "prepaid" boolean NOT NULL DEFAULT false,
        "scan_state" varchar(16) NOT NULL DEFAULT 'scanned',
        "scan_session_id" uuid,
        "scanned_by" uuid,
        "scanned_at" bigint,
        "reject_reason" varchar(24),
        "reject_note" text,
        "order_id" uuid,
        "accepted_at" bigint,
        "accept_batch_id" uuid,
        "remote_status" varchar(32),
        "remote_status_at" bigint,
        "last_sent_seq" bigint NOT NULL DEFAULT 0,
        "next_seq" bigint NOT NULL DEFAULT 0,
        "last_synced_at" bigint,
        "mismatch_at" bigint,
        "mismatch_reason" text,
        CONSTRAINT "FK_MP_PARCEL_INTEGRATION" FOREIGN KEY ("integration_id")
          REFERENCES "marketplace_integration"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_MP_PARCEL_SESSION" FOREIGN KEY ("scan_session_id")
          REFERENCES "marketplace_scan_session"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_MP_PARCEL_ORDER" FOREIGN KEY ("order_id")
          REFERENCES "order"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_MP_PARCEL_EXTERNAL" UNIQUE ("integration_id", "external_parcel_id"),
        CONSTRAINT "UQ_MP_PARCEL_TOKEN" UNIQUE ("integration_id", "qr_token_norm")
      )
    `);
    // Bitta buyurtma — bitta posilka yozuvi (qabul qilingandan keyin).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_MP_PARCEL_ORDER"
        ON "marketplace_parcel" ("order_id") WHERE "order_id" IS NOT NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_PARCEL_SESSION" ON "marketplace_parcel" ("scan_session_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_PARCEL_STATE" ON "marketplace_parcel" ("integration_id", "scan_state")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_PARCEL_ORDER_GROUP" ON "marketplace_parcel" ("integration_id", "external_order_id")`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MP_PARCEL_MISMATCH"
        ON "marketplace_parcel" ("mismatch_at") WHERE "mismatch_at" IS NOT NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_PARCEL_SYNCED" ON "marketplace_parcel" ("last_synced_at")`,
    );

    // ═══════════════ 6. marketplace_outbox ═══════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_outbox" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "integration_id" uuid NOT NULL,
        "event_id" uuid NOT NULL,
        "event_type" varchar(40) NOT NULL,
        "aggregate_type" varchar(16) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "seq" bigint NOT NULL,
        "seller_id" varchar(120),
        "payload" jsonb NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "status_reason" text,
        "attempts" int NOT NULL DEFAULT 0,
        "max_attempts" int NOT NULL DEFAULT 8,
        "next_retry_at" bigint,
        "processing_started_at" bigint,
        "sent_at" bigint,
        "last_http_status" int,
        "last_error" text,
        "last_response" jsonb,
        CONSTRAINT "FK_MP_OUTBOX_INTEGRATION" FOREIGN KEY ("integration_id")
          REFERENCES "marketplace_integration"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_MP_OUTBOX_EVENT" UNIQUE ("event_id"),
        CONSTRAINT "UQ_MP_OUTBOX_SEQ" UNIQUE ("aggregate_type", "aggregate_id", "seq")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_OUTBOX_CLAIM" ON "marketplace_outbox" ("status", "next_retry_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_OUTBOX_INTEGRATION" ON "marketplace_outbox" ("integration_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_OUTBOX_AGGREGATE" ON "marketplace_outbox" ("aggregate_type", "aggregate_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_OUTBOX_STALE" ON "marketplace_outbox" ("status", "processing_started_at")`,
    );

    // ═══════════════ 7. marketplace_ledger_entry ═══════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_ledger_entry" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "integration_id" uuid NOT NULL,
        "seller_id" varchar(120),
        "order_id" uuid,
        "external_parcel_id" varchar(120),
        "cashbox_history_id" uuid,
        "entry_type" varchar(20) NOT NULL,
        "amount" bigint NOT NULL,
        "balance_after" bigint NOT NULL,
        "seller_balance_after" bigint NOT NULL,
        "seq" bigint NOT NULL,
        "reverses_entry_id" uuid,
        "tariff_version" int,
        "note" text,
        CONSTRAINT "FK_MP_LEDGER_INTEGRATION" FOREIGN KEY ("integration_id")
          REFERENCES "marketplace_integration"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_MP_LEDGER_CASHBOX" FOREIGN KEY ("cashbox_history_id")
          REFERENCES "cashbox_history"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_MP_LEDGER_REVERSES" FOREIGN KEY ("reverses_entry_id")
          REFERENCES "marketplace_ledger_entry"("id") ON DELETE SET NULL
      )
    `);
    // IDEMPOTENTLIK LANGARI — bitta kassa yozuvi bitta daftar qatoriga.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_MP_LEDGER_CASHBOX_HISTORY"
        ON "marketplace_ledger_entry" ("cashbox_history_id")
        WHERE "cashbox_history_id" IS NOT NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_LEDGER_INTEGRATION" ON "marketplace_ledger_entry" ("integration_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_LEDGER_SELLER" ON "marketplace_ledger_entry" ("integration_id", "seller_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_LEDGER_ORDER" ON "marketplace_ledger_entry" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_MP_LEDGER_SEQ" ON "marketplace_ledger_entry" ("integration_id", "seq")`,
    );

    // ═══════════════ 8. marketplace_settlement ═══════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketplace_settlement" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "integration_id" uuid NOT NULL,
        "amount" bigint NOT NULL,
        "method" varchar(20) NOT NULL,
        "allocation" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "reference" varchar(120),
        "external_settlement_id" varchar(120),
        "cashbox_history_id" uuid,
        "created_by" uuid NOT NULL,
        "paid_at" bigint,
        "note" text,
        CONSTRAINT "FK_MP_SETTLEMENT_INTEGRATION" FOREIGN KEY ("integration_id")
          REFERENCES "marketplace_integration"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_MP_SETTLEMENT_CASHBOX" FOREIGN KEY ("cashbox_history_id")
          REFERENCES "cashbox_history"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_MP_SETTLEMENT_INTEGRATION" ON "marketplace_settlement" ("integration_id", "created_at")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_MP_SETTLEMENT_EXTERNAL"
        ON "marketplace_settlement" ("integration_id", "external_settlement_id")
        WHERE "external_settlement_id" IS NOT NULL
    `);

    // ═══════════════ 9. `order` jadvaliga ustunlar ═══════════════
    //
    // ⚠️ Hammasi NULLABLE va DEFAULT bilan — mavjud 100% qatorlar xulqi
    // O'ZGARMAYDI. Eski buyurtmalarda `integration_id IS NULL` bo'ladi va
    // barcha yangi indekslar ularni chetlab o'tadi.
    await queryRunner.query(`
      ALTER TABLE "order"
        ADD COLUMN IF NOT EXISTS "integration_id" uuid,
        ADD COLUMN IF NOT EXISTS "external_seller_id" varchar(120),
        ADD COLUMN IF NOT EXISTS "extra_cost_net" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "order"
        ADD CONSTRAINT "FK_ORDER_MP_INTEGRATION" FOREIGN KEY ("integration_id")
          REFERENCES "marketplace_integration"("id") ON DELETE SET NULL
    `).catch(() => {
      // Qayta ishga tushirilganda cheklov allaqachon bor — bu xato emas.
      // (Postgres `ADD CONSTRAINT IF NOT EXISTS` ni qo'llab-quvvatlamaydi.)
    });

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_MP_INTEGRATION" ON "order" ("integration_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_MP_SELLER" ON "order" ("integration_id", "external_seller_id")`,
    );

    // BLOKER B4 — `order.external_id` da noyoblik yo'q edi (indekssiz
    // nullable varchar). Ikki integratsiya bir ID da to'qnashishi mumkin edi.
    //
    // ⚠️ Faqat `integration_id IS NOT NULL` qatorlarga qo'llanadi — ya'ni
    // mavjud Adosh/tashqi-sayt buyurtmalariga UMUMAN ta'sir qilmaydi va
    // migratsiya mavjud dublikatlar sabab yiqilmaydi.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ORDER_MP_EXTERNAL"
        ON "order" ("integration_id", "external_id")
        WHERE "integration_id" IS NOT NULL
          AND "external_id" IS NOT NULL
          AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // `order` ustunlari — teskari tartibda
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ORDER_MP_EXTERNAL"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_MP_SELLER"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_MP_INTEGRATION"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "FK_ORDER_MP_INTEGRATION"`,
    );
    await queryRunner.query(`
      ALTER TABLE "order"
        DROP COLUMN IF EXISTS "extra_cost_net",
        DROP COLUMN IF EXISTS "external_seller_id",
        DROP COLUMN IF EXISTS "integration_id"
    `);

    // Jadvallar — FK bog'liqligi teskari tartibida
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_settlement"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_ledger_entry"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_outbox"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_parcel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_scan_session"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_seller"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_tariff"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_integration"`);
  }
}
