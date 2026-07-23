import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ALMASHTIRISH (kafolat-swap) buyurtmalari uchun sxema.
 *
 * Biznes muammosi: ayrim YANGI buyurtmalar aslida avval yetkazilgan buyurtma
 * O'RNIGA almashtirish (kafolat) sifatida boradi — kuryer yangisini topshirib,
 * ESKI mahsulotni olib marketga qaytarishi kerak. Hozir bu nazoratga olinmagan
 * va eski mahsulot yo'qoladi.
 *
 * MODEL = kafolat-almashtirish (swap), REFUND EMAS: eski sotuv puli QAYTARILMAYDI
 * (eski buyurtma SOTILGAN holatda qoladi, kassa/foyda/daromad muzlatiladi).
 * Yangi buyurtma 0 yoki kichik summaga boradi (oddiy sotuv yo'li).
 *
 * Bu migration FAQAT sxemani qo'shadi — hech qanday xulq o'zgartirmaydi.
 * Barcha ustunlar additiv va nullable/default'li; mavjud qatorlar o'zgarmaydi.
 *
 *   replacement_of_order_id  → YANGI buyurtma qaysi ESKI buyurtma o'rniga
 *                              (o'ziga-FK, ON DELETE SET NULL). parent_order_id'dan
 *                              ALOHIDA (u partlySold bola-buyurtmasiniki).
 *   replacement_state        → jismoniy qaytarish holati (kuryer gate'ini boshqaradi):
 *                              awaiting_old_pickup → old_collected → old_returned.
 *   is_replacement_return    → ESKI buyurtmada true — statusini O'ZGARTIRMASDAN
 *                              qaytarish ro'yxatida ko'rsatish uchun.
 *   old_product_returned_at  → kuryer eskini olgan/topshirgan vaqt (epoch ms).
 */
export class OrderReplacement1748000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) replacement_state enum tipi (TypeORM standart nomi: <jadval>_<ustun>_enum)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "order_replacement_state_enum" AS ENUM ('awaiting_old_pickup', 'old_collected', 'old_returned');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // 2) Ustunlar (additiv, nullable/default — mavjud qatorlar o'zgarmaydi)
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "replacement_of_order_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "replacement_state" "order_replacement_state_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "is_replacement_return" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "old_product_returned_at" bigint`,
    );

    // 3) O'ziga-o'zi FK — eski buyurtma o'chsa havola NULL bo'ladi (buyurtma qoladi)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "order" ADD CONSTRAINT "FK_ORDER_REPLACEMENT_OF"
          FOREIGN KEY ("replacement_of_order_id") REFERENCES "order"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // 4) Indexlar
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_REPLACEMENT_OF" ON "order" ("replacement_of_order_id")`,
    );
    // Qaytarish ro'yxati so'rovi uchun partial index (faqat almashtirish qaytishlari)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_IS_REPLACEMENT_RETURN" ON "order" ("is_replacement_return") WHERE "is_replacement_return" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ORDER_IS_REPLACEMENT_RETURN"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_REPLACEMENT_OF"`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "order" DROP CONSTRAINT "FK_ORDER_REPLACEMENT_OF";
      EXCEPTION WHEN undefined_object THEN null; END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "old_product_returned_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "is_replacement_return"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "replacement_state"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "replacement_of_order_id"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "order_replacement_state_enum"`,
    );
  }
}
