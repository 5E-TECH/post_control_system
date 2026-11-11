-- ══════════════════════════════════════════════════════════════════════
--  CARRIER API — UCHDAN-UCHGA SINOV SEED'I (test/carrier.e2e-spec.ts)
--
--  FAQAT bazaviy ma'lumot: login uchun superadmin, market (+mahsulot),
--  hudud/tuman (HAQIQIY SOATO), mijoz, oddiy kuryer va ikki "yangi"
--  carrier kuryeri. Qolgan HAMMASI (carrier akkaunt, buyurtma, pochta,
--  jo'natish, sotuv, kassa) sinov ichida HTTP orqali yaratiladi.
--
--  ⚠️ FAQAT `pcs_e2e` bazasi uchun — har ishga tushishda TOZALANADI.
--  UUID'lar v4 shaklida: `CreateOrderDto` `@IsUUID(4)` talab qiladi.
-- ══════════════════════════════════════════════════════════════════════
BEGIN;

TRUNCATE TABLE
  carrier_idempotency_key,
  carrier_account,
  activity_logs,
  cashbox_history,
  order_item,
  "order",
  post,
  cash_box,
  courier_regions,
  product,
  users,
  district,
  region
CASCADE;

-- 1726 = Toshkent shahri, 1726266 = Yunusobod tumani (haqiqiy SOATO).
INSERT INTO region (id, created_at, updated_at, name, sato_code) VALUES
  ('c1000000-0000-4000-8000-000000000001', 1, 1, 'Toshkent shahri', '1726');

INSERT INTO district (id, created_at, updated_at, name, region_id, assigned_region, sato_code) VALUES
  ('c1000000-0000-4000-8000-000000000002', 1, 1, 'Yunusobod tumani',
   'c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '1726266');

-- superadmin: HTTP login (parol: e2e-carrier-admin-pass, bcrypt 10).
INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status, password) VALUES
  ('c1000000-0000-4000-8000-000000000003', 1, 1, 'E2E Carrier Admin', '+998900100003', 'superadmin', 'active',
   '$2b$10$E43TrPGlZlJPZWGpLIA.e.u/7B/gm7LOaxL5QJ7rCHo5CpcRctBi6');

-- market: tarif markaz 30 000 / uy 40 000.
INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status, tariff_center, tariff_home, default_tariff, add_order) VALUES
  ('c1000000-0000-4000-8000-000000000004', 1, 1, 'E2E Market', '+998900100004', 'market', 'active', 30000, 40000, 'center', true);

-- mijoz: Yunusobod.
INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status, district_id, address, extra_number) VALUES
  ('c1000000-0000-4000-8000-000000000005', 1, 1, 'E2E Mijoz', '+998900100005', 'customer', 'active',
   'c1000000-0000-4000-8000-000000000002', 'Amir Temur ko''chasi 1', '+998900100055');

-- oddiy (ichki) kuryer — "boshqa kuryerning posilkasi" uchun.
INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status, region_id, tariff_center, tariff_home, default_tariff) VALUES
  ('c1000000-0000-4000-8000-000000000006', 1, 1, 'E2E Ichki Kuryer', '+998900100006', 'courier', 'active',
   'c1000000-0000-4000-8000-000000000001', 20000, 25000, 'center');

-- carrier kuryeri: SUPER kuryer — hudud tarifi (12 000 / 16 000) flat tarifdan
-- (15 000 / 18 000) farq qiladi. `sendPost` muzlatishi ishlaganini shu farq
-- isbotlaydi. Kassa YO'Q — akkaunt yaratilganda o'zi ochiladi.
INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status, region_id, tariff_center, tariff_home, default_tariff, is_super_courier) VALUES
  ('c1000000-0000-4000-8000-000000000007', 1, 1, 'E2E Carrier Kuryer', '+998900100007', 'courier', 'active',
   'c1000000-0000-4000-8000-000000000001', 15000, 18000, 'center', true);

-- ikkinchi carrier kuryeri — limit (429) va o'chirish sinovi uchun alohida akkaunt.
INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status, region_id, tariff_center, tariff_home, default_tariff) VALUES
  ('c1000000-0000-4000-8000-000000000008', 1, 1, 'E2E Carrier Kuryer 2', '+998900100008', 'courier', 'active',
   'c1000000-0000-4000-8000-000000000001', 15000, 18000, 'center');

INSERT INTO courier_regions (id, created_at, updated_at, courier_id, region_id, tariff_center, tariff_home) VALUES
  ('c1000000-0000-4000-8000-000000000009', 1, 1, 'c1000000-0000-4000-8000-000000000007',
   'c1000000-0000-4000-8000-000000000001', 12000, 16000);

INSERT INTO product (id, created_at, updated_at, name, user_id) VALUES
  ('c1000000-0000-4000-8000-000000000011', 1, 1, 'E2E Choynak', 'c1000000-0000-4000-8000-000000000004'),
  ('c1000000-0000-4000-8000-000000000012', 1, 1, 'E2E Piyola',  'c1000000-0000-4000-8000-000000000004');

-- Kassalar: asosiy, market, ichki kuryer (carrier kuryerlarida YO'Q).
INSERT INTO cash_box (id, created_at, updated_at, cashbox_type, user_id, balance, balance_cash, balance_card) VALUES
  ('c1000000-0000-4000-8000-000000000021', 1, 1, 'main',     NULL, 0, 0, 0),
  ('c1000000-0000-4000-8000-000000000022', 1, 1, 'markets',  'c1000000-0000-4000-8000-000000000004', 0, 0, 0),
  ('c1000000-0000-4000-8000-000000000023', 1, 1, 'couriers', 'c1000000-0000-4000-8000-000000000006', 0, 0, 0);

COMMIT;
