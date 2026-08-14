import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foyda-asosi (net/gross) o'zgarishi uchun TASDIQLASH so'rovi jadvali.
 * Admin taklif qiladi → investor tasdiqlaydi. Har investorda bitta kutayotgan
 * so'rov (investor_id unique).
 */
export class InvestorBasisRequest1748900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investor_basis_request" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" bigint NOT NULL,
        "updated_at" bigint NOT NULL,
        "investor_id" uuid NOT NULL,
        "requested_basis" varchar NOT NULL,
        "requested_by" uuid,
        CONSTRAINT "PK_investor_basis_request" PRIMARY KEY ("id"),
        CONSTRAINT "FK_IBR_INVESTOR" FOREIGN KEY ("investor_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_IBR_INVESTOR" ON "investor_basis_request" ("investor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "investor_basis_request"`);
  }
}
