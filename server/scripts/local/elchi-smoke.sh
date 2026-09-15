#!/usr/bin/env bash
# ELCHI HAMKOR API — LOKAL SINOV (BeePost tomonidan).
#
# Nima qiladi: lokal PCS bazasidagi Elchi kalitini olib, PRODUKSIYA Elchi
# Partner API sini tekshiradi. Ya'ni "bizdagi sozlama haqiqatan ishlaydimi"
# degan savolga javob beradi.
#
# ⚠️ 1-6 bosqich FAQAT O'QISH — Elchi da hech narsa yaratilmaydi.
#    7-bosqich (--create bilan) bitta sinov posilkasi yaratadi va DARHOL
#    bekor qiladi. Usiz ishga tushirilsa o'tkazib yuboriladi.
#
# Ishlatilishi:
#   bash server/scripts/local/elchi-smoke.sh
#   bash server/scripts/local/elchi-smoke.sh --create   # yaratish sinovi ham
set -u

DB_URL="${DB_URL:-postgres://postgres:root@localhost:5432/post_control_system}"
CREATE=0
[ "${1:-}" = "--create" ] && CREATE=1

# --- Sozlamani LOKAL bazadan o'qiymiz (qo'lda kalit kiritish shart emas) ---
read_cfg() {
  psql "$DB_URL" -tAc "$1" 2>/dev/null | tr -d ' \n'
}
BASE="$(read_cfg 'select api_base_url from elchi_config limit 1')"
KEY="$(read_cfg 'select api_key from elchi_config limit 1')"
MARKET="$(read_cfg 'select elchi_market_id from elchi_config limit 1')"

