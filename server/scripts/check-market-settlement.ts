/**
 * MARKET HISOB-KITOB INVARIANTI.
 *
 *     cash_box.balance  ==  SUM(market_net − market_settled)
 *
 * Har bir market uchun: kassada turgan qarz buyurtmalar bo'yicha ochiq
 * qoldiqqa TENG bo'lishi kerak.
 *
 * ── NEGA KERAK ──────────────────────────────────────────────────────────
 *
 * 2026-09-23 gacha bu invariant HECH QAYERDA tekshirilmasdi va aynan
 * shu sabab nuqson oylab sezilmadi: market kassasi to'rt manbadan
 * yechilar (sotuv, tarifdan arzon sotuv, qo'shimcha xarajat, bekordagi
 * xarajat), to'lov halqasi esa faqat `to_be_paid` ni ko'rardi.
 * Natijada marketga kassadagi HAMMA pulni to'lasangiz ham buyurtmalar
 * yopilmay qolardi.
 *
 * Endi ikkala tomon bitta maydondan (`market_net`) hisoblanadi — bu
 * skript ular ajralib ketmayotganini qo'riqlaydi.
 *
 * ── REJIMLAR (db:check-cashbox bilan bir xil) ───────────────────────────
 *
 *   (argumentsiz)      — har qanday farq → exit 1 (strict)
 *   --snapshot=<path>  — farqlarni JSON ga yozadi, halt QILMAYDI (baseline)
 *   --compare=<path>   — baseline bilan solishtiradi; YANGI yoki
 *                        KATTALASHGAN farq → exit 1
 *
 * ⚠️ BASELINE SHART. 2026-09-16..23 oralig'ida to'plangan tarixiy
 * tafovut ATAYLAB tuzatilmagan (foydalanuvchi qarori: faqat kod
 * tuzatiladi, eski ma'lumotga tegilmaydi). Strict rejim shu sabab
 * hozircha qizil bo'ladi — deploy'da `--snapshot` / `--compare`
 * ishlatiladi.
 *
 * Deploy:
 *   Pre-migration:   npm run db:check-market-settlement -- --snapshot=/tmp/ms-pre.json
 *   Post-migration:  npm run db:check-market-settlement -- --compare=/tmp/ms-pre.json
 */
import 'reflect-metadata';
import * as fs from 'fs';
import dataSource from '../src/data-source';

interface DriftRow {
  market_id: string;
  market_name: string | null;
  balance: string;
  open_settlement: string;
  diff: string;
  open_orders: string;
}

