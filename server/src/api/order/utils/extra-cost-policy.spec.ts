/// <reference types="jest" />
import { ExtraCostAction, ExtraCostDecisionMode } from 'src/common/enums';
import {
  EXTRA_COST_APPROVAL_FLOW_READY,
  resolveExtraCostPolicy,
} from './extra-cost-policy.util';

/**
 * QO'SHIMCHA XARAJAT SIYOSATI.
 *
 * Bu funksiya "pul darhol yozilsinmi yoki tasdiq kutsinmi" degan savolga
 * javob beradi, ya'ni har bir xato TO'G'RIDAN-TO'G'RI pulga tegadi:
 *
 *   - `deferred` noto'g'ri qaytsa — mavjud oqim to'xtaydi va kuryerga pul
 *     bermay qo'yamiz;
 *   - `immediate` noto'g'ri qaytsa — butun loyihaning maqsadi bekor bo'ladi
 *     (xarajat tasdiqsiz o'tib ketadi).
 */
const market = (over: Record<string, unknown> = {}) => ({
  extra_cost_proof_required: true,
  extra_cost_auto_approve_under: 0,
  ...over,
});
const courier = (over: Record<string, unknown> = {}) => ({
  external_provider: null,
  ...over,
});

const policy = (over: Record<string, any> = {}) =>
  resolveExtraCostPolicy({
    amount: 10000,
    market: market(),
    courier: courier(),
    actionType: ExtraCostAction.SELL,
    ...over,
  });

describe('Siyosat — mavjud oqimlar TEGILMAYDI', () => {
  it("TC1: summa 0 → immediate (bulk va LDG aynan shu yo'ldan o'tadi)", () => {
    // `bulkSellOrders`, `bulkCancelOrders` va LDG'ning uchala yo'li
    // `extraCost: 0` uzatadi. Bu darvoza ularni butunlay chetlab o'tkazadi.
    const p = policy({ amount: 0 });
    expect(p.mode).toBe('immediate');
    expect(p.requireProof).toBe(false);
  });

  it('TC2: manfiy summa ham immediate (hech narsa qilinmaydi)', () => {
    expect(policy({ amount: -5000 }).mode).toBe('immediate');
  });

  it('TC3: `undefined` summa — yiqilmaydi', () => {
    expect(policy({ amount: undefined }).mode).toBe('immediate');
  });

  it("TC4: bayroq O'CHIQ market → bugungi xulq saqlanadi", () => {
    const p = policy({ market: market({ extra_cost_proof_required: false }) });
    expect(p.mode).toBe('immediate');
    expect(p.requireProof).toBe(false);
    expect(p.decisionMode).toBe(ExtraCostDecisionMode.AUTO_RULE);
  });

  it('TC5: market `null` bo‘lsa ham immediate (fail-open, sotuv yiqilmaydi)', () => {
    expect(policy({ market: null }).mode).toBe('immediate');
  });

  it('TC6: bayroq `undefined` (eski yozuv) → immediate', () => {
    const p = policy({ market: { extra_cost_proof_required: undefined } });
    expect(p.mode).toBe('immediate');
  });
});

describe('Siyosat — tashqi kargo (Elchi/LDG)', () => {
  it("TC7: tashqi provayder bayroq YOQIQ bo'lsa ham darhol yozadi", () => {
    const p = policy({
      market: market({ extra_cost_proof_required: true }),
      courier: courier({ external_provider: 'elchi' }),
    });
    expect(p.mode).toBe('immediate');
    expect(p.requireProof).toBe(false);
    expect(p.decisionMode).toBe(ExtraCostDecisionMode.EXTERNAL_AUTO);
  });

  it('TC8: tashqi provayder tekshiruvi bayroqdan OLDIN turadi', () => {
    // Tartib muhim: agar bayroq tekshiruvi oldin bo'lsa, Elchi posilkalari
    // `deferred` bo'lib WAITING'da qotib qolardi.
    const p = policy({
      market: market({ extra_cost_proof_required: true }),
      courier: courier({ external_provider: 'ldg' }),
      amount: 999999,
    });
    expect(p.mode).toBe('immediate');
  });

  it("TC9: bo'sh satrli provayder tashqi hisoblanmaydi", () => {
    const p = policy({ courier: courier({ external_provider: '' }) });
    expect(p.decisionMode).not.toBe(ExtraCostDecisionMode.EXTERNAL_AUTO);
    expect(p.requireProof).toBe(true);
  });
});

