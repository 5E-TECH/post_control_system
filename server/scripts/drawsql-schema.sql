-- ============================================
-- Post Control System - Database Schema
-- DrawSQL Import uchun avtomatik generatsiya
-- Generatsiya sanasi: 2026-02-11
-- ============================================

-- Eski jadvallarni o'chirish (agar mavjud bo'lsa)
DROP TABLE IF EXISTS integration_sync_history CASCADE;
DROP TABLE IF EXISTS integration_sync_queue CASCADE;
DROP TABLE IF EXISTS external_integration CASCADE;
DROP TABLE IF EXISTS telegram_market CASCADE;
DROP TABLE IF EXISTS customer_market CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS user_salary CASCADE;
DROP TABLE IF EXISTS cashbox_history CASCADE;
DROP TABLE IF EXISTS cash_box CASCADE;
DROP TABLE IF EXISTS order_item CASCADE;
DROP TABLE IF EXISTS "order" CASCADE;
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS post CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS district CASCADE;
DROP TABLE IF EXISTS region CASCADE;

-- ============ ENUM TURLAR ============
DROP TYPE IF EXISTS roles CASCADE;
CREATE TYPE roles AS ENUM ('superadmin', 'admin', 'courier', 'registrator', 'market', 'customer', 'operator');

DROP TYPE IF EXISTS status CASCADE;
CREATE TYPE status AS ENUM ('active', 'inactive');

DROP TYPE IF EXISTS payment_method CASCADE;
CREATE TYPE payment_method AS ENUM ('cash', 'click', 'click_to_market');

DROP TYPE IF EXISTS operation_type CASCADE;
CREATE TYPE operation_type AS ENUM ('income', 'expense');

DROP TYPE IF EXISTS source_type CASCADE;
CREATE TYPE source_type AS ENUM ('courier_payment', 'market_payment', 'manual_expense', 'manual_income', 'correction', 'salary', 'sell', 'cancel', 'extra_cost', 'bills');

DROP TYPE IF EXISTS order_status CASCADE;
CREATE TYPE order_status AS ENUM ('created', 'new', 'received', 'on the road', 'waiting', 'sold', 'cancelled', 'paid', 'partly_paid', 'cancelled (sent)', 'closed');

DROP TYPE IF EXISTS cashbox_type CASCADE;
CREATE TYPE cashbox_type AS ENUM ('main', 'couriers', 'markets');

DROP TYPE IF EXISTS where_deliver CASCADE;
CREATE TYPE where_deliver AS ENUM ('center', 'address');

DROP TYPE IF EXISTS post_status CASCADE;
CREATE TYPE post_status AS ENUM ('new', 'sent', 'received', 'canceled', 'canceled_received');

DROP TYPE IF EXISTS shift_status CASCADE;
CREATE TYPE shift_status AS ENUM ('open', 'closed');

DROP TYPE IF EXISTS group_type CASCADE;
CREATE TYPE group_type AS ENUM ('cancel', 'create');

-- ============ JADVALLAR ============

