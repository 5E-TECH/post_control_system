import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Order'larni HARD delete'dan SOFT delete'ga o'tkazish.
 *
 * Eski sxema: `deleted: boolean` (default false) — qoldiriladi (xavfsiz)
 * Yangi sxema: `deleted_at: timestamp NULL` (TypeORM @DeleteDateColumn)
 *
 * MUHIM: hech qanday ustun yoki ma'lumot O'CHIRILMAYDI.
 *   - Yangi `deleted_at` ustun qo'shiladi
 *   - Eski `deleted = true` bo'lgan rowlar uchun deleted_at = NOW yoziladi
 *     (aks holda TypeORM ularni "ko'rinadigan" deb xato hisoblar edi)
 *   - Eski `deleted` ustun JADVAL'da QOLADI — lekin yangi kod uni ishlatmaydi
 *
 * Down migration: yangi ustunni olib tashlaydi (lekin eski `deleted` qoladi).
 */
export class OrderSoftDelete1745600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Yangi ustun qo'shish (idempotent)
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL DEFAULT NULL`,
    );

    // 2) Eski yumshoq-o'chirilgan rowlarni yangi ustun bilan sinxronlash
    //    (faqat agar eski `deleted` ustun mavjud bo'lsa)
    const hasOld = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'order' AND column_name = 'deleted'`,
    );
    if (hasOld && hasOld.length > 0) {
      await queryRunner.query(
        `UPDATE "order" SET "deleted_at" = NOW() WHERE "deleted" = true AND "deleted_at" IS NULL`,
      );
      // DIQQAT: eski `deleted` ustun OLIB TASHLANMAYDI (xavfsizlik uchun qoldiriladi)
    }

    // 3) Index — soft-delete filter tezroq ishlashi uchun
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_DELETED_AT" ON "order"("deleted_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Indexni olib tashlash
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_DELETED_AT"`);

    // Yangi ustunni olib tashlash
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN IF EXISTS "deleted_at"`);

    // Eski `deleted` ustun migration ichida o'chirilmagan, shuning uchun qaytarish ham yo'q.
  }
}
