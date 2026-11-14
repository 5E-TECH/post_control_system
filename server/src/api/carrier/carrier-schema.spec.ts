/// <reference types="jest" />
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { QueryRunner, getMetadataArgsStorage } from 'typeorm';
import { CarrierAccountEntity } from 'src/core/entity/carrier-account.entity';
import { CarrierIdempotencyKeyEntity } from 'src/core/entity/carrier-idempotency-key.entity';
import { CarrierRollbackToggle1751100001000 } from 'src/migrations/1751100001000-CarrierRollbackToggle';

/**
 * CARRIER SXEMASI — entity va `1751100000000-CarrierApi` migratsiyasi
 * konstruksiya NOMLARI bo'yicha bir xil.
 *
 * NEGA: real Postgres'dagi e2e (`npm run test:carrier-e2e`) tekshiruvida
 * `createSchemaBuilder().log()` migratsiya qurgan jadvalga qarab
 * `DROP CONSTRAINT "FK_CARRIER_ACCOUNT_COURIER"` + `ADD CONSTRAINT
 * "FK_7c8b…"` taklif qildi: entity FK nomini bermagan, TypeORM esa xesh-nom
 * kutgan. Ya'ni har `migration:generate` bu FK'ni o'chirib qayta qo'shishni
 * yangi migratsiyaga yozib qo'yardi. Nomlar shu yerda qulflanadi.
 */
const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '../../migrations/1751100000000-CarrierApi.ts'),
  'utf8',
);

const storage = getMetadataArgsStorage();
const CARRIER_ENTITIES: unknown[] = [
  CarrierAccountEntity,
  CarrierIdempotencyKeyEntity,
];

describe('Carrier sxemasi — entity va migratsiya nomlari', () => {
  it("⭐ courier FK nomi entity'da berilgan va migratsiyadagi bilan AYNAN bir xil", () => {
    const joinColumn = storage.joinColumns.find(
      (jc) =>
        jc.target === CarrierAccountEntity && jc.propertyName === 'courier',
    );
    expect(joinColumn?.name).toBe('courier_user_id');
    expect(joinColumn?.foreignKeyConstraintName).toBe(
      'FK_CARRIER_ACCOUNT_COURIER',
    );
    expect(MIGRATION).toMatch(
      /CONSTRAINT "FK_CARRIER_ACCOUNT_COURIER" FOREIGN KEY \("courier_user_id"\)\s+REFERENCES "users"\("id"\) ON DELETE RESTRICT/,
    );
  });

  it('FK ON DELETE qoidasi entity va migratsiyada bir xil (RESTRICT)', () => {
    const relation = storage.relations.find(
      (r) => r.target === CarrierAccountEntity && r.propertyName === 'courier',
    );
    expect(relation?.options?.onDelete).toBe('RESTRICT');
  });

  it("entity'dagi har bir indeks migratsiyada AYNI nom bilan yaratiladi", () => {
    const indices = storage.indices.filter((i) =>
      CARRIER_ENTITIES.includes(i.target),
    );
    expect(indices.map((i) => i.name).sort()).toEqual([
      'IDX_CARRIER_ACCOUNT_ACTIVE',
      'IDX_CARRIER_IDEM_ORDER',
      'UQ_CARRIER_ACCOUNT_COURIER',
      'UQ_CARRIER_ACCOUNT_KEY_HASH',
      'UQ_CARRIER_IDEM_ACCOUNT_KEY',
    ]);
    for (const index of indices) {
      const kind = index.unique ? 'CREATE UNIQUE INDEX' : 'CREATE INDEX';
      expect(MIGRATION).toContain(`${kind} IF NOT EXISTS "${index.name}"`);
    }
  });

  it("qisman noyob indeks sharti (is_deleted = false) entity'da ham, migratsiyada ham", () => {
    const partial = storage.indices.find(
      (i) => i.name === 'UQ_CARRIER_ACCOUNT_COURIER',
    );
    expect(partial?.where).toBe('"is_deleted" = false');
    expect(MIGRATION).toMatch(
      /"UQ_CARRIER_ACCOUNT_COURIER"\s+ON "carrier_account" \("courier_user_id"\)\s+WHERE "is_deleted" = false/,
    );
  });
});

describe('1751100001000-CarrierRollbackToggle — yashirin rollback ustuni', () => {
  const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
  const FILE = '1751100001000-CarrierRollbackToggle.ts';

  /** `QueryRunner.query` ni yozib boradigan soxta — SQL matni bo'yicha tekshiriladi. */
  const recorder = () => {
    const sql: string[] = [];
    const runner = {
      query: jest.fn((text: string) => {
        sql.push(text.replace(/\s+/g, ' ').trim());
        return Promise.resolve([]);
      }),
    };
    return { sql, runner: runner as unknown as QueryRunner };
  };

  it('⭐ up: NOT NULL DEFAULT false — mavjud qatorlar ham o‘chiq; idempotent', async () => {
    const { sql, runner } = recorder();
    await new CarrierRollbackToggle1751100001000().up(runner);
    expect(sql).toEqual([
      'ALTER TABLE "carrier_account" ADD COLUMN IF NOT EXISTS "rollback_enabled" boolean NOT NULL DEFAULT false',
    ]);
  });

  it('down: ustun olib tashlanadi (IF EXISTS)', async () => {
    const { sql, runner } = recorder();
    await new CarrierRollbackToggle1751100001000().down(runner);
    expect(sql).toEqual([
      'ALTER TABLE "carrier_account" DROP COLUMN IF EXISTS "rollback_enabled"',
    ]);
  });

  it('entity ustuni migratsiya bilan bir xil: boolean, sukut false, NOT NULL', () => {
    const column = storage.columns.find(
      (c) =>
        c.target === CarrierAccountEntity &&
        c.propertyName === 'rollback_enabled',
    );
    expect(column?.options).toMatchObject({ type: 'boolean', default: false });
    expect(column?.options.nullable).not.toBe(true);
  });

  it('nom va vaqt tamg‘asi: klass nomi = name, jadvalni yaratgan CarrierApi dan KEYIN', () => {
    const migration = new CarrierRollbackToggle1751100001000();
    expect(migration.name).toBe('CarrierRollbackToggle1751100001000');
    expect(fs.existsSync(path.join(MIGRATIONS_DIR, FILE))).toBe(true);
    expect(Number(FILE.split('-')[0])).toBeGreaterThan(1751100000000);
  });
});
