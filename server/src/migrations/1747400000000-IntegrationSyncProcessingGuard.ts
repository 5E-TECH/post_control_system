import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tashqi integratsiya sync navbati (integration_sync_queue) ishonchliligini
 * oshiradi (defense-in-depth):
 *
 *  1) `processing_started_at` ustuni — job qachon 'processing' holatiga
 *     o'tkazilganini belgilaydi. Server qayta ishga tushsa/crash bo'lsa
 *     'processing'da qotib qolgan joblarni vaqt bo'yicha aniqlab, qayta
 *     tiklash (stale recovery) uchun kerak. Busiz bunday joblar abadiy
 *     'processing'da qolib, buyurtma statusi tashqi saytga yetib bormaydi.
 *
 *  2) Tezkor stale-qidiruv uchun (status, processing_started_at) bo'yicha index.
 *
 *  3) Bir martalik tuzatish — deploy paytida ALLAQACHON 'processing'da qotib
 *     qolgan joblarni 'pending'ga qaytarish (yangi kod ularni qayta sync qiladi).
 */
export class IntegrationSyncProcessingGuard1747400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Yangi ustun (idempotent)
    await queryRunner.query(`
      ALTER TABLE "integration_sync_queue"
      ADD COLUMN IF NOT EXISTS "processing_started_at" bigint
    `);

    // 2) Stale-qidiruv indexi (idempotent)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_SYNC_QUEUE_STATUS_PROCESSING"
      ON "integration_sync_queue" ("status", "processing_started_at")
    `);

    // 3) Deploy paytida qotib qolgan eski 'processing' joblarni qutqarish.
    //    Hali urinish limiti tugamaganlarini 'pending'ga, tugaganlarini
    //    'failed'ga o'tkazamiz (yangi kod ham shu mantiqqa amal qiladi).
    await queryRunner.query(`
      UPDATE "integration_sync_queue"
      SET "status" = CASE
            WHEN "attempts" >= "max_attempts" THEN 'failed'
            ELSE 'pending'
          END,
          "next_retry_at" = NULL,
          "processing_started_at" = NULL,
          "updated_at" = (EXTRACT(EPOCH FROM now()) * 1000)::bigint
      WHERE "status" = 'processing'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_SYNC_QUEUE_STATUS_PROCESSING"
    `);
    await queryRunner.query(`
      ALTER TABLE "integration_sync_queue"
      DROP COLUMN IF EXISTS "processing_started_at"
    `);
  }
}
