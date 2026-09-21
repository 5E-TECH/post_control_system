import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * VIDEO ISBOTNI SERVERDA SIQISH — ustunlar va indeks.
 *
 * Video brauzerda siqib bo'lmaydi (`MediaRecorder` real vaqt talab qiladi,
 * mobil Safari kodek kafolati bermaydi), shuning uchun u serverda `ffmpeg`
 * bilan 720p/H.264 ga o'tkaziladi. Bu jarayon FONDA ketadi, ya'ni holatini
 * biror joyda saqlash kerak — aks holda server qayta ishga tushsa, yarim
 * qolgan ish butunlay yo'qolardi va video asl (katta) holida qolaverardi.
 *
 * ⚠️ Ustunlar NULL bo'lishi mumkin va bu NORMAL:
 *   - rasmlar uchun `transcode_status` har doim `NULL` (tegishli emas)
 *   - bu migratsiyadan OLDINGI videolar ham `NULL` — ular allaqachon
 *     saqlangan, ularni qayta siqishning ma'nosi yo'q (manba yo'qolgan
 *     emas, lekin foydasi zarariga arzimaydi).
 */
export class ExtraCostProofTranscode1749700003000
  implements MigrationInterface
{
  name = 'ExtraCostProofTranscode1749700003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "extra_cost_proof"
        ADD COLUMN IF NOT EXISTS "transcode_status" varchar(16),
        ADD COLUMN IF NOT EXISTS "original_size_bytes" integer
    `);

    // Navbatni tanlash so'rovi: `WHERE transcode_status = 'pending'`.
    // Qisman indeks — jadvalning katta qismi (rasmlar + tugagan videolar)
    // indeksga UMUMAN kirmaydi, ya'ni u kichik va tez qoladi.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ECP_TRANSCODE_PENDING"
        ON "extra_cost_proof" ("created_at")
        WHERE "transcode_status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ECP_TRANSCODE_PENDING"`);
    await queryRunner.query(`
      ALTER TABLE "extra_cost_proof"
        DROP COLUMN IF EXISTS "original_size_bytes",
        DROP COLUMN IF EXISTS "transcode_status"
    `);
  }
}
