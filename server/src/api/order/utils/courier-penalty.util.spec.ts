import {
  computeCourierAdjustment,
  deadlineStateOf,
  CourierPenaltyCalc,
  CourierPenaltyEvent,
  CourierPenaltyScope,
  lateDaysOf,
  pickRule,
  type PenaltyRule,
} from './courier-penalty.util';

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;
const COURIER = 'c-1';
const REGION = 'r-1';

const rule = (over: Partial<PenaltyRule> = {}): PenaltyRule => ({
  id: 'rule-global',
  scope_type: CourierPenaltyScope.GLOBAL,
  scope_id: null,
  event: CourierPenaltyEvent.LATE_MARK,
  threshold_days: 4,
  calc: CourierPenaltyCalc.PER_DAY,
  amount: -2000,
  max_amount: null,
  priority: 0,
  active_from: 0,
  active_to: null,
  is_active: true,
  ...over,
});

const run = (over: Partial<Parameters<typeof computeCourierAdjustment>[0]> = {}) =>
  computeCourierAdjustment({
    dispatchedAt: T0,
    markedAt: T0 + 6 * DAY,
    baseTariff: 20000,
    courierId: COURIER,
    regionId: REGION,
    rules: [rule()],
    ...over,
  });

describe('lateDaysOf — kalendar kun', () => {
  it('muddat ichida 0 qaytaradi', () => {
    expect(lateDaysOf(T0, T0 + 4 * DAY, 4)).toBe(0);
  });

  /**
   * ⚠️ `floor`: 4 kun 23 soat hali 4-kun. Kuryer soat farqi uchun
   * jazolanmasligi kerak — aks holda ertalab jo'natilgan posilkani
   * kechqurun belgilagan odam «bir kun kechikdi» deb hisoblanardi.
   */
  it('qisman kun kechikish deb sanalmaydi', () => {
    expect(lateDaysOf(T0, T0 + 4 * DAY + 23 * 3600_000, 4)).toBe(0);
    expect(lateDaysOf(T0, T0 + 5 * DAY, 4)).toBe(1);
  });

  it('teskari/buzuq vaqtda 0', () => {
    expect(lateDaysOf(T0, T0 - DAY, 4)).toBe(0);
    expect(lateDaysOf(null, T0, 4)).toBe(0);
    expect(lateDaysOf(T0, null, 4)).toBe(0);
  });
});

describe('shtraf hisobi — asosiy qoida', () => {
  it('muddat ichida tuzatish yo‘q', () => {
    const r = run({ markedAt: T0 + 4 * DAY });
    expect(r.amount).toBe(0);
    expect(r.kind).toBeNull();
  });

  it('2 kun kechikish → 4 000', () => {
    const r = run({ markedAt: T0 + 6 * DAY });
    expect(r.lateDays).toBe(2);
    expect(r.amount).toBe(4000);
    expect(r.kind).toBe('penalty');
    expect(r.event).toBe(CourierPenaltyEvent.LATE_MARK);
  });

  /**
   * ⚠️ QULFLANGAN QAROR: POL — 0. Shtraf tarifdan OSHMAYDI, kuryer
   * ustiga pul to'lamaydi. Aks holda uzoq kechikishda u belgilashni
   * butunlay tashlab qo'yardi.
   */
  it('shtraf TARIFDAN OSHMAYDI — pol 0', () => {
    const r = run({ markedAt: T0 + 30 * DAY });
    expect(r.lateDays).toBe(26);
    // 26 × 2 000 = 52 000, lekin tarif 20 000
    expect(r.amount).toBe(20000);
    expect(r.cappedByTariff).toBe(true);
  });

  it('tarif 0 bo‘lsa shtraf ham 0', () => {
    const r = run({ markedAt: T0 + 30 * DAY, baseTariff: 0 });
    expect(r.amount).toBe(0);
    expect(r.skipReason).toBe('zero_tariff');
  });

  it('qoida chegarasi (max_amount) tarifdan oldin ishlaydi', () => {
    const r = run({
      markedAt: T0 + 30 * DAY,
      rules: [rule({ max_amount: 6000 })],
    });
    expect(r.amount).toBe(6000);
    expect(r.cappedByTariff).toBe(false);
  });

  it('bir martalik hisob kunga ko‘paytirilmaydi', () => {
    const r = run({
      markedAt: T0 + 10 * DAY,
      rules: [rule({ calc: CourierPenaltyCalc.ONCE, amount: -5000 })],
    });
    expect(r.amount).toBe(5000);
  });
});

/**
 * ⚠️ GRANDFATHERING — darvoza JO'NATISH vaqtiga, belgilash vaqtiga EMAS.
 *
 * Yoqilishdan OLDIN jo'natilib, KEYIN belgilangan buyurtma
 * jazolanmasligi kerak: kuryer uni qoida yo'q paytda olgan. Shart
 * `markedAt` ga qo'yilsa, yoqilgan kuni o'nlab eski buyurtma birdan
 * shtrafga tushardi.
 */
