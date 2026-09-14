import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elchi Pochta integratsiyasi uchun jadvallar (pilot P2):
 *   1. `elchi_config`        — bitta qatorli sozlamalar (API kalit, sekret, bog'lanishlar)
 *   2. `elchi_shipment`      — buyurtma ↔ Elchi posilkasi bog'lanishi
 *   3. `elchi_webhook_log`   — webhook qabul jurnali (takror himoyasi + audit)
 *   4. `elchi_district_map`  — tuman moslamasi VA pilot darvozasi
 *
 * `users.external_provider` ustuni QAYTA ISHLATILADI — u LDG migratsiyasida
 * (`1746500000000`) allaqachon qo'shilgan. Bu yerda hech narsa o'zgartirilmaydi:
 * Elchi shu ustunga `'elchi'` qiymati bilan yoziladi.
 *
 * Hech qaysi mavjud ustun o'zgartirilmaydi — DROP ham, TYPE CHANGE ham yo'q.
 * Migratsiya idempotent: qayta ishga tushirilsa `IF NOT EXISTS` tufayli xato
 * chiqarmaydi.
 *
 * Batafsil: docs/integrations/07-pilot.md
 */
export class ElchiIntegration1749600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===== 1. elchi_config (singleton) =====
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "elchi_config" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "is_active" boolean NOT NULL DEFAULT false,
        "webhook_enabled" boolean NOT NULL DEFAULT true,
        "reconcile_enabled" boolean NOT NULL DEFAULT true,
        "api_base_url" varchar,
        "api_key" varchar,
        "webhook_secret" varchar,
        "webhook_secret_previous" varchar,
        "elchi_market_id" varchar,
        "elchi_courier_user_id" uuid,
        "last_ping_at" bigint,
        "last_reconcile_at" bigint
      )
    `);

    // ===== 2. elchi_shipment =====
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "elchi_shipment" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "order_id" uuid NOT NULL,
        "post_id" uuid,
        "elchi_shipment_id" varchar,
        "qr_code_token" varchar,
        "elchi_status" varchar,
        "elchi_status_changed_at" bigint,
        "cod_amount_sent" numeric(14,2) NOT NULL DEFAULT 0,
        "cod_collected_reported" numeric(14,2),
        "send_attempts" int NOT NULL DEFAULT 0,
        "last_error" text,
        "last_request_id" varchar,
        "mismatch_at" bigint,
        "mismatch_reason" text,
        "last_synced_at" bigint,
        CONSTRAINT "UQ_ELCHI_SHIPMENT_ORDER" UNIQUE ("order_id"),
        CONSTRAINT "FK_ELCHI_SHIPMENT_ORDER" FOREIGN KEY ("order_id")
          REFERENCES "order" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ELCHI_SHIPMENT_REMOTE_ID" ON "elchi_shipment" ("elchi_shipment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ELCHI_SHIPMENT_STATUS" ON "elchi_shipment" ("elchi_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ELCHI_SHIPMENT_LAST_SYNCED" ON "elchi_shipment" ("last_synced_at")`,
    );

    // ===== 3. elchi_webhook_log =====
    // PK = `event_id`: Elchi hodisa id'sini TANADA yuboradi (headerda emas).
    // Takror webhook unique violation beradi va biz 200 qaytaramiz.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "elchi_webhook_log" (
        "event_id" varchar PRIMARY KEY,
        "synthesized_key" boolean NOT NULL DEFAULT false,
        "event_type" varchar,
        "elchi_shipment_id" varchar,
        "external_order_id" varchar,
        "elchi_status" varchar,
        "signature_valid" boolean NOT NULL,
        "status" varchar NOT NULL,
        "error_message" text,
        "raw_payload" jsonb NOT NULL,
        "received_at" bigint NOT NULL,
        "processed_at" bigint
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ELCHI_WEBHOOK_LOG_RECEIVED_AT" ON "elchi_webhook_log" ("received_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ELCHI_WEBHOOK_LOG_STATUS" ON "elchi_webhook_log" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ELCHI_WEBHOOK_LOG_SHIPMENT" ON "elchi_webhook_log" ("elchi_shipment_id")`,
    );

    // ===== order.control_owner (BOSHQARUV EGASI) =====
    // `null` = biz boshqaramiz (eski yozuvlar shunday qoladi, backfill kerak
    // emas). Provayder slug'i (masalan 'elchi') = tashqi tizim boshqaradi va
    // BeePost UI'dan sotish/bekor bloklanadi. Sabab: ikki tizim mustaqil
    // "sotildi" yozsa pul IKKI DAFTARDA paydo bo'ladi.
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "control_owner" varchar`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_CONTROL_OWNER" ON "order" ("control_owner")`,
    );

    // ===== 4. elchi_district_map (moslama + DARVOZA) =====
    // `is_enabled` standart `false`: moslama yaratilishi jo'natishga ruxsat
    // BERMAYDI — ruxsat operator tomonidan ataylab berilishi kerak. Jadval
    // bo'sh bo'lsa hamma tuman bloklangan (xavfsiz standart holat).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "elchi_district_map" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "district_id" uuid NOT NULL,
        "elchi_district_id" varchar,
        "elchi_region_id" varchar,
        "sato_code" varchar,
        "matched_automatically" boolean NOT NULL DEFAULT false,
        "is_enabled" boolean NOT NULL DEFAULT false,
        CONSTRAINT "UQ_ELCHI_DISTRICT_MAP_DISTRICT" UNIQUE ("district_id"),
        CONSTRAINT "FK_ELCHI_DISTRICT_MAP_DISTRICT" FOREIGN KEY ("district_id")
          REFERENCES "district" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ELCHI_DISTRICT_MAP_ENABLED" ON "elchi_district_map" ("is_enabled")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ELCHI_DISTRICT_MAP_SATO" ON "elchi_district_map" ("sato_code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ORDER_CONTROL_OWNER"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "control_owner"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "elchi_district_map"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "elchi_webhook_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "elchi_shipment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "elchi_config"`);
    // `users.external_provider` ATAYLAB tegilmaydi — u LDG migratsiyasiga
    // tegishli va LDG prod'da ishlayapti.
  }
}
