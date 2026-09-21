import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * QO'SHIMCHA XARAJAT SO'ROVIGA KONTEKST MAYDONLARI.
 *
 * MUAMMO. So'rov kartasida faqat buyurtma raqami, summa va tarif bor edi.
 * Market "kim, qayerga, qaysi mijozga" degan savolga javob topa olmasdi;
 * kuryer esa qaysi MARKETning buyurtmasi ekanini ko'rmasdi. Qaror qabul
 * qilish uchun har safar boshqa ekranga o'tish kerak edi.
 *
 * ⚠️ NEGA DENORMALIZATSIYA, RELATION EMAS.
 *
 *   1. `relations: ['courier', 'market']` qo'shish `users` qatorini BUTUNLAY
 *      tortadi — ichida `password` hashi bor. U API javobiga chiqib ketardi.
 *      Har bir so'rovda `select` yozib yurish esa unutilishi muqarrar.
 *
 *   2. Market sahifasi buyurtma endpointlariga TEGMASLIGI kerak:
 *      `GET order/:id` market egaligini tekshirmaydi (faqat kuryerni), ya'ni
 *      undan foydalanish mavjud IDOR'ni yangi sahifaga ko'chirish bo'lardi.
 *
 *   3. SNAPSHOT qiymat nizoda muhim: mijoz telefoni yoki market nomi keyin
 *      o'zgarsa, so'rov o'sha paytdagi holatni ko'rsatishi kerak.
 *
 * ⚠️ NEGA ALOHIDA MIGRATION. `1749700000000-ExtraCostApproval` allaqachon
 * bajarilgan (lokal bazada). Uning `CREATE TABLE IF NOT EXISTS` bloki qayta
 * ishga tushsa ham yangi ustunlarni QO'SHMAYDI — jadval mavjud. Eski
 * migrationni tahrirlash esa uni qaytadan bajarganlar bilan ajralib ketardi.
 *
 * Barcha ustunlar NULLABLE — mavjud qatorlar buziladigan joyi yo'q.
 */
export class ExtraCostRequestDetails1749700001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: Array<[string, string]> = [
      // Mijoz — market kimga yetkazilganini ko'rsin.
      ['customer_name', 'varchar'],
      ['customer_phone', 'varchar'],
      // Manzil — "qayerga borgan" savoli xarajatni baholashda asosiy.
      ['region_name', 'varchar'],
      // Tomonlar nomi — parol hashini tortmasdan ko'rsatish uchun.
      ['market_name', 'varchar'],
      ['courier_name', 'varchar'],
    ];

    for (const [name, type] of columns) {
      await queryRunner.query(
        `ALTER TABLE "extra_cost_request" ADD COLUMN IF NOT EXISTS "${name}" ${type}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of [
      'courier_name',
      'market_name',
      'region_name',
      'customer_phone',
      'customer_name',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "extra_cost_request" DROP COLUMN IF EXISTS "${name}"`,
      );
    }
  }
}
