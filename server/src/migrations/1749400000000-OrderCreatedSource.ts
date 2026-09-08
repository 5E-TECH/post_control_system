import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Buyurtma yaratilish manbasi (audit/tracking + AI dashboard):
 * order.created_source ('manual' | 'ai' | 'bot'). Eski yozuvlar -> 'manual'.
 * (created_source, created_at) composite indeks — kunlik AI buyurtma sanashi tez.
 */
export class OrderCreatedSource1749400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "created_source" varchar(16) NOT NULL DEFAULT 'manual'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ORDER_SOURCE_CREATED" ON "order" ("created_source", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ORDER_SOURCE_CREATED"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "created_source"`,
    );
  }
}
