/**
 * KURYER KECHIKISHI — O'LCHOV (FAZA 0).
 *
 * ── NEGA ────────────────────────────────────────────────────────────────
 *
 * Shtraf moduli uchun ikkita son tanlanishi kerak: MUDDAT (necha kun) va
 * KUN NARXI (har kechikkan kun uchun qancha). Bu sonlar taxmindan emas,
 * HAQIQIY taqsimotdan chiqishi shart — aks holda modul yoki hech kimga
 * tegmaydi, yoki hammani bir vaqtda nolga tushiradi.
 *
 * Skript faqat O'QIYDI. Hech narsa yozmaydi, hech narsani o'zgartirmaydi.
 *
 * ── SOAT QAYERDAN BOSHLANADI ────────────────────────────────────────────
 *
 * Buyurtmada «jo'natildi» ustuni YO'Q. Yagona ishonchli langar —
 * `post.created_at`: har jo'natishda `sendPost` YANGI `sent` post qatorini
 * yaratadi va buyurtmani unga biriktiradi (post.service.ts:983). Pochtani
 * boshqa kuryerga o'tkazish faqat `courier_id` ni almashtiradi, yaratilgan
 * vaqtga tegmaydi — ya'ni muddat qayta boshlanmaydi.
 *
 * ── KIM HISOBGA OLINMAYDI ───────────────────────────────────────────────
 *
 * Tashqi provayder kuryerlari (Elchi, LDG) — ular boshqa shartnoma bo'yicha
 * ishlaydi va shtraf moduli ularni hech qachon qamramaydi. O'lchovda ham
 * qatnashmasligi kerak, aks holda raqamlar buziladi.
 *
 * ── ISHLATISH ───────────────────────────────────────────────────────────
 *
 *   npm run db:measure-courier-delay
 *   npm run db:measure-courier-delay -- --days=90 --top=20
 */
import 'reflect-metadata';
import dataSource from '../src/data-source';

const DAY_MS = 86_400_000;

