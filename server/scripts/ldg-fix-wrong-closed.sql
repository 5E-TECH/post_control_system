-- =============================================================================
-- LDG "RETURNED → CLOSED" xato yozuvlarini topish va tuzatish
-- =============================================================================
--
-- SABAB: Eski kodda LDG `RETURNED` (bekor qilib qaytardi) statusi buyurtmani
-- to'g'ridan-to'g'ri CLOSED ("Yopilgan") qilardi — jismonan qaytib kelib skanerdan
-- o'tmasa ham. To'g'ri xatti-harakat: LDG eng ko'pi CANCELLED_SENT ("Bekor
-- (yuborilgan)" — qaytish yo'lida) qo'yishi kerak; CLOSED faqat skanerdan.
--
-- Bu skript o'sha xato CLOSED bo'lib qolgan buyurtmalarni topib, CANCELLED_SENT'ga
-- qaytaradi — shunda jismonan kelgan paket skanerdan o'tkazilib qonuniy CLOSED
-- bo'la oladi.
--
-- !!! AVVAL O'QING !!!
--   1) `bash scripts/db-backup.sh` bilan ZAXIRA oling.
--   2) Avval FAQAT A/B/C bo'limlarini (SELECT) ishga tushirib, natijani ko'ring.
--   3) D bo'limi (UPDATE) — TRANZAKSIYA ichida. Avval oxiridagi COMMIT o'rniga
--      ROLLBACK bilan "quruq yurgizish" (dry-run) qiling, natija sonini tekshiring,
--      keyingina COMMIT bilan bajaring.
--   4) `cancel_flow_ishlagan = false` guruh AVTOMATIK tuzatilMAYDI (pul/earning
--      tuzatilmagan bo'lishi mumkin) — ularni qo'lda ko'rib chiqing.
--
-- Jadval nomlari: "order" (reserved so'z — qo'shtirnoq SHART), ldg_shipment,
-- activity_logs, operator_earning. created_at/updated_at = epoch millisekund (bigint).
-- =============================================================================


-- --- A) ANIQ BARMOQ IZI: LDG kelib chiqishli CLOSED, skaner tasdig'isiz ---------
-- markReturnedByLdg / logIntermediateStatus activity_log'ga metadata.source='ldg'
-- yozadi. Skaner esa metadata.source='scanner' (yoki tavsifda "QR skaner" /
-- "qabul qilindi (CLOSED)") yozadi. LDG yozgan, skaner yozmagan CLOSE'larni topamiz.
SELECT o.id, o.order_number, o.status, o.user_id AS market_id,
       o.cancelled_at, s.ldg_status, s.ldg_status_changed_at,
       al.created_at AS ldg_closed_log_at, al.description
FROM "order" o
JOIN activity_logs al
  ON al.entity_type = 'order' AND al.entity_id = o.id
 AND al.action = 'status_change'
 AND al.new_value->>'status' = 'closed'
 AND al.metadata->>'source' = 'ldg'
LEFT JOIN ldg_shipment s ON s.order_id = o.id
WHERE o.status = 'closed'
  AND o.deleted_at IS NULL
  AND NOT EXISTS (                            -- SKANER tasdig'i YO'Q
    SELECT 1 FROM activity_logs sc
    WHERE sc.entity_type = 'order' AND sc.entity_id = o.id
      AND sc.action = 'status_change'
      AND sc.new_value->>'status' = 'closed'
      AND ( sc.metadata->>'source' = 'scanner'                 -- receiveWithScaner
         OR sc.description ILIKE '%QR skaner%'                 -- receiveWithScaner matni
         OR sc.description ILIKE '%qabul qilindi (CLOSED)%' )  -- receiveCanceledPost matni
  )
ORDER BY al.created_at DESC;


-- --- B) ZAXIRA (loglar tozalangan / eski bo'lsa): shipment.ldg_status bo'yicha ---
SELECT o.id, o.order_number, o.status, s.ldg_status,
       s.ldg_status_changed_at, o.cancelled_at
FROM "order" o
JOIN ldg_shipment s ON s.order_id = o.id
WHERE o.status = 'closed'
  AND UPPER(COALESCE(s.ldg_status, '')) = 'RETURNED'
  AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs sc
    WHERE sc.entity_type = 'order' AND sc.entity_id = o.id
      AND sc.action = 'status_change'
      AND sc.new_value->>'status' = 'closed'
      AND ( sc.metadata->>'source' = 'scanner'
         OR sc.description ILIKE '%QR skaner%'
         OR sc.description ILIKE '%qabul qilindi (CLOSED)%' )
  );


