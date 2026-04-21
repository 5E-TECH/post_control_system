import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pul ustunlarini int → bigint ga kengaytirish.
 *
 * Maqsad: Postgres `int` (max 2,147,483,647) overflow muammosini oldini olish.
 * Tiyin/so'mlarda hisob-kitob qilinganda bu chegara tez yetiladi.
 *
 * `ALTER COLUMN ... TYPE BIGINT USING ...::bigint` ma'lumotni saqlaydi —
 * faqat ustun tipini kengaytiradi. DROP + ADD QILMAYDI.
 *
 * Rollback (down): bigint → int. AGAR ma'lumot int chegarasidan oshib ketgan
 * bo'lsa, rollback xato beradi (bu xavfsiz default).
 */
export class WidenMoneyColumnsToBigint1744800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // financial_balance_history
    await queryRunner.query(
      `ALTER TABLE "financial_balance_history" ALTER COLUMN "amount" TYPE BIGINT USING "amount"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_balance_history" ALTER COLUMN "balance_before" TYPE BIGINT USING "balance_before"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_balance_history" ALTER COLUMN "balance_after" TYPE BIGINT USING "balance_after"::bigint`,
    );

    // user_salary
    await queryRunner.query(
      `ALTER TABLE "user_salary" ALTER COLUMN "salary_amount" TYPE BIGINT USING "salary_amount"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_salary" ALTER COLUMN "have_to_pay" TYPE BIGINT USING "have_to_pay"::bigint`,
    );

    // orders
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "to_be_paid" TYPE BIGINT USING "to_be_paid"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "paid_amount" TYPE BIGINT USING "paid_amount"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "market_tariff" TYPE BIGINT USING "market_tariff"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "courier_tariff" TYPE BIGINT USING "courier_tariff"::bigint`,
    );

    // (Idempotency) Cashbox ustunlari allaqachon qo'lda bigint ga o'zgartirilgan.
    // Defensiv ravishda yana ishonch hosil qilamiz:
    await queryRunner.query(
      `ALTER TABLE "cash_box" ALTER COLUMN "balance" TYPE BIGINT USING "balance"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "cash_box" ALTER COLUMN "balance_cash" TYPE BIGINT USING "balance_cash"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "cash_box" ALTER COLUMN "balance_card" TYPE BIGINT USING "balance_card"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashbox_history" ALTER COLUMN "amount" TYPE BIGINT USING "amount"::bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashbox_history" ALTER COLUMN "balance_after" TYPE BIGINT USING "balance_after"::bigint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // DIQQAT: Agar qiymatlar int chegarasidan oshgan bo'lsa, bu xato beradi.
    // Bu xavfsiz default — ma'lumotni yo'qotmaslik uchun.
    const moneyCols: Array<[string, string]> = [
      ['order', 'courier_tariff'],
      ['order', 'market_tariff'],
      ['order', 'paid_amount'],
      ['order', 'to_be_paid'],
      ['user_salary', 'have_to_pay'],
      ['user_salary', 'salary_amount'],
      ['financial_balance_history', 'balance_after'],
      ['financial_balance_history', 'balance_before'],
      ['financial_balance_history', 'amount'],
    ];
    for (const [table, col] of moneyCols) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${col}" TYPE INTEGER USING "${col}"::integer`,
      );
    }
    // cash_box / cashbox_history bigint qoldiriladi (down qilmaymiz — xavfli).
  }
}
