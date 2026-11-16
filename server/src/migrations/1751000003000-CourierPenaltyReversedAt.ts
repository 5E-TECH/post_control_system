import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SHTRAF MODULI — ROLLBACK ORQALI QOCHISH YO'LINI YOPISH.
 *
 * ── MUAMMO ──────────────────────────────────────────────────────────────
 *
 * `UQ_CP_ENTRY_ORDER_REASON` indeksi `(order_id, reason)` bo'yicha va
 * `kind <> 'waiver'` qatorlarga qo'yilgan. Bekor qilish ASL qatorni
 * O'CHIRMAGANI uchun (bu to'g'ri — dalil saqlanishi kerak), asl `penalty`
 * qatori indeks uyasini BAND qilib qolardi. Natijada:
 *
 *   sotildi (20 kun kechikish) → shtraf 32 000 yozildi
 *   rollback                   → waiver −32 000 (sof 0)
 *   QAYTA sotildi              → insert konfliktga urildi → `orIgnore`
 *                                → `writeEntry` null → KASSAGA HECH NARSA
 *
 * Ya'ni kuryer «sotildi»ni bosib, rollback qilib, keyin haqiqiy statusni
 * bosish orqali kechikish shtrafidan BUTUNLAY qutulardi. Lokal bazada
 * buyurtma #100132 aynan shunday: jo'natishdan 20 kun, sof shtraf 0.
 *
 * ── YECHIM ──────────────────────────────────────────────────────────────
 *
 * `reversed_at` ustuni qo'shiladi va unikal indeksga
 * `AND "reversed_at" IS NULL` sharti kiritiladi. Shunda:
 *
 *   • TIRIK shtraf uyani band qiladi  → takroriy so'rov ikkinchi marta
 *     jazolay olmaydi (idempotentlik SAQLANADI, bu asosiy maqsad edi);
 *   • bekor qilingan shtraf uyani BO'SHATADI → qayta hal qilinganda
 *     yangi qator yoziladi va kechikish yana hisoblanadi.
 *
 * IKKI BARAVAR JAZO YO'Q: birinchi shtraf to'liq qaytariladi, daftarda
 * esa yangi qator qoladi.
 *
 * ⚠️ LEKIN YANGI SUMMA ASLIDAN KATTA BO'LADI. `recordForOrder` ni qayta
 * hisoblaydi va `markedAt` endi YANGI belgilash vaqti — ya'ni kechikish
 * rollback oynasini ham o'z ichiga oladi (tarif poligacha). Masalan
 * 16 kunlik kechikish uchun 32 000 yozilib, 5 kundan keyin qayta
 * belgilansa yangi summa 42 000 bo'ladi.
 *
 * Bu ATAYLAB: aks holda rollback soatni to'xtatib turish vositasiga
 * aylanardi. Oqibati shuki, rollbackni ADMIN kechiktirsa, o'sha kunlar
 * ham kuryer hisobiga tushadi — bunday holat `waive` bilan, majburiy
 * sabab va daftardagi dalil bilan hal qilinadi.
 *
 * ⚠️ VAQT CHEGARASI ATAYLAB QO'YILMADI. Rollbackni vaqt oynasi bilan
 * cheklash taklif qilingan edi (egasi rad etdi: kundalik ishda
 * noqulaylik tug'diradi). Yechim shtraf mantig'ining O'ZIDA: necha marta
 * va qachon rollback qilinishidan qat'i nazar, soat JO'NATISHDAN yakuniy
 * hal qilishgacha ishlaydi.
 *
 * ── IKKINCHI DARVOZA: QO'SHALOQ BEKOR QILISH ────────────────────────────
 *
 * `waives_entry_id` ga unikal indeks qo'yiladi. Ilgari ayni shtrafni ikki
 * marta teskari qaytarish faqat ilova kodidagi tekshiruv bilan to'silardi
 * va u `entryId` yo'lida ISHLAMASDI (to'plam bo'sh qolardi) — ya'ni
 * poygada kuryerga pul ikki marta qaytarilishi mumkin edi.
 */
export class CourierPenaltyReversedAt1751000003000
  implements MigrationInterface
{
  name = 'CourierPenaltyReversedAt1751000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Ustun ──
    await queryRunner.query(`
      ALTER TABLE "courier_penalty_entry"
        ADD COLUMN IF NOT EXISTS "reversed_at" bigint
    `);

    /**
     * ── 2. BACKFILL ──
     *
     * Mavjud bekor qilingan shtraflarga `reversed_at` qo'yiladi, aks
     * holda ular uyani abadiy band qilib qolardi va migratsiyadan keyin
     * ham qochish yo'li ochiq turardi. Vaqt sifatida WAIVER qatorining
     * `created_at` i olinadi — bekor qilish aynan o'shanda bo'lgan.
     *
     * ⚠️ FAQAT `sale_rolled_back`. Admin kechirimi (yopiq ro'yxatdagi
     * boshqa sabablar) uyani ATAYLAB BAND qoldiradi: kechirim o'sha
     * buyurtmaning o'sha kechikishiga berilgan, shuning uchun qayta
     * belgilashda yangi shtraf yozilmasligi kerak (egasi qarori,
     * 2026-10-15). Shartsiz backfill kechirimlarni jim bekor qilardi.
     */
    await queryRunner.query(`
      UPDATE "courier_penalty_entry" AS e
         SET "reversed_at" = w."created_at"
        FROM "courier_penalty_entry" AS w
       WHERE w."waives_entry_id" = e."id"
         AND w."reason" = 'sale_rolled_back'
         AND e."reversed_at" IS NULL
    `);

    // ── 3. Unikal indeksni almashtirish ──
    //
    // Eski indeks tashlanib, o'rniga `reversed_at IS NULL` shartli
    // variant qo'yiladi. Nomi SAQLANADI: invariant skripti va kod
    // izohlari shu nomga ishora qiladi.
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_CP_ENTRY_ORDER_REASON"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CP_ENTRY_ORDER_REASON"
        ON "courier_penalty_entry" ("order_id", "reason")
      WHERE "kind" <> 'waiver' AND "reversed_at" IS NULL
    `);

    /**
     * ── 4. QO'SHALOQ BEKOR QILISHNI DB DARAJASIDA TO'SISH ──
     *
     * ⚠️ OLDIN TEKSHIRAMIZ. Eski kodda «allaqachon qaytarilgan» himoyasi
     * `entryId` yo'lida ISHLAMASDI, ya'ni prodda bitta shtrafga ikkita
     * waiver yozilgan bo'lishi MUMKIN (kuryerga pul ikki marta
     * qaytarilgan). Bunday ma'lumotda `CREATE UNIQUE INDEX` xom Postgres
     * xatosi bilan yiqilardi va deploy darvozasi to'xtab, sababi
     * migratsiya matnidan KO'RINMASDI. Shu sababli oldindan tekshirib,
     * aniq ko'rsatma beramiz — ma'lumot JIM tuzatilmaydi, chunki bu real
     * pul harakati va uni odam ko'rib chiqishi shart.
     */
    const dupes = await queryRunner.query(`
      SELECT "waives_entry_id"::text AS id, COUNT(*)::int AS n
      FROM "courier_penalty_entry"
      WHERE "waives_entry_id" IS NOT NULL
      GROUP BY "waives_entry_id"
      HAVING COUNT(*) > 1
    `);
    if (Array.isArray(dupes) && dupes.length) {
      const list = dupes
        .map((d: { id: string; n: number }) => `${d.id} (${d.n} marta)`)
        .join(', ');
      throw new Error(
        'Shtraf daftarida QO\'SHALOQ bekor qilish topildi — unikal indeks ' +
          'qo\'yib bo\'lmaydi. Bu kuryerga pul IKKI MARTA qaytarilgan ' +
          'degani, shuning uchun avtomatik tozalanmaydi. Qatorlarni ko\'rib ' +
          'chiqing va ortiqcha waiver(lar)ni teskari yozuv bilan tuzating: ' +
          list,
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CP_ENTRY_WAIVES"
        ON "courier_penalty_entry" ("waives_entry_id")
      WHERE "waives_entry_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_CP_ENTRY_WAIVES"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_CP_ENTRY_ORDER_REASON"`);
    /**
     * ⚠️ Eski indeksni tiklashdan OLDIN takrorlar tozalanmaydi — ularni
     * qo'lda ko'rib chiqish kerak. `CREATE UNIQUE INDEX` takror bo'lsa
     * yiqiladi va bu TO'G'RI: jim ma'lumot yo'qotishdan ko'ra, revert
     * to'xtab, odam qaror qabul qilgani yaxshiroq.
     */
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CP_ENTRY_ORDER_REASON"
        ON "courier_penalty_entry" ("order_id", "reason")
      WHERE "kind" <> 'waiver'
    `);
    await queryRunner.query(`
      ALTER TABLE "courier_penalty_entry" DROP COLUMN IF EXISTS "reversed_at"
    `);
  }
}