function parseArg(prefix: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return fallback;
  const n = Number(arg.slice(prefix.length));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const fmt = (v: number | string | null | undefined): string => {
  const n = Math.round(Number(v ?? 0));
  return n.toLocaleString('ru-RU').replace(/ /g, ' ');
};
const pad = (s: string, w: number) => s.padEnd(w);
const padL = (s: string, w: number) => s.padStart(w);

/**
 * ⚠️ KURYERNING O'SHA BUYURTMA UCHUN TARIFI.
 *
 * Shtraf tarifdan oshmasligi kerak (pol: 0), shuning uchun simulyatsiya
 * ham AYNAN shu chegarani qo'llaydi. Tarif uch manbadan: buyurtmaga
 * muzlatilgan snapshot → super kuryerning viloyat tarifi → kuryerning
 * umumiy tarifi. `where_deliver` uyga/markazga tarifni tanlaydi.
 */
const TARIFF_SQL = `
  COALESCE(
    o.courier_tariff,
    CASE WHEN o.where_deliver = 'center'
         THEN COALESCE(cr.tariff_center, u.tariff_center)
         ELSE COALESCE(cr.tariff_home,   u.tariff_home) END,
    0
  )::bigint`;

/** Ichki kuryerga biriktirilgan, jo'natilgan buyurtmalar. */
const BASE_FROM = `
  FROM "order" o
  JOIN post p  ON p.id = o.post_id AND p.status IN ('sent', 'received')
  JOIN users u ON u.id = p.courier_id
  LEFT JOIN courier_regions cr
         ON cr.courier_id = p.courier_id AND cr.region_id = p.region_id
  WHERE o.deleted_at IS NULL
    AND u.external_provider IS NULL`;

async function main() {
  const windowDays = parseArg('--days=', 90);
  const topN = parseArg('--top=', 15);
  const since = Date.now() - windowDays * DAY_MS;

  await dataSource.initialize();
  console.log(
    `\n🔌 DB ulandi. Kuryer kechikishi o'lchanmoqda ` +
      `(oxirgi ${windowDays} kun, tashqi provayderlarsiz).\n`,
  );

  // ══════════════ 1. BELGILASH MUDDATI TAQSIMOTI ══════════════
  const dist: Array<{ oraliq: string; soni: string; ulush: string }> =
    await dataSource.query(
      `
    SELECT
      CASE WHEN kun <= 1 THEN 'a) 0-1 kun'
           WHEN kun <= 2 THEN 'b) 2 kun'
           WHEN kun <= 3 THEN 'c) 3 kun'
           WHEN kun <= 4 THEN 'd) 4 kun'
           WHEN kun <= 7 THEN 'e) 5-7 kun'
           WHEN kun <= 14 THEN 'f) 8-14 kun'
           WHEN kun <= 30 THEN 'g) 15-30 kun'
           ELSE 'h) 30+ kun' END                       AS oraliq,
      COUNT(*)::text                                   AS soni,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)::text AS ulush
    FROM (
      SELECT FLOOR((COALESCE(o.sold_at, o.cancelled_at) - p.created_at) / ${DAY_MS}.0) AS kun
      ${BASE_FROM}
        AND COALESCE(o.sold_at, o.cancelled_at) IS NOT NULL
        AND COALESCE(o.sold_at, o.cancelled_at) >= p.created_at
        AND p.created_at >= $1
    ) t
    GROUP BY 1 ORDER BY 1`,
      [since],
    );

  console.log('📊 BELGILASH MUDDATI — taqsimot');
  console.log('   ' + pad('oraliq', 14) + padL('soni', 8) + padL('ulush', 9));
  console.log('   ' + '─'.repeat(31));
  for (const r of dist) {
    console.log(
      '   ' +
        pad(r.oraliq, 14) +
        padL(fmt(r.soni), 8) +
        padL(`${r.ulush}%`, 9),
    );
  }

  // ══════════════ 2. HOZIR KURYERDA YOTGANLAR ══════════════
  const open: Array<{ holat: string; soni: string; summa: string }> =
    await dataSource.query(
      `
    SELECT
      CASE WHEN kun <= 4 THEN 'a) muddat ichida'
           WHEN kun <= 7 THEN 'b) 5-7 kun'
           WHEN kun <= 14 THEN 'c) 8-14 kun'
           WHEN kun <= 30 THEN 'd) 15-30 kun'
           ELSE 'e) 30+ kun' END       AS holat,
      COUNT(*)::text                   AS soni,
      COALESCE(SUM(narx), 0)::text     AS summa
    FROM (
      SELECT FLOOR((${Date.now()} - p.created_at) / ${DAY_MS}.0) AS kun,
             o.total_price AS narx
      ${BASE_FROM}
        AND o.status = 'on the road'
    ) t
    GROUP BY 1 ORDER BY 1`,
    );

  console.log("\n📦 HOZIR KURYERDA — belgilanmagan");
  console.log(
    '   ' + pad('holat', 18) + padL('soni', 8) + padL("summa (so'm)", 16),
  );
  console.log('   ' + '─'.repeat(42));
  for (const r of open) {
    console.log(
      '   ' + pad(r.holat, 18) + padL(fmt(r.soni), 8) + padL(fmt(r.summa), 16),
    );
  }

  // ══════════════ 3. SEZGIRLIK MATRITSASI ══════════════
  //
  // ⚠️ ASOSIY NATIJA. «4 kun + 2 000» taxmin edi; bu jadval har
  // kombinatsiyada qancha undirilishini va nechta kuryer tegishini
  // ko'rsatadi. Shtraf TARIFDAN OSHMAYDI (pol: 0).
  const deadlines = [3, 4, 5, 7];
  const perDays = [1000, 2000, 3000];

  const matrix: Array<{
    muddat: string;
    kun_narxi: string;
    buyurtma: string;
    kuryer: string;
    jami: string;
    nolga: string;
  }> = await dataSource.query(
    `
    WITH marked AS (
      SELECT p.courier_id,
             FLOOR((COALESCE(o.sold_at, o.cancelled_at) - p.created_at) / ${DAY_MS}.0) AS kun,
             ${TARIFF_SQL} AS tarif
      ${BASE_FROM}
        AND COALESCE(o.sold_at, o.cancelled_at) IS NOT NULL
        AND COALESCE(o.sold_at, o.cancelled_at) >= p.created_at
        AND p.created_at >= $1
    ),
    combos AS (
      SELECT d AS muddat, pd AS kun_narxi
      FROM unnest(ARRAY[${deadlines.join(',')}]) AS d
      CROSS JOIN unnest(ARRAY[${perDays.join(',')}]) AS pd
    )
    SELECT
      c.muddat::text                                        AS muddat,
      c.kun_narxi::text                                     AS kun_narxi,
      COUNT(*) FILTER (WHERE shtraf > 0)::text              AS buyurtma,
      COUNT(DISTINCT m.courier_id) FILTER (WHERE shtraf > 0)::text AS kuryer,
      COALESCE(SUM(shtraf), 0)::text                        AS jami,
      COUNT(*) FILTER (WHERE shtraf >= m.tarif AND m.tarif > 0)::text AS nolga
    FROM combos c
    CROSS JOIN LATERAL (SELECT 1) AS _
    JOIN marked m ON TRUE
    CROSS JOIN LATERAL (
      -- Shtraf TARIFDAN OSHMAYDI — moduldagi pol bilan AYNI.
      SELECT LEAST(
               GREATEST(0, m.kun - c.muddat)::bigint * c.kun_narxi,
               m.tarif
             ) AS shtraf
    ) s
    GROUP BY c.muddat, c.kun_narxi
    ORDER BY c.muddat, c.kun_narxi`,
    [since],
  );

  console.log(
    `\n🎯 SEZGIRLIK MATRITSASI — ${windowDays} kunda qancha undirilardi`,
  );
  console.log(
    '   ' +
      pad('muddat', 8) +
      pad('kun narxi', 11) +
      padL('buyurtma', 10) +
      padL('kuryer', 8) +
      padL("jami (so'm)", 15) +
      padL('nolga tushgan', 15),
  );
  console.log('   ' + '─'.repeat(67));
  for (const r of matrix) {
    const mark =
      r.muddat === '4' && r.kun_narxi === '2000' ? '  ← taklif' : '';
    console.log(
      '   ' +
        pad(`${r.muddat} kun`, 8) +
        pad(fmt(r.kun_narxi), 11) +
        padL(fmt(r.buyurtma), 10) +
        padL(fmt(r.kuryer), 8) +
        padL(fmt(r.jami), 15) +
        padL(fmt(r.nolga), 15) +
        mark,
    );
  }

  // ══════════════ 4. KURYERLAR KESIMI ══════════════
  const couriers: Array<{
    kuryer: string;
    belgilangan: string;
    ortacha: string;
    kech: string;
    foiz: string;
    shtraf: string;
  }> = await dataSource.query(
    `
    SELECT u.name                                        AS kuryer,
           COUNT(*)::text                                AS belgilangan,
           ROUND(AVG(t.kun), 1)::text                    AS ortacha,
           COUNT(*) FILTER (WHERE t.kun > 4)::text       AS kech,
           ROUND(100.0 * COUNT(*) FILTER (WHERE t.kun > 4) / COUNT(*), 1)::text AS foiz,
           COALESCE(SUM(LEAST(GREATEST(0, t.kun - 4)::bigint * 2000, t.tarif)), 0)::text AS shtraf
    FROM (
      SELECT p.courier_id,
             FLOOR((COALESCE(o.sold_at, o.cancelled_at) - p.created_at) / ${DAY_MS}.0) AS kun,
             ${TARIFF_SQL} AS tarif
      ${BASE_FROM}
        AND COALESCE(o.sold_at, o.cancelled_at) IS NOT NULL
        AND COALESCE(o.sold_at, o.cancelled_at) >= p.created_at
        AND p.created_at >= $1
    ) t
    JOIN users u ON u.id = t.courier_id
    GROUP BY u.name
    HAVING COUNT(*) >= 5
    ORDER BY ROUND(100.0 * COUNT(*) FILTER (WHERE t.kun > 4) / COUNT(*), 1) DESC
    LIMIT $2`,
    [since, topN],
  );

  console.log(
    `\n👤 KURYERLAR KESIMI — eng ko'p kechiktiruvchi ${topN} ta` +
      ' (4 kun + 2 000 bo\'yicha)',
  );
  console.log(
    '   ' +
      pad('kuryer', 24) +
      padL('belgi.', 8) +
      padL("o'rt.kun", 10) +
      padL('kech', 7) +
      padL('kech %', 9) +
      padL("shtraf (so'm)", 15),
  );
  console.log('   ' + '─'.repeat(73));
  for (const r of couriers) {
    console.log(
      '   ' +
        pad((r.kuryer ?? '—').slice(0, 23), 24) +
        padL(fmt(r.belgilangan), 8) +
        padL(r.ortacha, 10) +
        padL(fmt(r.kech), 7) +
        padL(`${r.foiz}%`, 9) +
        padL(fmt(r.shtraf), 15),
    );
  }

  // ══════════════ XULOSA ══════════════
  const [sum]: Array<{
    jami: string;
    kech: string;
    ortacha: string;
    kuryerlar: string;
  }> = await dataSource.query(
    `
    SELECT COUNT(*)::text                                AS jami,
           COUNT(*) FILTER (WHERE kun > 4)::text         AS kech,
           ROUND(AVG(kun), 1)::text                      AS ortacha,
           COUNT(DISTINCT courier_id)::text              AS kuryerlar
    FROM (
      SELECT p.courier_id,
             FLOOR((COALESCE(o.sold_at, o.cancelled_at) - p.created_at) / ${DAY_MS}.0) AS kun
      ${BASE_FROM}
        AND COALESCE(o.sold_at, o.cancelled_at) IS NOT NULL
        AND COALESCE(o.sold_at, o.cancelled_at) >= p.created_at
        AND p.created_at >= $1
    ) t`,
    [since],
  );

  const late = Number(sum?.kech ?? 0);
  const total = Number(sum?.jami ?? 0);
  console.log(
    `\n📌 XULOSA (${windowDays} kun): ${fmt(total)} ta belgilangan buyurtma, ` +
      `${fmt(sum?.kuryerlar)} kuryer, o'rtacha ${sum?.ortacha} kun. ` +
      `4 kundan kech: ${fmt(late)} ta` +
      (total ? ` (${((100 * late) / total).toFixed(1)}%)` : '') +
      '.\n',
  );

  await dataSource.destroy();
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Skript xatosi:", e);
  process.exit(1);
});
