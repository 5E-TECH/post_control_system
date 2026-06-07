import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `cashbox_history` ga "amaldan keyingi balans" ni naqd/karta bo'yicha ajratish
 * uchun ikkita ustun qo'shadi:
 *   - `balance_after_cash` — amaldan keyingi NAQD balans
 *   - `balance_after_card` — amaldan keyingi KARTA balans
 *
 * Naqd/karta ajratimi faqat ASOSIY (MAIN) kassada yuritiladi — shu sababli bu
 * ustunlar faqat MAIN kassa yozuvlarida to'ldiriladi. Kuryer/market kassalari
 * va MIGRATSIYAGACHA mavjud bo'lgan barcha yozuvlar uchun `null` qoladi
 * (tarixiy ajratimni qayta tiklab bo'lmaydi). Frontend `null` bo'lsa umumiy
 * `balance_after` ga qaytadi — shuning uchun mavjud ma'lumotlarga zarar yetmaydi.
 *
 * Ustunlar `nullable` — eski qatorlar uchun NOT NULL talab qilinmaydi.
 */
export class CashboxHistoryBalanceSplit1747100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cashbox_history" ADD COLUMN IF NOT EXISTS "balance_after_cash" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashbox_history" ADD COLUMN IF NOT EXISTS "balance_after_card" bigint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cashbox_history" DROP COLUMN IF EXISTS "balance_after_card"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cashbox_history" DROP COLUMN IF EXISTS "balance_after_cash"`,
    );
  }
}
