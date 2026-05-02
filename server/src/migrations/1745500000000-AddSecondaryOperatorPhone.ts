import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ikkinchi (ixtiyoriy) operator telefon raqamini qo'shish.
 *
 * - `users.secondary_operator_phone` — market sozlamasi
 * - `order.secondary_operator_phone` — buyurtma yaratilganda snapshot olinadi
 *
 * Ikkala ustun ham nullable — mavjud yozuvlarga ta'sir qilmaydi.
 */
export class AddSecondaryOperatorPhone1745500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "secondary_operator_phone" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "secondary_operator_phone" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "secondary_operator_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "secondary_operator_phone"`,
    );
  }
}
