import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TOPSHIRILGAN QAYTARISHLAR TARIXI — INDEKSLAR.
 *
 * ── NEGA ────────────────────────────────────────────────────────────────
 *
 * Bekor-qaytarish oqimi endi topshirilgan posilkalarni PARTIYA bo'yicha
 * ko'rsatadi (xuddi «topshirilgan pochta» kabi): har topshirish sessiyasi
 * = bitta partiya, market esa o'z partiyalarini kun bo'yicha ko'radi.
 *
 * Ikkala so'rov ham `order` jadvalining ikki ustuniga tayanadi va
 * ularning IKKALASIDA HAM indeks YO'Q edi:
 *
 *   · `market_handover_session_id` — partiya ichini ochish
 *     (`WHERE market_handover_session_id = $1`) va partiya xulosasini
 *     hisoblash (`GROUP BY`);
 *   · `market_handover_at` — marketning «qaysi kuni nima oldim»
 *     ro'yxati (`WHERE user_id = $1 AND market_handover_at BETWEEN …`).
 *
 * Hajm o'lchovi: kuniga ~150 qaytarish, oyiga ~4 500, yiliga ~54 000
 * topshirilgan qator. Indekssiz har ochilish to'liq jadval skani
 * bo'lardi (`order` da yiliga ~180 000 qator).
 *
 * ── NEGA QISMAN (PARTIAL) ───────────────────────────────────────────────
 *
 * Buyurtmalarning KO'PCHILIGI hech qachon qaytarilmaydi — ikkala ustun
 * ham ularda `NULL`. Qisman indeks faqat zanjirdan o'tgan qatorlarni
 * saqlaydi: hajmi bir necha barobar kichik va `NULL` qatorlarni yozishda
 * umuman yangilanmaydi (qiyos: `IDX_ORDER_AWAITING_MARKET`,
 * `IDX_ORDER_CANCELED_POST_ID` — ayni naqsh).
 *
 * ⚠️ `deleted_at IS NULL` predikatda EMAS — ataylab. Tarix ro'yxati
 * soft-delete qilingan qatorni ham chiqarmaydi, lekin uni SQL'ning o'zi
 * filtrlaydi; predikatga qo'shsak indeks `deleted_at` o'zgarganda qayta
 * yozilardi, foydasi esa sezilarsiz (o'chirilgan qaytarish kam).
 *
 * ⚠️ `CONCURRENTLY` ISHLATILMAYDI: TypeORM migratsiyasi TRANZAKSIYA
 * ichida ishlaydi, `CREATE INDEX CONCURRENTLY` esa tranzaksiyada
 * ishlamaydi. Qisman indeks kichik bo'lgani uchun qulf vaqti qisqa.
 */
export class MarketHandoverHistoryIndexes1750800000000
  implements MigrationInterface
{
  name = 'MarketHandoverHistoryIndexes1750800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════ 1. Partiya ichini ochish / xulosa ═══════════
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ORDER_HANDOVER_SESSION"
        ON "order" ("market_handover_session_id")
      WHERE "market_handover_session_id" IS NOT NULL
    `);

    // ═══════════ 2. Market: «qaysi kuni nima oldim» ═══════════
    //
    // Ustunlar tartibi `(user_id, market_handover_at)`: avval market
    // bo'yicha torayadi, keyin sana oralig'i va saralash AYNI indeksdan
    // o'qiladi (qo'shimcha `ORDER BY` saralashi kerak bo'lmaydi).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ORDER_MARKET_HANDED_AT"
        ON "order" ("user_id", "market_handover_at")
      WHERE "market_handover_at" IS NOT NULL
    `);

    // ═══════════ 3. Sessiya ro'yxati — yopilgan partiyalar ═══════════
    //
    // Mavjud `IDX_MRH_SESSION_MARKET_CREATED` (market_id, created_at)
    // market kesimida yaxshi, LEKIN xodim ekrani BARCHA marketlar
    // bo'yicha oxirgi topshirishlarni sana kamayish tartibida so'raydi.
    // `handed_over_count > 0` — bo'sh/bekor sessiyalar tarixda ko'rinmasin.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MRH_SESSION_CLOSED_AT"
        ON "market_return_handover_session" ("closed_at")
      WHERE "handed_over_count" > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_MRH_SESSION_CLOSED_AT"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ORDER_MARKET_HANDED_AT"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_HANDOVER_SESSION"`);
  }
}
