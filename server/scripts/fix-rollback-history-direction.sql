-- ============================================================================
-- ROLLBACK TARIX YO'NALISHINI TUZATISH — YOZADI!
-- ----------------------------------------------------------------------------
-- ⚠️ BU FAYL MOLIYAVIY TARIXNI O'ZGARTIRADI.
--
-- OLDIN MAJBURIY:
--     psql "$DB_URL" -f scripts/check-rollback-history-direction.sql
--
-- O'sha fayl faqat O'QIYDI va nechta qator, qancha summa ekanini
-- ko'rsatadi. Natijani KO'RIB CHIQQANDAN KEYIN shu faylni ishlating.
--
-- Agar tekshiruvda `buzuq_qatorlar = 0` chiqsa — bu fayl KERAK EMAS.
--
-- ⚠️ `cash_box.balance` va `cashbox_history.balance_after` ustunlariga
--    TEGILMAYDI — ular HAR DOIM to'g'ri bo'lgan. Faqat `operation_type`
--    (yo'nalish) va `source_type` tuzatiladi.
--
-- ⚠️ YANGI KOD DEPLOY QILINGANDAN KEYIN ishga tushiring. Aks holda eski
--    kod yana buzuq qatorlar yozishda davom etadi.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════
-- 3. TUZATISH — 1-bo'lim natijasini SAQLAB OLGANDAN KEYIN bajaring
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️ Yangi kod deploy qilingandan KEYIN ishga tushiring. Aks holda eski
--    kod yana buzuq qatorlar yozishda davom etadi.
--
-- ⚠️ `source_type` ham `rollback_correction` ga o'giriladi. Bu SHART:
--    `reverseExtraCostForCashbox` qaytarilgan xarajatni aynan
--    `correction + income` yig'indisi deb hisoblaydi. Bu qatorlarni
--    `correction + income` holida qoldirsak, o'sha buyurtmalarning
--    KELGUSI xarajat qaytarishi «allaqachon qaytarilgan» deb sanalib
--    bajarilmay qolardi — bu ko'rinish emas, REAL PUL ZARARI.

BEGIN;

WITH h AS (
  SELECT id, cashbox_id, source_type, operation_type, comment,
         balance_after, created_at,
         LAG(balance_after) OVER (
           PARTITION BY cashbox_id ORDER BY created_at, id
         ) AS prev_balance
  FROM cashbox_history
)
UPDATE cashbox_history c
   SET operation_type = 'income',
       source_type    = 'rollback_correction'
  FROM h
 WHERE c.id = h.id
   AND h.source_type    = 'correction'
   AND h.operation_type = 'expense'
   AND h.comment LIKE '[ROLLBACK]%'
   AND h.prev_balance IS NOT NULL
   AND (h.balance_after - h.prev_balance) > 0;

-- Tekshiruv: buzuq qator QOLMASLIGI kerak (0 qaytarishi shart).
WITH h AS (
  SELECT id, cashbox_id, source_type, operation_type, comment, balance_after, created_at,
         LAG(balance_after) OVER (PARTITION BY cashbox_id ORDER BY created_at, id) AS prev_balance
  FROM cashbox_history
)
SELECT count(*) AS qolgan_buzuq_qatorlar
  FROM h
 WHERE source_type='correction' AND operation_type='expense'
   AND comment LIKE '[ROLLBACK]%'
   AND prev_balance IS NOT NULL AND (balance_after - prev_balance) > 0;

-- Natija 0 bo'lsa:
COMMIT;
-- Aks holda:
-- ROLLBACK;
