/**
 * KURYER SHTRAF MODULI — PUL INVARIANTLARI.
 *
 * ── NIMANI QO'RIQLAYDI ──────────────────────────────────────────────────
 *
 * Shtraf IKKI joyga yoziladi: shtraf daftariga (`courier_penalty_entry`)
 * va kuryer kassasiga (`cashbox_history`). Ular AJRALIB ketsa pul
 * yo'qoladi yoki qo'shaloq undiriladi, va buni hech kim sezmaydi —
 * kassa invarianti (`balance == Σtarix`) ikkalasini ham to'g'ri deb
 * ko'rsataveradi, chunki u daftarni UMUMAN ko'rmaydi.
 *
 * ⚠️ NEGA MAVJUD DARVOZALAR YETARLI EMAS. `check-cashbox` snapshot/compare
 * naqshida ishlaydi: baseline HAR DEPLOYDA qayta olinadi, ya'ni ikki
 * deploy ORASIDA kod yaratgan drift keyingi deployda jim qabul qilinadi.
 * Bu skript esa STRICT — baseline yo'q, har qanday buzilish exit 1.
 *
 * ── ISHORA SHARTNOMASI ──────────────────────────────────────────────────
 *
 * Daftardagi `amount` ISHORALI: musbat = kuryer qarzi OSHADI (shtraf),
 * manfiy = KAMAYADI (bonus yoki bekor qilish). Kuryer kassasida musbat
 * balans = qarz, shuning uchun musbat summa `income` ga, manfiy
 * `expense` ga mos keladi.
 *
 * ── SOYA REJIMI ─────────────────────────────────────────────────────────
 *
 * `shadow = true` qatorlar PULGA TEGMAGAN. Ular kassada aks etmasligi
 * SHART va hech qachon «real» ga aylantirilmaydi — backfill qilinsa
 * kuryerlardan ogohlantirmasdan o'tgan davr uchun pul yechilardi.
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
  why: string;
  sql: string;
}

/**
 * ⚠️ `::text` solishtirish ATAYLAB: enum qiymati (`courier_penalty`)
 * migratsiya bilan qo'shiladi va skript migratsiyadan OLDIN ham
 * yurishi mumkin. Enum bilan to'g'ridan-to'g'ri solishtirish u holda
 * «invalid input value» xatosi berib, tekshiruvni emas, DEPLOYNI
 * yiqitardi.
 */
