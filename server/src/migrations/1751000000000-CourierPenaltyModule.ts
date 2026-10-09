import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * KURYER SHTRAF / BONUS MODULI — SXEMA.
 *
 * ── MUAMMO ──────────────────────────────────────────────────────────────
 *
 * Kuryerlar sotgan buyurtmalarini vaqtida belgilamayapti. Natijada mol
 * jismonan yetkazilgan bo'lsa ham tizimda «yo'lda» bo'lib turadi: pul
 * ko'rinmaydi, market hisobi kechikadi, posilka taqdiri noma'lum.
 *
 * ── MEXANIZM: TARIFNI KAMAYTIRISH EMAS, ALOHIDA YOZUV ───────────────────
 *
 * Shtrafni `order.courier_tariff` ni pasaytirib qo'llash mumkin edi va
 * foyda (`market_tariff − courier_tariff`) avtomatik oshardi. SHUNDAY
 * QILINMADI, uch sabab:
 *
 *   1. BEKOR yo'lida kuryerga tarif UMUMAN to'lanmaydi (cancelOrder
 *      kuryer kassasiga birorta yozuv yozmaydi) — kamaytiriladigan narsa
 *      yo'q. Ya'ni tarif usuli bilan sotuv va bekor uchun IKKITA
 *      mexanizm qurishga to'g'ri kelardi.
 *   2. Kuryer kassa tarixida «Sotuv +184 000» ni ko'rib, nega 180 000
 *      emasligini BILMASDI. Shtraf tizimi odamlar tomonidan adolatli
 *      deb qabul qilinmasa ishlamaydi.
 *   3. `order.courier_tariff` butun tizimda «kelishilgan stavka»
 *      ma'nosini tashiydi (courierStat foydasi, hisobotlar shundan
 *      o'qiydi). Unga shtrafli son yozsak ustun ma'nosi aralashardi.
 *
 * Shuning uchun tarif TEGILMAYDI, shtraf kuryer kassasiga ALOHIDA qator
 * bo'lib tushadi. Pul balansi o'z-o'zidan to'g'ri chiqadi: tarozi
 * `main + Σkuryer − Σmarket`, kuryer qarzi oshsa kompaniya aktivi oshadi.
 *
 * ── UCH JADVAL ──────────────────────────────────────────────────────────
 *
 *   config  — modul kalitlari (yoqilganmi, qachon yoqilgan)
 *   rule    — qoidalar: kimga, nima bo'lganda, qancha
 *   entry   — daftar: AMALDA qo'llangan har tuzatish
 *
 * ⚠️ `activated_at` — GRANDFATHERING langari. Modul faqat o'zi
 * yoqilgandan KEYIN JO'NATILGAN buyurtmalarga tegadi. Darvoza
 * `post.created_at >= activated_at` bo'lishi SHART; `sold_at` ga
 * qo'yilsa, yoqilgan kuni o'nlab eski buyurtma birdan shtrafga tushardi
 * — kuryer ularni qoida yo'q paytda olgan.
 */
