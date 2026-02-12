/**
 * DrawSQL Diagram Generator
 *
 * Bu skript loyihadagi TypeORM entity'larni o'qib,
 * DrawSQL ga import qilish uchun PostgreSQL DDL SQL generatsiya qiladi.
 *
 * Ishlatish:
 *   npx ts-node scripts/generate-drawsql.ts
 *
 * Natija: scripts/drawsql-schema.sql fayli yaratiladi
 * DrawSQL da: Import → Paste SQL → natija faylni paste qiling
 */

import * as fs from 'fs';
import * as path from 'path';

// ============ ENUM DEFINITIONS ============

const enums: Record<string, string[]> = {
  roles: ['superadmin', 'admin', 'courier', 'registrator', 'market', 'customer', 'operator'],
  status: ['active', 'inactive'],
  payment_method: ['cash', 'click', 'click_to_market'],
  operation_type: ['income', 'expense'],
  source_type: [
    'courier_payment', 'market_payment', 'manual_expense', 'manual_income',
    'correction', 'salary', 'sell', 'cancel', 'extra_cost', 'bills',
  ],
  order_status: [
    'created', 'new', 'received', 'on the road', 'waiting',
    'sold', 'cancelled', 'paid', 'partly_paid', 'cancelled (sent)', 'closed',
  ],
  cashbox_type: ['main', 'couriers', 'markets'],
  where_deliver: ['center', 'address'],
  post_status: ['new', 'sent', 'received', 'canceled', 'canceled_received'],
  shift_status: ['open', 'closed'],
  group_type: ['cancel', 'create'],
};

// ============ TABLE DEFINITIONS ============

interface Column {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  unique?: boolean;
  primaryKey?: boolean;
}

interface ForeignKey {
  column: string;
  refTable: string;
  refColumn: string;
  onDelete?: string;
}

interface Table {
  name: string;
  columns: Column[];
  foreignKeys: ForeignKey[];
}

