import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `order_number` ni HAR QANDAY sharoitda buzilmas qiladi (defense-in-depth).
 *
 * Muammo tarixi: `order_number` ustuni DB DEFAULT `nextval('order_number_seq')`
 * ga tayanadi. Ammo entity'da noto'g'ri bigint-transformer (`undefined -> 0`)
 * ishlatilgani sabab TypeORM ustunni DEFAULT bilan tashlamasdan, har bir
 * INSERT'ga aniq `order_number = 0` yuborardi. Birinchi buyurtma o'tib,
 * keyingilari `IDX_ORDER_NUMBER` unique constraint'ni buzib, butun buyurtma
 * yaratishni ishdan chiqarardi (prodda — kritik).
 *
 * Transformer kodda tuzatildi, ammo bu migration ORM xatti-harakatidan
 * MUSTAQIL ravishda DB darajasida kafolat beradi:
 *
 *  1) Mavjud `order_number = 0` (yoki NULL) qatorlarni sequence'dan yangi
 *     unikal raqam bilan to'g'rilash — prod deploy'da avtomatik davolanish.
 *  2) Sequence'ni jadvaldagi eng katta raqamdan keyinga surish (import/restore
 *     dan keyin desinxronlanib qolishidan himoya).
 *  3) BEFORE INSERT trigger: `order_number` NULL yoki 0 bo'lsa — sequence'dan
 *     to'ldiradi. `order_number` hech qachon qonuniy ravishda 0 emas, shuning
 *     uchun bu xavfsiz. Endi ORM nima yuborishidan qat'i nazar (0/null/yo'q),
 *     DB har doim unikal raqam beradi — duplicate key qayta chiqmaydi.
 */
export class OrderNumberGuard1747200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sequence mavjudligiga ishonch (OrderNumber migration'idan keyin bor, lekin xavfsizlik uchun)
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START WITH 100000 INCREMENT BY 1`,
    );

    // 1) Buzilgan qatorlarni to'g'rilash: order_number = 0 yoki NULL -> yangi sequence raqami.
    //    Avval sequence'ni mavjud max'dan keyinga surib, keyin har bir buzuq qatorga nextval beramiz.
    await queryRunner.query(
      `SELECT setval('order_number_seq', (SELECT GREATEST(COALESCE(MAX("order_number"), 99999), 99999) FROM "order" WHERE "order_number" > 0))`,
    );
    await queryRunner.query(`
      UPDATE "order"
      SET "order_number" = nextval('order_number_seq')
      WHERE "order_number" IS NULL OR "order_number" = 0
    `);

    // 2) Sequence'ni yakuniy max'dan keyinga surish (keyingi nextval = max+1)
    await queryRunner.query(
      `SELECT setval('order_number_seq', (SELECT COALESCE(MAX("order_number"), 99999) FROM "order"))`,
    );

    // 3) Buzilmas himoya — BEFORE INSERT trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION order_number_guard() RETURNS trigger AS $$
      BEGIN
        IF NEW."order_number" IS NULL OR NEW."order_number" = 0 THEN
          NEW."order_number" := nextval('order_number_seq');
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_order_number_guard ON "order"`,
    );
    await queryRunner.query(`
      CREATE TRIGGER trg_order_number_guard
        BEFORE INSERT ON "order"
        FOR EACH ROW EXECUTE FUNCTION order_number_guard()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_order_number_guard ON "order"`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS order_number_guard()`);
  }
}
