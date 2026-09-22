import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `cashbox_history.source_type` ga `rollback_correction` qiymatini qo'shadi.
 *
 * ── NEGA KERAK ──────────────────────────────────────────────────────────
 *
 * Rollback sotuvni teskari qaytarganda kassaga tuzatish yozuvi yozadi.
 * Avval u `CORRECTION` turida edi — LEKIN ayni tur
 * `reverseExtraCostForCashbox` da BOSHQA ma'noda ishlatiladi: u
 * qo'shimcha xarajat qaytarilganini AYNAN
 *
 *     source_type = 'correction' AND operation_type = 'income'
 *
 * yig'indisi bo'yicha hisoblaydi. Rollback tarif yozuvi ham `income`
 * bo'lib qolsa (0 so'mli buyurtmada aynan shunday — pul QAYTARILADI),
 * u «xarajat allaqachon qaytarilgan» deb sanalib, haqiqiy qaytarish
 * bajarilmay qolardi. Bu daftar emas, REAL PUL ZARARI bo'lardi.
 *
 * Shu sabab rollback yozuvi alohida turga ko'chirildi:
 *   `correction`          → faqat qo'shimcha xarajat teskari qaytarishi
 *   `rollback_correction` → sotuvni orqaga qaytarish tuzatishi
 *
 * ── ENUM QIYMATI QO'SHISH HAQIDA ────────────────────────────────────────
 *
 * PostgreSQL 12+ da `ALTER TYPE ... ADD VALUE` tranzaksiya ichida
 * ishlaydi, LEKIN yangi qiymatni O'SHA tranzaksiyada ISHLATIB bo'lmaydi.
 * Bu migratsiya faqat qiymatni QO'SHADI, ishlatmaydi — shuning uchun
 * xavfsiz. Kod esa keyingi deploy'dan so'ng (app restartdan keyin) uni
 * ishlatadi.
 *
 * ⚠️ SHU SABAB MIGRATSIYA APP RESTARTDAN OLDIN QO'LLANISHI SHART —
 * deploy.yml da tartib aynan shunday (migration → restart).
 *
 * `IF NOT EXISTS` — migratsiya qayta ishga tushsa yiqilmasin.
 */
export class RollbackCorrectionSourceType1750200000000
  implements MigrationInterface
{
  name = 'RollbackCorrectionSourceType1750200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "cashbox_history_source_type_enum"
         ADD VALUE IF NOT EXISTS 'rollback_correction'`,
    );
  }

  /**
   * ⚠️ `down()` ATAYLAB BO'SH.
   *
   * PostgreSQL enum qiymatini O'CHIRISHNI QO'LLAB-QUVVATLAMAYDI. Yagona
   * yo'l — butun turni qayta yaratish va unga bog'liq har bir ustunni
   * ko'chirish. Bu `cashbox_history` kabi katta va MOLIYAVIY jadvalda
   * nomutanosib xavf: qiymatdan foydalangan qatorlar bo'lsa migratsiya
   * ma'lumot yo'qotmasdan orqaga qayta olmaydi.
   *
   * Ortiqcha enum qiymati hech narsani buzmaydi — u shunchaki
   * ishlatilmay qoladi.
   */
  public async down(): Promise<void> {
    // ataylab bo'sh — yuqoridagi izohga qarang
  }
}
