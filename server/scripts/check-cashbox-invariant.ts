/**
 * Cashbox invariant tekshiruvi.
 *
 * Har bir kassaning hozirgi `balance` qiymati uning `cashbox_history` dagi
 * `amount` summasiga teng bo'lishi kerak. Agar farq bo'lsa — ma'lumotlar
 * buzilgan (yoki history yozilmasdan balance o'zgartirilgan).
 *
 * Foydalanish:
 *   npm run db:check-cashbox
 *
 * Deploy oldidan VA keyin ishga tushiring. Farq bo'lmasligi kerak.
 */
import 'reflect-metadata';
import dataSource from '../src/data-source';

interface DriftRow {
  cashbox_id: string;
  user_id: string | null;
  cashbox_type: string;
  current_balance: string;
  history_sum: string;
  diff: string;
}

async function main() {
  await dataSource.initialize();
  console.log('🔌 DB ulandi. Cashbox invariant tekshirilmoqda...\n');

  const rows: DriftRow[] = await dataSource.query(`
    SELECT
      cb.id              AS cashbox_id,
      cb.user_id         AS user_id,
      cb.cashbox_type    AS cashbox_type,
      cb.balance::text   AS current_balance,
      COALESCE(SUM(ch.amount), 0)::text AS history_sum,
      (cb.balance - COALESCE(SUM(ch.amount), 0))::text AS diff
    FROM cash_box cb
    LEFT JOIN cashbox_history ch ON ch.cashbox_id = cb.id
    GROUP BY cb.id, cb.user_id, cb.cashbox_type, cb.balance
    ORDER BY ABS(cb.balance - COALESCE(SUM(ch.amount), 0)) DESC
  `);

  let drifted = 0;
  for (const r of rows) {
    const diff = BigInt(r.diff);
    if (diff !== 0n) {
      drifted++;
      console.log(
        `⚠️  ${r.cashbox_type} (${r.cashbox_id})  user=${r.user_id ?? '-'}\n` +
          `    balance=${r.current_balance}  history_sum=${r.history_sum}  diff=${r.diff}`,
      );
    }
  }

  console.log(`\n📊 Jami: ${rows.length} ta kassa, ${drifted} ta farqli.`);

  if (drifted === 0) {
    console.log('✅ Hammasi joyida — invariant saqlangan.');
  } else {
    console.log('❌ Farqlar topildi. Tekshirishni so\'rang.');
  }

  await dataSource.destroy();
  process.exit(drifted === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
