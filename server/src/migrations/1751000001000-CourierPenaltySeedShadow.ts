import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SHTRAF MODULI — SOYA REJIMIDA ISHGA TUSHIRISH.
 *
 * Ikki qator ekadi: modul kaliti (O'CHIQ) va bitta global qoida
 * «4 kundan keyin har kechikkan kun uchun 2 000 so'm».
 *
 * ── NEGA KODDA EMAS, MIGRATSIYADA ───────────────────────────────────────
 *
 * Kalit qatori sotuv tranzaksiyasi ichida «yo'q bo'lsa yarat» yo'li bilan
 * tug'ilishi mumkin edi. SHUNDAY QILINMADI: ikki kuryer bir vaqtda sotsa
 * ikkita kalit qatori paydo bo'lardi va keyin «qaysi biri haqiqiy» degan
 * savol tug'ilardi. Singleton DEPLOY paytida, bir martta tug'iladi.
 *
 * ── NEGA `is_active = false` ────────────────────────────────────────────
 *
 * Soya rejimi: hisob to'liq ishlaydi va daftarga yoziladi, LEKIN kuryer
 * kassasiga TEGILMAYDI. Avval bir hafta haqiqiy raqamlar ko'riladi, keyin
 * yoqiladi. Aks holda noto'g'ri sozlama darhol odamlarning puliga tegardi.
 *
 * ⚠️ `shadow_since` — soyadagi GRANDFATHERING langari. Soya hisobi faqat
 * shu paytdan KEYIN jo'natilgan buyurtmalarni sanaydi, aks holda soya
 * raqamlari yoqilgandan keyingi haqiqatdan ANCHA katta chiqib, qarorni
 * noto'g'ri tomonga burardi (eski 145 kunlik qarzlar bir marta sanalib,
 * keyin hech qachon takrorlanmasdi). Eski to'planma uchun alohida o'lchov
 * skripti bor: `npm run db:measure-courier-delay`.
 */
export class CourierPenaltySeedShadow1751000001000
  implements MigrationInterface
{
  name = 'CourierPenaltySeedShadow1751000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const now = `(EXTRACT(EPOCH FROM now()) * 1000)::bigint`;

    // ── 1. Kalit qatori (singleton) ──
    //
    // `WHERE NOT EXISTS` — migratsiya qayta ishga tushsa ikkinchi qator
    // tug'ilmasin; `activated_at` esa TEGILMAYDI (u yoqish paytida
    // qo'yiladi va grandfathering langari bo'lib qoladi).
    await queryRunner.query(`
      INSERT INTO "courier_penalty_config"
        ("created_at", "updated_at", "is_active", "activated_at", "shadow_since")
      SELECT ${now}, ${now}, false, NULL, ${now}
      WHERE NOT EXISTS (SELECT 1 FROM "courier_penalty_config")
    `);

    // ── 2. Global qoida: 4 kun muddat, kuniga 2 000 ──
    //
    // ⚠️ `amount` MANFIY — shtraf. Bonus qoidalari (Faza 4) musbat
    // bo'ladi; ishora turni ajratadi.
    //
    // `max_amount` NULL: yagona chegara — kuryer tarifi (pol 0). 20 000
    // tarifda shtraf 14-kunda to'yinadi. Agar hisobot ko'pchilik polni
    // urganini ko'rsatsa, DARAJALAR qo'shiladi — buning uchun kod emas,
    // shu jadvalga yangi qator kerak.
    await queryRunner.query(`
      INSERT INTO "courier_penalty_rule"
        ("created_at", "updated_at", "scope_type", "scope_id", "event",
         "threshold_days", "calc", "amount", "max_amount", "priority",
         "active_from", "active_to", "is_active")
      SELECT ${now}, ${now}, 'global', NULL, 'late_mark',
             4, 'per_day', -2000, NULL, 0,
             ${now}, NULL, true
      WHERE NOT EXISTS (
        SELECT 1 FROM "courier_penalty_rule"
        WHERE "event" = 'late_mark' AND "scope_type" = 'global'
      )
    `);
  }

  /**
   * ⚠️ ATAYLAB BO'SH — bu migratsiya SXEMA emas, MA'LUMOT ekadi.
   *
   * Qatorlarni o'chirish `activated_at` ni yo'q qilardi, ya'ni
   * grandfathering langari yo'qolib, qayta yoqilganda eski buyurtmalar
   * shtrafga tushardi. `up` idempotent (`WHERE NOT EXISTS`), shuning
   * uchun qaytarishning hojati yo'q; jadvallarning o'zi oldingi
   * migratsiya (`1751000000000`) tomonidan tashlanadi.
   */
  public async down(): Promise<void> {
    // bo'sh
  }
}
