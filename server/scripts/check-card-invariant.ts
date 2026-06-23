/**
 * Virtual karta invariant tekshiruvi.
 *
 * Har bir MAIN kassada virtual kartalarning `balance` yig'indisi shu kassaning
 * `balance_card` qiymatiga TENG bo'lishi kerak:
 *     SUM(cashbox_card.balance) === cash_box.balance_card
 *
 * REJIMLAR (check-cashbox-invariant.ts bilan bir xil):
 *   (argumentsiz)          — har qanday drift → exit 1 (strict)
 *   --snapshot=<path>      — drift-larni JSON-ga yozadi, halt QILMAYDI (baseline)
 *   --compare=<path>       — saqlangan JSON bilan solishtiradi; yangi/kattalashgan
 *                            drift → exit 1
 *
 * Deploy workflow:
 *   Pre-migration:   npm run db:check-cards -- --snapshot=/tmp/cards-pre.json
 *   Post-migration:  npm run db:check-cards -- --compare=/tmp/cards-pre.json
 */
import 'reflect-metadata';
import * as fs from 'fs';
import dataSource from '../src/data-source';

interface DriftRow {
  cashbox_id: string;
  cashbox_type: string;
  balance_card: string;
  cards_sum: string;
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
  console.log('🔌 DB ulandi. Virtual karta invariant tekshirilmoqda...\n');

  const rows: DriftRow[] = await dataSource.query(`
    SELECT
      cb.id                AS cashbox_id,
      cb.cashbox_type      AS cashbox_type,
      cb.balance_card::text AS balance_card,
      COALESCE(SUM(c.balance), 0)::text AS cards_sum,
      (cb.balance_card - COALESCE(SUM(c.balance), 0))::text AS diff
    FROM cash_box cb
    LEFT JOIN cashbox_card c ON c.cashbox_id = cb.id
    WHERE cb.cashbox_type = 'main'
    GROUP BY cb.id, cb.cashbox_type, cb.balance_card
    ORDER BY ABS(cb.balance_card - COALESCE(SUM(c.balance), 0)) DESC
  `);

  const drifted = rows.filter((r) => BigInt(r.diff) !== 0n);

  for (const r of drifted) {
    console.log(
      `⚠️  ${r.cashbox_type} (${r.cashbox_id})\n` +
        `    balance_card=${r.balance_card}  cards_sum=${r.cards_sum}  diff=${r.diff}`,
    );
  }

  console.log(
    `\n📊 Jami: ${rows.length} ta MAIN kassa, ${drifted.length} ta farqli.`,
  );

  await dataSource.destroy();

  if (snapshotPath) {
    const payload = {
      taken_at: new Date().toISOString(),
      total: rows.length,
      drifted: drifted.length,
      items: drifted.map((r) => ({ cashbox_id: r.cashbox_id, diff: r.diff })),
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(payload, null, 2));
    console.log(`\n💾 Snapshot yozildi: ${snapshotPath}`);
    process.exit(0);
  }

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
        newDrifts.push({ id: r.cashbox_id, before: '0', after: r.diff });
      } else if (BigInt(before) !== BigInt(r.diff)) {
        newDrifts.push({ id: r.cashbox_id, before, after: r.diff });
      }
    }

    if (newDrifts.length === 0) {
      console.log(`\n✅ Yangi drift yo'q — barcha farqlar baseline-ga mos.`);
      process.exit(0);
    }

    console.log(`\n❌ YANGI/O'ZGARGAN DRIFT (${newDrifts.length} ta):`);
    for (const d of newDrifts) {
      console.log(`   ${d.id}  ${d.before} → ${d.after}`);
    }
    process.exit(1);
  }

  if (drifted.length === 0) {
    console.log('✅ Hammasi joyida — karta invariant saqlangan.');
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
