import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `order.market_net` — market bilan hisob-kitobning ISHORALI summasi.
 *
 * ── NEGA KERAK ──────────────────────────────────────────────────────────
 *
 * Market kassasidan pul to'rt manbadan yechiladi (sotuv, tarifdan arzon
 * sotuv, qo'shimcha xarajat, bekordagi xarajat), `paymentsToMarket` esa
 * to'lovni FAQAT `to_be_paid − paid_amount` bo'yicha tarqatadi.
 * `to_be_paid` esa `Math.max(price − tarif, 0)` — ya'ni manfiy hissani
 * ham, xarajatni ham ko'rmaydi.
 *
 * Natija: `cash_box.balance` doimo `SUM(to_be_paid − paid_amount)` dan
 * kichik va marketga kassadagi HAMMA pulni to'lasangiz ham navbat
 * oxiridagi buyurtmalar yopilmay qoladi.
 *
 * `market_net` shu to'rt manbani BITTA ishorali maydonga jamlaydi:
 *
 *     market_net = total_price − market_tariff − extra_cost_net
 *
 * ── ESKI QATORLAR TEGILMAYDI ────────────────────────────────────────────
 *
 * ⚠️ Backfill `market_net = to_be_paid` qiladi, QAYTA HISOBLAMAYDI.
 *
 * Bu foydalanuvchi qarori (2026-09-23): mavjud ~5,9 mln so'mlik tafovut
 * migratsiya bilan to'g'rilanmaydi, faqat kod tuzatiladi. Qayta
 * hisoblansa eski buyurtmalarning qiymati o'zgarib, marketlar bilan
 * allaqachon kelishilgan hisob buzilardi.
 *
 * Ya'ni migratsiyadan keyin eski buyurtmalar AYNAN hozirgidek ishlaydi:
 *   · tarifdan arzon eski buyurtma:  to_be_paid 0  → market_net 0
 *   · xarajatli eski buyurtma:       to_be_paid X  → market_net X
 * Faqat YANGI sotuvlar to'g'ri ishorali qiymat oladi.
 *
 * ── XATTI-HARAKAT ───────────────────────────────────────────────────────
 *
 * Bu migratsiya va u bilan kelgan kod HECH NARSANI O'ZGARTIRMAYDI:
 * ustun yoziladi, lekin uni HECH KIM O'QIMAYDI. To'lov halqasi unga
 * keyingi bosqichda o'tadi.
 */
export class OrderMarketNet1750300000000 implements MigrationInterface {
  name = 'OrderMarketNet1750300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * ⚠️ `bigint` — `int` EMAS. Buyurtma summalari va kassa ustunlari
     * ham `bigint`; `int` bo'lsa 2,1 mlrd dan oshganda jimgina toshardi.
     * Ishorali: manfiy qiymat market qarzini bildiradi.
     */
    await queryRunner.query(
      `ALTER TABLE "order"
         ADD COLUMN IF NOT EXISTS "market_net" bigint NOT NULL DEFAULT 0`,
    );

    /**
     * Backfill — FAQAT hozirgi `to_be_paid` nusxasi.
     *
     * `IS DISTINCT FROM` ishlatilmaydi: ustun endigina qo'shilgani uchun
     * hamma qatorda 0 turibdi va bitta `UPDATE` yetarli. Jadval katta
     * bo'lsa ham bu bitta ketma-ket skan — bo'laklashga hojat yo'q,
     * chunki hech qanday indeks yoki trigger yangilanmaydi.
     */
    await queryRunner.query(
      `UPDATE "order" SET "market_net" = COALESCE("to_be_paid", 0)`,
    );

    /**
     * ⚠️ QISMAN INDEKS — to'lov navbati uchun.
     *
     * Keyingi bosqichda navbat `market_net <> paid_amount` bo'yicha
     * tanlanadi. To'liq indeks bu yerda ortiqcha: yopilgan buyurtmalar
     * vaqt o'tishi bilan jadvalning katta qismini egallaydi, navbat esa
     * doim kichik qoladi.
     */
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_MARKET_SETTLEMENT"
         ON "order" ("user_id")
       WHERE "market_net" <> "paid_amount" AND "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ORDER_MARKET_SETTLEMENT"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "market_net"`,
    );
  }
}