echo "=== SOZLAMA (lokal PCS bazasidan) ==="
printf '  baza manzili : %s\n' "${BASE:-(YOQ)}"
printf '  kalit        : %s\n' "$([ -n "$KEY" ] && echo "bor (${#KEY} belgi)" || echo '(YOQ)')"
printf '  market id    : %s\n' "${MARKET:-(YOQ)}"
echo

if [ -z "$BASE" ] || [ -z "$KEY" ]; then
  echo "XATO: elchi_config da manzil yoki kalit yo.q."
  echo "PCS UI: Integratsiyalar -> Elchi -> Sozlamalar."
  exit 1
fi

BASE="${BASE%/}"
H=(-H "X-Api-Key: $KEY" -H "Content-Type: application/json")
ok=0; fail=0; LAST_BODY=''

t() { # t <nom> <kutilgan_kod> <curl argumentlari...>
  local nom="$1" want="$2"; shift 2
  local out code
  out="$(curl -s -w '\n%{http_code}' --max-time 25 "$@" 2>&1)"
  code="$(printf '%s' "$out" | tail -n1)"
  LAST_BODY="$(printf '%s' "$out" | sed '$d')"
  if [ "$code" = "$want" ]; then
    ok=$((ok+1)); printf '  OK   %-46s %s\n' "$nom" "$code"
  else
    fail=$((fail+1)); printf '  XATO %-46s kutilgan=%s olingan=%s\n' "$nom" "$want" "$code"
    printf '       %s\n' "$(printf '%s' "$LAST_BODY" | head -c 200)"
  fi
}

echo "=== 1. AUTENTIFIKATSIYA ==="
t 'kalitsiz -> 401'                401 "$BASE/partner/ping"
t 'yaroqsiz kalit -> 401'          401 -H 'X-Api-Key: yaroqsiz' "$BASE/partner/ping"
t 'haqiqiy kalit -> 200'           200 "${H[@]}" "$BASE/partner/ping"

echo
echo "=== 2. GEO (tuman moslash uchun manba) ==="
t 'viloyatlar -> 200'              200 "${H[@]}" "$BASE/partner/regions"
printf '       viloyat soni: %s\n' "$(printf '%s' "$LAST_BODY" | grep -o '"sato_code"' | wc -l)"
t 'tumanlar -> 200'                200 "${H[@]}" "$BASE/partner/districts"
# ⚠️ Elchi id lari RAQAMLI (masalan 121), UUID EMAS. Birinchi yozganimda
# UUID naqshini qidirib, bo.sh natija olgandim.
DISTRICT="$(printf '%s' "$LAST_BODY" | grep -oE '"id":"?[0-9]+"?' | head -1 | grep -oE '[0-9]+')"
printf '       tuman soni: %s | namuna id: %s\n' \
  "$(printf '%s' "$LAST_BODY" | grep -o '"sato_code"' | wc -l)" "${DISTRICT:-YOQ}"

echo
echo "=== 3. TARIF ==="
# ⚠️ `elchi_market_id` MAJBURIY. Hujjatda `region_id` deb yozilgan — bu audit
# topilmasi (MP-DOC / ep-tariff-farq) va birinchi urinishda men ham shu
# xatoga tushdim. Tarif MARKETGA tegishli, viloyatga emas.
if [ -n "$MARKET" ]; then
  t 'tarif -> 200'                 200 "${H[@]}" "$BASE/partner/tariff?elchi_market_id=$MARKET"
else
  echo "  OTKAZILDI  elchi_market_id yo.q"
fi
printf '       %s\n' "$(printf '%s' "$LAST_BODY" | head -c 180)"

echo
echo "=== 4. XATO ISHLANISHI ==="
t 'yoq posilka -> 404'             404 "${H[@]}" "$BASE/partner/shipments/00000000-0000-0000-0000-000000000000"
t 'bosh tana -> 400'               400 "${H[@]}" -X POST -d '{}' "$BASE/partner/shipments"
t 'begona maydon -> 400'           400 "${H[@]}" -X POST \
     -d '{"external_order_id":"x","begona":1}' "$BASE/partner/shipments"

echo
echo "=== 5. PUL MAYDONLARI (audit M2 tuzatishi) ==="
# Mavjud posilkani olib, yangi maydonlar javobda bor-yo.qligini tekshiramiz.
SHIP="$(read_cfg 'select elchi_shipment_id from elchi_shipment where elchi_shipment_id is not null order by created_at desc limit 1')"
if [ -z "$SHIP" ]; then
  echo "  OTKAZILDI  lokal bazada Elchi posilkasi yo.q (hali jo.natilmagan)"
else
  t "mavjud posilka ($SHIP) -> 200"  200 "${H[@]}" "$BASE/partner/shipments/$SHIP"
  for f in collected_from_customer elchi_fee market_amount; do
    if printf '%s' "$LAST_BODY" | grep -q "\"$f\""; then
      printf '  OK   maydon mavjud: %-28s %s\n' "$f" \
        "$(printf '%s' "$LAST_BODY" | grep -oE "\"$f\":[^,}]*" | head -1)"
      ok=$((ok+1))
    else
      printf '  XATO maydon YO.Q: %s  (Elchi deploy qilinganini tekshiring)\n' "$f"
      fail=$((fail+1))
    fi
  done
fi

if [ "$CREATE" -eq 0 ]; then
  echo
  echo "=== 6-7. YARATISH SINOVI OTKAZILDI (--create bilan ishga tushiring) ==="
elif [ -z "$MARKET" ]; then
  echo
  echo "=== 6-7. YARATISH SINOVI OTKAZILDI: elchi_market_id yo.q ==="
  echo "    PCS UI da 'Market akkaunti' tugmasini bosing."
elif [ -z "${DISTRICT:-}" ]; then
  echo
  echo "=== 6-7. YARATISH SINOVI OTKAZILDI: tuman id o.qilmadi ==="
else
  REF="pcs-smoke-$(date +%s)"
  echo
  echo "=== 6. POSILKA YARATISH (ref=$REF) ==="
  BODY="$(printf '{"external_order_id":"%s","elchi_market_id":"%s","customer":{"name":"SINOV Mijoz","phone":"+998901234567"},"district_id":"%s","where_deliver":"center","items":[{"name":"SINOV mahsuloti","quantity":1}],"cod_amount":10000,"subtotal":10000}' "$REF" "$MARKET" "$DISTRICT")"
  t 'yaratish -> 201'              201 "${H[@]}" -X POST -d "$BODY" "$BASE/partner/shipments"
  SID="$(printf '%s' "$LAST_BODY" | grep -oE '"shipment_id":"[^"]+"' | head -1 | cut -d'"' -f4)"
  printf '       shipment_id: %s\n' "${SID:-YOQ}"

  echo
  echo "=== 7. IDEMPOTENTLIK va BEKOR QILISH ==="
  t 'ayni ref qayta -> 200'        200 "${H[@]}" -X POST -d "$BODY" "$BASE/partner/shipments"
  printf '       %s\n' "$(printf '%s' "$LAST_BODY" | grep -oE '"idempotent":[a-z]*' | head -1)"
  if [ -n "${SID:-}" ]; then
    t 'holat -> 200'               200 "${H[@]}" "$BASE/partner/shipments/$SID"
    t 'bekor -> 200'               200 "${H[@]}" -X POST "$BASE/partner/shipments/$SID/cancel"
    t 'qayta bekor -> 409'         409 "${H[@]}" -X POST "$BASE/partner/shipments/$SID/cancel"
  fi
fi

echo
echo "=== YAKUN: $ok o.tdi, $fail yiqildi ==="
[ "$fail" -eq 0 ] || exit 1
