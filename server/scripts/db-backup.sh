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

# .env ni to'g'ridan-to'g'ri `source` qilmaymiz — qiymatlarda bo'shliq (masalan
# SUPERADMIN_LASTNAME="Shodiyor Ergashev") bo'lsa shell xato beradi. Faqat
# kerakli o'zgaruvchilarni `grep` bilan ajratib olamiz.
if [[ -f "$ROOT_DIR/.env" ]]; then
  env_get() {
    grep -E "^$1=" "$ROOT_DIR/.env" | head -n1 | cut -d= -f2- | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
  }
  : "${DB_URL:=$(env_get DB_URL)}"
  : "${S3_BACKUP_BUCKET:=$(env_get S3_BACKUP_BUCKET)}"
  : "${UPLOAD_ROOT:=$(env_get UPLOAD_ROOT)}"
  export DB_URL S3_BACKUP_BUCKET UPLOAD_ROOT
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
#
# ⚠️  BU BLOK DEPLOY'NI TO'XTATADI. `set -e` + quyidagi `exit 1` tufayli
#     S3 yuklash muvaffaqiyatsiz bo'lsa, CI/CD deploy'i SHU YERDA yiqiladi —
#     migratsiyaga ham, app restartiga ham yetib bormaydi. Bu ATAYLAB:
#     zaxirasiz migratsiya qilishdan ko'ra deploy'ni to'xtatgan afzal.
#
#     Lekin real nosozlik odatda bazada emas, AWS tomonida bo'ladi:
#       InvalidAccessKeyId / InvalidClientTokenId  -> kalit o'chirilgan yoki
#       hisob to'lanmagan. Tekshirish: `aws sts get-caller-identity`
#       (`ubuntu` foydalanuvchisi ostida, sudo'SIZ — sudo /root/.aws/ ni o'qiydi).
#
#     Shoshilinch chiqish yo'li: `.env` da `S3_BACKUP_BUCKET` ni izohga oling.
#     Skript quyidagi `else` shoxiga tushadi, lokal backup baribir olinadi
#     (server/backups/, oxirgi 3 tasi) va deploy davom etadi. AWS tuzalgach
#     qatorni qaytaring — lokal nusxa disk to'lishidan himoya qilmaydi.
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

# ----- 3. QO'SHIMCHA XARAJAT ISBOTLARI (foto) -----
#
# ⚠️ NEGA pg_dump YETARLI EMAS. Isbot fayllari DISKDA yashaydi, bazada esa
# faqat ularga havola (`extra_cost_proof.rel_path`) turadi. Faqat DB backup
# qilinsa, tiklangandan keyin yozuv bor-u FAYL YO'Q bo'ladi — ya'ni market
# bilan kuryer o'rtasidagi pul nizosining yagona dalili yo'qoladi.
#
# Inkremental emas, TO'LIQ arxiv: fayllar hech qachon o'zgartirilmaydi (faqat
# qo'shiladi va TTL bo'yicha o'chiriladi), shuning uchun arxiv hajmi
# bashoratli o'sadi. Siqilgan foto ~300 KB, kuniga ~200 ta ≈ 60 MB/kun.

PROOF_DIR="${UPLOAD_ROOT:-}/extra-cost-proofs"

