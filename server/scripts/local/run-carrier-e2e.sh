#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  CARRIER API — UCHDAN-UCHGA SINOV (`/api/v1/carrier/*`)
#
#  Haqiqiy Postgres + haqiqiy Nest ilovasi (AppModule to'liq). Carrier
#  akkaunt, buyurtma, pochta, jo'natish, sotuv/qisman/bekor/qaytarish,
#  rollback, idempotentlik, kassa, IP ro'yxati, limit — test/carrier.e2e-spec.ts.
#
#  Ishlatish:  npm run test:carrier-e2e        (server/ ichidan)
#
#  ⚠️ ALOHIDA BAZA (`pcs_e2e`, marketplace e2e bilan umumiy) — dev bazaga
#     TEGILMAYDI. Carrier seed'i bazani har ishga tushishda TOZALAYDI.
#
#  Baza yo'q bo'lsa — sxema dev bazadan nusxalanadi (faqat O'QISH): bazaviy
#  jadvallar tarixan `synchronize` bilan yaratilgan, migratsiyalar toza
#  bazani qura olmaydi. So'ng kutilayotgan migratsiyalar (masalan
#  `1751100000000-CarrierApi`) qo'llanadi.
#
#  Ulanish: `server/.env` dagi DB_URL dan foydalanuvchi/parol/host/port
#  olinadi; muhitdagi PGUSER / PGPASSWORD / PGHOST / PGPORT ustun turadi.
#  `.env` yo'q bo'lsa sukut: joriy OS foydalanuvchisi, parolsiz,
#  localhost:5432.
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/../.."          # server/

DB_NAME="${E2E_DB:-pcs_e2e}"
case "$DB_NAME" in
  *e2e*) ;;
  *) echo "✖ E2E_DB='$DB_NAME' — nomida 'e2e' bo'lmagan bazaga sinov yozilmaydi" >&2; exit 1 ;;
esac

# DB_URL qismlari — `URL` bilan (parolda `@`/`:` bo'lsa ham to'g'ri).
url_part() {
  node -e '
    const u = new URL(process.argv[1]);
    const parts = {
      db: u.pathname.replace(/^\//, ""),
      user: decodeURIComponent(u.username),
      pass: decodeURIComponent(u.password),
      host: u.hostname,
      port: u.port,
    };
    process.stdout.write(parts[process.argv[2]] || "");
  ' "$1" "$2"
}

SRC_DB=""
if [ -f .env ] && grep -q '^DB_URL=' .env; then
  ENV_URL="$(grep '^DB_URL=' .env | head -1 | sed -E "s/^DB_URL=//; s/^[\"']//; s/[\"']$//")"
  SRC_DB="$(url_part "$ENV_URL" db)"
  : "${PGUSER:=$(url_part "$ENV_URL" user)}"
  : "${PGPASSWORD:=$(url_part "$ENV_URL" pass)}"
  : "${PGHOST:=$(url_part "$ENV_URL" host)}"
  : "${PGPORT:=$(url_part "$ENV_URL" port)}"
fi
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-$(id -un)}"
export PGHOST PGPORT PGUSER
if [ -n "${PGPASSWORD:-}" ]; then export PGPASSWORD; else unset PGPASSWORD; fi

if [ -n "$SRC_DB" ] && [ "$SRC_DB" = "$DB_NAME" ]; then
  echo "✖ .env dagi DB_URL e2e bazasining o'ziga qaraydi — dev bazani ko'rsating" >&2
  exit 1
fi

if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  if [ -z "$SRC_DB" ]; then
    echo "✖ '$DB_NAME' bazasi yo'q va sxema manbasi (server/.env DB_URL) topilmadi." >&2
    echo "  Dev bazasi bor mashinada ishga tushiring yoki '$DB_NAME' ni oldindan tayyorlang." >&2
    exit 1
  fi
  echo "▸ $DB_NAME yaratilmoqda (sxema $SRC_DB dan nusxalanadi)"
  psql -d postgres -c "CREATE DATABASE \"$DB_NAME\"" >/dev/null
  pg_dump --schema-only --no-owner --no-acl "$SRC_DB" | psql -q -d "$DB_NAME" >/dev/null
  pg_dump --data-only --no-owner --table=typeorm_migrations "$SRC_DB" | psql -q -d "$DB_NAME" >/dev/null
fi

DB_URL="$(node -e '
  const [user, pass, host, port, db] = process.argv.slice(1);
  const u = new URL("postgres://localhost");
  u.username = user;
  if (pass) u.password = pass;
  u.hostname = host;
  u.port = port;
  u.pathname = "/" + db;
  process.stdout.write(u.toString());
' "$PGUSER" "${PGPASSWORD:-}" "$PGHOST" "$PGPORT" "$DB_NAME")"
export DB_URL

echo "▸ kutilayotgan migratsiyalar ($DB_NAME)"
npx --no-install ts-node -r tsconfig-paths/register \
  ./node_modules/typeorm/cli.js -d src/data-source.ts migration:run 2>&1 \
  | grep -E "executed successfully|No migrations|rror" || true

echo "▸ seed"
psql -q -v ON_ERROR_STOP=1 -d "$DB_NAME" -f test/carrier-e2e-seed.sql >/dev/null 2>&1

echo "▸ sinov"
# ⚠️ BOT TOKENLARI SOXTA + BOTS_ENABLED=false — haqiqiy token bilan PROD boti
# ishga tushib, `dropPendingUpdates: true` kutilayotgan xabarlarni o'chirardi.
# JWT kalitlari — faqat shu sinov uchun (token shu jarayonda imzolanadi).
# CARRIER_THROTTLE_LIMIT / CARRIER_IP_THROTTLE_LIMIT katta: butun sinov bitta
# akkaunt va bitta IP (loopback) bilan bir daqiqa ichida yuzlab so'rov
# yuboradi; 429 sinovlari limitni o'zi kamaytiradi (IP sinovi alohida soxta
# IP bilan — loopback savatiga tegmaydi).
NODE_ENV=test \
BOTS_ENABLED=false \
BOT_TOKEN=e2e-disabled ORDER_BOT_TOKEN=e2e-disabled \
BOT_NAME=e2e_notify_bot ORDER_BOT_NAME=e2e_order_bot \
ACCESS_TOKEN_KEY=e2e-carrier-access-key ACCESS_TOKEN_TIME=2h \
REFRESH_TOKEN_KEY=e2e-carrier-refresh-key REFRESH_TOKEN_TIME=7d \
CARRIER_THROTTLE_LIMIT=10000 CARRIER_THROTTLE_TTL_MS=60000 \
CARRIER_IP_THROTTLE_LIMIT=10000 \
CARRIER_DOCS_ENABLED= CARRIER_DOCS_PASSWORD= \
npx --no-install jest --config test/jest-e2e.json --runInBand \
  --testPathPattern 'carrier\.e2e-spec' "$@"
