-- E2E SEED — barqaror UUID'lar, testdan qayta-qayta ishlatiladi.
BEGIN;

-- Tozalash (qayta ishga tushirish uchun)
TRUNCATE TABLE marketplace_outbox, marketplace_ledger_entry, marketplace_settlement,
               marketplace_parcel, marketplace_scan_session, marketplace_seller,
               marketplace_tariff, marketplace_integration CASCADE;
TRUNCATE TABLE cashbox_history CASCADE;
DELETE FROM "order_item";
DELETE FROM "order";
DELETE FROM post;
DELETE FROM cash_box;
DELETE FROM users WHERE role IN ('customer','market','courier','superadmin');
DELETE FROM district;
DELETE FROM region;

INSERT INTO region (id, created_at, updated_at, name, sato_code) VALUES
  ('11111111-1111-4111-8111-111111111111', 1, 1, 'Toshkent shahri', '1727');

INSERT INTO district (id, created_at, updated_at, name, region_id, sato_code) VALUES
  ('22222222-2222-4222-8222-222222222222', 1, 1, 'Yunusobod', '11111111-1111-4111-8111-111111111111', '1727401');

-- superadmin: sozlash + skan + qabul
INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status) VALUES
  ('33333333-3333-4333-8333-333333333333', 1, 1, 'E2E Admin', '+998900000001', 'superadmin', 'active');

-- kuryer: sotuv/bekor/rollback
-- Kuryer tariflari SHART: ortiqcha xarajat chegarasi shulardan hisoblanadi
-- (markaz 20 000 / uy 40 000 -> sotuvda maks 20 000, bekorda maks 20 000).
INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status, region_id, tariff_center, tariff_home, default_tariff) VALUES
  ('44444444-4444-4444-8444-444444444444', 1, 1, 'E2E Kuryer', '+998900000002', 'courier', 'active', '11111111-1111-4111-8111-111111111111', 20000, 40000, 'center');

-- marketplace biriktiriladigan market
INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status, tariff_center, tariff_home, default_tariff) VALUES
  ('55555555-5555-4555-8555-555555555555', 1, 1, 'UzMarket (marketplace)', '+998900000003', 'market', 'active', 50000, 70000, 'center');

-- Kassalar
INSERT INTO cash_box (id, created_at, updated_at, cashbox_type, user_id, balance, balance_cash, balance_card) VALUES
  ('66666666-6666-4666-8666-666666666666', 1, 1, 'main',    NULL, 0, 0, 0),
  ('77777777-7777-4777-8777-777777777777', 1, 1, 'markets', '55555555-5555-4555-8555-555555555555', 0, 0, 0),
  ('88888888-8888-4888-8888-888888888888', 1, 1, 'couriers','44444444-4444-4444-8444-444444444444', 0, 0, 0);

COMMIT;
