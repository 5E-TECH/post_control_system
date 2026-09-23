import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `order.market_settled` — market bilan hisob-kitobning YOPILGAN qismi.
 *
 * ── NEGA ALOHIDA USTUN, `paid_amount` EMAS ──────────────────────────────
 *
 * Yangi to'lov halqasi MANFIY hisobli buyurtmalarni ham yopishi kerak
 * (tarifdan arzon sotuv, bekordagi xarajat — u yerda market BIZGA
 * qarzdor). Agar ularni `paid_amount` bilan belgilasak, u MANFIY bo'lib
 * ketardi.
 *
 * `paid_amount` esa foydalanuvchiga «To'langan» deb ko'rsatiladi —
 * kamida 5 joyda:
 *   client/src/pages/orders/components/orderDetails/index.tsx:280
 *   client/src/pages/payments/components/historyPopup.tsx:398
 *   client/src/pages/orders/components/order-tracking/index.tsx:135
 *   client/src/pages/logs-page/index.tsx:336
 *   client/src/pages/orders/pages/superadmin/order-details/index.tsx:493
 *
 * «To'langan: −75 000 so'm» market uchun tushunarsiz va noto'g'ri
 * ko'rinardi. Shuning uchun hisob-kitob ALOHIDA ustunda yuritiladi,
 * `paid_amount` esa hozirgi ma'nosini va yangilanish qoidasini
 * TO'LIQ saqlaydi.
 *
 *     market_settled == market_net   →  hisob yopiq
 *     market_settled <> market_net   →  hisob ochiq (musbat yoki manfiy)
 *
 * ── ESKI QATORLAR ───────────────────────────────────────────────────────
 *
 * Backfill `market_settled = paid_amount`, ya'ni hozirgi holat AYNAN
 * saqlanadi. `market_net` ham oldingi migratsiyada `to_be_paid` dan
 * ko'chirilgan edi — demak eski buyurtmalar uchun
 * `market_net − market_settled` bugungi `to_be_paid − paid_amount` ga
 * teng va navbat O'ZGARMAYDI.
 */
export class OrderMarketSettled1750400000000 implements MigrationInterface {
  name = 'OrderMarketSettled1750400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order"
         ADD COLUMN IF NOT EXISTS "market_settled" bigint NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `UPDATE "order" SET "market_settled" = COALESCE("paid_amount", 0)`,
    );

    /**
     * ⚠️ INDEKS SHARTI KENGAYTIRILDI.
     *
     * Navbatga ikki toifa kiradi:
     *   · hisobi ochiq buyurtmalar (`market_net <> market_settled`);
     *   · hisobi yopiq, LEKIN statusi hali `sold`/`partly_paid` bo'lganlar.
     *
     * Ikkinchisi SHART: tarifdan arzon eski buyurtmalarda hisob ham, to'lov
     * ham 0 — lekin status hamon `sold`. Eski halqa ularni `PAID` qilardi
     * (`remaining = 0` → shart rost). Faqat birinchi shart qoldirilsa ular
     * navbatdan tushib qolib, ABADIY `sold` bo'lib qolardi — bu
     * regressiya bo'lardi (simulyatsiyada 8810 da 11→9 ga tushgani
     * aynan shu).
     */
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ORDER_MARKET_SETTLEMENT"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_MARKET_SETTLEMENT"
         ON "order" ("user_id")
       WHERE "deleted_at" IS NULL
         AND ("market_net" <> "market_settled"
              OR "status" IN ('sold', 'partly_paid'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ORDER_MARKET_SETTLEMENT"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "market_settled"`,
    );
    // Oldingi migratsiyadagi indeksni tiklaymiz.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_MARKET_SETTLEMENT"
         ON "order" ("user_id")
       WHERE "market_net" <> "paid_amount" AND "deleted_at" IS NULL`,
    );
  }
}
