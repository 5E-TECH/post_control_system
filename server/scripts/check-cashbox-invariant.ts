/**
 * Cashbox invariant tekshiruvi.
 *
 * Har bir kassaning hozirgi `balance` qiymati uning `cashbox_history` dagi
 * amount-lar yig'indisiga (operation_type bo'yicha signed) teng bo'lishi kerak.
 *
 * REJIMLAR:
 *   (argumentsiz)          — har qanday drift → exit 1 (strict)
 *   --snapshot=<path>      — drift-larni JSON-ga yozadi, halt QILMAYDI (baseline olish)
 *   --compare=<path>       — saqlangan JSON bilan solishtiradi;
 *                            YANGI yoki KATTALASHGAN drift → exit 1
 *                            (eski, o'zgarmagan drift — OK)
 *
 * Deploy workflow foydalanishi:
 *   Pre-migration:   npm run db:check-cashbox -- --snapshot=/tmp/cb-pre.json
 *   Post-migration:  npm run db:check-cashbox -- --compare=/tmp/cb-pre.json
 */
import 'reflect-metadata';
import * as fs from 'fs';
import dataSource from '../src/data-source';

interface DriftRow {
  cashbox_id: string;
  user_id: string | null;
  cashbox_type: string;
  current_balance: string;
  history_sum: string;
  diff: string;
}

function parseArg(prefix: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const snapshotPath = parseArg('--snapshot=');
  const comparePath = parseArg('--compare=');

  await dataSource.initialize();
  console.log('🔌 DB ulandi. Cashbox invariant tekshirilmoqda...\n');

  // cashbox_history.amount DOIM MUSBAT saqlanadi; kirim/chiqim
  // operation_type ('income' / 'expense') orqali aniqlanadi.
  const rows: DriftRow[] = await dataSource.query(`
    WITH signed AS (
      SELECT
        ch.cashbox_id,
        CASE
          WHEN ch.operation_type = 'income'  THEN  ch.amount
          WHEN ch.operation_type = 'expense' THEN -ch.amount
          ELSE 0
        END AS delta
      FROM cashbox_history ch
    )
    SELECT
      cb.id              AS cashbox_id,
      cb.user_id         AS user_id,
      cb.cashbox_type    AS cashbox_type,
      cb.balance::text   AS current_balance,
      COALESCE(SUM(s.delta), 0)::text AS history_sum,
      (cb.balance - COALESCE(SUM(s.delta), 0))::text AS diff
    FROM cash_box cb
    LEFT JOIN signed s ON s.cashbox_id = cb.id
    GROUP BY cb.id, cb.user_id, cb.cashbox_type, cb.balance
    ORDER BY ABS(cb.balance - COALESCE(SUM(s.delta), 0)) DESC
  `);

  // Faqat drift-li satrlarni ajratib olamiz (diff != 0)
  const drifted = rows.filter((r) => BigInt(r.diff) !== 0n);

  for (const r of drifted) {
    console.log(
      `⚠️  ${r.cashbox_type} (${r.cashbox_id})  user=${r.user_id ?? '-'}\n` +
        `    balance=${r.current_balance}  history_sum=${r.history_sum}  diff=${r.diff}`,
    );
  }

  console.log(`\n📊 Jami: ${rows.length} ta kassa, ${drifted.length} ta farqli.`);

  await dataSource.destroy();

  // ============================================================
  // SNAPSHOT REJIMI — baseline yozib qo'yamiz, halt qilmaymiz
  // ============================================================
  if (snapshotPath) {
    const payload = {
      taken_at: new Date().toISOString(),
      total: rows.length,
      drifted: drifted.length,
      items: drifted.map((r) => ({
        cashbox_id: r.cashbox_id,
        diff: r.diff,
      })),
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(payload, null, 2));
    console.log(`\n💾 Snapshot yozildi: ${snapshotPath}`);
    console.log(
      `ℹ️  Baseline rejimi — halt qilmaydi (${drifted.length} ta eski drift).`,
    );
    process.exit(0);
  }

  // ============================================================
  // COMPARE REJIMI — baseline bilan solishtiramiz
  // ============================================================
  if (comparePath) {
    if (!fs.existsSync(comparePath)) {
      console.log(`❌ Snapshot topilmadi: ${comparePath}`);
      process.exit(1);
    }
    const snap = JSON.parse(fs.readFileSync(comparePath, 'utf8')) as {
      items: Array<{ cashbox_id: string; diff: string }>;
    };
    const prevMap = new Map(snap.items.map((it) => [it.cashbox_id, it.diff]));

    const newDrifts: Array<{ id: string; before: string; after: string }> = [];
    for (const r of drifted) {
      const before = prevMap.get(r.cashbox_id);
      if (!before) {
        // butunlay yangi drift paydo bo'ldi
        newDrifts.push({ id: r.cashbox_id, before: '0', after: r.diff });
      } else if (BigInt(before) !== BigInt(r.diff)) {
        // mavjud drift hajmi o'zgargan
        newDrifts.push({ id: r.cashbox_id, before, after: r.diff });
      }
    }

    if (newDrifts.length === 0) {
      console.log(
        `\n✅ Yangi drift yo'q — barcha farqlar baseline-ga mos.` +
          ` (${drifted.length} ta eski drift o'zgarmadi)`,
      );
      process.exit(0);
    }

    console.log(`\n❌ YANGI/O'ZGARGAN DRIFT (${newDrifts.length} ta):`);
    for (const d of newDrifts) {
      console.log(`   ${d.id}  ${d.before} → ${d.after}`);
    }
    console.log('Migration yangi ma\'lumot buzilishini keltirib chiqardi!');
    process.exit(1);
  }

  // ============================================================
  // STRICT REJIMI (argumentsiz) — eski xatti-harakat
  // ============================================================
  if (drifted.length === 0) {
    console.log('✅ Hammasi joyida — invariant saqlangan.');
    process.exit(0);
  } else {
    console.log('❌ Farqlar topildi. Tekshirishni so\'rang.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
