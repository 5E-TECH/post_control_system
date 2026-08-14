import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Investor ulush versiyasiga profit_basis ('net' | 'gross') — har investor
 * foydaning qaysi turidan (sof yoki yalpi marja) ulush olishini belgilaydi.
 * Vaqt-tortilgan: har ulush versiyasi o'z basis'iga ega.
 */
export class InvestorOwnershipBasis1748700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "investor_ownership_stake"
        ADD COLUMN IF NOT EXISTS "profit_basis" varchar NOT NULL DEFAULT 'net'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "investor_ownership_stake"
        DROP COLUMN IF EXISTS "profit_basis"
    `);
  }
}
