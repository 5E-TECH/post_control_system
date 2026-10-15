import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SHTRAF LANGARI UCHUN ALOHIDA USTUN — `post.courier_assigned_at`.
 *
 * ── NEGA KERAK ──────────────────────────────────────────────────────────
 *
 * Shtraf soati «pochta kuryerga jo'natilgan payt» dan boshlanadi. Shu
 * paytgacha langar sifatida `post.created_at` ishlatilardi va u ODATDA
 * to'g'ri edi: jo'natish amali YANGI pochta qatori yaratadi
 * (`post.service.ts` → `sentPost`), ya'ni o'sha qator uchun `created_at`
 * aynan jo'natish payti.
 *
 * LEKIN bitta yo'l bundan chetda qolardi: `changeCourier` pochtani boshqa
 * kuryerga biriktirganda faqat `courier_id` ni yangilaydi. Natijada YANGI
 * kuryer ESKI soatni meros qilib olardi va avvalgi kuryerning kechikishi
 * uchun jazolanardi.
 *
 * `post.created_at` ni yangilash MUMKIN EMAS: u hisobotlarda, ro'yxat
 * tartiblarida va sana filtrlarida ishlatiladi (`buildCreatedAtRange`),
 * ya'ni uni surish tarixiy hisobotni jimgina siljitardi.
 *
 * Shuning uchun langar ALOHIDA ustunga ko'chiriladi. Yon foyda: nom endi
 * o'zi aytib turadi va keyingi o'quvchi «created_at pochta yaratilganda
 * qo'yiladi-ku» deb shubhalanmaydi.
 *
 * ── BACKFILL ────────────────────────────────────────────────────────────
 *
 * Kuryeri bor pochtalarga `created_at` ko'chiriladi — ular uchun ikkisi
 * ayni (hammasi jo'natishda yaratilgan). Kuryersiz NEW pochtalar NULL
 * qoladi: ular shtraf so'rovlariga umuman tushmaydi.
 */
export class PostCourierAssignedAt1751000004000 implements MigrationInterface {
  name = 'PostCourierAssignedAt1751000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "post"
        ADD COLUMN IF NOT EXISTS "courier_assigned_at" bigint
    `);

    await queryRunner.query(`
      UPDATE "post"
         SET "courier_assigned_at" = "created_at"
       WHERE "courier_id" IS NOT NULL
         AND "courier_assigned_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "post" DROP COLUMN IF EXISTS "courier_assigned_at"
    `);
  }
}