export class CourierPenaltyModule1751000000000 implements MigrationInterface {
  name = 'CourierPenaltyModule1751000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════ 1. Modul kalitlari (singleton) ═══════════
    //
    // Naqsh: `elchi_config` — bitta qator, yo'q bo'lsa yaratiladi.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courier_penalty_config" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"    bigint NOT NULL,
        "updated_at"    bigint NOT NULL,
        -- false = SOYA REJIMI: hisob ishlaydi, daftarga yoziladi,
        -- LEKIN pulga tegmaydi. Raqamlar ko'rilgach true qilinadi.
        "is_active"     boolean NOT NULL DEFAULT false,
        -- Grandfathering langari: shu paytdan KEYIN jo'natilgan
        -- buyurtmalargagina tegadi.
        "activated_at"  bigint,
        -- Soya qachon boshlangani — hisobot «qancha yig'ilardi» uchun.
        "shadow_since"  bigint,
        "updated_by"    uuid
      )
    `);

    // ═══════════ 2. Qoidalar ═══════════
    //
    // ⚠️ `amount` ISHORALI: shtraf MANFIY, bonus MUSBAT. Ikki alohida
    // ustun (`penalty_amount`/`bonus_amount`) qilinmadi — ular doim
    // bir-birini istisno qiladi va har hisobda «qaysi biri to'ldirilgan»
    // ni tekshirish kerak bo'lardi.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courier_penalty_rule" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"     bigint NOT NULL,
        "updated_at"     bigint NOT NULL,
        -- 'global' | 'courier' | 'region'
        "scope_type"     varchar(10) NOT NULL DEFAULT 'global',
        "scope_id"       uuid,
        -- 'late_mark' | 'early_mark' | 'damage'
        "event"          varchar(16) NOT NULL,
        -- late_mark: muddat (shundan keyin shtraf); early_mark: bonus darajasi
        "threshold_days" int NOT NULL DEFAULT 0,
        -- 'per_day' | 'once'
        "calc"           varchar(8) NOT NULL DEFAULT 'per_day',
        "amount"         bigint NOT NULL,
        -- Bitta buyurtma uchun eng ko'pi (null = faqat tarif chegarasi)
        "max_amount"     bigint,
        -- Katta raqam ustun; teng bo'lsa aniqroq qamrov yutadi
        "priority"       int NOT NULL DEFAULT 0,
        "active_from"    bigint NOT NULL,
        "active_to"      bigint,
        "is_active"      boolean NOT NULL DEFAULT true,
        "created_by"     uuid
      )
    `);

    // Qoida tanlash so'rovi: qamrov + hodisa + amal muddati bo'yicha.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_CP_RULE_LOOKUP"
        ON "courier_penalty_rule" ("event", "scope_type", "scope_id")
      WHERE "is_active" = true
    `);

    // ═══════════ 3. Daftar — AMALDA qo'llangan tuzatishlar ═══════════
    //
    // ⚠️ `amount` — NAZARIY emas, AMALDA qo'llangan summa (tarif
    // chegarasidan keyin). Aks holda daftar yig'indisi kassadagi
    // yozuvlar yig'indisiga mos kelmay qolardi va invariant yiqilardi.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courier_penalty_entry" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"         bigint NOT NULL,
        "updated_at"         bigint NOT NULL,
        "order_id"           uuid NOT NULL,
        "courier_id"         uuid NOT NULL,
        "rule_id"            uuid,
        -- 'penalty' | 'bonus' | 'waiver'
        "kind"               varchar(10) NOT NULL,
        -- 'late_mark' | 'early_mark' | 'damage' yoki bekor qilish sababi
        "reason"             varchar(32) NOT NULL,
        -- ISHORALI: kuryer qarzini oshirsa musbat, kamaytirsa manfiy
        "amount"             bigint NOT NULL,
        "late_days"          int,
        -- Hisob paytidagi tarif — chegara shundan olingan (dalil)
        "base_tariff"        bigint,
        -- true = SOYA: pulga tegilmagan, faqat qayd etilgan
        "shadow"             boolean NOT NULL DEFAULT false,
        -- Soya bo'lmasa — mos kassa yozuvi
        "cashbox_history_id" uuid,
        -- Bekor qilish qatori asl yozuvga ishora qiladi
        "waives_entry_id"    uuid,
        "applied_by"         uuid,
        "note"               varchar(256)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_CP_ENTRY_ORDER"
        ON "courier_penalty_entry" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_CP_ENTRY_COURIER_CREATED"
        ON "courier_penalty_entry" ("courier_id", "created_at")
    `);

    /**
     * ⚠️ IDEMPOTENTLIK DARVOZASI. Ayni buyurtmaga ayni turdagi tuzatish
     * IKKI MARTA yozilmasligi kerak — takroriy so'rov yoki qayta urinish
     * kuryerni ikki marta jazolardi. Bekor qilish (`waiver`) istisno:
     * u asl yozuvga ishora qiladi va `waives_entry_id` bilan ajraladi.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CP_ENTRY_ORDER_REASON"
        ON "courier_penalty_entry" ("order_id", "reason")
      WHERE "kind" <> 'waiver'
    `);

    // ═══════════ 4. Qo'lda istisno ═══════════
    //
    // Tashqi provayder kuryerlari (Elchi, LDG) kodda allaqachon
    // istisno (`users.external_provider`), bu esa QO'LDA istisno uchun.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "penalty_exempt" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "penalty_exempt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "courier_penalty_entry"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courier_penalty_rule"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courier_penalty_config"`);
  }
}