describe('grandfathering — eski buyurtmalar tegilmaydi', () => {
  it('yoqilishdan OLDIN jo‘natilgan buyurtma jazolanmaydi', () => {
    const r = run({
      dispatchedAt: T0,
      markedAt: T0 + 30 * DAY,
      activatedAt: T0 + DAY, // modul keyinroq yoqilgan
    });
    expect(r.amount).toBe(0);
    expect(r.skipReason).toBe('before_activation');
  });

  it('yoqilgandan KEYIN jo‘natilgan buyurtma jazolanadi', () => {
    const r = run({
      dispatchedAt: T0 + 2 * DAY,
      markedAt: T0 + 9 * DAY,
      activatedAt: T0 + DAY,
    });
    expect(r.lateDays).toBe(3);
    expect(r.amount).toBe(6000);
  });

  it('yoqilmagan bo‘lsa (soya) hisob baribir ishlaydi', () => {
    const r = run({ markedAt: T0 + 6 * DAY, activatedAt: null });
    expect(r.amount).toBe(4000);
  });
});

describe('istisno va buzuq ma‘lumot', () => {
  it('istisno qilingan kuryerga tegilmaydi', () => {
    expect(run({ exempt: true }).skipReason).toBe('exempt');
  });

  it('jo‘natish langari yo‘q bo‘lsa hisob yo‘q', () => {
    expect(run({ dispatchedAt: null }).skipReason).toBe('no_dispatch_anchor');
  });

  it('belgilash vaqti jo‘natishdan oldin bo‘lsa hisob yo‘q', () => {
    expect(run({ markedAt: T0 - DAY }).skipReason).toBe('no_mark_time');
  });

  it('mos qoida bo‘lmasa tuzatish yo‘q', () => {
    expect(run({ rules: [] }).skipReason).toBe('no_matching_rule');
  });
});

/**
 * Qamrov aniqligi — «falon kuryerga boshqacha muddat» talabi aynan shu.
 */
describe('qoida tanlash — aniqroq qamrov ustun', () => {
  it('kuryer qoidasi viloyat va global qoidadan ustun', () => {
    const picked = pickRule(
      [
        rule({ id: 'g' }),
        rule({
          id: 'r',
          scope_type: CourierPenaltyScope.REGION,
          scope_id: REGION,
        }),
        rule({
          id: 'c',
          scope_type: CourierPenaltyScope.COURIER,
          scope_id: COURIER,
        }),
      ],
      CourierPenaltyEvent.LATE_MARK,
      T0,
      COURIER,
      REGION,
    );
    expect(picked?.id).toBe('c');
  });

  it('viloyat qoidasi global qoidadan ustun — «uzoq hududga 7 kun»', () => {
    const r = run({
      markedAt: T0 + 6 * DAY,
      rules: [
        rule({ id: 'g', threshold_days: 4 }),
        rule({
          id: 'r',
          scope_type: CourierPenaltyScope.REGION,
          scope_id: REGION,
          threshold_days: 7,
        }),
      ],
    });
    // 6 kun < 7 kun muddat → kechikish yo'q
    expect(r.amount).toBe(0);
  });

  it('boshqa kuryerning qoidasi tegishli emas', () => {
    const picked = pickRule(
      [
        rule({
          id: 'other',
          scope_type: CourierPenaltyScope.COURIER,
          scope_id: 'c-2',
        }),
      ],
      CourierPenaltyEvent.LATE_MARK,
      T0,
      COURIER,
      REGION,
    );
    expect(picked).toBeNull();
  });

  it('amal muddati tugagan qoida ishlatilmaydi', () => {
    const r = run({
      rules: [rule({ active_to: T0 - DAY })],
    });
    expect(r.skipReason).toBe('no_matching_rule');
  });

  it('hali boshlanmagan qoida ishlatilmaydi', () => {
    const r = run({ rules: [rule({ active_from: T0 + 100 * DAY })] });
    expect(r.skipReason).toBe('no_matching_rule');
  });

  it('o‘chirilgan qoida ishlatilmaydi', () => {
    const r = run({ rules: [rule({ is_active: false })] });
    expect(r.skipReason).toBe('no_matching_rule');
  });
});

