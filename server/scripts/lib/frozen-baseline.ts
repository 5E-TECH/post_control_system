import * as fs from 'fs';
import * as path from 'path';

/**
 * ══════════════ MUZLATILGAN BASELINE ══════════════
 *
 * ⚠️ NEGA KERAK — DEPLOY DARVOZASINING KO'R NUQTASI.
 *
 * `--snapshot` / `--compare` juftligi HAR DEPLOYDA baseline'ni QAYTA
 * oladi (`/tmp/ms-pre.json` qayta yoziladi). Ya'ni u faqat bitta
 * savolga javob beradi: «shu migratsiya biror narsani buzdimi?».
 *
 * Ikki deploy ORASIDA to'plangan farq esa keyingi deployda yangi
 * baseline bo'lib JIMGINA qabul qilinadi. Natijada raqam deploydan
 * deployga o'sib boradi va har safar yashil chiqadi — 2026-10-06 da
 * market hisob-kitobida aynan shunday bo'ldi: 210 marketdan 152 tasi
 * farqli, lekin darvoza «yangi farq yo'q» dedi (va TO'G'RI dedi —
 * o'sish migratsiyadan emas, kundalik ishdan).
 *
 * Muzlatilgan baseline — QO'ZG'ALMAS tayanch nuqta: bir marta yoziladi
 * va keyin HECH QACHON qayta yozilmaydi. Har deploy aynan o'shanga
 * nisbatan o'lchaydi, shuning uchun deploylar orasidagi o'sish ham
 * ko'rinadi.
 *
 * ⚠️ FAYL REPODAN TASHQARIDA. `git reset --hard` (deploy.yml:139) repo
 * ichidagi kuzatilmaydigan faylni o'chirib yuborardi va baseline har
 * deployda qaytadan «muzlardi» — ya'ni hech qachon muzlamasdi.
 *
 * ⚠️ HECH QACHON `exit 1` QILMAYDI. Bu o'lchov asbobi, darvoza emas:
 * tarixiy tafovut foydalanuvchi qarori bilan ataylab tuzatilmagan
 * (2026-09-23), deployni to'xtatish nomutanosib javob bo'lardi.
 */

export interface FrozenItem {
  id: string;
  diff: string;
}

interface FrozenFile {
  frozen_at: string;
  label: string;
  total: number;
  drifted: number;
  /** Farqlarning ISHORALI yig'indisi (so'm). */
  sum: string;
  items: FrozenItem[];
}

const fmt = (v: bigint): string => {
  const neg = v < 0n;
  const s = (neg ? -v : v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '-' : '') + s;
};

const sumOf = (items: FrozenItem[]): bigint =>
  items.reduce((acc, it) => acc + BigInt(it.diff), 0n);

/**
 * Muzlatilgan baseline bilan solishtiradi (yoki birinchi marta yozadi).
 *
 * @returns `true` — o'sish aniqlandi (faqat ma'lumot uchun; chaqiruvchi
 *          baribir `exit 0` qiladi).
 */
export function compareFrozen(
  freezePath: string,
  label: string,
  total: number,
  current: FrozenItem[],
): boolean {
  const currentSum = sumOf(current);

  // ── Birinchi yurish: muzlatamiz ──
  if (!fs.existsSync(freezePath)) {
    fs.mkdirSync(path.dirname(freezePath), { recursive: true });
    const payload: FrozenFile = {
      frozen_at: new Date().toISOString(),
      label,
      total,
      drifted: current.length,
      sum: currentSum.toString(),
      items: current,
    };
    fs.writeFileSync(freezePath, JSON.stringify(payload, null, 2));
    console.log(
      `\n🧊 BASELINE MUZLATILDI: ${freezePath}\n` +
        `   ${label}: ${current.length}/${total} ta farqli, jami ${fmt(currentSum)} so'm.\n` +
        '   Keyingi deploylar AYNAN shu nuqtaga nisbatan o\'lchaydi.',
    );
    return false;
  }

  // ── Keyingi yurishlar: o'sishni o'lchaymiz ──
  const frozen = JSON.parse(fs.readFileSync(freezePath, 'utf8')) as FrozenFile;
  const prev = new Map(frozen.items.map((it) => [it.id, BigInt(it.diff)]));
  const frozenSum = BigInt(frozen.sum ?? sumOf(frozen.items).toString());

  const appeared: FrozenItem[] = [];
  const grown: Array<{ id: string; before: bigint; after: bigint }> = [];

  for (const it of current) {
    const before = prev.get(it.id);
    const after = BigInt(it.diff);
    if (before === undefined) {
      appeared.push(it);
    } else if (before !== after) {
      grown.push({ id: it.id, before, after });
    }
  }

  const delta = currentSum - frozenSum;
  const since = frozen.frozen_at.slice(0, 10);

  console.log(
    `\n🧊 Muzlatilgan baseline (${since}) bilan taqqos — ${label}:`,
  );
  console.log(
    `   farqli: ${frozen.drifted} → ${current.length}` +
      `   jami summa: ${fmt(frozenSum)} → ${fmt(currentSum)} so'm`,
  );

  if (appeared.length === 0 && grown.length === 0) {
    console.log("   ✅ O'sish YO'Q — muzlatilgan nuqtadan beri o'zgarmadi.");
    return false;
  }

  console.log(
    `   📈 O'SISH: ${fmt(delta)} so'm` +
      `  (${appeared.length} ta yangi, ${grown.length} ta o'zgargan)`,
  );

  // Eng katta 10 tasi — jurnal ko'milib ketmasin.
  const top = [...grown]
    .map((g) => ({ ...g, move: g.after - g.before }))
    .sort((a, b) => (b.move < a.move ? -1 : b.move > a.move ? 1 : 0))
    .slice(0, 10);
  for (const g of top) {
    console.log(`      ${g.id}  ${fmt(g.before)} → ${fmt(g.after)}`);
  }
  for (const a of appeared.slice(0, 10)) {
    console.log(`      ${a.id}  YANGI → ${fmt(BigInt(a.diff))}`);
  }
  if (appeared.length > 10 || grown.length > 10) {
    console.log('      … (qolgani jurnalda qisqartirildi)');
  }

  console.log(
    "   ℹ️  Bu DARVOZA EMAS — deploy to'xtamaydi. Tuzatish Yangi yilda\n" +
      '      ish to\'xtaganda rejalashtirilgan; bu raqam o\'sha paytda\n' +
      '      «qancha edi, qancha bo\'ldi» ni o\'lchash uchun yuritiladi.',
  );
  return true;
}