function parseArg(prefix: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const snapshotPath = parseArg('--snapshot=');
  const comparePath = parseArg('--compare=');

  await dataSource.initialize();
  console.log('🔌 DB ulandi. Market hisob-kitob invarianti tekshirilmoqda...\n');

  /**
   * ⚠️ SXEMA DARVOZASI — MIGRATSIYADAN OLDIN ISHLAY OLISHI SHART.
   *
   * Bu skript deploy'da IKKI marta chaqiriladi:
   *   1. migratsiyadan OLDIN  (--snapshot, baseline olish)
   *   2. migratsiyadan KEYIN  (--compare)
   *
   * `market_net` / `market_settled` ustunlarini esa AYNAN o'sha
   * migratsiya yaratadi. Ya'ni birinchi chaqiruvda ular hali YO'Q.
   *
   * 2026-09-24 deploy'i shu sababli yiqildi:
   *     column o.market_net does not exist
   *     Error: Process completed with exit code 1
   * (migratsiya ishlamadi, baza tegilmadi — xato baseline bosqichida edi).
   *
   * Endi ustunlar yo'qligi XATO EMAS: baseline olinmaydi va buni
   * fayldagi `schema_ready: false` bayrog'i bildiradi. `--compare`
   * o'sha bayroqni ko'rib, birinchi ishga tushirish ekanini tushunadi.
   */
  const colRows: Array<{ n: string }> = await dataSource.query(
    `SELECT column_name AS n
       FROM information_schema.columns
      WHERE table_name = 'order'
        AND column_name IN ('market_net', 'market_settled')`,
  );
  const schemaReady = colRows.length === 2;

  if (!schemaReady) {
    console.log(
      "ℹ️  `market_net` / `market_settled` ustunlari hali yo'q —\n" +
        '   migratsiya qo\'llanmagan. Tekshiruv o\'tkazib yuborildi.',
    );
    await dataSource.destroy();

    if (snapshotPath) {
      fs.writeFileSync(
        snapshotPath,
        JSON.stringify(
          { taken_at: new Date().toISOString(), schema_ready: false, items: [] },
          null,
          2,
        ),
      );
      console.log(`💾 Bo'sh baseline yozildi: ${snapshotPath}`);
    }
    /**
     * ⚠️ `exit 0` — deploy TO'XTAMAYDI. Ustun yo'qligi nuqson emas,
     * shunchaki migratsiya hali qo'llanmagani.
     */
    process.exit(0);
  }

  /**
   * ⚠️ `deleted_at IS NULL` SHART. Soft-delete qilingan buyurtma
   * to'lov navbatiga tushmaydi (TypeORM uni avtomatik chiqaradi), demak
   * uning qoldig'i ham hisobga olinmasligi kerak. Aks holda skript
   * o'chirilgan buyurtmalar tufayli soxta farq ko'rsatardi.
   */
  const rows: DriftRow[] = await dataSource.query(`
    SELECT
      u.id                                   AS market_id,
      u.name                                 AS market_name,
      cb.balance::text                       AS balance,
      COALESCE(SUM(o.market_net - o.market_settled), 0)::text AS open_settlement,
      (cb.balance - COALESCE(SUM(o.market_net - o.market_settled), 0))::text AS diff,
      COUNT(o.id) FILTER (WHERE o.market_net <> o.market_settled)::text AS open_orders
    FROM users u
    JOIN cash_box cb
      ON cb.user_id = u.id AND cb.cashbox_type = 'markets'
    LEFT JOIN "order" o
      ON o.user_id = u.id AND o.deleted_at IS NULL
    WHERE u.role = 'market'
    GROUP BY u.id, u.name, cb.balance
    ORDER BY ABS(cb.balance - COALESCE(SUM(o.market_net - o.market_settled), 0)) DESC
  `);

  const drifted = rows.filter((r) => BigInt(r.diff) !== 0n);

  for (const r of drifted) {
    console.log(
      `⚠️  ${r.market_name ?? '-'} (${r.market_id})\n` +
        `    kassa=${r.balance}  ochiq_hisob=${r.open_settlement}  farq=${r.diff}` +
        `  (${r.open_orders} ta ochiq buyurtma)`,
    );
  }

  console.log(`\n📊 Jami: ${rows.length} ta market, ${drifted.length} ta farqli.`);

  await dataSource.destroy();

  // ── SNAPSHOT — baseline yozib qo'yamiz, halt qilmaymiz ────────────
  if (snapshotPath) {
    const payload = {
      taken_at: new Date().toISOString(),
      schema_ready: true,
      total: rows.length,
      drifted: drifted.length,
      items: drifted.map((r) => ({ market_id: r.market_id, diff: r.diff })),
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(payload, null, 2));
    console.log(`\n💾 Snapshot yozildi: ${snapshotPath}`);
    console.log(
      `ℹ️  Baseline rejimi — halt qilmaydi (${drifted.length} ta eski farq).`,
    );
    process.exit(0);
  }

  // ── COMPARE — baseline bilan solishtiramiz ────────────────────────
  if (comparePath) {
    if (!fs.existsSync(comparePath)) {
      console.log(`❌ Snapshot topilmadi: ${comparePath}`);
      process.exit(1);
    }
    const snap = JSON.parse(fs.readFileSync(comparePath, 'utf8')) as {
      schema_ready?: boolean;
      items: Array<{ market_id: string; diff: string }>;
    };

    /**
     * ⚠️ BIRINCHI ISHGA TUSHIRISH.
     *
     * Baseline olinganda ustunlar hali yo'q edi (`schema_ready: false`),
     * ya'ni taqqoslash uchun asos YO'Q. Migratsiya backfill'i
     * `market_net = to_be_paid` va `market_settled = paid_amount` qiladi,
     * demak hozirgi farqlar MIGRATSIYADAN OLDIN ham mavjud bo'lgan
     * tarixiy farqlar.
     *
     * Bo'sh baseline bilan solishtirsak ularning HAMMASI «yangi» bo'lib
     * ko'rinib, deploy'ni asossiz to'xtatardi. Shu sabab birinchi
     * yurishda hozirgi holat YANGI BASELINE sifatida qabul qilinadi.
     */
    if (snap.schema_ready === false) {
      console.log(
        '\nℹ️  Baseline migratsiyadan OLDIN olingan — ustunlar hali yo\'q edi.\n' +
          `   Bu BIRINCHI yurish: hozirgi ${drifted.length} ta farq tarixiy deb\n` +
          '   qabul qilinadi (migratsiya backfill\'i mavjud holatni ko\'chirgan).\n' +
          '   Keyingi deploylarda ular baseline bo\'lib xizmat qiladi.',
      );
      if (drifted.length > 0) {
        console.log(
          `   Eslatma: ${drifted.length} ta market uchun kassa va hisob-kitob\n` +
            '   mos kelmaydi — bu 2026-09 dagi ma\'lum tarixiy tafovut.',
        );
      }
      process.exit(0);
    }

    const prevMap = new Map(snap.items.map((it) => [it.market_id, it.diff]));

    const newDrifts: Array<{ id: string; before: string; after: string }> = [];
    for (const r of drifted) {
      const before = prevMap.get(r.market_id);
      if (!before) {
        newDrifts.push({ id: r.market_id, before: '0', after: r.diff });
      } else if (BigInt(before) !== BigInt(r.diff)) {
        newDrifts.push({ id: r.market_id, before, after: r.diff });
      }
    }

    if (newDrifts.length === 0) {
      console.log(
        `\n✅ Yangi farq yo'q — hammasi baseline-ga mos.` +
          ` (${drifted.length} ta eski farq o'zgarmadi)`,
      );
      process.exit(0);
    }

    console.log(`\n❌ YANGI/KATTALASHGAN FARQ (${newDrifts.length} ta):`);
    for (const d of newDrifts) {
      console.log(`   ${d.id}  ${d.before} → ${d.after}`);
    }
    console.log(
      "Market bilan hisob-kitob kassadan ajralib ketdi — marketga to'liq " +
        "to'lov qilinsa ham buyurtmalar yopilmay qoladi.",
    );
    process.exit(1);
  }

  // ── STRICT (argumentsiz) ──────────────────────────────────────────
  if (drifted.length === 0) {
    console.log('✅ Hammasi joyida — invariant saqlangan.');
    process.exit(0);
  }
  console.log(
    `\n❌ ${drifted.length} ta marketda kassa va hisob-kitob mos kelmaydi.`,
  );
  process.exit(1);
}

main().catch((e) => {
  console.error('❌ Skript xatosi:', e);
  process.exit(1);
});
