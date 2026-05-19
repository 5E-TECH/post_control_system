import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LDG Cargo integratsiyasi uchun jadvallar:
 *   1. `ldg_config`        — bitta qatorli sozlamalar (sender info, API key, defaults)
 *   2. `ldg_shipment`      — Order ↔ LDG package bog'lanishi
 *   3. `ldg_webhook_log`   — webhook qabul jurnali (replay protection + audit)
 *
 * Va mavjud `users` jadvaliga `external_provider` (varchar nullable) ustuni
 * qo'shiladi — kuryer-userni "ichki" yoki "ldg" deb belgilash uchun.
 *
 * Hech qaysi mavjud ustun o'zgartirilmaydi — DROP ham, TYPE CHANGE ham yo'q.
 * Migration idempotent: qayta ishga tushirilsa IF NOT EXISTS tufayli xato chiqarmaydi.
 */
export class LdgCargoIntegration1746500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== users.external_provider =====
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "external_provider" varchar`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_USERS_EXTERNAL_PROVIDER" ON "users" ("external_provider")`,
    );

    // ===== ldg_config =====
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ldg_config" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "is_sandbox" boolean NOT NULL DEFAULT true,
        "api_base_url" varchar NOT NULL DEFAULT 'https://api.fcargo.uz/api/client/v1',
        "api_key" varchar,
        "tenant_domain" varchar,
        "webhook_secret" varchar,
        "webhook_secret_previous" varchar,
        "sender_name" varchar,
        "sender_phone" varchar,
        "sender_region_sato" int,
        "sender_district_sato" int,
        "sender_address" text,
        "sender_branch_id" int,
        "default_weight" double precision NOT NULL DEFAULT 1.0,
        "default_length" int NOT NULL DEFAULT 30,
        "default_width" int NOT NULL DEFAULT 20,
        "default_height" int NOT NULL DEFAULT 15,
        "default_seats" int NOT NULL DEFAULT 1,
        "default_payer_type" varchar NOT NULL DEFAULT 'receiver',
        "enabled_district_sato_codes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "ldg_courier_user_id" uuid,
        CONSTRAINT "FK_LDG_CONFIG_LDG_COURIER"
          FOREIGN KEY ("ldg_courier_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Eski DB'lar uchun ALTER (mavjud bo'lmasa)
    await queryRunner.query(
      `ALTER TABLE "ldg_config" ADD COLUMN IF NOT EXISTS "sender_branch_id" int`,
    );

    // ===== ldg_shipment =====
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ldg_shipment" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "order_id" uuid NOT NULL,
        "ldg_order_id" int,
        "tracking_number" varchar,
        "ldg_status" varchar,
        "ldg_status_changed_at" bigint,
        "ldg_created_at" bigint,
        "last_request_id" varchar,
        "send_attempts" int NOT NULL DEFAULT 0,
        "last_error" text,
        CONSTRAINT "UQ_LDG_SHIPMENT_ORDER" UNIQUE ("order_id"),
        CONSTRAINT "FK_LDG_SHIPMENT_ORDER"
          FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_LDG_SHIPMENT_LDG_ORDER_ID" ON "ldg_shipment" ("ldg_order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_LDG_SHIPMENT_TRACKING" ON "ldg_shipment" ("tracking_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_LDG_SHIPMENT_STATUS" ON "ldg_shipment" ("ldg_status")`,
    );

    // ===== ldg_webhook_log =====
    // delivery_id PRIMARY KEY — replay protection (takror webhook unique violation beradi)
    // delivery_id va event_id varchar — LDG `whd_<uuid>` va `evt_<uuid>` prefiksi bilan yuboradi
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ldg_webhook_log" (
        "delivery_id" varchar PRIMARY KEY,
        "event_id" varchar,
        "event_type" varchar NOT NULL,
        "signature_valid" boolean NOT NULL,
        "status" varchar NOT NULL,
        "error_message" text,
        "raw_payload" jsonb NOT NULL,
        "received_at" bigint NOT NULL,
        "processed_at" bigint
      )
    `);

    // Agar jadval allaqachon uuid bilan yaratilgan bo'lsa (eski migratsiyadan),
    // ustunlar tipini varchar ga o'zgartiramiz. Empty table'da xavfsiz.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ldg_webhook_log'
            AND column_name = 'delivery_id'
            AND data_type = 'uuid'
        ) THEN
          ALTER TABLE "ldg_webhook_log"
            ALTER COLUMN "delivery_id" TYPE varchar USING "delivery_id"::varchar;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ldg_webhook_log'
            AND column_name = 'event_id'
            AND data_type = 'uuid'
        ) THEN
          ALTER TABLE "ldg_webhook_log"
            ALTER COLUMN "event_id" TYPE varchar USING "event_id"::varchar;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_LDG_WEBHOOK_LOG_RECEIVED_AT" ON "ldg_webhook_log" ("received_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_LDG_WEBHOOK_LOG_EVENT_TYPE" ON "ldg_webhook_log" ("event_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ldg_webhook_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ldg_shipment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ldg_config"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_USERS_EXTERNAL_PROVIDER"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "external_provider"`,
    );
  }
}
