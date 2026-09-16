/// <reference types="jest" />
import { ExtraCostAction, Where_deliver } from 'src/common/enums';
import { resolveExtraCostPolicy } from './extra-cost-policy.util';
import {
  assertExtraCostWithinLimit,
  sellExtraCostLimit,
} from './extra-cost-limit.util';

/**
 * YASHIRIN CHEGIRMA DARVOZASI — REGRESSIYA QULFI.
 *
 * KONTEKST. `partlySold` da kuryer mahsulot sonini O'ZGARTIRMASDAN narxni
 * tushirsa, pul natijasi qo'shimcha xarajat bilan aynan bir xil bo'ladi.
 * Shu yo'l ochiq qolsa, isbot/tasdiq talabi bitta `if` bilan aylanib
 * o'tiladi.
 *
 * ⚠️ LEKIN darvozani noto'g'ri qurish bundan ham QIMMAT. Ikki tuzoq bor va
 * ikkalasi ham dastlabki versiyada bor edi:
 *
 *   1. `sellExtraCostLimit` ni chegirmaga qo'llash. U BOSHQA savolga javob
 *      beradi — "kuryerga yo'l xarajati uchun qancha berish mumkin" — va
 *      UYGA yetkazishda har qanday summani TAQIQLAYDI. Uni chegirmaga
 *      qo'llash mijoz bilan narx kelishilgan HAR BIR uyga yetkazishni
 *      butunlay bloklardi.
 *
 *   2. Darvozani market bayrog'idan MUSTAQIL qilish. Narxni pasaytirib
 *      sotish loyihada ATAYLAB qo'llab-quvvatlanadigan oqim
 *      (`['Buyurtma arzonroqqa sotildi!']`), shuning uchun bayroq o'chiq
 *      marketlarda — bugun HAMMASIDA — hech narsa o'zgarmasligi shart.
 *
 * Bu testlar ikkala tuzoqni ham qaytib kelishidan saqlaydi.
 */
const marketOff = {
  extra_cost_proof_required: false,
  extra_cost_auto_approve_under: 0,
};
const marketOn = {
  extra_cost_proof_required: true,
  extra_cost_auto_approve_under: 0,
};
const courier = { external_provider: null };

const cutPolicy = (market: typeof marketOff, amount = 50_000) =>
  resolveExtraCostPolicy({
    amount,
    market,
    courier,
    actionType: ExtraCostAction.PRICE_CUT,
  });

describe('Chegirma darvozasi — bayroq O‘CHIQ marketlar (bugun HAMMASI)', () => {
  it('TC1: sabab TALAB QILINMAYDI — «arzonroqqa sotildi» oqimi tegilmaydi', () => {
    // Darvoza `requireProof` bo'yicha ishlaydi; o'chiq bayroqda u `false`,
    // ya'ni `partlySold` bugungidek izohsiz ham o'tadi.
    expect(cutPolicy(marketOff).requireProof).toBe(false);
  });

  it('TC2: summa qanchalik katta bo‘lsa ham to‘sib qo‘yilmaydi', () => {
    expect(cutPolicy(marketOff, 5_000_000).requireProof).toBe(false);
  });

  it('TC3: pul har doim darhol yoziladi (kechiktirilmaydi)', () => {
    expect(cutPolicy(marketOff).mode).toBe('immediate');
  });
});

describe('Chegirma darvozasi — bayroq YOQIQ market', () => {
  it('TC4: sabab MAJBURIY bo‘ladi', () => {
    expect(cutPolicy(marketOn).requireProof).toBe(true);
  });

  it('TC5: pul BARIBIR darhol yoziladi — kechiktirish sotuv matematikasini buzardi', () => {
    // Chegirmani kechiktirish uchun to'liq narxni kassaga yozib, keyin farqni
    // alohida qaytarish kerak bo'lardi — bu `to_be_paid`, `paid_amount`,
    // `autoPay`, `SELL_PROFIT` va operator daromadi hisobini o'zgartiradi.
    expect(cutPolicy(marketOn).mode).toBe('immediate');
  });

  it('TC6: `PRICE_CUT` shoxi O‘LIK KOD emas — haqiqatan chaqiriladi', () => {
    // Avval darvoza siyosatni umuman chaqirmasdi, ya'ni `PRICE_CUT` shoxiga
    // hech qachon yetib borilmasdi.
    const p = cutPolicy(marketOn);
    expect(p.reason).toMatch(/Narx pasaytirish/);
  });
});