describe('Siyosat — asosiy holat (bayroq yoqiq)', () => {
  /**
   * ⚠️ ENG MUHIM QULF.
   *
   * Tasdiqlash oqimi (Bosqich 3-5) qurilmagunga qadar `deferred` HECH QACHON
   * qaytarilmasligi SHART. Chaqiruvchida `else` shoxi yo'q — `deferred`
   * qaytsa, pul kassaga ham, `extra_cost_request` jadvaliga ham yozilmay
   * YO'QOLADI, buyurtma izohida esa "qo'shimcha X so'm ushlab qolingan" deb
   * turadi. Kuryer pulini jimgina yo'qotadi va uni tiklab ham bo'lmaydi.
   *
   * Bayroqni yoqish yo'li allaqachon ochiq (admin UI → DTO → ustun), ya'ni
   * bu faraziy emas: admin bir marta tugmani bossa yetadi.
   */
  const expectedMode = EXTRA_COST_APPROVAL_FLOW_READY
    ? 'deferred'
    : 'immediate';

  it('TC10: oddiy sotuv — isbot majburiy', () => {
    const p = policy();
    expect(p.mode).toBe(expectedMode);
    expect(p.requireProof).toBe(true);
  });

  it('TC11: bekor qilish ham bir xil rejimda', () => {
    expect(policy({ actionType: ExtraCostAction.CANCEL }).mode).toBe(
      expectedMode,
    );
  });

  it('TC12: qisman sotuv ham bir xil rejimda', () => {
    expect(policy({ actionType: ExtraCostAction.PARTLY_SOLD }).mode).toBe(
      expectedMode,
    );
  });

  it("TC10b: oqim tayyor bo'lmasa `deferred` UMUMAN qaytarilmaydi", () => {
    if (EXTRA_COST_APPROVAL_FLOW_READY) return;
    // Barcha mumkin bo'lgan kirishlar bo'ylab tekshiramiz — bironta ham
    // `deferred` chiqmasligi kerak.
    for (const action of Object.values(ExtraCostAction)) {
      for (const amount of [1, 5000, 999_999_999]) {
        for (const autoUnder of [0, 5000, 1_000_000]) {
          const p = policy({
            amount,
            actionType: action,
            market: market({ extra_cost_auto_approve_under: autoUnder }),
          });
          expect(p.mode).toBe('immediate');
        }
      }
    }
  });
});

describe('Siyosat — yashirin chegirma (price_cut)', () => {
  it('TC13: isbot MAJBURIY, lekin pul kechiktirilMAYDI', () => {
    // Kechiktirish sotuv matematikasini (to_be_paid/paid_amount/SELL_PROFIT/
    // operator daromadi) buzardi — shuning uchun ataylab immediate.
    const p = policy({ actionType: ExtraCostAction.PRICE_CUT });
    expect(p.mode).toBe('immediate');
    expect(p.requireProof).toBe(true);
  });

  it("TC14: bayroq o'chiq bo'lsa price_cut uchun ham isbot talab qilinmaydi", () => {
    const p = policy({
      actionType: ExtraCostAction.PRICE_CUT,
      market: market({ extra_cost_proof_required: false }),
    });
    expect(p.mode).toBe('immediate');
    expect(p.requireProof).toBe(false);
  });
});

describe('Siyosat — avtomatik tasdiq chegarasi', () => {
  it('TC15: chegaradan KICHIK → immediate, lekin isbot baribir kerak', () => {
    const p = policy({
      amount: 4000,
      market: market({ extra_cost_auto_approve_under: 5000 }),
    });
    expect(p.mode).toBe('immediate');
    expect(p.requireProof).toBe(true);
    expect(p.decisionMode).toBe(ExtraCostDecisionMode.AUTO_RULE);
  });

  // Chegaradan KATTA/TENG summalar oqim tayyor bo'lgach `deferred` bo'ladi;
  // hozir esa `EXTRA_COST_APPROVAL_FLOW_READY=false` ularni `immediate` da
  // ushlab turadi. Ikkala holatda ham `requireProof` YOQILGAN bo'lishi shart —
  // aynan shu isbot talabini ifodalaydi.
  const deferredOrHeld = EXTRA_COST_APPROVAL_FLOW_READY
    ? 'deferred'
    : 'immediate';

  it("TC16: chegaraga TENG → tasdiq talab qilinadi (qat'iy kichik bo'lishi shart)", () => {
    const p = policy({
      amount: 5000,
      market: market({ extra_cost_auto_approve_under: 5000 }),
    });
    expect(p.mode).toBe(deferredOrHeld);
    expect(p.requireProof).toBe(true);
  });

  it('TC17: chegaradan KATTA → tasdiq talab qilinadi', () => {
    const p = policy({
      amount: 5001,
      market: market({ extra_cost_auto_approve_under: 5000 }),
    });
    expect(p.mode).toBe(deferredOrHeld);
  });

  it("TC18: chegara 0 (o'chiq) → har doim tasdiq talab qilinadi", () => {
    const p = policy({
      amount: 1,
      market: market({ extra_cost_auto_approve_under: 0 }),
    });
    expect(p.mode).toBe(deferredOrHeld);
  });

  it("TC19: chegara MANFIY bo'lsa ham o'chiq deb qaraladi", () => {
    const p = policy({
      amount: 1,
      market: market({ extra_cost_auto_approve_under: -100 }),
    });
    expect(p.mode).toBe(deferredOrHeld);
  });

  it('TC20: kasrli summa butunga kesiladi — chegara solishtiruvi buzilmasin', () => {
    // 5000.9 -> 5000, ya'ni chegaraga TENG.
    const p = policy({
      amount: 5000.9,
      market: market({ extra_cost_auto_approve_under: 5000 }),
    });
    expect(p.mode).toBe(deferredOrHeld);
  });
});