-- --- C) TASNIF: pul teskari qaytarilganmi? (tuzatishdan oldin MAJBURIY) ----------
-- cancel_flow_ishlagan = true  → cancelOrder bajarilgan, pul to'g'ri → faqat status
--                                tuzatiladi (D bo'limi).
-- cancel_flow_ishlagan = false → xom yozuv yo'lidan o'tgan (cancelOrder ishlamagan):
--                                pul/earning tuzatilmagan bo'lishi mumkin → AVTOMATIK
--                                O'ZGARTIRMANG, qo'lda ko'rib chiqing.
-- Pastdagi IN (...) ga A yoki B natijasidagi id'larni qo'ying.
SELECT o.id, o.order_number,
       (o.cancelled_at IS NOT NULL) AS cancel_flow_ishlagan,
       EXISTS (SELECT 1 FROM operator_earning oe WHERE oe.order_id = o.id) AS earning_qolgan,
       o.canceled_post_id
FROM "order" o
WHERE o.id IN ( /* A yoki B natijasidagi id'lar */ '00000000-0000-0000-0000-000000000000' );


-- --- D) TUZATISH (faqat cancel_flow_ishlagan = true guruh) -----------------------
-- Avval COMMIT o'rniga ROLLBACK bilan quruq yurgizing. Idempotent: qayta ishga
-- tushsa ham faqat 'closed' qatorlarga tegadi.
BEGIN;

-- A (barmoq izi) + B (shipment) birlashmasi, FAQAT cancel oqimi ishlagan (pul to'g'ri).
CREATE TEMP TABLE ldg_wrong_closed ON COMMIT DROP AS
  SELECT o.id
  FROM "order" o
  LEFT JOIN ldg_shipment s ON s.order_id = o.id
  WHERE o.status = 'closed'
    AND o.deleted_at IS NULL
    AND o.cancelled_at IS NOT NULL          -- C: cancel oqimi ishlagan (pul teskari qaytarilgan)
    AND (
          EXISTS (
            SELECT 1 FROM activity_logs al
            WHERE al.entity_type = 'order' AND al.entity_id = o.id
              AND al.action = 'status_change'
              AND al.new_value->>'status' = 'closed'
              AND al.metadata->>'source' = 'ldg'
          )
       OR UPPER(COALESCE(s.ldg_status, '')) = 'RETURNED'
    )
    AND NOT EXISTS (                          -- SKANER tasdig'i YO'Q
      SELECT 1 FROM activity_logs sc
      WHERE sc.entity_type = 'order' AND sc.entity_id = o.id
        AND sc.action = 'status_change'
        AND sc.new_value->>'status' = 'closed'
        AND ( sc.metadata->>'source' = 'scanner'
           OR sc.description ILIKE '%QR skaner%'
           OR sc.description ILIKE '%qabul qilindi (CLOSED)%' )
    );

-- CLOSED → CANCELLED_SENT (qaytish yo'lida; jismonan kelsa skaner CLOSED qiladi).
UPDATE "order" o
   SET status = 'cancelled (sent)',
       updated_at = (EXTRACT(EPOCH FROM now()) * 1000)::bigint
  FROM ldg_wrong_closed w
 WHERE o.id = w.id AND o.status = 'closed';

-- Audit izi.
INSERT INTO activity_logs
  (id, created_at, updated_at, entity_type, entity_id, action,
   old_value, new_value, description, metadata)
SELECT gen_random_uuid(),
       (EXTRACT(EPOCH FROM now())*1000)::bigint,
       (EXTRACT(EPOCH FROM now())*1000)::bigint,
       'order', w.id, 'data_fix',
       '{"status":"closed"}'::jsonb,
       '{"status":"cancelled (sent)"}'::jsonb,
       'Tuzatish: LDG RETURNED noto''g''ri CLOSED qilgan edi — skaner kutish holatiga (CANCELLED_SENT) qaytarildi',
       '{"source":"data_fix","reason":"ldg_returned_closed"}'::jsonb
FROM ldg_wrong_closed w;

-- Nechta qator o'zgargani ko'ring:
SELECT count(*) AS tuzatilgan_buyurtma FROM ldg_wrong_closed;

-- DRY-RUN: quyidagini ROLLBACK qoldiring; ishonch hosil qilgach COMMIT ga o'zgartiring.
ROLLBACK;
-- COMMIT;
