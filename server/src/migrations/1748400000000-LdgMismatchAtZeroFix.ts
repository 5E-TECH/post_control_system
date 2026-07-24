import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LDG "soxta mismatch" tuzatish (ma'lumot tozalash).
 *
 * SABAB: `ldg_shipment.mismatch_at` ustuni `bigintTransformerNonNull` ishlatgan,
 * u `null → 0` yozadi. Har status saqlanganda mismatch_at=0 bo'lib, admin panel
 * "Mismatch" kartasi/filtri (`WHERE mismatch_at IS NOT NULL`) HAR BIR shipmentni
 * nomuvofiq deb sanardi (5 mingdan ortiq soxta mismatch).
 *
 * Entity endi null-saqlovchi `bigintTransformer` ishlatadi (kelgusi yozuvlar to'g'ri).
 * Bu migratsiya MAVJUD soxta yozuvlarni tozalaydi.
 *
 * XAVFSIZ: faqat `mismatch_at = 0` qatorlarga tegadi. Haqiqiy mismatch'da
 * mismatch_at = Date.now() (katta son) bo'ladi — 0 hech qachon haqiqiy mismatch
 * emas, shuning uchun ular tegilmaydi. Idempotent (qayta ishga tushsa xavfsiz).
 */
export class LdgMismatchAtZeroFix1748400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "ldg_shipment" SET "mismatch_at" = NULL WHERE "mismatch_at" = 0`,
    );
    // Bir vaqtning o'zida boshqa nullable timestamp ustunlar ham 0 → NULL
    // (transformer bir xil tuzoqdan aziyat chekkan; 0 = 1970-01-01 noto'g'ri).
    await queryRunner.query(
      `UPDATE "ldg_shipment" SET "ldg_status_changed_at" = NULL WHERE "ldg_status_changed_at" = 0`,
    );
    await queryRunner.query(
      `UPDATE "ldg_shipment" SET "ldg_created_at" = NULL WHERE "ldg_created_at" = 0`,
    );
    await queryRunner.query(
      `UPDATE "ldg_shipment" SET "last_synced_at" = NULL WHERE "last_synced_at" = 0`,
    );
  }

  public async down(): Promise<void> {
    // Teskari qaytarish YO'Q: 0 qiymatlar bug edi, ularni tiklash mantiqsiz.
  }
}
