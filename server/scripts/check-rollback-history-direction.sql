-- ============================================================================
-- ROLLBACK TARIX YO'NALISHINI TUZATISH (bir martalik, QO'LDA ishga tushiriladi)
-- ----------------------------------------------------------------------------
-- NEGA MIGRATSIYA EMAS: bu moliyaviy TARIXNI o'zgartiradi. Avtomatik
-- migratsiya har deployda jimgina ishlab ketardi; bu yerda esa oldin
-- 1-bo'lim bilan KO'RIB CHIQISH, keyin ongli ravishda 3-bo'limni
-- bajarish kerak.
--
-- ⚠️ `cash_box.balance` va `cashbox_history.balance_after` ustunlariga
--    TEGILMAYDI — ular HAR DOIM TO'G'RI bo'lgan. Nuqson faqat
--    `operation_type` (yo'nalish) va `amount` (ishora) da edi.
--
-- ── NUQSON ─────────────────────────────────────────────────────────────
-- `rollbackOrderToWaiting` sotuvni teskari qaytarganda kassaga tuzatish
-- yozardi. `total_price` tarifdan KICHIK bo'lganda (0 so'mlik buyurtma —
-- eng aniq holat) bu yozuv aslida KIRIM bo'ladi: pul kassaga QAYTADI.
-- Lekin kod `operation: EXPENSE` ni qotirib yozardi.
--
-- Yo'nalishni esa hamma jamlagich `operation_type` dan o'qiydi
-- (`cash-box.service.ts`: `if (INCOME) income += amount; else outcome += amount`).
-- Natijada ekranda «Chiqim» = sotuv + rollback = 2 × tarif bo'lib
-- ko'rinardi va market/kuryer tarif ikkinchi marta ayrilgandek his qilardi.
--
-- Deraza: 2026-09-16 18:38 (commit 4a525a5f) — 2026-09-23 (tuzatish).
-- Undan OLDIN kod `amount` ni XOM, ISHORALI yozardi (-50000) va jamlagich
-- `outcome += (-50000)` qilib o'zini-o'zi qoplardi.
-- ============================================================================



-- ⚠️ BU FAYL FAQAT O'QIYDI. Hech narsani o'zgartirmaydi.
--    Xavfsiz: istalgan vaqtda, istalgan marta ishga tushirish mumkin.
--
--    Tuzatish ALOHIDA faylda: fix-rollback-history-direction.sql
--    Uni FAQAT shu yerdagi natijalarni ko'rib chiqqandan KEYIN ishlating.
-- ════════════════════════════════════════════════════════════════════════
-- 1. AVVAL KO'RING — nechta qator va qancha summa
-- ════════════════════════════════════════════════════════════════════════
--
-- Aniqlash mezoni ISHONCHLI: qator `expense` deb yozilgan, LEKIN
-- `balance_after` OLDINGI qatorga nisbatan OSHGAN — ya'ni aslida kirim.
-- Bu `total_price`/`tariff` ni qayta hisoblashdan ko'ra ishonchli:
-- tariflar keyinchalik o'zgargan bo'lishi mumkin.

WITH h AS (
  SELECT
    id, cashbox_id, source_id, source_type, operation_type, amount,
    balance_after, comment, created_at,
    LAG(balance_after) OVER (
      PARTITION BY cashbox_id ORDER BY created_at, id
    ) AS prev_balance
  FROM cashbox_history
)
SELECT
  h.id                              AS history_id,
  c.cashbox_type,
  o.order_number,
  o.total_price,
  o.market_tariff,
  o.courier_tariff,
  h.amount,
  h.prev_balance,
  h.balance_after,
  (h.balance_after - h.prev_balance) AS haqiqiy_delta,   -- MUSBAT = buzuq
  to_char(to_timestamp(h.created_at / 1000), 'YYYY-MM-DD HH24:MI') AS vaqt
FROM h
JOIN cash_box c   ON c.id = h.cashbox_id
LEFT JOIN "order" o ON o.id = h.source_id
WHERE h.source_type    = 'correction'
  AND h.operation_type = 'expense'
  AND h.comment LIKE '[ROLLBACK]%'
  AND h.prev_balance IS NOT NULL
  AND (h.balance_after - h.prev_balance) > 0
ORDER BY h.created_at;


-- ════════════════════════════════════════════════════════════════════════
-- 2. UMUMIY HAJM — hisobotlar qancha og'gan
-- ════════════════════════════════════════════════════════════════════════

WITH h AS (
  SELECT id, cashbox_id, operation_type, source_type, amount, comment,
         balance_after, created_at,
         LAG(balance_after) OVER (
           PARTITION BY cashbox_id ORDER BY created_at, id
         ) AS prev_balance
  FROM cashbox_history
)
SELECT
  count(*)                   AS buzuq_qatorlar,
  count(DISTINCT cashbox_id) AS tasirlangan_kassalar,
  COALESCE(sum(amount), 0)   AS soxta_chiqim,   -- «Chiqim» shuncha OSHIB ketgan
  COALESCE(sum(amount), 0)   AS yoqolgan_kirim  -- «Kirim» shuncha KAM ko'rsatilgan
FROM h
WHERE source_type = 'correction'
  AND operation_type = 'expense'
  AND comment LIKE '[ROLLBACK]%'
  AND prev_balance IS NOT NULL
  AND (balance_after - prev_balance) > 0;



-- ════════════════════════════════════════════════════════════════════════
-- 4. ESKI KONVENSIYA (2026-09-16 gacha) — alohida ko'rib chiqiladi
-- ════════════════════════════════════════════════════════════════════════
--
-- 4a525a5f gacha rollback `amount` ni ISHORALI yozardi (manfiy). Ular
-- jamlagichda o'zini-o'zi qoplaydi, ya'ni hisobot TO'G'RI chiqadi —
-- shuning uchun ularga TEGISH SHART EMAS.
--
-- Lekin bilib qo'yish kerak: 16-sentyabrni kesib o'tuvchi hisobot
-- oralig'i ikki xil konvensiyani qo'shib yuboradi. Nechta borligini
-- ko'rish uchun:

SELECT count(*)      AS eski_ishorali_qatorlar,
       sum(amount)   AS jami_manfiy,
       to_char(to_timestamp(min(created_at)/1000), 'YYYY-MM-DD') AS eng_eski,
       to_char(to_timestamp(max(created_at)/1000), 'YYYY-MM-DD') AS eng_yangi
  FROM cashbox_history
 WHERE amount < 0;