describe('Chegirma darvozasi — `sellExtraCostLimit` QO‘LLANMASLIGI shart', () => {
  it('TC7: UYGA yetkazishda u har qanday summani taqiqlaydi (shuning uchun ishlatilmaydi)', () => {
    // Bu test qoidaning O'ZINI hujjatlashtiradi: agar kimdir chegirmaga shu
    // chegarani qaytadan ulasa, uyga yetkazishdagi har bir kelishilgan narx
    // rad etilardi.
    const limit = sellExtraCostLimit({
      whereDeliver: Where_deliver.ADDRESS,
      tariffCenter: 20_000,
      tariffHome: 30_000,
    });
    expect(limit.forbiddenReason).toBeTruthy();
    expect(() => assertExtraCostWithinLimit(1, limit)).toThrow();
  });

  it('TC8: MARKAZGA yetkazishda ham chegara juda tor — tarif farqi', () => {
    // 300 000 so'mlik buyurtmada mijoz bilan kelishilgan 30 000 lik chegirma
    // shu chegaradan (10 000) oshib ketardi va rad etilardi.
    const limit = sellExtraCostLimit({
      whereDeliver: Where_deliver.CENTER,
      tariffCenter: 20_000,
      tariffHome: 30_000,
    });
    expect(limit.max).toBe(10_000);
    expect(() => assertExtraCostWithinLimit(30_000, limit)).toThrow();
  });

  it('TC9: shu sababli siyosat chegirma uchun SUMMA chegarasi qaytarmaydi', () => {
    // Siyosat javobida chegara tushunchasi umuman yo'q — u faqat
    // "sabab kerakmi" va "pul kechiktirilsinmi" degan savollarga javob beradi.
    const p = cutPolicy(marketOn, 5_000_000);
    expect(p.mode).toBe('immediate');
    expect(p.requireProof).toBe(true);
  });
});

/**
 * DARVOZANI AYLANIB O'TISH URINISHLARI.
 *
 * Darvoza `totalNewQty` va `totalOldQty` yig'indilariga tayanadi, shuning
 * uchun shu yig'indiga ta'sir qiladigan har bir yo'l tekshirilishi kerak.
 * Quyidagi funksiya `order.service.ts` dagi AYNI mantiqni takrorlaydi.
 */
const qtyOf = (q: unknown) => Math.max(0, Math.trunc(Number(q) || 0));
const sumQty = (items: { quantity: unknown }[]) =>
  items.reduce((acc, i) => acc + qtyOf(i.quantity), 0);
const hiddenCutOf = (
  oldItems: { quantity: unknown }[],
  newItems: { quantity: unknown }[],
  oldTotalPrice: number,
  price: number,
) =>
  sumQty(newItems) >= sumQty(oldItems)
    ? Math.max(0, Math.trunc(oldTotalPrice - price))
    : 0;

describe("Chegirma darvozasi — aylanib o'tish urinishlari", () => {
  it('TC10: dona O‘ZGARMAY narx tushsa — darvoza ISHLAYDI', () => {
    expect(
      hiddenCutOf([{ quantity: 1 }], [{ quantity: 1 }], 500_000, 450_000),
    ).toBe(50_000);
  });

  it('TC11: dona OSHIRILSA ham darvoza ishlaydi (`>=`, `===` emas)', () => {
    // Eng sodda aylanib o'tish: 1 -> 2 yuborib shartni buzish. Dona oshishi
    // hech qanday ta'sir qilmaydi (item faqat KAMAYGAN shoxda yangilanadi),
    // ya'ni bu sof darvozadan qochish usuli edi.
    expect(
      hiddenCutOf([{ quantity: 1 }], [{ quantity: 2 }], 500_000, 450_000),
    ).toBe(50_000);
  });

  it('TC12: dona KAMAYSA — darvoza ATAYLAB ishlamaydi (qonuniy qisman sotuv)', () => {
    expect(
      hiddenCutOf([{ quantity: 2 }], [{ quantity: 1 }], 500_000, 250_000),
    ).toBe(0);
  });

  it('TC13: `quantity` SATR bo‘lsa yig‘indi ULANMAYDI — koersiya bor', () => {
    // Koersiyasiz `0 + "1"` = `"01"` bo'lib, solishtiruv hech qachon
    // to'g'ri bo'lmasdi va darvoza jimgina o'chib qolardi.
    expect(sumQty([{ quantity: '1' }, { quantity: '2' }])).toBe(3);
    expect(
      hiddenCutOf([{ quantity: 1 }], [{ quantity: '1' }], 500_000, 450_000),
    ).toBe(50_000);
  });

  it('TC14: MANFIY `quantity` soxta "kamayish" yasay olmaydi', () => {
    // `-5` bilan yig'indini sun'iy tushirib, darvozani o'chirish urinishi.
    expect(sumQty([{ quantity: 1 }, { quantity: -5 }])).toBe(1);
    expect(
      hiddenCutOf(
        [{ quantity: 1 }],
        [{ quantity: 1 }, { quantity: -5 }],
        500_000,
        450_000,
      ),
    ).toBe(50_000);
  });

  it('TC15: narx OSHSA chegirma yo‘q (manfiy hiddenCut bo‘lmaydi)', () => {
    expect(
      hiddenCutOf([{ quantity: 1 }], [{ quantity: 1 }], 100_000, 150_000),
    ).toBe(0);
  });

  it('TC16: narx o‘zgarmasa darvoza ishlamaydi', () => {
    expect(
      hiddenCutOf([{ quantity: 1 }], [{ quantity: 1 }], 100_000, 100_000),
    ).toBe(0);
  });
});