const CHECKS: Check[] = [
  {
    code: 'I-CP1',
    title: 'Haqiqiy daftar qatorining kassa langari BOR',
    why:
      "`shadow=false` degani pul kuryer kassasiga yozilgan. Langar yo'q bo'lsa " +
      'daftar «undirdim» deydi-yu, kuryer qarzi o\'zgarmagan bo\'ladi.',
    sql: `
      SELECT e.id::text AS id,
             'kuryer ' || e.courier_id || ', summa ' || e.amount AS detail
      FROM courier_penalty_entry e
      WHERE e.shadow = false AND e.cashbox_history_id IS NULL
    `,
  },
  {
    code: 'I-CP2',
    title: 'Soya qatori kassaga TEGMAGAN',
    why:
      'Soya rejimi — hisob ishlaydi, pul tegilmaydi. Soya qatorida kassa ' +
      'langari paydo bo\'lsa, kuryerdan ogohlantirmasdan pul yechilgan.',
    sql: `
      SELECT e.id::text AS id, 'langar ' || e.cashbox_history_id AS detail
      FROM courier_penalty_entry e
      WHERE e.shadow = true AND e.cashbox_history_id IS NOT NULL
    `,
  },
  {
    code: 'I-CP3',
    title: "Langar TO'G'RI kassa yozuviga ishora qiladi",
    why:
      'Langar boshqa kuryerning yoki boshqa turdagi yozuvga ishora qilsa, ' +
      'daftar bilan kassa boshqa-boshqa narsani ko\'rsatadi va yig\'indi ' +
      'tasodifan to\'g\'ri chiqishi mumkin.',
    sql: `
      SELECT e.id::text AS id,
             'tur=' || h.source_type::text ||
             ', yo''nalish=' || h.operation_type::text ||
             ', summa=' || h.amount AS detail
      FROM courier_penalty_entry e
      JOIN cashbox_history h ON h.id = e.cashbox_history_id
      JOIN cash_box cb ON cb.id = h.cashbox_id
      WHERE e.shadow = false
        AND (
          h.source_type::text <> 'courier_penalty'
          OR cb.cashbox_type::text <> 'couriers'
          OR cb.user_id IS DISTINCT FROM e.courier_id
          OR h.source_id IS DISTINCT FROM e.order_id
          OR h.amount <> ABS(e.amount)
          OR h.operation_type::text <>
             CASE WHEN e.amount > 0 THEN 'income' ELSE 'expense' END
        )
    `,
  },
  {
    code: 'I-CP4',
    title: 'Bitta kassa yozuvi IKKI daftar qatoriga bog‘lanmagan',
    why:
      'Ikki qator bitta langarni ulashsa, yig\'indi ikki barobar ko\'rinadi ' +
      'va bekor qilish bittasini qaytarib, ikkinchisini osilgan qoldiradi.',
    sql: `
      SELECT cashbox_history_id::text AS id,
             count(*)::text || ' ta qator' AS detail
      FROM courier_penalty_entry
      WHERE cashbox_history_id IS NOT NULL
      GROUP BY cashbox_history_id
      HAVING count(*) > 1
    `,
  },
  {
    code: 'I-CP5',
    title: 'Egasiz shtraf kassa yozuvi yo‘q',
    why:
      "Kassada `courier_penalty` yozuvi bor, daftarda esa yo'q — ya'ni pul " +
      'yechilgan, lekin sababi hech qayerda qayd etilmagan. Kuryer «bu nima» ' +
      'deb so\'rasa javob bo\'lmaydi.',
    sql: `
      SELECT h.id::text AS id,
             'summa ' || h.amount || ', ' || h.operation_type::text AS detail
      FROM cashbox_history h
      LEFT JOIN courier_penalty_entry e ON e.cashbox_history_id = h.id
      WHERE h.source_type::text = 'courier_penalty' AND e.id IS NULL
    `,
  },
  {
    code: 'I-CP6',
    title: 'Kuryer bo‘yicha daftar yig‘indisi = kassa yig‘indisi',
    why:
      'ASOSIY SAVOL: daftar nima deyayotgan bo\'lsa, kuryer kassasida ham ' +
      'AYNAN shuncha bo\'lishi kerak. Farq chiqsa — yo pul ikki marta ' +
      'yechilgan, yo umuman yechilmagan.',
    /**
     * ⚠️ O'CHIRILGAN KURYER ISTISNO. Kuryer qattiq o'chirilsa `cash_box`
     * CASCADE ketadi va `cashbox_history` ham yo'qoladi; daftar qatori esa
     * FK `ON DELETE SET NULL` tufayli langarsiz qoladi. Bunday holat
     * I-CP1 da ko'rinadi, bu yerda esa ABADIY qizil chiroq yoqib,
     * tuzatish yo'lini yopib qo'yardi.
     */
    sql: `
      WITH ledger AS (
        SELECT e.courier_id, COALESCE(SUM(e.amount), 0) AS ledger_sum
        FROM courier_penalty_entry e
        JOIN users u ON u.id = e.courier_id
        WHERE e.shadow = false
        GROUP BY e.courier_id
      ),
      cash AS (
        SELECT cb.user_id AS courier_id,
               COALESCE(SUM(
                 CASE WHEN h.operation_type::text = 'income'
                      THEN h.amount ELSE -h.amount END
               ), 0) AS cash_sum
        FROM cashbox_history h
        JOIN cash_box cb ON cb.id = h.cashbox_id
        WHERE h.source_type::text = 'courier_penalty'
          AND cb.cashbox_type::text = 'couriers'
        GROUP BY cb.user_id
      )
      SELECT COALESCE(l.courier_id, c.courier_id)::text AS id,
             'daftar=' || COALESCE(l.ledger_sum, 0) ||
             ', kassa=' || COALESCE(c.cash_sum, 0) ||
             ', farq=' || (COALESCE(l.ledger_sum, 0) - COALESCE(c.cash_sum, 0))
               AS detail
      FROM ledger l
      FULL OUTER JOIN cash c ON c.courier_id = l.courier_id
      WHERE COALESCE(l.ledger_sum, 0) <> COALESCE(c.cash_sum, 0)
    `,
  },
];

async function main(): Promise<void> {
  await dataSource.initialize();

  /**
   * Jadval hali yo'q bo'lsa (migratsiya ishlamagan) — bu xato EMAS.
   * Birinchi deployda skript migratsiyadan oldin ham yurishi mumkin.
   */
  const exists = await dataSource.query<Array<{ ok: boolean }>>(`
    SELECT to_regclass('public.courier_penalty_entry') IS NOT NULL AS ok
  `);
  if (!exists?.[0]?.ok) {
    console.log(
      "ℹ️  `courier_penalty_entry` jadvali yo'q — migratsiya hali ishlamagan. O'tkazib yuborildi.",
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

  // Ma'lumot uchun: modul qaysi rejimda.
  const [cfg] = await dataSource.query<
    Array<{ is_active: boolean; real_rows: string }>
  >(`
    SELECT c.is_active,
           (SELECT count(*) FROM courier_penalty_entry WHERE shadow = false)::text
             AS real_rows
    FROM courier_penalty_config c
    LIMIT 1
  `);
  if (cfg) {
    console.log(
      `\nℹ️  Modul: ${cfg.is_active ? 'YOQILGAN' : 'soya rejimi'} · ` +
        `haqiqiy yozuvlar: ${cfg.real_rows}`,
    );
  }

  await dataSource.destroy();

  console.log(`\n${total - failed}/${total} invariant o'tdi`);
  if (failed > 0) {
    console.error(
      `\n❌ ${failed} ta invariant BUZILGAN — deploy to'xtatildi.\n` +
        '   Shtraf daftari bilan kuryer kassasi ajralib ketgan. Bu real pul\n' +
        "   nomutanosibligi, uni e'tiborsiz qoldirmang.",
    );
    process.exit(1);
  }
  console.log('🎉 Kuryer shtraf invariantlari toza.');
}

main().catch((e) => {
  console.error('❌ Tekshiruv bajarilmadi:', e instanceof Error ? e.message : e);
  process.exit(1);
});
