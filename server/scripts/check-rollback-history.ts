/**
 * ROLLBACK TARIX YO'NALISHI — tekshiruv (FAQAT O'QIYDI).
 *
 * ── NIMA TEKSHIRADI ─────────────────────────────────────────────────────
 *
 * 2026-09-16 (commit `4a525a5f`) dan 2026-09-23 gacha `rollbackOrderToWaiting`
 * kassaga PUL QAYTARGANDA ham qatorni `expense` (chiqim) deb yozardi.
 * `cash_box.balance` HAR DOIM to'g'ri edi — buzilgani faqat tarix qatorining
 * YO'NALISHI va undan hisoblanadigan «Chiqim» yig'indisi.
 *
 * Aniqlash mezoni ISHONCHLI: qator `expense` deb yozilgan, LEKIN
 * `balance_after` oldingi qatorga nisbatan OSHGAN. Chiqim balansni
 * oshira olmaydi — demak qator buzuq. Tarifdan qayta hisoblashga
 * TAYANMAYDI (tarif keyin o'zgargan bo'lishi mumkin).
 *
 * ── XAVFSIZLIK ──────────────────────────────────────────────────────────
 *
 * ⚠️ Bu skript BIRORTA ham yozuv buyrug'i bajarmaydi. Istalgan vaqtda,
 * istalgan marta ishga tushirish mumkin. `DB_URL` ni qo'lda yozish ham
 * shart emas — `.env` dan avtomatik olinadi.
 *
 * Tuzatish ALOHIDA: `scripts/fix-rollback-history-direction.sql`.
 * Uni FAQAT shu tekshiruv 0 dan katta son qaytargandan keyin,
 * va FAQAT yangi kod deploy qilingandan keyin ishlating.
 *
 * Ishlatish:  npm run db:check-rollback-history
 */
import 'reflect-metadata';
import dataSource from '../src/data-source';

interface BrokenRow {
  history_id: string;
  cashbox_type: string;
  order_number: string | null;
  amount: string;
  prev_balance: string;
  balance_after: string;
  haqiqiy_delta: string;
  vaqt: string;
}

const DETECT = `
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
    h.id::text                            AS history_id,
    c.cashbox_type::text                  AS cashbox_type,
    o.order_number::text                  AS order_number,
    h.amount::text                        AS amount,
    h.prev_balance::text                  AS prev_balance,
    h.balance_after::text                 AS balance_after,
    (h.balance_after - h.prev_balance)::text AS haqiqiy_delta,
    to_char(to_timestamp(h.created_at / 1000), 'YYYY-MM-DD HH24:MI') AS vaqt
  FROM h
  JOIN cash_box c     ON c.id = h.cashbox_id
  LEFT JOIN "order" o ON o.id = h.source_id
  WHERE h.source_type    = 'correction'
    AND h.operation_type = 'expense'
    AND h.comment LIKE '[ROLLBACK]%'
    AND h.prev_balance IS NOT NULL
    AND (h.balance_after - h.prev_balance) > 0
  ORDER BY h.created_at
`;

async function main() {
  await dataSource.initialize();
  console.log('🔌 DB ulandi. Rollback tarix yo\'nalishi tekshirilmoqda...\n');

  const rows: BrokenRow[] = await dataSource.query(DETECT);

  if (rows.length === 0) {
    console.log('✅ Buzuq qator YO\'Q — tuzatish KERAK EMAS.');
    console.log('   `fix-rollback-history-direction.sql` ni ishlatmang.');
    await dataSource.destroy();
    process.exit(0);
  }

  console.log(`⚠️  ${rows.length} ta buzuq qator topildi:\n`);
  for (const r of rows) {
    console.log(
      `   #${r.order_number ?? '-'}  ${r.cashbox_type}  ${r.vaqt}\n` +
        `       yozilgan: chiqim ${r.amount}  |  haqiqiy: +${r.haqiqiy_delta}` +
        `  (balans ${r.prev_balance} → ${r.balance_after})`,
    );
  }

  const total = rows.reduce((s, r) => s + BigInt(r.amount), 0n);
  const cashboxes = new Set(rows.map((r) => r.cashbox_type)).size;

  console.log(
    `\n📊 Jami: ${rows.length} ta qator, ${cashboxes} xil kassa turi.\n` +
      `   Hisobotlarda «Chiqim» ${total} so'mga OSHIB, «Kirim» shuncha KAM ko'rinadi.\n`,
  );
  console.log(
    'ℹ️  Bu KO\'RINISH xatosi — `cash_box.balance` va buyurtma statuslari TO\'G\'RI.\n' +
      '   Tuzatish (ixtiyoriy, yangi kod deploydan KEYIN):\n' +
      '     psql "$DB_URL" -f scripts/fix-rollback-history-direction.sql',
  );

  await dataSource.destroy();
  /**
   * ⚠️ `exit 0` — ATAYLAB. Bu tekshiruv deploy'ni TO'XTATMASLIGI kerak:
   * topilgan narsa tarixiy ko'rinish xatosi, pul harakati emas.
   */
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Skript xatosi:', e);
  process.exit(1);
});
