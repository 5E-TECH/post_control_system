import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CARRIER API — TASHQI YETKAZUVCHI KOMPANIYA UCHUN KALIT VA IDEMPOTENTLIK.
 *
 * ── NEGA ────────────────────────────────────────────────────────────────
 *
 * Tashqi yetkazuvchi (masalan, viloyatdagi kuryerlik kompaniyasi) Elchi'ga
 * `/carrier/*` kontrakti orqali ulangan. Shu kompaniya BeePost bilan ham
 * ishlashi uchun BeePost AYNAN o'sha kontraktni beradi — kompaniya bitta
 * integratsiya yozadi, faqat base URL va kalit boshqa (CARRIER_API.md,
 * docs/integrations/15-carrier-api.md).
 *
 * Model: kompaniya = BITTA kuryer user (`users.external_provider =
 * 'carrier'`). Har so'rov o'sha kuryer nomidan mavjud kuryer amallariga
 * yo'naltiriladi, pul kuryerning `FOR_COURIER` kassasiga tushadi. Shu sabab
 * pul yadrosi, `order` va `cash_box` jadvallari O'ZGARMAYDI — faqat ikki
 * yangi jadval.
 *
 * ── 1. carrier_account ──────────────────────────────────────────────────
 *
 * Kalit OCHIQ SAQLANMAYDI — faqat `sha256` (`api_key_hash`, noyob indeks
 * orqali bitta so'rovda topiladi). Kalit yaratish/almashtirishda BIR MARTA
 * ko'rsatiladi; yo'qotilsa — yangisi beriladi (rotate). `api_key_last4`
 * faqat admin panelda niqoblangan ko'rinish (`bpc_…a1b2`) uchun.
 *
 * Bitta kuryerga bitta TIRIK akkaunt: `UQ_CARRIER_ACCOUNT_COURIER` QISMAN
 * (`WHERE is_deleted = false`). O'chirilgan akkaunt kuryerni bo'shatadi —
 * tarix qatori qoladi, lekin yangi akkaunt ochishga to'sqinlik qilmaydi.
 *
 * `courier_user_id → users(id) ON DELETE RESTRICT`: kuryer qatori o'chsa
 * akkaunt "kimning nomidan ishlaganini" yo'qotmasin (users odatda yumshoq
 * o'chiriladi, bu — ikkinchi devor).
 *
 * ── 2. carrier_idempotency_key ──────────────────────────────────────────
 *
 * `POST /carrier/orders/:id/status` har chaqiruvda `Idempotency-Key` talab
 * qiladi: tarmoq uzilishi / timeout / qayta urinishda sotuv puli IKKINCHI
 * marta yozilmasin. Kalit `(carrier_account_id, key_hash)` bo'yicha NOYOB —
 * `INSERT … ON CONFLICT DO NOTHING` + `SELECT … FOR UPDATE` atomik egallash
 * shu indeksga tayanadi.
 *
 * ⚠️ Qatorlar O'CHIRILMAYDI (TTL yo'q): eskirgan kalitni aniqlash
 * (`CARRIER_IDEMPOTENCY_KEY_STALE`) `completed` qatorlar saqlanishiga
 * tayanadi. Hajm kichik: bitta status o'zgarishi = bitta qator.
 *
 * `carrier_account_id` ga FK ATAYLAB YO'Q: entity'da relation yo'q
 * (`migration:generate` uni o'chirishni taklif qilardi), akkaunt esa faqat
 * yumshoq o'chiriladi — osilib qolgan qator bo'lmaydi.
 *
 * ── SXEMA KONVENSIYASI ──────────────────────────────────────────────────
 *
 * Ustunlar entity'lar bilan AYNAN bir xil (`carrier-account.entity.ts`,
 * `carrier-idempotency-key.entity.ts`): `id` uuid, `created_at` /
 * `updated_at` bigint epoch-ms (BaseEntity hook'lari to'ldiradi).
 * `uuid_generate_v4()` — `@PrimaryGeneratedColumn('uuid')` ning TypeORM
 * sukuti va eng so'nggi migratsiya (`1751000000000-CourierPenaltyModule`)
 * bilan bir xil; `uuid-ossp` kengaytmasi bazada allaqachon bor.
 *
 * Migratsiya IDEMPOTENT (`IF NOT EXISTS`) va XULQNI O'ZGARTIRMAYDI: akkaunt
 * admin tomonidan ochilmaguncha `/carrier/*` har so'rovga 401 qaytaradi.
 */
