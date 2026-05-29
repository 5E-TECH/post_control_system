import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Super kuryer (multi-region) qo'llab-quvvatlash.
 *
 * Hammasi ADDITIVE — mavjud kuryerlar va oqim o'zgarmaydi:
 *  - `users.is_super_courier`  (default false) — oddiy kuryerlar avvalgidek
 *  - `users.serves_all_regions`(default false) — LDG kabi "barcha viloyatlar"
 *  - `courier_regions` jadval  — super kuryerga biriktirilgan viloyatlar va
 *    (ixtiyoriy) per-region tarif. NULL tarif → users.tariff_* (flat) fallback.
 */
export class SuperCourier1746600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_super_courier" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "serves_all_regions" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courier_regions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "courier_id" uuid NOT NULL,
        "region_id" uuid NOT NULL,
        "tariff_home" integer,
        "tariff_center" integer,
        CONSTRAINT "PK_courier_regions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_COURIER_REGION" UNIQUE ("courier_id", "region_id"),
        CONSTRAINT "FK_courier_regions_courier" FOREIGN KEY ("courier_id")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_courier_regions_region" FOREIGN KEY ("region_id")
          REFERENCES "region"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_COURIER_REGION_REGION" ON "courier_regions" ("region_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_COURIER_REGION_COURIER" ON "courier_regions" ("courier_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "courier_regions"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "serves_all_regions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "is_super_courier"`,
    );
  }
}
