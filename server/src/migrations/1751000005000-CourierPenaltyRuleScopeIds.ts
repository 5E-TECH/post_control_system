import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * QOIDA QAMROVI — BITTA QOIDAGA KO'P KURYER.
 *
 * ── MUAMMO ──────────────────────────────────────────────────────────────
 *
 * `scope_type` = global | courier | region va `scope_id` BITTA uuid edi,
 * ya'ni qoidani yo HAMMAGA, yo BITTA kuryerga qo'yish mumkin edi. O'nta
 * kuryerga bir xil shart kerak bo'lsa admin AYNI qoidani o'n marta
 * yaratardi — va birini o'zgartirish kerak bo'lganda qolgan to'qqiztasi
 * unutilardi (egasi aynan shundan shikoyat qildi).
 *
 * ── YECHIM: MASSIV, BOG'LIQ JADVAL EMAS ─────────────────────────────────
 *
 * `scope_ids uuid[]` ustuni qo'shiladi. Bog'liq jadval emasligining
 * sababi: qoidalar KAM va `loadRules` har hisobda HAMMA faol qoidani
 * xotiraga yuklaydi (`courier-penalty.service.ts`). Bog'liq jadval o'sha
 * yerda ikkinchi so'rov va guruhlashni, ustiga «yo'q kuryerga ishora»
 * uchun yangi invariantni talab qilardi. Massivda esa qo'shimcha so'rov
 * YO'Q va eskirgan id zararsiz — u shunchaki hech bir kuryerga mos
 * kelmaydi.
 *
 * `scope_id` ustuni SAQLANADI: `region` qamrovi hamon bitta nishon
 * ishlatadi va eski qoidalar uchun fallback bo'lib qoladi.
 *
 * ── BACKFILL ────────────────────────────────────────────────────────────
 *
 * Mavjud `scope_type = 'courier'` qoidalari bitta elementli massivga
 * ko'chiriladi, shunda moslik mantig'i faqat `scope_ids` ga qarashi
 * mumkin bo'ladi (fallback baribir qoldiriladi — ikki devor).
 */
export class CourierPenaltyRuleScopeIds1751000005000
  implements MigrationInterface
{
  name = 'CourierPenaltyRuleScopeIds1751000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "courier_penalty_rule"
        ADD COLUMN IF NOT EXISTS "scope_ids" uuid[]
    `);

    await queryRunner.query(`
      UPDATE "courier_penalty_rule"
         SET "scope_ids" = ARRAY["scope_id"]
       WHERE "scope_type" = 'courier'
         AND "scope_id" IS NOT NULL
         AND ("scope_ids" IS NULL OR cardinality("scope_ids") = 0)
    `);

    /**
     * GIN indeks — `scope_ids @> ARRAY[...]` so'rovlari uchun. Hozir
     * moslik XOTIRADA hisoblanadi (hamma faol qoida yuklanadi), lekin
     * hisobot yoki «shu kuryerga qaysi qoidalar tegadi» ekrani SQL
     * darajasida filtrlashi mumkin — indekssiz u ketma-ket skan bo'lardi.
     */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_CP_RULE_SCOPE_IDS"
        ON "courier_penalty_rule" USING GIN ("scope_ids")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_CP_RULE_SCOPE_IDS"`);
    /**
     * ⚠️ MA'LUMOT YO'QOLADI. Bir nechta kuryerga qo'yilgan qoida bitta
     * `scope_id` ga sig'maydi. Birinchi elementni saqlab qolamiz, qolgan
     * kuryerlar o'sha qoidadan CHIQIB KETADI — revert qilishdan oldin
     * buni bilib turish kerak.
     */
    await queryRunner.query(`
      UPDATE "courier_penalty_rule"
         SET "scope_id" = "scope_ids"[1]
       WHERE "scope_type" = 'courier'
         AND "scope_id" IS NULL
         AND "scope_ids" IS NOT NULL
         AND cardinality("scope_ids") > 0
    `);
    await queryRunner.query(`
      ALTER TABLE "courier_penalty_rule" DROP COLUMN IF EXISTS "scope_ids"
    `);
  }
}