export class CarrierApi1751100000000 implements MigrationInterface {
  name = 'CarrierApi1751100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════ 1. carrier_account ═══════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "carrier_account" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"      bigint NOT NULL,
        "updated_at"      bigint NOT NULL,
        "name"            varchar(200) NOT NULL,
        -- Bog'langan kuryer: barcha amallar shu kuryer nomidan.
        "courier_user_id" uuid NOT NULL,
        -- sha256(api_key) hex. Ochiq kalit hech qayerda saqlanmaydi.
        "api_key_hash"    varchar(64) NOT NULL,
        "api_key_last4"   varchar(4) NOT NULL,
        -- Kanonik IPv4 / IPv4 CIDR / IPv6; NULL — cheklov yo'q.
        "ip_allowlist"    jsonb,
        "is_active"       boolean NOT NULL DEFAULT true,
        "is_deleted"      boolean NOT NULL DEFAULT false,
        -- Oxirgi muvaffaqiyatli autentifikatsiya (~1 daqiqa aniqlik).
        "last_used_at"    bigint,
        "created_by"      uuid,
        CONSTRAINT "PK_CARRIER_ACCOUNT" PRIMARY KEY ("id"),
        CONSTRAINT "FK_CARRIER_ACCOUNT_COURIER" FOREIGN KEY ("courier_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    // Har so'rovdagi kalit qidiruvi (guard) — xesh bo'yicha bitta qator.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CARRIER_ACCOUNT_KEY_HASH"
        ON "carrier_account" ("api_key_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_CARRIER_ACCOUNT_ACTIVE"
        ON "carrier_account" ("is_active")
    `);
    // Bitta kuryerga bitta TIRIK akkaunt (o'chirilgani kuryerni bo'shatadi).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CARRIER_ACCOUNT_COURIER"
        ON "carrier_account" ("courier_user_id")
      WHERE "is_deleted" = false
    `);

    // ═══════════ 2. carrier_idempotency_key ═══════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "carrier_idempotency_key" (
        "id"                 uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"         bigint NOT NULL,
        "updated_at"         bigint NOT NULL,
        "carrier_account_id" uuid NOT NULL,
        -- sha256(Idempotency-Key) hex — mijoz kaliti ochiq saqlanmaydi.
        "key_hash"           varchar(64) NOT NULL,
        -- <action>:<orderId>:<fingerprint32> — boshqa amal/buyurtma/tana → 422.
        "binding"            varchar(160) NOT NULL,
        "action"             varchar(32) NOT NULL,
        "order_id"           uuid NOT NULL,
        -- 'in_progress' | 'completed' | 'failed'
        "state"              varchar(16) NOT NULL,
        -- in_progress lease tugashi (epoch ms); tugasa kalit qayta olinadi.
        "lease_until"        bigint,
        "http_status"        int,
        CONSTRAINT "PK_CARRIER_IDEMPOTENCY_KEY" PRIMARY KEY ("id")
      )
    `);

    // Atomik egallash (`ON CONFLICT (carrier_account_id, key_hash)`) shu indeksga tayanadi.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CARRIER_IDEM_ACCOUNT_KEY"
        ON "carrier_idempotency_key" ("carrier_account_id", "key_hash")
    `);
    // Diagnostika: buyurtma bo'yicha qaysi kalitlar ishlatilgan.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_CARRIER_IDEM_ORDER"
        ON "carrier_idempotency_key" ("order_id")
    `);
  }

  /**
   * Haqiqatan orqaga qaytaradi. Carrier kuryerlari `external_provider` dan
   * bo'shatiladi: modul yo'q bo'lsa `'carrier'` qiymati faqat shtraf
   * istisnosi va avtomatik qo'shimcha xarajat siyosatini yoqiq qoldirardi.
   * Kuryerlarning buyurtmalari va kassasi tegilmaydi (ular oddiy kuryer
   * yozuvlari); tasodifiy qilingan parollar tiklanmaydi.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
         SET "external_provider" = NULL
       WHERE "external_provider" = 'carrier'
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_CARRIER_IDEM_ORDER"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_CARRIER_IDEM_ACCOUNT_KEY"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "carrier_idempotency_key"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_CARRIER_ACCOUNT_COURIER"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_CARRIER_ACCOUNT_ACTIVE"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_CARRIER_ACCOUNT_KEY_HASH"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "carrier_account"`);
  }
}
