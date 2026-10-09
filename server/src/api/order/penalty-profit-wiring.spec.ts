/// <reference types="jest" />
import * as fs from 'fs';
import * as path from 'path';

/**
 * SHTRAF FOYDAGA ULANISHI — REGRESSIYA QULFI.
 *
 * ⚠️ NEGA MANBA MATNINI O'QIYMIZ. Bu ulanish INVESTOR PULIGA tegadi:
 * `investor-ledger.service.ts` `getRevenueStats('daily', …)` ni chaqirib
 * har kun uchun `(revenue − opex) × bps / 10000` hisoblaydi va o'sha son
 * investorga to'lanadigan ulush bo'lib chiqadi. Ulanish jimgina
 * yo'qolsa yoki noto'g'ri shaklda yozilsa, `tsc` ham, boshqa testlar ham
 * MIQ etmaydi — raqam shunchaki boshqacha bo'lib qolaveradi.
 *
 * Quyidagi har bir tekshiruv aniq bir tarzda noto'g'ri bo'lishi mumkin
 * bo'lgan narsani qotiradi. Ular xaritalashda TASDIQLANGAN topilmalardan
 * kelib chiqqan.
 */
const SERVICE = path.resolve(__dirname, 'order.service.ts');
const src = fs.readFileSync(SERVICE, 'utf8');

function methodBody(name: string): string {
  const start = src.indexOf(`  async ${name}(`);
  if (start === -1) throw new Error(`metod topilmadi: ${name}`);
  const next = src.indexOf('\n  async ', start + 10);
  return src.slice(start, next === -1 ? src.length : next);
}

/**
 * ⚠️ IZOHLAR OLIB TASHLANADI.
 *
 * Bu testlar KODNI tekshiradi, matnni emas. Izohlarda ataylab
 * «shunday QILMA» misollari yozilgan — masalan qo'shaloq
 * `AT TIME ZONE` tuzog'i va «manba `courier_penalty_entry` EMAS»
 * ogohlantirishi. Ular tozalanmasa, test aynan o'zi himoya qilayotgan
 * izohlardan yiqilardi.
 */
function codeOnly(name: string): string {
  return methodBody(name)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/--[^\n]*/g, ' ');
}

describe('shtraf foyda hisobiga ulangan', () => {
  /**
   * Foyda ikki joyda MUSTAQIL hisoblanadi. Faqat bittasiga qo'shilsa,
   * admin dashboardi bilan investor sahifasi turli son ko'rsatardi.
   */
  it.each(['getStats', 'getRevenueStats'])(
    '%s shtraf yig‘indisini o‘qiydi',
    (method) => {
      expect(methodBody(method)).toContain("source_type = 'courier_penalty'");
    },
  );

  /**
   * ⚠️ MANBA `financial_balance_history` BO'LISHI SHART.
   *
   * `courier_penalty_entry` da SOYA qatorlari ham bor — pulga tegilmagan
   * yozuvlar. Ular foydaga kirsa, pochta olmagan pulni olgan deb
   * ko'rsatardi va investorga yo'q foydadan ulush hisoblanardi.
   * FBH ga esa faqat haqiqiy pul harakati tushadi.
   */
  it.each(['getStats', 'getRevenueStats'])(
    '%s manbasi financial_balance_history (soya qatorlari yo‘q joy)',
    (method) => {
      const body = codeOnly(method);
      expect(body).toContain('financial_balance_history');
      expect(body).not.toContain('courier_penalty_entry');
    },
  );

  /**
   * ⚠️ JOIN TAQIQLANADI. Foyda SQL'i buyurtma qatorlarini `GROUP BY`
   * bilan jamlaydi; bitta buyurtmada bir nechta shtraf qatori bo'lishi
   * mumkin (shtraf + uni bekor qilish). JOIN o'sha buyurtmaning
   * MARJASINI shtraf qatorlari soniga ko'paytirib yuborardi.
   */
  it('shtraf ALOHIDA so‘rov bilan olinadi, foyda SQL‘iga JOIN qilinmaydi', () => {
    for (const method of ['getStats', 'getRevenueStats']) {
      const body = codeOnly(method);
      // Shtraf so'rovi o'z FROM i bilan boshlanadi
      expect(body).toMatch(/FROM\s+"financial_balance_history"/);
      // va foyda so'roviga JOIN bo'lib kirmaydi
      expect(body).not.toMatch(/JOIN\s+"?financial_balance_history/i);
    }
  });

  /**
   * ⚠️ SHTRAF O'Z SANASI BO'YICHA BUCKETLANADI.
   *
   * Ikki sabab: (1) shtraf BEKOR yo'lida ham yoziladi, bekor buyurtmada
   * `sold_at` YO'Q — `sold_at` ga bog'lansa jimgina tushib qolardi;
   * (2) bekor qilish qatori asl shtrafdan kunlar keyin tug'iladi va
   * `sold_at` ga bog'lansa YOPILGAN kunning investor ulushini
   * retroaktiv o'zgartirardi.
   */
  it('shtraf `h.created_at` bo‘yicha sanaladi, `sold_at` bo‘yicha emas', () => {
    const body = codeOnly('getRevenueStats');
    const penaltySql = body.slice(body.indexOf('financial_balance_history'));
    expect(penaltySql).toContain('h.created_at');
    expect(penaltySql).not.toContain('sold_at');
  });

  /**
   * ⚠️ BITTA `AT TIME ZONE`. Qo'shaloq `AT TIME ZONE 'UTC' AT TIME ZONE
   * 'Asia/Tashkent'` siljishni bekor qilib, UTC kuni bo'yicha bucketlaydi
   * — loyihada bu allaqachon bir marta production xatosi bergan.
   */
  it('kun bucketlash bitta AT TIME ZONE bilan', () => {
    const body = codeOnly('getRevenueStats');
    expect(body).toContain("TO_TIMESTAMP(h.created_at / 1000) AT TIME ZONE 'Asia/Tashkent'");
    expect(body).not.toMatch(/AT TIME ZONE 'UTC'\s*AT TIME ZONE/);
  });

  /**
   * ⚠️ SHTRAFLI, LEKIN SOTUVSIZ KUN YO'QOLMASLIGI KERAK.
   *
   * `investor-ledger.service.ts` kunlar to'plamini seriyadan yasaydi.
   * Shtraf seriyaga qo'shilmasa, sotuv bo'lmagan kundagi shtraf (bekor
   * yo'li yoki dam olish kuni) investor hisobidan butunlay yo'qolardi.
   * Shuning uchun birlashtirish IKKI TOMONLAMA bo'lishi shart —
   * shtraf-only davr ham natijaga kirishi kerak.
   */
  it('shtrafli-sotuvsiz davr ham natijaga kiradi', () => {
    const body = codeOnly('getRevenueStats');
    expect(body).toContain('byPeriod.set(key, {');
    expect(body).toContain('ordersCount: 0,');
  });

  /** Shaffoflik: «daromad nega o'zgardi» savoliga javob bo'lsin. */
  it('shtraf alohida maydon bo‘lib ham chiqadi', () => {
    expect(methodBody('getRevenueStats')).toContain('totalPenalty');
    expect(methodBody('getStats')).toContain('penaltyNet');
  });
});
