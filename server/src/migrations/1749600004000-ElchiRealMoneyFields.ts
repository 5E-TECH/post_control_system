import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `elchi_shipment` ga HAQIQIY pul maydonlari (audit M2).
 *
 * ⚠️ NEGA KERAK BO'LDI. Elchi hamkorga `cod_collected` deb `order.paid_amount`
 * ni yuborardi — u "kuryer yig'gan pul" EMAS, market qarzining avtomatik
 * to'langan qismi, va oddiy sotuvda 0. Biz uni `cod_collected_reported` ga
 * yozib, hisob-kitob panelida "Elchi yig'gan" deb ko'rsatardik. Natijada
 * uchta ko'rsatkich jimgina yolg'on bo'lgan:
 *
 *   "Elchi yig'gan (net)"  = 0
 *   "Elchi bizga qarz"     = 0 - to'lovlar = MANFIY
 *   "Elchi ushlagan"       = jo'natilgan - 0 = BUTUN COD (tarif emas)
 *
 * Elchi endi ANIQ nomli ikki maydon yuboradi:
 *   `collected_from_customer` — kuryer yig'gan naqd (sotuv snapshoti)
 *   `elchi_fee`               — Elchi ushlab qolgan tarif (sotuv snapshoti)
 *
 * Qarz shulardan hisoblanadi: SUM(collected - fee) - to'langan.
 *
 * ⚠️ NULLABLE, DEFAULT YO'Q. `NULL` = "Elchi hali bu maydonni yubormagan"
 * (eski posilkalar) yoki "buyurtma hali sotilmagan". 0 bilan to'ldirish
 * ikkisini ham "yig'ilmadi" deb ko'rsatib, aynan tuzatayotgan xatoni
 * takrorlardi.
 */
export class ElchiRealMoneyFields1749600004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "elchi_shipment"
      ADD COLUMN IF NOT EXISTS "collected_from_customer_reported" numeric(14,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "elchi_shipment"
      ADD COLUMN IF NOT EXISTS "elchi_fee_reported" numeric(14,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "elchi_shipment"
      DROP COLUMN IF EXISTS "elchi_fee_reported"
    `);
    await queryRunner.query(`
      ALTER TABLE "elchi_shipment"
      DROP COLUMN IF EXISTS "collected_from_customer_reported"
    `);
  }
}
