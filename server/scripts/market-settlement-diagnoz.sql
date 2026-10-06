-- ════════════════════════════════════════════════════════════════════
-- MARKET HISOB-KITOB FARQI — SABABINI ANIQLASH (FAQAT O'QISH)
-- Hech narsa o'zgartirmaydi. Prodda xavfsiz.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) Umumiy manzara: nechta market, jami farq qancha ──
SELECT
  COUNT(*)                                   AS jami_market,
  COUNT(*) FILTER (WHERE d.farq <> 0)        AS farqli_market,
  SUM(d.farq) FILTER (WHERE d.farq < 0)      AS manfiy_farq_jami,
  SUM(d.farq) FILTER (WHERE d.farq > 0)      AS musbat_farq_jami
FROM (
  SELECT u.id,
         cb.balance - COALESCE(SUM(o.market_net - o.market_settled), 0) AS farq
  FROM users u
  JOIN cash_box cb ON cb.user_id = u.id AND cb.cashbox_type = 'markets'
  LEFT JOIN "order" o ON o.user_id = u.id AND o.deleted_at IS NULL
  WHERE u.role = 'market'
  GROUP BY u.id, cb.balance
) d;

-- ── 2) SABAB A: marketplace hisob-kitobi ──
-- `marketplace-settlement.service.ts` market kassasini TEKIS kamaytiradi,
-- lekin birorta buyurtmaning `market_settled` ini oshirmaydi.
-- Agar market farqi shu summaga MOS kelsa — sabab shu.
SELECT u.name                     AS market,
       d.farq,
       COALESCE(ms.jami, 0)       AS marketplace_tolovlari,
       d.farq + COALESCE(ms.jami, 0) AS qoldiq_tushuntirilmagan
FROM (
  SELECT u.id,
         cb.balance - COALESCE(SUM(o.market_net - o.market_settled), 0) AS farq
  FROM users u
  JOIN cash_box cb ON cb.user_id = u.id AND cb.cashbox_type = 'markets'
  LEFT JOIN "order" o ON o.user_id = u.id AND o.deleted_at IS NULL
  WHERE u.role = 'market'
  GROUP BY u.id, cb.balance
) d
JOIN users u ON u.id = d.id
LEFT JOIN (
  SELECT i.market_id, SUM(s.amount) AS jami
  FROM marketplace_settlement s
  JOIN marketplace_integration i ON i.id = s.integration_id
  GROUP BY i.market_id
) ms ON ms.market_id = d.id
WHERE d.farq <> 0
ORDER BY ABS(d.farq) DESC
LIMIT 25;

-- ── 3) SABAB B: market_net ≠ to_be_paid bo'lgan buyurtmalar ──
-- To'lov halqasi `to_be_paid` bo'yicha tarqatadi, invariant esa
-- `market_net` ni o'lchaydi. Qo'shimcha xarajat va tarifdan arzon sotuv
-- aynan shu yerda ajraladi.
SELECT u.name AS market,
       COUNT(*)                                   AS nomuvofiq_buyurtma,
       SUM(o.market_net - o.to_be_paid)           AS net_vs_tobepaid_farqi,
       SUM(o.extra_cost_net)                      AS qoshimcha_xarajat_jami
FROM "order" o
JOIN users u ON u.id = o.user_id
WHERE o.deleted_at IS NULL
  AND u.role = 'market'
  AND o.market_net <> o.to_be_paid
GROUP BY u.name
ORDER BY ABS(SUM(o.market_net - o.to_be_paid)) DESC
LIMIT 25;

-- ── 4) O'SISH SURATI: farq qachon paydo bo'lgan ──
-- Agar oxirgi kunlarda ham yangi nomuvofiq buyurtmalar chiqayotgan
-- bo'lsa — nuqson HALI HAM ishlayapti, tarixiy emas.
SELECT date_trunc('day', o.created_at_ts) AS kun,
       COUNT(*)                            AS nomuvofiq_buyurtma,
       SUM(o.market_net - o.to_be_paid)    AS farq
FROM (
  SELECT *, to_timestamp(created_at / 1000) AS created_at_ts
  FROM "order"
  WHERE deleted_at IS NULL AND market_net <> to_be_paid
) o
WHERE o.created_at_ts > now() - interval '30 days'
GROUP BY 1 ORDER BY 1 DESC;
