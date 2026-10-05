import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BEKOR QILINGAN BUYURTMANI MARKETGA TOPSHIRISH — IKKI BOSQICHLI TASDIQ.
 *
 * ── NEGA ────────────────────────────────────────────────────────────────
 *
 * Bugun bekor qilingan buyurtma markaz uni qabul qilgan zahoti `CLOSED`
 * bo'ladi (post.service.ts `receiveCanceledPost`, order.service.ts
 * `receiveWithScaner`). Ya'ni:
 *   · mol jismonan hali omborda, lekin tizimda "yopilgan";
 *   · MARKET hech narsa tasdiqlamaydi — uning roziligi so'ralmaydi;
 *   · "viloyatdan keldi" va "marketga topshirildi" — ikki BOSHQA fakt,
 *     lekin bitta statusga siqilgan.
 *
 * Elchi'da bu zanjir ikki tasdiqdan o'tadi (filial/HQ qabul qiladi →
 * market QR'i bilan topshiriladi). Shu qoida BeePost'ga ko'chiriladi.
 *
 * ── NEGA YANGI `Order_status` QIYMATI YO'Q ──────────────────────────────
 *
 * `Order_status` repoda 15+ joyda QO'LDA sanalgan (ldg-status.guard.ts,
 * elchi-shipment.service.ts, order.service.ts NON_CANCELLABLE/rollback/
 * DELIVERED, users.service.ts, region.service.ts,
 * extra-cost-decision.service.ts, marketplace-status.util.ts …) va
 * client'da yana 8+ status xaritasi bor. Bittasi o'tkazib yuborilsa
 * LDG/Elchi oraliq webhooki statusni ORQAGA qaytaradi yoki posilka qayta
 * jo'natiladi. Ustiga PostgreSQL `ALTER TYPE … ADD VALUE` ni QAYTARIB
 * BO'LMAYDI — `down()` yolg'on bo'lib qolardi.
 *
 * Shuning uchun status O'ZGARMAYDI (`cancelled (sent)` qoladi), ikki fakt
 * esa DALIL USTUNLARIDA saqlanadi. Bu repoda allaqachon ishlayotgan naqsh:
 * `old_product_returned_at` + `old_returned_by` (order.entity.ts) —
 * "marketga topshirildi" dalili statusni o'zgartirmasdan yoziladi.
 *
 * Hosila (derived) holatlar — DB'da status emas, faqat shart:
 *   kuryerda  : center_received_at IS NULL
 *   markazda  : center_received_at IS NOT NULL AND market_handover_at IS NULL
 *   marketda  : market_handover_at IS NOT NULL  (status ham CLOSED bo'ladi)
 *
 * ── BU MIGRATSIYA XULQNI O'ZGARTIRMAYDI ─────────────────────────────────
 *
 * Faqat sxema: hamma ustun NULLABLE va default'siz, market bayrog'i esa
 * `false`. Ya'ni migratsiya qo'llangandan keyin ham tizim AYNAN hozirgidek
 * ishlaydi; xulq keyingi qadamda (receiveCanceledPost / receiveWithScaner)
 * o'zgaradi. Shu sabab bu migratsiyani xavfsiz oldinroq chiqarish mumkin.
 */
export class CancelReturnMarketHandover1750700000000
  implements MigrationInterface
{
  name = 'CancelReturnMarketHandover1750700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════ 1. "order" — dalil ustunlari ═══════════
    //
    // Vaqtlar epoch-ms `bigint` (repo konvensiyasi: sold_at, cancelled_at,
    // old_product_returned_at). ⚠️ Kodda transformer ULANISHI SHART, aks
    // holda `pg` ularni SATR qaytaradi va `<= Date.now()` leksikografik
    // solishtiriladi.
    await queryRunner.query(`
      ALTER TABLE "order"
        ADD COLUMN IF NOT EXISTS "center_received_at" bigint,
        ADD COLUMN IF NOT EXISTS "center_received_by" uuid,
        ADD COLUMN IF NOT EXISTS "market_handover_at" bigint,
        ADD COLUMN IF NOT EXISTS "market_handover_by" uuid,
        ADD COLUMN IF NOT EXISTS "market_handover_mode" varchar(32),
        ADD COLUMN IF NOT EXISTS "market_handover_session_id" uuid,
        ADD COLUMN IF NOT EXISTS "handover_notified_at" bigint,
        ADD COLUMN IF NOT EXISTS "handover_escalated_at" bigint
    `);

    // ═══════════ 2. Navbat indeksi ═══════════
    //
    // "Markazda — market kutilmoqda" navbati. Hajm o'lchovi: viloyatlarga
    // kuniga ~500 buyurtma chiqadi, ~30% i bekor bo'ladi → kuniga ~150,
    // oyiga ~4 500 qaytarish. Market o'rtacha 3 kun kutsa omborda doimiy
    // ~450 posilka turadi. Indekssiz bu ro'yxat va eskalatsiya cron'i
    // to'liq jadval skani bo'lardi.
    //
    // `user_id` — market (order.user_id = market egasi), `center_received_at`
    // — yosh bo'yicha saralash. `deleted_at IS NULL` ATAYLAB predikatda:
    // soft-delete qilingan buyurtma market navbatida KO'RINMASLIGI kerak
    // (qiyos: IDX_ORDER_MARKET_SETTLEMENT ham shunday).
    //
    // ⚠️ STATUS SHARTI YO'Q. `center_received_at` ni faqat markazga qabul
    // yo'llari yozadi, ya'ni uning o'zi zanjirni belgilaydi. Status qo'shsak
    // almashtirish (kafolat-swap) qatorlari tushib qolardi — ular zanjirdan
    // o'tadi, lekin STATUSI SOTILGAN bo'lib qoladi (puli muzlatilgan).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ORDER_AWAITING_MARKET"
        ON "order" ("user_id", "center_received_at")
      WHERE "deleted_at" IS NULL
        AND "center_received_at" IS NOT NULL
        AND "market_handover_at" IS NULL
    `);

    // ═══════════ 3. canceled_post_id indeksi ═══════════
    //
    // ⚠️ Bu ustunda indeks HOZIRGACHA YO'Q edi (IDX_ORDER_POST_ID bor,
    // canceled_post_id uchun hech narsa yo'q). Har bekor-pochta manifesti
    // (post.service.ts `receiveCanceledPost`, `getRejectedPostsOrders`)
    // to'liq jadval skani qiladi. Yiliga ~180 000 buyurtma qatorida bu
    // sezilarli. Yangi oqim bu so'rovlarni ko'proq ishlatadi.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ORDER_CANCELED_POST_ID"
        ON "order" ("canceled_post_id")
      WHERE "canceled_post_id" IS NOT NULL
    `);

    // ═══════════ 4. users — per-market majburiylik bayrog'i ═══════════
    //
    // `false` = ruxsat QAYD ETILADI, lekin MAJBURLANMAYDI. Ya'ni migratsiya
    // kuni birorta market bloklanmaydi. Market onboarding'dan o'tgach admin
    // uni `true` qiladi (qiyos: extra_cost_proof_required naqshi).
    //
    // Majburiy QILMASLIK ataylab: panelga umuman kirmaydigan marketlar bor
    // (parolsiz akkauntlar, marketplace vakil-akkauntlari). Ular uchun
    // yagona yo'l — offline akt.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "cancel_handover_consent_required"
          boolean NOT NULL DEFAULT false
    `);

    // ═══════════ 4b. post.region_id — NOT NULL ni olib tashlash ═══════════
    //
    // ⚠️ MAVJUD NUQSON, yangi oqim uni ko'proq ochadi.
    //
    // `post.region_id` NOT NULL edi, lekin uni yozuvchi UCH joy ham
    // `courier.region_id` ni beradi:
    //   · post.service.ts  attachOrdersToCanceledPost
    //   · order.service.ts attachReplacementToCanceledPost
    //   · order.service.ts rollback (CANCELLED_SENT shoxi)
    // Tashqi provayderlarning (Elchi) virtual vakil-kuryerida viloyat YO'Q →
    // bekor pochtaga biriktirish NOT NULL violation bilan yiqilardi.
    // Koddagi "optional, faqat qo'shimcha info" izohi yolg'on edi — endi
    // sxema izohga MOS keladi. Iste'molchilar null'ga allaqachon tayyor
    // (region.service.ts: `if (!p.region_id) continue`).
    await queryRunner.query(`
      ALTER TABLE "post" ALTER COLUMN "region_id" DROP NOT NULL
    `);

    // ═══════════ 5. market_return_handover_session ═══════════
    //
    // Market ruxsatining SESSIYASI. Elchi'ning
    // `market_cancelled_handover_sessions` ekvivalenti, lekin oyna
    // mexanikasi BeePost hajmiga moslangan:
    //
    //   · market QR (`MRC-…`)  — 2 daqiqa, keyin eskiradi;
    //   · xodim skan qiladi    — ruxsat (`MRA-…`) 10 DAQIQA;
    //   · oyna ichida PARTIYA-PARTIYA topshirish mumkin (market bir
    //     kelganda 100–200 posilka olib ketadi, 5 daqiqa yetmaydi);
    //   · ruxsat TOPSHIRISH SAHIFASIGA bog'langan — xodim sahifadan chiqsa
    //     `closed` bo'ladi; brauzer qulasa `last_seen_at` (heartbeat)
    //     eskirib sessiya o'ladi.
    //
    // ⚠️ XOM TOKEN SAQLANMAYDI — faqat sha256 hex. Sabab: BeePost'da QR
    // token avtorizatsiya SIRI EMAS (`GET order/qr-code/:token` da
    // `@UseGuards` kommentga olingan va global APP_GUARD yo'q). Shuning
    // uchun ruxsat token + TTL + egalik + bir martalik yopilish bilan
    // himoyalanadi, tokenning o'zi sir bo'lishiga tayanmaydi.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "market_return_handover_session" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "market_id" uuid NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "channel" varchar(16) NOT NULL DEFAULT 'web',
        "qr_token_hash" char(64),
        "pin_hash" char(64),
        "qr_expires_at" bigint,
        "scanned_at" bigint,
        "scanned_by_user_id" uuid,
        "authorization_token_hash" char(64),
        "authorization_expires_at" bigint,
        "last_seen_at" bigint,
        "pin_attempts" smallint NOT NULL DEFAULT 0,
        "handed_over_count" int NOT NULL DEFAULT 0,
        "closed_at" bigint,
        "close_reason" varchar(24),
        "representative_name" varchar(120),
        "representative_phone" varchar(32),
        "override_reason" varchar(200),
        CONSTRAINT "FK_MRH_SESSION_MARKET" FOREIGN KEY ("market_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_MRH_SESSION_SCANNED_BY" FOREIGN KEY ("scanned_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Token hash'lari noyob — ayni token ikki sessiyada bo'lmaydi.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_MRH_SESSION_QR_HASH"
        ON "market_return_handover_session" ("qr_token_hash")
        WHERE "qr_token_hash" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_MRH_SESSION_AUTH_HASH"
        ON "market_return_handover_session" ("authorization_token_hash")
        WHERE "authorization_token_hash" IS NOT NULL
    `);
    // Market o'zining oxirgi sessiyasini qaytadan so'raganda + audit.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MRH_SESSION_MARKET_CREATED"
        ON "market_return_handover_session" ("market_id", "created_at" DESC)
    `);
    // Cron: muddati o'tgan / heartbeat uzilgan sessiyalarni yopish.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MRH_SESSION_OPEN"
        ON "market_return_handover_session" ("status", "authorization_expires_at")
      WHERE "status" <> 'closed'
    `);

    // Topshirilgan buyurtma qaysi sessiya orqali yopilganini ko'rsatadi
    // (audit zanjiri: order → sessiya → market QR → skan qilgan xodim).
    // ⚠️ `ON DELETE SET NULL` — sessiya o'chsa ham buyurtmaning
    // `market_handover_at/by` dalili JOYIDA QOLADI.
    await queryRunner.query(`
      ALTER TABLE "order"
        ADD CONSTRAINT "FK_ORDER_HANDOVER_SESSION"
          FOREIGN KEY ("market_handover_session_id")
          REFERENCES "market_return_handover_session"("id") ON DELETE SET NULL
    `);
  }

  /**
   * Haqiqatan orqaga qaytaradi — enum o'zgartirilmagani uchun hech narsa
   * "yopishib" qolmaydi. Dalil ustunlari o'chganda faqat yangi oqim
   * ma'lumoti yo'qoladi, buyurtmalarning STATUSI esa tegilmagan.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "FK_ORDER_HANDOVER_SESSION"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "market_return_handover_session"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "cancel_handover_consent_required"`,
    );
    // ⚠️ `post.region_id` ga NOT NULL QAYTARILMAYDI: migratsiyadan keyin
    // viloyatsiz bekor pochtalar paydo bo'lgan bo'lsa, tiklash yiqilardi.
    // Ortiqcha nullable ustun hech narsani buzmaydi.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ORDER_CANCELED_POST_ID"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_AWAITING_MARKET"`);
    await queryRunner.query(`
      ALTER TABLE "order"
        DROP COLUMN IF EXISTS "center_received_at",
        DROP COLUMN IF EXISTS "center_received_by",
        DROP COLUMN IF EXISTS "market_handover_at",
        DROP COLUMN IF EXISTS "market_handover_by",
        DROP COLUMN IF EXISTS "market_handover_mode",
        DROP COLUMN IF EXISTS "market_handover_session_id",
        DROP COLUMN IF EXISTS "handover_notified_at",
        DROP COLUMN IF EXISTS "handover_escalated_at"
    `);
  }
}