if [[ -n "${UPLOAD_ROOT:-}" && -d "$PROOF_DIR" ]]; then
  PROOF_FILENAME="proofs-backup-$TIMESTAMP.tar.gz"
  PROOF_FILE="$BACKUP_DIR/$PROOF_FILENAME"
  # `|| true` SHART: `set -euo pipefail` da find'ning bitta "Permission denied"
  # xatosi ham butun skriptni to'xtatardi — DB backup allaqachon tayyor bo'lsa
  # ham deploy to'xtab qolardi.
  PROOF_COUNT=$(find "$PROOF_DIR" -type f 2>/dev/null | wc -l || true)

  echo "🧾 Isbot fayllari arxivlanmoqda: $PROOF_COUNT ta fayl"

  # ⚠️ `tar` ning 1-kodi FATAL EMAS.
  #
  # Kuryer aynan shu paytda isbot yuklayotgan bo'lsa (multer faylni diskka
  # yozmoqda) yoki orfan-tozalash CRON fayl o'chirayotgan bo'lsa, tar
  # «file changed as we read it» deb EXIT 1 qaytaradi. `set -e` da bu BUTUN
  # backup'ni yiqitardi va deploy to'xtardi — holbuki arxiv yaratilgan va
  # deyarli to'liq bo'ladi.
  #
  # 1 = ogohlantirish (fayl o'zgardi/yo'qoldi) → davom etamiz
  # 2 = haqiqiy xato (disk to'lgan, yo'l yo'q) → to'xtaymiz
  TAR_EXIT=0
  tar -czf "$PROOF_FILE" -C "$UPLOAD_ROOT" extra-cost-proofs || TAR_EXIT=$?
  if [[ "$TAR_EXIT" -ge 2 ]]; then
    echo "❌ Isbot arxivini yaratib bo'lmadi (tar exit $TAR_EXIT)" >&2
    exit 1
  elif [[ "$TAR_EXIT" -eq 1 ]]; then
    echo "⚠️  Arxivlash paytida ayrim fayllar o'zgardi/o'chdi (tar exit 1)." >&2
    echo "    Arxiv yaratildi va ishlatsa bo'ladi — davom etilmoqda." >&2
  fi

  PROOF_SIZE=$(du -h "$PROOF_FILE" | cut -f1)
  echo "✅ Isbot arxivi tayyor: $PROOF_FILE ($PROOF_SIZE)"

  if [[ -n "${S3_BACKUP_BUCKET:-}" ]]; then
    PROOF_S3_KEY="proof-backups/$PROOF_FILENAME"
    echo "☁️  S3 ga yuklanmoqda: s3://$S3_BACKUP_BUCKET/$PROOF_S3_KEY"
    if ! aws s3 cp "$PROOF_FILE" "s3://$S3_BACKUP_BUCKET/$PROOF_S3_KEY" \
          --storage-class STANDARD_IA \
          --only-show-errors; then
      echo "❌ Isbot arxivini S3 ga yuklash muvaffaqiyatsiz!" >&2
      exit 1
    fi
    echo "✅ Isbot arxivi S3 ga yuklandi"
  fi

  # Lokal isbot arxivlaridan oxirgi 3 tasi (DB backup bilan bir xil siyosat)
  ( cd "$BACKUP_DIR" && ls -1t proofs-backup-*.tar.gz 2>/dev/null \
      | tail -n +$(( ${KEEP_LOCAL_BACKUPS:-3} + 1 )) | xargs -r rm -f ) || true
elif [[ -z "${UPLOAD_ROOT:-}" ]]; then
  echo "⚠️  UPLOAD_ROOT o'rnatilmagan — isbot fayllari ARXIVLANMADI." >&2
  echo "    Qo'shimcha xarajat isboti yoqilgan bo'lsa, bu MA'LUMOT YO'QOTISH xavfi." >&2
else
  echo "ℹ️  Isbot papkasi hali yaratilmagan ($PROOF_DIR) — o'tkazib yuborildi."
fi

# ----- 4. Lokal eski backuplarni tozalash (oxirgi 3 tasi qoladi) -----
KEEP_LOCAL="${KEEP_LOCAL_BACKUPS:-3}"
cd "$BACKUP_DIR"
DELETED=$(ls -1t db-backup-*.sql.gz 2>/dev/null | tail -n +$((KEEP_LOCAL + 1)) | xargs -r rm -v || true)
if [[ -n "$DELETED" ]]; then
  echo "🧹 Lokal eski backuplar tozalandi (oxirgi $KEEP_LOCAL tasi qoldirildi)"
fi

echo "🎉 Backup jarayoni tugadi."
