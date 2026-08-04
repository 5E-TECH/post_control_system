/**
 * Investor equity ledger invariant tekshiruvi (strict).
 *
 * Tekshiradi:
 *   1) Har investorda faqat BITTA ochiq ulush qatori (effective_to IS NULL).
 *   2) Ledger qatorlari faqat role='investor' userga bog'langan (orphan yo'q).
 *   3) amount > 0, ownership_bps 0..10000 (CHECK ustidan qo'shimcha himoya).
 *
 * Har qanday buzilish → exit 1 (deploy halt qiladi). Buzilish yo'q → exit 0.
 *
 * Deploy: migration'dan KEYIN `npm run db:check-investor-ledger`.
 */
import 'reflect-metadata';
import dataSource from '../src/data-source';

async function main() {
  await dataSource.initialize();
  console.log('🔌 DB ulandi. Investor ledger invariant tekshirilmoqda...\n');

  const problems: string[] = [];

  // 1) >1 ochiq ulush qatori.
  const multiOpen = await dataSource.query(`
    SELECT investor_id, COUNT(*) AS open_count
    FROM investor_ownership_stake
    WHERE effective_to IS NULL
    GROUP BY investor_id
    HAVING COUNT(*) > 1
  `);
  if (multiOpen.length) {
    problems.push(`${multiOpen.length} ta investorda >1 ochiq ulush qatori`);
  }

  // 2) Orphan yoki investor-bo'lmagan bog'lanishlar.
  const tables: [string, string][] = [
    ['investor_capital_contribution', 'kapital'],
    ['investor_ownership_stake', 'ulush'],
    ['investor_distribution', 'taqsimot'],
  ];
  for (const [table, label] of tables) {
    const bad = await dataSource.query(`
      SELECT COUNT(*)::int AS c
      FROM "${table}" t
      LEFT JOIN users u ON u.id = t.investor_id
      WHERE u.id IS NULL OR u.role <> 'investor'
    `);
    if (bad[0].c > 0) {
      problems.push(
        `${table}: ${bad[0].c} ta ${label} qatori investor bo'lmagan userga bog'langan`,
      );
    }
  }

  // 3) Qiymat cheklovlari.
  const negCap = await dataSource.query(
    `SELECT COUNT(*)::int AS c FROM investor_capital_contribution WHERE amount <= 0`,
  );
  const negDist = await dataSource.query(
    `SELECT COUNT(*)::int AS c FROM investor_distribution WHERE amount <= 0`,
  );
  const badBps = await dataSource.query(
    `SELECT COUNT(*)::int AS c FROM investor_ownership_stake WHERE ownership_bps < 0 OR ownership_bps > 10000`,
  );
  if (negCap[0].c) problems.push(`${negCap[0].c} ta kapital amount <= 0`);
  if (negDist[0].c) problems.push(`${negDist[0].c} ta taqsimot amount <= 0`);
  if (badBps[0].c) problems.push(`${badBps[0].c} ta ulush 0..10000 dan tashqarida`);

  await dataSource.destroy();

  if (problems.length) {
    console.error('❌ Investor ledger invariant BUZILDI:');
    for (const p of problems) console.error('   - ' + p);
    process.exit(1);
  }
  console.log('✅ Investor ledger invariant TOZA.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Xato:', e);
  try {
    await dataSource.destroy();
  } catch {
    // ignore
  }
  process.exit(1);
});
