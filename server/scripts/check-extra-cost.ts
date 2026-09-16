/**
 * QO'SHIMCHA XARAJAT — REKONSILIATSIYA DARVOZASI.
 *
 * `check-cashbox-invariant.ts` kassa balansini tarix bilan solishtiradi, lekin
 * u qo'shimcha xarajat SO'ROVLARI bilan kassa yozuvlari o'rtasidagi bog'lanishni
 * KO'RMAYDI. Aynan shu bog'lanishda ikkita eng qimmat xato yashaydi:
 *
 *   "tasdiqlangan, lekin to'lanmagan" — market tasdiqladi, kassa yozuvi esa
 *   yaratilmadi. Kuryer pulni kutib qoladi, hech kim sezmaydi.
 *
 *   "rad etilgan, lekin to'langan" — rad etish kassaga yozuv qoldirgan.
 *   Market rad etgan pulni baribir to'laydi.
 *
 * Ishlatish:
 *   npm run db:check-extra-cost
 *
 * Har qanday buzilgan invariant → exit 1 (CI darvozasi).
 */
import 'reflect-metadata';
import dataSource from '../src/data-source';

interface Violation {
  id: string;
  detail: string;
}

interface Check {
  code: string;
  title: string;
  sql: string;
  /** Nima uchun bu muhim — xato chiqqanda ko'rsatiladi. */
  why: string;
}

const CHECKS: Check[] = [
  {
    code: 'I1',
    title: "Tasdiqlangan so'rovda ikkala kassa yozuvi ham bo'lishi shart",
    why:
      "So'rov `approved`, lekin langar yo'q — kuryerga pul YOZILMAGAN " +
      'bo\'lishi mumkin. Bu "tasdiqladim" deb ko\'rsatib, to\'lamaslik holati.',
    sql: `
      SELECT id,
             'market_history_id=' || COALESCE(market_history_id::text, 'NULL') ||
             ', courier_history_id=' || COALESCE(courier_history_id::text, 'NULL') AS detail
        FROM extra_cost_request
       WHERE status = 'approved'
         AND (market_history_id IS NULL OR courier_history_id IS NULL)
    `,
  },
  {
    code: 'I2',
    title: "Tasdiqlangan so'rov summasi kassa yozuvlariga MOS bo'lishi shart",
    why:
      "So'rovda bir summa, kassada boshqa summa — biri noto'g'ri. Qaysi biri " +
      "ekanini keyin aniqlash deyarli imkonsiz bo'ladi.",
    sql: `
      SELECT r.id,
             'ecr=' || r.amount || ', market=' || COALESCE(mh.amount::text,'-') ||
             ', courier=' || COALESCE(ch.amount::text,'-') AS detail
        FROM extra_cost_request r
        LEFT JOIN cashbox_history mh ON mh.id = r.market_history_id
        LEFT JOIN cashbox_history ch ON ch.id = r.courier_history_id
       WHERE r.status = 'approved'
         AND (mh.amount IS DISTINCT FROM r.amount
           OR ch.amount IS DISTINCT FROM r.amount)
    `,
  },
  {
    code: 'I3',
    title: "Rad etilgan/bekor qilingan so'rov kassaga YOZMAGAN bo'lishi shart",
    why:
      'Rad etish hech qachon pul harakatlantirmasligi kerak. Langar bo\'lsa — ' +
      "market rad etgan pulni baribir to'lagan.",
    sql: `
      SELECT id, 'status=' || status AS detail
        FROM extra_cost_request
       WHERE status IN ('rejected', 'void', 'awaiting_proof', 'pending')
         AND (market_history_id IS NOT NULL OR courier_history_id IS NOT NULL)
    `,
  },
  {
    code: 'I4',
    title: "Bir buyurtmada bir vaqtda faqat BITTA ochiq so'rov",
    why:
      "Ikkita ochiq so'rov — bitta xarajat ikki marta tasdiqlanishi mumkin " +
      'degani. `UQ_ECR_ORDER_OPEN` buni to\'sadi; bu tekshiruv indeks ' +
      'tasodifan olib tashlangan holatni ushlaydi.',
    sql: `
      SELECT order_id AS id, 'ochiq so''rovlar: ' || COUNT(*) AS detail
        FROM extra_cost_request
       WHERE status IN ('awaiting_proof', 'pending')
       GROUP BY order_id
      HAVING COUNT(*) > 1
    `,
  },
  {
    code: 'I5',
    title: 'Bir kassa yozuvi ikki so‘rovga bog‘lanmasin',
    why:
      'Bitta to\'lov ikki so\'rovni "to\'langan" qilib ko\'rsatardi, ya\'ni ' +
      "ikkinchisi bepul o'tib ketardi.",
    sql: `
      SELECT market_history_id AS id, 'market yozuvi ' || COUNT(*) || ' so''rovda' AS detail
        FROM extra_cost_request
       WHERE market_history_id IS NOT NULL
       GROUP BY market_history_id
      HAVING COUNT(*) > 1
       UNION ALL
      SELECT courier_history_id AS id, 'kuryer yozuvi ' || COUNT(*) || ' so''rovda' AS detail
        FROM extra_cost_request
       WHERE courier_history_id IS NOT NULL
       GROUP BY courier_history_id
      HAVING COUNT(*) > 1
    `,
  },
  {
    code: 'I6',
    title: 'Buyurtma bo‘yicha market va kuryer chiqimlari SIMMETRIK',
    why:
      'Ikkalasi bir xil bo\'lishi shart: market to\'laydi, kuryer oladi. ' +
      "Nomutanosiblik moliyaviy tarozini (main + Σcourier − Σmarket) jimgina " +
      'siljitadi va uni keyin topish juda qiyin.',
    sql: `
      WITH sums AS (
        SELECT h.source_id AS order_id,
               SUM(CASE WHEN c.cashbox_type = 'markets'  THEN h.amount ELSE 0 END) AS market_sum,
               SUM(CASE WHEN c.cashbox_type = 'couriers' THEN h.amount ELSE 0 END) AS courier_sum
          FROM cashbox_history h
          JOIN cash_box c ON c.id = h.cashbox_id
         WHERE h.source_type = 'extra_cost'
           AND h.operation_type = 'expense'
           AND h.source_id IS NOT NULL
         GROUP BY h.source_id
      )
      SELECT order_id AS id,
             'market=' || market_sum || ', kuryer=' || courier_sum AS detail
        FROM sums
       WHERE market_sum <> courier_sum
    `,
  },
  {
    code: 'I7',
    title: "Ochiq so'rov kassaga TEGMAGAN bo'lishi shart",
    why:
      "Eng muhim qoida. `reverseExtraCostForCashbox` idempotentlikni " +
      'SUM(EXTRA_COST) − SUM(CORRECTION) net-hisobi bilan quradi. ' +
      'Tasdiqlanmagan xarajat kassaga tushsa, keyingi rollback YO\'QDAN PUL ' +
      'YARATADI — hech qachon berilmagan pulni "qaytaradi".',
    sql: `
      SELECT r.id,
             'ochiq so''rov, lekin kassada ' || COUNT(h.id) || ' yozuv bor' AS detail
        FROM extra_cost_request r
        JOIN cashbox_history h
          ON h.source_id = r.order_id
         AND h.source_type = 'extra_cost'
         AND h.operation_type = 'expense'
         AND h.created_at >= r.created_at
       WHERE r.status IN ('awaiting_proof', 'pending')
       GROUP BY r.id
    `,
  },
];