-- REGION jadvali
CREATE TABLE region (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  sato_code varchar(255) UNIQUE NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- DISTRICT jadvali
CREATE TABLE district (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  sato_code varchar(255) UNIQUE NULL,
  region_id uuid NOT NULL,
  assigned_region uuid NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- USERS jadvali
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  phone_number varchar(255) NOT NULL,
  password varchar(255) NULL,
  region_id uuid NULL,
  district_id uuid NULL,
  tariff_home integer NULL,
  tariff_center integer NULL,
  status status NOT NULL DEFAULT 'active',
  role roles NOT NULL,
  add_order boolean NULL DEFAULT false,
  market_tg_token varchar(255) NULL,
  address varchar(255) NULL,
  extra_number varchar(255) NULL,
  market_id uuid NULL,
  telegram_id bigint NULL,
  avatar_id varchar(255) NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  default_tariff where_deliver NOT NULL DEFAULT 'center',
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- POST jadvali
CREATE TABLE post (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NULL,
  post_total_price decimal NOT NULL DEFAULT 0,
  order_quantity smallint NOT NULL DEFAULT 0,
  qr_code_token varchar(255) NOT NULL,
  region_id uuid NOT NULL,
  status post_status NOT NULL DEFAULT 'new',
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- PRODUCT jadvali
CREATE TABLE product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  user_id uuid NOT NULL,
  image_url varchar(255) NULL,
  isDeleted boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- ORDER jadvali
CREATE TABLE "order" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  product_quantity integer NOT NULL DEFAULT 0,
  where_deliver where_deliver NOT NULL DEFAULT 'center',
  total_price float NOT NULL,
  to_be_paid integer NOT NULL DEFAULT 0,
  paid_amount integer NOT NULL DEFAULT 0,
  status order_status NOT NULL,
  comment text NULL,
  operator text NULL,
  post_id uuid NULL,
  canceled_post_id uuid NULL,
  qr_code_token varchar(255) NOT NULL,
  parent_order_id uuid NULL,
  district_id uuid NULL,
  address text NULL,
  sold_at bigint NULL,
  market_tariff integer NULL,
  courier_tariff integer NULL,
  deleted boolean NOT NULL DEFAULT false,
  create_bot_messages jsonb NULL,
  external_id varchar(255) NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- ORDER_ITEM jadvali
CREATE TABLE order_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orderId uuid NOT NULL,
  productId uuid NOT NULL,
  quantity integer NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- CASH_BOX jadvali
CREATE TABLE cash_box (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance integer NOT NULL DEFAULT 0,
  balance_cash integer NOT NULL DEFAULT 0,
  balance_card integer NOT NULL DEFAULT 0,
  cashbox_type cashbox_type NOT NULL,
  user_id uuid NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- CASHBOX_HISTORY jadvali
CREATE TABLE cashbox_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type operation_type NOT NULL,
  cashbox_id uuid NOT NULL,
  source_type source_type NOT NULL,
  source_id uuid NULL,
  source_user_id uuid NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  payment_method payment_method NULL,
  comment varchar(255) NULL,
  created_by uuid NOT NULL,
  payment_date date NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- USER_SALARY jadvali
CREATE TABLE user_salary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  salary_amount integer NOT NULL,
  have_to_pay integer NOT NULL,
  payment_day integer NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- SHIFTS jadvali
CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid NOT NULL,
  closed_by uuid NULL,
  opened_at bigint NOT NULL,
  closed_at bigint NULL,
  status shift_status NOT NULL DEFAULT 'open',
  opening_balance_cash integer NOT NULL DEFAULT 0,
  opening_balance_card integer NOT NULL DEFAULT 0,
  closing_balance_cash integer NOT NULL DEFAULT 0,
  closing_balance_card integer NOT NULL DEFAULT 0,
  total_income_cash integer NOT NULL DEFAULT 0,
  total_income_card integer NOT NULL DEFAULT 0,
  total_expense_cash integer NOT NULL DEFAULT 0,
  total_expense_card integer NOT NULL DEFAULT 0,
  comment text NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- CUSTOMER_MARKET jadvali
CREATE TABLE customer_market (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  market_id uuid NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- TELEGRAM_MARKET jadvali
CREATE TABLE telegram_market (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL,
  group_id varchar(255) NOT NULL,
  group_type group_type NULL,
  token varchar(255) NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- EXTERNAL_INTEGRATION jadvali
CREATE TABLE external_integration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  slug varchar(50) UNIQUE NOT NULL,
  api_url varchar(255) NOT NULL,
  api_key varchar(255) NULL,
  api_secret varchar(255) NULL,
  auth_type varchar(20) NOT NULL DEFAULT 'api_key',
  auth_url varchar(255) NULL,
  username varchar(255) NULL,
  password varchar(255) NULL,
  market_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  field_mapping jsonb NOT NULL,
  status_mapping jsonb NOT NULL,
  status_sync_config jsonb NOT NULL,
  last_sync_at bigint NULL,
  total_synced_orders integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- INTEGRATION_SYNC_QUEUE jadvali
CREATE TABLE integration_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  integration_id uuid NOT NULL,
  action varchar(20) NOT NULL,
  old_status varchar(50) NULL,
  new_status varchar(50) NOT NULL,
  external_status varchar(50) NULL,
  payload jsonb NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text NULL,
  last_response jsonb NULL,
  next_retry_at bigint NULL,
  synced_at bigint NULL,
  external_order_id varchar(255) NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- INTEGRATION_SYNC_HISTORY jadvali
CREATE TABLE integration_sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL,
  integration_name varchar(100) NOT NULL,
  synced_orders integer NOT NULL DEFAULT 0,
  sync_date bigint NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

-- ============ FOREIGN KEY ALOQALAR ============

ALTER TABLE district ADD CONSTRAINT fk_district_region_id_1 FOREIGN KEY (region_id) REFERENCES region(id) ON DELETE CASCADE;
ALTER TABLE district ADD CONSTRAINT fk_district_assigned_region_2 FOREIGN KEY (assigned_region) REFERENCES region(id) ON DELETE CASCADE;
ALTER TABLE users ADD CONSTRAINT fk_users_region_id_3 FOREIGN KEY (region_id) REFERENCES region(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_district_id_4 FOREIGN KEY (district_id) REFERENCES district(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_market_id_5 FOREIGN KEY (market_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE post ADD CONSTRAINT fk_post_courier_id_6 FOREIGN KEY (courier_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE post ADD CONSTRAINT fk_post_region_id_7 FOREIGN KEY (region_id) REFERENCES region(id) ON DELETE CASCADE;
ALTER TABLE product ADD CONSTRAINT fk_product_user_id_8 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "order" ADD CONSTRAINT fk_order_user_id_9 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "order" ADD CONSTRAINT fk_order_customer_id_10 FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "order" ADD CONSTRAINT fk_order_post_id_11 FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE SET NULL;
ALTER TABLE "order" ADD CONSTRAINT fk_order_district_id_12 FOREIGN KEY (district_id) REFERENCES district(id) ON DELETE SET NULL;
ALTER TABLE order_item ADD CONSTRAINT fk_order_item_orderId_13 FOREIGN KEY (orderId) REFERENCES "order"(id) ON DELETE CASCADE;
ALTER TABLE order_item ADD CONSTRAINT fk_order_item_productId_14 FOREIGN KEY (productId) REFERENCES product(id);
ALTER TABLE cash_box ADD CONSTRAINT fk_cash_box_user_id_15 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE cashbox_history ADD CONSTRAINT fk_cashbox_history_cashbox_id_16 FOREIGN KEY (cashbox_id) REFERENCES cash_box(id) ON DELETE CASCADE;
ALTER TABLE cashbox_history ADD CONSTRAINT fk_cashbox_history_created_by_17 FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cashbox_history ADD CONSTRAINT fk_cashbox_history_source_id_18 FOREIGN KEY (source_id) REFERENCES "order"(id) ON DELETE SET NULL;
ALTER TABLE cashbox_history ADD CONSTRAINT fk_cashbox_history_source_user_id_19 FOREIGN KEY (source_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE user_salary ADD CONSTRAINT fk_user_salary_user_id_20 FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE shifts ADD CONSTRAINT fk_shifts_opened_by_21 FOREIGN KEY (opened_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD CONSTRAINT fk_shifts_closed_by_22 FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE customer_market ADD CONSTRAINT fk_customer_market_customer_id_23 FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE customer_market ADD CONSTRAINT fk_customer_market_market_id_24 FOREIGN KEY (market_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE telegram_market ADD CONSTRAINT fk_telegram_market_market_id_25 FOREIGN KEY (market_id) REFERENCES users(id);
ALTER TABLE external_integration ADD CONSTRAINT fk_external_integration_market_id_26 FOREIGN KEY (market_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE integration_sync_queue ADD CONSTRAINT fk_integration_sync_queue_integration_id_27 FOREIGN KEY (integration_id) REFERENCES external_integration(id) ON DELETE CASCADE;
ALTER TABLE integration_sync_queue ADD CONSTRAINT fk_integration_sync_queue_order_id_28 FOREIGN KEY (order_id) REFERENCES "order"(id) ON DELETE CASCADE;
ALTER TABLE integration_sync_history ADD CONSTRAINT fk_integration_sync_history_integration_id_29 FOREIGN KEY (integration_id) REFERENCES external_integration(id) ON DELETE CASCADE;

-- ============ TAYYOR! ============
-- Bu SQL ni DrawSQL da import qiling:
-- 1. drawsql.app ga kiring
-- 2. "Create New Diagram" bosing
-- 3. Database: PostgreSQL tanlang
-- 4. "Import" tugmasini bosing
-- 5. Ushbu SQL ni paste qiling
-- 6. "Import" bosing - diagramma avtomatik chiziladi!