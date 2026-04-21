#!/usr/bin/env bash
# ============================================================================
# Pre-deploy DB backup script (S3 upload bilan)
# ----------------------------------------------------------------------------
# Foydalanish:
#   bash scripts/db-backup.sh
#
# Deploy QILISHDAN OLDIN HAR DOIM ishga tushiring:
#   npm run db:backup && npm run migration:run
#
# ========= MUHIM =========
# - S3 ga yuboriladi (disk to'lmasligi uchun).
# - Lokal nusxa faqat oxirgi 3 tasi qoldiriladi (tez tiklash uchun).
# - S3 bucket'da lifecycle rule orqali 60 kundan keyin avto o'chiriladi.
#
# Talablar:
#   - pg_dump o'rnatilgan
#   - aws CLI o'rnatilgan + sozlangan (aws configure)
#   - .env da S3_BACKUP_BUCKET bo'lishi kerak (yoki env var sifatida)
# ============================================================================
set -euo pipefail

# .env faylidan o'qish
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ -f "$ROOT_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ -z "${DB_URL:-}" ]]; then
  echo "❌ DB_URL topilmadi. .env faylida bo'lishi kerak." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILENAME="db-backup-$TIMESTAMP.sql.gz"
BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILENAME"

echo "📦 Backup boshlandi: $BACKUP_FILENAME"
echo "    DB: $(echo "$DB_URL" | sed -E 's|://[^:]+:[^@]+@|://***:***@|')"

# ----- 1. pg_dump + gzip -----
pg_dump \
  --no-owner \
  --no-privileges \
  --format=plain \
  --clean \
  --if-exists \
  "$DB_URL" | gzip -9 > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Lokal backup tayyor: $BACKUP_FILE ($SIZE)"

# ----- 2. S3 ga yuklash (agar sozlangan bo'lsa) -----
if [[ -n "${S3_BACKUP_BUCKET:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "❌ aws CLI topilmadi, S3 yuklash o'tkazib yuborildi. Lokal nusxa saqlangan." >&2
    exit 1
  fi

  S3_KEY="db-backups/$BACKUP_FILENAME"
  echo "☁️  S3 ga yuklanmoqda: s3://$S3_BACKUP_BUCKET/$S3_KEY"

  if ! aws s3 cp "$BACKUP_FILE" "s3://$S3_BACKUP_BUCKET/$S3_KEY" \
        --storage-class STANDARD_IA \
        --only-show-errors; then
    echo "❌ S3 upload muvaffaqiyatsiz!" >&2
    exit 1
  fi
  echo "✅ S3 ga yuklandi: s3://$S3_BACKUP_BUCKET/$S3_KEY"
else
  echo "⚠️  S3_BACKUP_BUCKET o'rnatilmagan — faqat lokal backup saqlandi."
fi

# ----- 3. Lokal eski backuplarni tozalash (oxirgi 3 tasi qoladi) -----
KEEP_LOCAL="${KEEP_LOCAL_BACKUPS:-3}"
cd "$BACKUP_DIR"
DELETED=$(ls -1t db-backup-*.sql.gz 2>/dev/null | tail -n +$((KEEP_LOCAL + 1)) | xargs -r rm -v || true)
if [[ -n "$DELETED" ]]; then
  echo "🧹 Lokal eski backuplar tozalandi (oxirgi $KEEP_LOCAL tasi qoldirildi)"
fi

echo "🎉 Backup jarayoni tugadi."