const tables: Table[] = [
  // ===== 1. REGION =====
  {
    name: 'region',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'name', type: 'varchar(255)' },
      { name: 'sato_code', type: 'varchar(255)', nullable: true, unique: true },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [],
  },

  // ===== 2. DISTRICT =====
  {
    name: 'district',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'name', type: 'varchar(255)' },
      { name: 'sato_code', type: 'varchar(255)', nullable: true, unique: true },
      { name: 'region_id', type: 'uuid' },
      { name: 'assigned_region', type: 'uuid', nullable: true },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'region_id', refTable: 'region', refColumn: 'id', onDelete: 'CASCADE' },
      { column: 'assigned_region', refTable: 'region', refColumn: 'id', onDelete: 'CASCADE' },
    ],
  },

  // ===== 3. USERS =====
  {
    name: 'users',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'name', type: 'varchar(255)' },
      { name: 'phone_number', type: 'varchar(255)' },
      { name: 'password', type: 'varchar(255)', nullable: true },
      { name: 'region_id', type: 'uuid', nullable: true },
      { name: 'district_id', type: 'uuid', nullable: true },
      { name: 'tariff_home', type: 'integer', nullable: true },
      { name: 'tariff_center', type: 'integer', nullable: true },
      { name: 'status', type: 'status', default: "'active'" },
      { name: 'role', type: 'roles' },
      { name: 'add_order', type: 'boolean', nullable: true, default: 'false' },
      { name: 'market_tg_token', type: 'varchar(255)', nullable: true },
      { name: 'address', type: 'varchar(255)', nullable: true },
      { name: 'extra_number', type: 'varchar(255)', nullable: true },
      { name: 'market_id', type: 'uuid', nullable: true },
      { name: 'telegram_id', type: 'bigint', nullable: true },
      { name: 'avatar_id', type: 'varchar(255)', nullable: true },
      { name: 'is_deleted', type: 'boolean', default: 'false' },
      { name: 'default_tariff', type: 'where_deliver', default: "'center'" },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'region_id', refTable: 'region', refColumn: 'id', onDelete: 'SET NULL' },
      { column: 'district_id', refTable: 'district', refColumn: 'id', onDelete: 'SET NULL' },
      { column: 'market_id', refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
    ],
  },

  // ===== 4. POST =====
  {
    name: 'post',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'courier_id', type: 'uuid', nullable: true },
      { name: 'post_total_price', type: 'decimal', default: '0' },
      { name: 'order_quantity', type: 'smallint', default: '0' },
      { name: 'qr_code_token', type: 'varchar(255)' },
      { name: 'region_id', type: 'uuid' },
      { name: 'status', type: 'post_status', default: "'new'" },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'courier_id', refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
      { column: 'region_id', refTable: 'region', refColumn: 'id', onDelete: 'CASCADE' },
    ],
  },

  // ===== 5. PRODUCT =====
  {
    name: 'product',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'name', type: 'varchar(255)' },
      { name: 'user_id', type: 'uuid' },
      { name: 'image_url', type: 'varchar(255)', nullable: true },
      { name: 'isDeleted', type: 'boolean', default: 'false' },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'user_id', refTable: 'users', refColumn: 'id', onDelete: 'CASCADE' },
    ],
  },

  // ===== 6. ORDER =====
  {
    name: '"order"',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'user_id', type: 'uuid' },
      { name: 'customer_id', type: 'uuid' },
      { name: 'product_quantity', type: 'integer', default: '0' },
      { name: 'where_deliver', type: 'where_deliver', default: "'center'" },
      { name: 'total_price', type: 'float' },
      { name: 'to_be_paid', type: 'integer', default: '0' },
      { name: 'paid_amount', type: 'integer', default: '0' },
      { name: 'status', type: 'order_status' },
      { name: 'comment', type: 'text', nullable: true },
      { name: 'operator', type: 'text', nullable: true },
      { name: 'post_id', type: 'uuid', nullable: true },
      { name: 'canceled_post_id', type: 'uuid', nullable: true },
      { name: 'qr_code_token', type: 'varchar(255)' },
      { name: 'parent_order_id', type: 'uuid', nullable: true },
      { name: 'district_id', type: 'uuid', nullable: true },
      { name: 'address', type: 'text', nullable: true },
      { name: 'sold_at', type: 'bigint', nullable: true },
      { name: 'market_tariff', type: 'integer', nullable: true },
      { name: 'courier_tariff', type: 'integer', nullable: true },
      { name: 'deleted', type: 'boolean', default: 'false' },
      { name: 'create_bot_messages', type: 'jsonb', nullable: true },
      { name: 'external_id', type: 'varchar(255)', nullable: true },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'user_id', refTable: 'users', refColumn: 'id', onDelete: 'CASCADE' },
      { column: 'customer_id', refTable: 'users', refColumn: 'id', onDelete: 'CASCADE' },
      { column: 'post_id', refTable: 'post', refColumn: 'id', onDelete: 'SET NULL' },
      { column: 'district_id', refTable: 'district', refColumn: 'id', onDelete: 'SET NULL' },
    ],
  },

  // ===== 7. ORDER_ITEM =====
  {
    name: 'order_item',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'orderId', type: 'uuid' },
      { name: 'productId', type: 'uuid' },
      { name: 'quantity', type: 'integer' },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'orderId', refTable: '"order"', refColumn: 'id', onDelete: 'CASCADE' },
      { column: 'productId', refTable: 'product', refColumn: 'id' },
    ],
  },

  // ===== 8. CASH_BOX =====
  {
    name: 'cash_box',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'balance', type: 'integer', default: '0' },
      { name: 'balance_cash', type: 'integer', default: '0' },
      { name: 'balance_card', type: 'integer', default: '0' },
      { name: 'cashbox_type', type: 'cashbox_type' },
      { name: 'user_id', type: 'uuid', nullable: true },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'user_id', refTable: 'users', refColumn: 'id', onDelete: 'CASCADE' },
    ],
  },

  // ===== 9. CASHBOX_HISTORY =====
  {
    name: 'cashbox_history',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'operation_type', type: 'operation_type' },
      { name: 'cashbox_id', type: 'uuid' },
      { name: 'source_type', type: 'source_type' },
      { name: 'source_id', type: 'uuid', nullable: true },
      { name: 'source_user_id', type: 'uuid', nullable: true },
      { name: 'amount', type: 'integer' },
      { name: 'balance_after', type: 'integer' },
      { name: 'payment_method', type: 'payment_method', nullable: true },
      { name: 'comment', type: 'varchar(255)', nullable: true },
      { name: 'created_by', type: 'uuid' },
      { name: 'payment_date', type: 'date', nullable: true },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'cashbox_id', refTable: 'cash_box', refColumn: 'id', onDelete: 'CASCADE' },
      { column: 'created_by', refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
      { column: 'source_id', refTable: '"order"', refColumn: 'id', onDelete: 'SET NULL' },
      { column: 'source_user_id', refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
    ],
  },

  // ===== 10. USER_SALARY =====
  {
    name: 'user_salary',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'user_id', type: 'uuid' },
      { name: 'salary_amount', type: 'integer' },
      { name: 'have_to_pay', type: 'integer' },
      { name: 'payment_day', type: 'integer' },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'user_id', refTable: 'users', refColumn: 'id' },
    ],
  },

  // ===== 11. SHIFTS =====
  {
    name: 'shifts',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'opened_by', type: 'uuid' },
      { name: 'closed_by', type: 'uuid', nullable: true },
      { name: 'opened_at', type: 'bigint' },
      { name: 'closed_at', type: 'bigint', nullable: true },
      { name: 'status', type: 'shift_status', default: "'open'" },
      { name: 'opening_balance_cash', type: 'integer', default: '0' },
      { name: 'opening_balance_card', type: 'integer', default: '0' },
      { name: 'closing_balance_cash', type: 'integer', default: '0' },
      { name: 'closing_balance_card', type: 'integer', default: '0' },
      { name: 'total_income_cash', type: 'integer', default: '0' },
      { name: 'total_income_card', type: 'integer', default: '0' },
      { name: 'total_expense_cash', type: 'integer', default: '0' },
      { name: 'total_expense_card', type: 'integer', default: '0' },
      { name: 'comment', type: 'text', nullable: true },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'opened_by', refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
      { column: 'closed_by', refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
    ],
  },

  // ===== 12. CUSTOMER_MARKET =====
  {
    name: 'customer_market',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'customer_id', type: 'uuid' },
      { name: 'market_id', type: 'uuid' },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'customer_id', refTable: 'users', refColumn: 'id', onDelete: 'CASCADE' },
      { column: 'market_id', refTable: 'users', refColumn: 'id', onDelete: 'CASCADE' },
    ],
  },

  // ===== 13. TELEGRAM_MARKET =====
  {
    name: 'telegram_market',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'market_id', type: 'uuid' },
      { name: 'group_id', type: 'varchar(255)' },
      { name: 'group_type', type: 'group_type', nullable: true },
      { name: 'token', type: 'varchar(255)' },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'market_id', refTable: 'users', refColumn: 'id' },
    ],
  },

  // ===== 14. EXTERNAL_INTEGRATION =====
  {
    name: 'external_integration',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'name', type: 'varchar(100)' },
      { name: 'slug', type: 'varchar(50)', unique: true },
      { name: 'api_url', type: 'varchar(255)' },
      { name: 'api_key', type: 'varchar(255)', nullable: true },
      { name: 'api_secret', type: 'varchar(255)', nullable: true },
      { name: 'auth_type', type: 'varchar(20)', default: "'api_key'" },
      { name: 'auth_url', type: 'varchar(255)', nullable: true },
      { name: 'username', type: 'varchar(255)', nullable: true },
      { name: 'password', type: 'varchar(255)', nullable: true },
      { name: 'market_id', type: 'uuid' },
      { name: 'is_active', type: 'boolean', default: 'true' },
      { name: 'field_mapping', type: 'jsonb' },
      { name: 'status_mapping', type: 'jsonb' },
      { name: 'status_sync_config', type: 'jsonb' },
      { name: 'last_sync_at', type: 'bigint', nullable: true },
      { name: 'total_synced_orders', type: 'integer', default: '0' },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'market_id', refTable: 'users', refColumn: 'id', onDelete: 'CASCADE' },
    ],
  },

  // ===== 15. INTEGRATION_SYNC_QUEUE =====
  {
    name: 'integration_sync_queue',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'order_id', type: 'uuid' },
      { name: 'integration_id', type: 'uuid' },
      { name: 'action', type: 'varchar(20)' },
      { name: 'old_status', type: 'varchar(50)', nullable: true },
      { name: 'new_status', type: 'varchar(50)' },
      { name: 'external_status', type: 'varchar(50)', nullable: true },
      { name: 'payload', type: 'jsonb', nullable: true },
      { name: 'status', type: 'varchar(20)', default: "'pending'" },
      { name: 'attempts', type: 'integer', default: '0' },
      { name: 'max_attempts', type: 'integer', default: '3' },
      { name: 'last_error', type: 'text', nullable: true },
      { name: 'last_response', type: 'jsonb', nullable: true },
      { name: 'next_retry_at', type: 'bigint', nullable: true },
      { name: 'synced_at', type: 'bigint', nullable: true },
      { name: 'external_order_id', type: 'varchar(255)', nullable: true },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'integration_id', refTable: 'external_integration', refColumn: 'id', onDelete: 'CASCADE' },
      { column: 'order_id', refTable: '"order"', refColumn: 'id', onDelete: 'CASCADE' },
    ],
  },

  // ===== 16. INTEGRATION_SYNC_HISTORY =====
  {
    name: 'integration_sync_history',
    columns: [
      { name: 'id', type: 'uuid', primaryKey: true },
      { name: 'integration_id', type: 'uuid' },
      { name: 'integration_name', type: 'varchar(100)' },
      { name: 'synced_orders', type: 'integer', default: '0' },
      { name: 'sync_date', type: 'bigint' },
      { name: 'created_at', type: 'bigint' },
      { name: 'updated_at', type: 'bigint' },
    ],
    foreignKeys: [
      { column: 'integration_id', refTable: 'external_integration', refColumn: 'id', onDelete: 'CASCADE' },
    ],
  },
];