async function main(): Promise<void> {
  await dataSource.initialize();

  // Jadval hali yaratilmagan bo'lsa (migration ishlamagan) — bu xato emas.
  const exists = await dataSource.query<Array<{ ok: boolean }>>(`
    SELECT to_regclass('public.extra_cost_request') IS NOT NULL AS ok
  `);
  if (!exists?.[0]?.ok) {
    console.log(
      "ℹ️  `extra_cost_request` jadvali yo'q — migration hali ishlamagan. O'tkazib yuborildi.",
    );
    await dataSource.destroy();
    return;
  }

  let failed = 0;
  let total = 0;

  for (const check of CHECKS) {
    const rows = await dataSource.query<Violation[]>(check.sql);
    total++;
    if (!rows.length) {
      console.log(`✅ ${check.code}  ${check.title}`);
      continue;
    }
    failed++;
    console.error(`\n❌ ${check.code}  ${check.title}`);
    console.error(`   NEGA MUHIM: ${check.why}`);
    console.error(`   Buzilgan qatorlar: ${rows.length}`);
    for (const r of rows.slice(0, 10)) {
      console.error(`     - ${r.id}: ${r.detail}`);
    }
    if (rows.length > 10) {
      console.error(`     ... yana ${rows.length - 10} ta`);
    }
  }

  await dataSource.destroy();

  console.log(`\n${total - failed}/${total} invariant o'tdi`);
  if (failed > 0) {
    console.error(
      `\n❌ ${failed} ta invariant BUZILGAN — deploy to'xtatildi.\n` +
        "   Bu pul nomutanosibligini bildiradi, uni e'tiborsiz qoldirmang.",
    );
    process.exit(1);
  }
  console.log('🎉 Qo\'shimcha xarajat invariantlari toza.');
}

main().catch((e) => {
  console.error('❌ Tekshiruv bajarilmadi:', e instanceof Error ? e.message : e);
  process.exit(1);
});
