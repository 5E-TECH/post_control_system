import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SHTRAF MODULI — PUL YO'LI UCHUN SXEMA.
 *
 * Uch ish qiladi: ikki enumga `courier_penalty` qiymatini qo'shadi va
 * daftar qatorining kassa langariga FOREIGN KEY o'rnatadi.
 *
 * ── NEGA ALOHIDA FAYL VA NEGA RESTARTDAN OLDIN ──────────────────────────
 *
 * PostgreSQL 12+ da `ALTER TYPE ... ADD VALUE` tranzaksiya ichida
 * ishlaydi, LEKIN yangi qiymatni O'SHA tranzaksiyada ISHLATIB bo'lmaydi.
 * Bu migratsiya qiymatni faqat QO'SHADI — hech qayerda ishlatmaydi.
 *
 * ⚠️ Migratsiya APP RESTARTDAN OLDIN qo'llanishi SHART. deploy.yml da
 * tartib aynan shunday. Aks holda birinchi shtraf yozuvi INSERT xatosi
 * berib BUTUN SOTUV tranzaksiyasini abort qilardi — ya'ni kuryer mijoz
 * oldida «sotildi» tugmasini bosa olmasdi.
 *
 * ── NEGA MAVJUD TUR QAYTA ISHLATILMADI ──────────────────────────────────
 *
 * `correction` ni olish REAL PUL ZARARI bo'lardi:
 * `reverseExtraCostForCashbox` qaytarilgan xarajatni AYNAN
 * `source_type='correction' AND operation_type='income'` yig'indisi deb
 * sanaydi. Bonus (kuryer qarzini kamaytiruvchi) shu turda yozilsa, o'sha
 * buyurtmaning qo'shimcha xarajati «allaqachon qaytarilgan» deb hisoblanib,
 * haqiqiy qaytarish bajarilmay qolardi.
 *
 * `extra_cost` ham yaramaydi — ayni funksiya uni ham o'qiydi.
 *
 * ⚠️ Enum qiymatini keyin O'CHIRIB bo'lmaydi (PostgreSQL qo'llab-quvvatlamaydi),
 * ya'ni nom BIR MARTA tanlanadi. `cashbox_history` enumida allaqachon
 * TS tomonda yo'q bir nechta o'lik qiymat bor — bu amalda tasdiqlangan.
 */
export class CourierPenaltyActivation1751000002000
  implements MigrationInterface
{
  name = 'CourierPenaltyActivation1751000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Kuryer kassasidagi shtraf/bonus/bekor qilish qatori.
    await queryRunner.query(
      `ALTER TYPE "cashbox_history_source_type_enum"
         ADD VALUE IF NOT EXISTS 'courier_penalty'`,
    );

    /**
     * Moliyaviy tarozi yozuvi.
     *
     * ⚠️ NEGA KERAK: shtraf FAQAT BITTA kassani o'zgartiradi (kuryer
     * qarzi oshadi), ya'ni global tarozi `main + Σkuryer − Σmarket`
     * siljiydi. Sotuv foydasi (`sell_profit`) uchun bunday qator
     * allaqachon yoziladi; shtraf ham daromad tan olinishi, shuning
     * uchun u ham o'z qatorini oladi. Aks holda «Moliyaviy balans»
     * ekranidagi son sababsiz o'sardi.
     */
    await queryRunner.query(
      `ALTER TYPE "financial_balance_history_source_type_enum"
         ADD VALUE IF NOT EXISTS 'courier_penalty'`,
    );

    /**
     * ⚠️ LANGAR YETIM QOLMASIN.
     *
     * `courier_penalty_entry` da birorta FK yo'q edi. Kuryer o'chirilsa
     * `cash_box` CASCADE ketadi, u bilan `cashbox_history` ham — va
     * `shadow=false` daftar qatorlari mavjud bo'lmagan yozuvga ishora
     * qilib qolardi. Natijada daftar↔kassa invarianti ABADIY qizil
     * bo'lib, tuzatish yo'li qolmasdi.
     *
     * `SET NULL` tanlandi, `CASCADE` emas: daftar qatori DALIL, u
     * kassa yozuvi bilan birga o'chib ketmasligi kerak.
     */
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_CP_ENTRY_CASHBOX_HISTORY'
        ) THEN
          ALTER TABLE "courier_penalty_entry"
            ADD CONSTRAINT "FK_CP_ENTRY_CASHBOX_HISTORY"
            FOREIGN KEY ("cashbox_history_id")
            REFERENCES "cashbox_history" ("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  /**
   * ⚠️ Enum qiymatlari QAYTARILMAYDI — PostgreSQL enum qiymatini
   * o'chirishni qo'llab-quvvatlamaydi (yagona yo'l butun turni qayta
   * yaratish, bu esa `cashbox_history` kabi moliyaviy jadvalda
   * nomutanosib xavf). Ortiqcha qiymat hech narsani buzmaydi.
   *
   * FK esa qaytariladi.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "courier_penalty_entry"
         DROP CONSTRAINT IF EXISTS "FK_CP_ENTRY_CASHBOX_HISTORY"`,
    );
  }
}
