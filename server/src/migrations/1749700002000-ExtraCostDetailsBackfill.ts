import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ESKI SO'ROVLARGA MA'LUMOTNI TO'LDIRISH (backfill).
 *
 * `1749700001000-ExtraCostRequestDetails` ustunlarni QO'SHDI, lekin ular
 * faqat YANGI so'rovlarda to'ladi — eski yozuvlarda `NULL` bo'lib qoladi.
 * Natijada market kartasida "Kuryer: —, Mijoz: —, Manzil: —" turadi va
 * market qaror qabul qilish uchun yetarli ma'lumot ko'rmaydi.
 *
 * ⚠️ NEGA ALOHIDA MIGRATSIYA. Oldingisi ba'zi muhitlarda ALLAQACHON
 * bajarilgan; TypeORM bajarilgan migratsiyani qayta o'qimaydi, ya'ni unga
 * qo'shilgan `UPDATE` hech qachon ishlamasdi.
 *
 * ⚠️ FAQAT `NULL` MAYDONLAR TO'LDIRILADI (`COALESCE` emas, `WHERE ... IS
 * NULL`). Snapshot maydonlarining butun ma'nosi — buyurtma keyin
 * o'zgartirilsa ham QAROR PAYTIDAGI holatni saqlash. Mavjud qiymat ustiga
 * bugungi ma'lumotni yozish o'sha kafolatni buzardi.
 *
 * Orqaga qaytarish (`down`) ATAYLAB bo'sh: bu ma'lumot to'ldirish, sxema
 * o'zgarishi emas. Qaytarish faqat ma'lumotni yo'q qilardi.
 */
export class ExtraCostDetailsBackfill1749700002000
  implements MigrationInterface
{
  name = 'ExtraCostDetailsBackfill1749700002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Market va kuryer nomlari ──────────────────────────────────────────
    await queryRunner.query(`
      UPDATE "extra_cost_request" r
         SET "market_name" = u."name"
        FROM "users" u
       WHERE u."id" = r."market_id"
         AND r."market_name" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "extra_cost_request" r
         SET "courier_name" = u."name"
        FROM "users" u
       WHERE u."id" = r."courier_id"
         AND r."courier_name" IS NULL
    `);

    // ── Mijoz (buyurtma orqali) ───────────────────────────────────────────
    await queryRunner.query(`
      UPDATE "extra_cost_request" r
         SET "customer_name"  = c."name",
             "customer_phone" = c."phone_number"
        FROM "order" o
        JOIN "users" c ON c."id" = o."customer_id"
       WHERE o."id" = r."order_id"
         AND r."customer_name" IS NULL
         AND r."customer_phone" IS NULL
    `);

    // ── Viloyat va tuman (buyurtma tumani orqali) ─────────────────────────
    //
    // `district_name` ba'zi eski yozuvlarda BOR (u birinchi migratsiyadan
    // beri yoziladi), `region_name` esa yo'q — shuning uchun shart faqat
    // viloyatga qo'yilgan va tuman `COALESCE` bilan saqlanadi.
    await queryRunner.query(`
      UPDATE "extra_cost_request" r
         SET "region_name"   = reg."name",
             "district_name" = COALESCE(r."district_name", d."name")
        FROM "order" o
        JOIN "district" d ON d."id" = o."district_id"
        LEFT JOIN "region" reg ON reg."id" = d."region_id"
       WHERE o."id" = r."order_id"
         AND r."region_name" IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Ma'lumot to'ldirish qaytarilmaydi — qaytarish faqat yo'qotish bo'lardi.
  }
}