describe('bonus — tez belgilash', () => {
  const bonus = (over: Partial<PenaltyRule> = {}) =>
    rule({
      id: 'b1',
      event: CourierPenaltyEvent.EARLY_MARK,
      threshold_days: 1,
      calc: CourierPenaltyCalc.ONCE,
      amount: 2000,
      ...over,
    });

  it('1 kun ichida belgilansa bonus — qarz KAMAYADI', () => {
    const r = run({ markedAt: T0 + DAY, rules: [rule(), bonus()] });
    expect(r.kind).toBe('bonus');
    // Ishora manfiy: kuryer qarzi kamayadi.
    expect(r.amount).toBe(-2000);
  });

  it('eng qattiq daraja tanlanadi', () => {
    const r = run({
      markedAt: T0 + DAY,
      rules: [
        rule(),
        bonus({ id: 'b2', threshold_days: 2, amount: 1000 }),
        bonus({ id: 'b1', threshold_days: 1, amount: 2000 }),
      ],
    });
    expect(r.ruleId).toBe('b1');
    expect(r.amount).toBe(-2000);
  });

  it('darajadan oshsa pastki daraja beriladi', () => {
    const r = run({
      markedAt: T0 + 2 * DAY,
      rules: [
        rule(),
        bonus({ id: 'b2', threshold_days: 2, amount: 1000 }),
        bonus({ id: 'b1', threshold_days: 1, amount: 2000 }),
      ],
    });
    expect(r.ruleId).toBe('b2');
    expect(r.amount).toBe(-1000);
  });

  /**
   * ⚠️ Shtraf va bonus BIR VAQTDA bo'la olmaydi — kechikkan buyurtma
   * tez belgilangan bo'lishi mumkin emas. Funksiya DOIM bittasini
   * qaytaradi.
   */
  it('kechikkan buyurtmaga bonus berilmaydi', () => {
    const r = run({
      markedAt: T0 + 10 * DAY,
      rules: [rule(), bonus({ threshold_days: 20 })],
    });
    expect(r.kind).toBe('penalty');
  });

  it('bonus grandfathering darvozasiga ham bo‘ysunadi', () => {
    const r = run({
      dispatchedAt: T0,
      markedAt: T0 + DAY,
      activatedAt: T0 + 5 * DAY,
      rules: [bonus()],
    });
    expect(r.amount).toBe(0);
    expect(r.skipReason).toBe('before_activation');
  });
});

/**
 * MUDDAT SANOG'I — kuryer ekrani uchun.
 *
 * ⚠️ Bu yerda qulflanayotgan narsa: sanoq SHTRAF HISOBI bilan AYNI
 * chegarani ko'rsatadi. Agar ekran «1 kun qoldi» deb turib shtraf allaqachon
 * yozilgan bo'lsa, kuryer tizimga ishonmay qo'yadi va modul ishlamaydi.
 */
describe('deadlineStateOf — kuryer sanog‘i', () => {
  it('langar yo‘q bo‘lsa null', () => {
    expect(deadlineStateOf(null, T0, 4)).toBeNull();
  });

  it('shtraf boshlanish payti = jo‘natish + (muddat + 1) kun', () => {
    const st = deadlineStateOf(T0, T0, 4)!;
    expect(st.penaltyStartsAt).toBe(T0 + 5 * DAY);
  });

  /**
   * ⚠️ ASOSIY QULF: sanoq va hisob BIR chegaradan foydalanadi.
   * `lateDaysOf` 0 qaytargan paytda sanoq hali «muddat o'tmagan» deyishi
   * SHART — aks holda ekran bilan kassa bir-biriga qarshi chiqardi.
   */
  it('sanoq va lateDaysOf AYNI chegarani ko‘rsatadi', () => {
    // Bir ms oldin: kechikish 0, muddat hali o'tmagan
    const before = T0 + 5 * DAY - 1;
    expect(lateDaysOf(T0, before, 4)).toBe(0);
    expect(deadlineStateOf(T0, before, 4)!.msLeft).toBeGreaterThan(0);

    // Ayni chegarada: kechikish 1, muddat o'tgan
    const at = T0 + 5 * DAY;
    expect(lateDaysOf(T0, at, 4)).toBe(1);
    expect(deadlineStateOf(T0, at, 4)!.msLeft).toBeLessThanOrEqual(0);
  });

  it('qolgan to‘liq kunlar', () => {
    expect(deadlineStateOf(T0, T0, 4)!.daysLeft).toBe(5);
    expect(deadlineStateOf(T0, T0 + 3 * DAY, 4)!.daysLeft).toBe(2);
  });

  it('muddat o‘tgan bo‘lsa daysLeft null, lateDays musbat', () => {
    const st = deadlineStateOf(T0, T0 + 7 * DAY, 4)!;
    expect(st.daysLeft).toBeNull();
    expect(st.lateDays).toBe(3);
  });

  /** «Bugun muddati tugaydi» — oxirgi sutka ichida. */
  it('dueToday faqat oxirgi sutkada', () => {
    expect(deadlineStateOf(T0, T0 + 4 * DAY, 4)!.dueToday).toBe(true);
    expect(deadlineStateOf(T0, T0 + 3 * DAY, 4)!.dueToday).toBe(false);
    expect(deadlineStateOf(T0, T0 + 6 * DAY, 4)!.dueToday).toBe(false);
  });
});
