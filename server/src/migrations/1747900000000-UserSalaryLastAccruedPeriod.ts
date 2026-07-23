import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `user_salary`ga `last_accrued_period` ('YYYY-MM') ustunini qo'shadi.
 *
 * SABAB: Oylik CRON ilgari ikki marta qo'shishdan himoyani `updated_at` sanasiga
 * tayanib qilardi. Ammo `updated_at` HAR `save()`da (avans/maosh to'lash, summa
 * tahriri) yangilanadi — shu sabab to'lov kuni tegilgan ishchilar noto'g'ri
 * "allaqachon hisoblangan" deb o'tkazib yuborilardi (ba'zi ishchilar oyligi
 * belgilangan sanada qo'shilmas edi). Bu ustun accrual idempotentligining yagona,
 * ishonchli manbai bo'ladi va FAQAT CRON/catch-up tomonidan o'zgartiriladi.
 *
 * Additive va nullable — eski qatorlar uchun NULL bo'lib qoladi.
 *
 * BACKFILL (ikki marta to'lashdan himoya): Joriy oyda to'lov kuni ALLAQACHON
 * yetib kelgan qatorlarni joriy davr ('YYYY-MM') bilan belgilaymiz. Shunda
 * deploy'dan keyingi startup catch-up bu oy uchun ESKI mantiq allaqachon
 * qo'shgan summani QAYTA qo'shmaydi. Sana Asia/Tashkent bo'yicha — ilova kodi
 * (getTashkentSalaryContext) bilan bir xil.
 *
 * DIQQAT (operatorga): Backfill jim ravishda "bu oy to'langan" deb belgilaydi —
 * shu jumladan ESKI bug tufayli AYNAN shu oyda o'tkazib yuborilgan ishchilarni
 * ham. Ya'ni o'tmishdagi yo'qotishlarni AVTOMATIK tiklamaydi (ikki marta
 * to'lashning oldini olish uchun ataylab konservativ). O'sha aniq ishchilarni
 * qo'lda to'g'rilang (diagnostika SQL'lari bilan aniqlab, have_to_pay'ni
 * tuzating yoki users/salary/trigger-cron'dan keyin tekshiring).
 */
export class UserSalaryLastAccruedPeriod1747900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_salary" ADD COLUMN IF NOT EXISTS "last_accrued_period" varchar(7)`,
    );

    // Joriy oyda effektiv to'lov kuni (oy oxiri mantig'i bilan) allaqachon
    // yetib kelgan qatorlarni joriy davr bilan belgilash.
    await queryRunner.query(`
      UPDATE "user_salary" s
      SET "last_accrued_period" = to_char(tk.now_tk, 'YYYY-MM')
      FROM (SELECT (now() AT TIME ZONE 'Asia/Tashkent') AS now_tk) tk
      WHERE s."last_accrued_period" IS NULL
        AND LEAST(
              s."payment_day",
              EXTRACT(
                DAY FROM (date_trunc('month', tk.now_tk)
                          + interval '1 month' - interval '1 day')
              )::int
            ) <= EXTRACT(DAY FROM tk.now_tk)::int
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_salary" DROP COLUMN IF EXISTS "last_accrued_period"`,
    );
  }
}
