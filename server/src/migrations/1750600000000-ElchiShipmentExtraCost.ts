import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `elchi_shipment.extra_cost_reported` — Elchi sotuvda yozgan KURYER HAQQI.
 *
 * Asosiy kassaga tegmaydi (marketdan kuryerga), lekin "Elchi bizga qarz"
 * hisob-kitobidan ayirilishi kerak — aks holda har buyurtmada qarz extra_cost
 * miqdoricha OSHIB ko'rinardi (ShM3oBjJ).
 */
export class ElchiShipmentExtraCost1750600000000
  implements MigrationInterface
{
  name = 'ElchiShipmentExtraCost1750600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "elchi_shipment"
         ADD COLUMN IF NOT EXISTS "extra_cost_reported" numeric(14,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "elchi_shipment" DROP COLUMN IF EXISTS "extra_cost_reported"`,
    );
  }
}
