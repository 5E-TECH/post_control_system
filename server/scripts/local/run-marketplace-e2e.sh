#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  MARKETPLACE — UCHDAN-UCHGA SINOV
#
#  Haqiqiy Postgres + haqiqiy Nest ilovasi + haqiqiy mock marketplace.
#  19 ta qabul mezonini (reja §16) tekshiradi.
#
#  Ishlatish:  bash server/scripts/local/run-marketplace-e2e.sh
#
#  ⚠️ ALOHIDA BAZA ishlatiladi (`pcs_e2e`) — dev bazaga TEGILMAYDI.
#     Baza har ishga tushishda TOZALANADI.
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/../.."          # server/

DB_NAME="${E2E_DB:-pcs_e2e}"
SRC_DB="$(grep '^DB_URL' .env | sed -E 's|.*/([^/?]+)$|\1|')"
PGPASSWORD="$(grep '^DB_URL' .env | sed -E 's|.*postgres://[^:]+:([^@]*)@.*|\1|')"
export PGPASSWORD
PGHOST="${PGHOST:-localhost}"; PGUSER="${PGUSER:-postgres}"
export PGHOST PGUSER

if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  echo "▸ $DB_NAME yaratilmoqda (sxema $SRC_DB dan nusxalanadi)"
  psql -c "CREATE DATABASE $DB_NAME" >/dev/null
  # ⚠️ Migratsiyalar TOZA bazadan qurilmaydi — bazaviy jadvallar tarixan
  # `synchronize` bilan yaratilgan. Shuning uchun sxema dev bazadan
  # nusxalanadi (faqat O'QISH), keyin kutilayotgan migratsiyalar qo'llanadi.
  pg_dump --schema-only --no-owner --no-acl "$SRC_DB" | psql -q -d "$DB_NAME" >/dev/null
  pg_dump --data-only --no-owner --table=typeorm_migrations "$SRC_DB" | psql -q -d "$DB_NAME" >/dev/null
fi

export DB_URL="postgres://$PGUSER:$PGPASSWORD@$PGHOST:5432/$DB_NAME"
echo "▸ kutilayotgan migratsiyalar"
npx --no-install ts-node -r tsconfig-paths/register \
  ./node_modules/typeorm/cli.js -d src/data-source.ts migration:run 2>&1 \
  | grep -E "executed successfully|No migrations|error" || true

echo "▸ seed"
psql -q -d "$DB_NAME" -f test/marketplace-e2e-seed.sql >/dev/null 2>&1

# ⚠️ FAQAT 4011 (e2e porti) tozalanadi — 4010 GA TEGILMAYDI.
#   4010 da qo'lda sinov uchun mock turadi. Avval bu skript uni ham
#   o'ldirardi va operator ekranida «Marketplace bilan aloqa yo'q»
#   chiqib, 3 urinishdan keyin skan bloklanardi.
if command -v fuser >/dev/null 2>&1; then
  fuser -k 4011/tcp >/dev/null 2>&1 || true
  sleep 0.3
fi

echo "▸ sinov"
# ⚠️ BOT TOKENLARI SOXTA bo'lishi SHART — haqiqiysi bilan PROD boti ishga
# tushib, `dropPendingUpdates: true` kutilayotgan xabarlarni o'chirardi.
MARKETPLACE_ALLOW_LOCAL_URL=1 \
MARKETPLACE_SECRET_KEY=e2e-test-key-0123456789abcdef \
BOT_TOKEN=e2e-disabled ORDER_BOT_TOKEN=e2e-disabled \
NODE_ENV=test \
npx --no-install jest --config test/jest-e2e.json --runInBand \
  --testPathPattern marketplace "$@"