// ============ SQL GENERATION ============

function generateSQL(): string {
  const lines: string[] = [];

  // Header
  lines.push('-- ============================================');
  lines.push('-- Post Control System - Database Schema');
  lines.push('-- DrawSQL Import uchun avtomatik generatsiya');
  lines.push(`-- Generatsiya sanasi: ${new Date().toISOString().split('T')[0]}`);
  lines.push('-- ============================================');
  lines.push('');

  // Drop existing types and tables (for clean import)
  lines.push('-- Eski jadvallarni o\'chirish (agar mavjud bo\'lsa)');
  const reversedTables = [...tables].reverse();
  for (const table of reversedTables) {
    lines.push(`DROP TABLE IF EXISTS ${table.name} CASCADE;`);
  }
  lines.push('');

  // Create ENUM types
  lines.push('-- ============ ENUM TURLAR ============');
  for (const [enumName, values] of Object.entries(enums)) {
    lines.push(`DROP TYPE IF EXISTS ${enumName} CASCADE;`);
    const vals = values.map((v) => `'${v}'`).join(', ');
    lines.push(`CREATE TYPE ${enumName} AS ENUM (${vals});`);
    lines.push('');
  }

  // Create tables
  lines.push('-- ============ JADVALLAR ============');
  lines.push('');

  for (const table of tables) {
    lines.push(`-- ${table.name.replace(/"/g, '').toUpperCase()} jadvali`);
    lines.push(`CREATE TABLE ${table.name} (`);

    const colDefs: string[] = [];

    for (const col of table.columns) {
      let def = `  ${col.name} ${col.type}`;
      if (col.primaryKey) {
        def += ' PRIMARY KEY DEFAULT gen_random_uuid()';
      }
      if (col.unique) {
        def += ' UNIQUE';
      }
      if (!col.nullable && !col.primaryKey) {
        def += ' NOT NULL';
      }
      if (col.nullable) {
        def += ' NULL';
      }
      if (col.default !== undefined) {
        def += ` DEFAULT ${col.default}`;
      }
      colDefs.push(def);
    }

    lines.push(colDefs.join(',\n'));
    lines.push(');');
    lines.push('');
  }

  // Create foreign keys (separate ALTER TABLE statements for DrawSQL compatibility)
  lines.push('-- ============ FOREIGN KEY ALOQALAR ============');
  lines.push('');

  let fkCounter = 1;
  for (const table of tables) {
    for (const fk of table.foreignKeys) {
      const fkName = `fk_${table.name.replace(/"/g, '')}_${fk.column}_${fkCounter}`;
      lines.push(
        `ALTER TABLE ${table.name} ADD CONSTRAINT ${fkName} ` +
        `FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn})` +
        (fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '') +
        ';',
      );
      fkCounter++;
    }
  }

  lines.push('');
  lines.push('-- ============ TAYYOR! ============');
  lines.push('-- Bu SQL ni DrawSQL da import qiling:');
  lines.push('-- 1. drawsql.app ga kiring');
  lines.push('-- 2. "Create New Diagram" bosing');
  lines.push('-- 3. Database: PostgreSQL tanlang');
  lines.push('-- 4. "Import" tugmasini bosing');
  lines.push('-- 5. Ushbu SQL ni paste qiling');
  lines.push('-- 6. "Import" bosing - diagramma avtomatik chiziladi!');

  return lines.join('\n');
}

// ============ MAIN ============

const sql = generateSQL();
const outputPath = path.join(__dirname, 'drawsql-schema.sql');
fs.writeFileSync(outputPath, sql, 'utf-8');

console.log('✅ DrawSQL schema muvaffaqiyatli generatsiya qilindi!');
console.log(`📁 Fayl: ${outputPath}`);
console.log('');
console.log('📊 Statistika:');
console.log(`   - Jadvallar soni: ${tables.length}`);
console.log(`   - ENUM turlar soni: ${Object.keys(enums).length}`);

const totalFKs = tables.reduce((sum, t) => sum + t.foreignKeys.length, 0);
console.log(`   - Foreign Key aloqalar: ${totalFKs}`);

const totalCols = tables.reduce((sum, t) => sum + t.columns.length, 0);
console.log(`   - Jami ustunlar: ${totalCols}`);

console.log('');
console.log('🔗 DrawSQL da import qilish:');
console.log('   1. drawsql.app → Create Diagram → PostgreSQL');
console.log('   2. Import → Paste SQL');
console.log(`   3. ${outputPath} faylini paste qiling`);
