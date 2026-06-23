import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LDG fon jarayonlarini (webhook qabul, reconcile, auto-retry) admin paneldan
 * yoqib/o'chirib turish uchun bayroqlar. Hammasi default `true` — mavjud
 * xatti-harakat o'zgarmaydi.
 */
export class LdgAutomationFlags1747600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ldg_config"
      ADD COLUMN IF NOT EXISTS "webhook_enabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "reconcile_enabled" boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "auto_retry_enabled" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ldg_config"
      DROP COLUMN IF EXISTS "webhook_enabled",
      DROP COLUMN IF EXISTS "reconcile_enabled",
      DROP COLUMN IF EXISTS "auto_retry_enabled"
    `);
  }
}
