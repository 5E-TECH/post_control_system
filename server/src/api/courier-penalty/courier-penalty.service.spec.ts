/// <reference types="jest" />
import { EntityManager } from 'typeorm';
import { Where_deliver } from 'src/common/enums';
import { CourierPenaltyService } from './courier-penalty.service';
import { CourierPenaltyConfigEntity } from 'src/core/entity/courier-penalty-config.entity';
import { CourierPenaltyRuleEntity } from 'src/core/entity/courier-penalty-rule.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { UserEntity } from 'src/core/entity/users.entity';

/**
 * SHTRAF SERVISI — SOYA REJIMI SHARTNOMASI.
 *
 * Hisobning o'zi `courier-penalty.util.spec.ts` da sinalgan (27 test). Bu
 * yerda BOSHQA narsa tekshiriladi: servis TO'G'RI ma'lumotni to'g'ri joydan
 * oladimi va daftarga nima yozadi.
 *
 * Uchta shartnoma qulflanadi:
 *   1. Shtraf POCHTA kuryeriga yoziladi, AMAL QILUVCHIGA emas.
 *   2. Faza 1 da yozuv DOIM `shadow = true` va kassaga tegilmaydi.
 *   3. Soyada grandfathering langari — `shadow_since`.
 */

const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

const POST_ID = 'post-1';
const COURIER_ID = 'courier-1';
const ADMIN_ID = 'admin-1';
const ORDER_ID = 'order-1';

type Rows = {
  post?: Partial<PostEntity> | null;
  courier?: Partial<UserEntity> | null;
  config?: Partial<CourierPenaltyConfigEntity> | null;
  rules?: Array<Partial<CourierPenaltyRuleEntity>>;
};

const defaultRule = (): Partial<CourierPenaltyRuleEntity> => ({
  id: 'rule-global',
  scope_type: 'global',
  scope_id: null,
  event: 'late_mark',
  threshold_days: 4,
  calc: 'per_day',
  amount: -2000,
  max_amount: null,
  priority: 0,
  active_from: 0,
  active_to: null,
  is_active: true,
});

/** `EntityManager` ning eng kichik, lekin haqiqiy xulqli taqlidi. */
function makeManager(rows: Rows = {}) {
  const inserted: Array<Record<string, unknown>> = [];
  const conflict = { hit: false };

  const manager = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === PostEntity)
        return rows.post === undefined
          ? { id: POST_ID, created_at: T0, courier_id: COURIER_ID, region_id: null }
          : rows.post;
      if (entity === UserEntity)
        return rows.courier === undefined
          ? { id: COURIER_ID, tariff_center: 20000, tariff_home: 20000 }
          : rows.courier;
      if (entity === CourierPenaltyConfigEntity)
        return rows.config === undefined ? { shadow_since: null } : rows.config;
      return null;
    }),
    find: jest.fn(async () => rows.rules ?? [defaultRule()]),
    createQueryBuilder: () => {
      const qb: Record<string, unknown> = {};
      let values: Record<string, unknown> = {};
      const chain = () => qb;
      Object.assign(qb, {
        insert: chain,
        into: chain,
        values: (v: Record<string, unknown>) => {
          values = v;
          return qb;
        },
        orIgnore: chain,
        returning: chain,
        execute: async () => {
          if (conflict.hit) return { raw: [] };
          inserted.push(values);
          return { raw: [{ id: 'entry-1', ...values }] };
        },
      });
      return qb;
    },
  };

  return { manager: manager as unknown as EntityManager, inserted, conflict };
}

const order = (over: Record<string, unknown> = {}) =>
  ({
    id: ORDER_ID,
    post_id: POST_ID,
    courier_tariff: 20000,
    where_deliver: Where_deliver.ADDRESS,
    ...over,
  }) as Parameters<CourierPenaltyService['recordForOrder']>[1]['order'];

let service: CourierPenaltyService;
beforeEach(() => {
  service = new CourierPenaltyService();
  // Yoqilgan holat ogohlantirishi testlarni ko'kartirmasin.
  jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
});

describe('yozuv yozilmaydigan holatlar', () => {
  it('pochtasiz buyurtma — langar yo‘q, hisob yo‘q', async () => {
    const { manager, inserted } = makeManager();
    const r = await service.recordForOrder(manager, {
      order: order({ post_id: null }),
      markedAt: T0 + 30 * DAY,
    });
    expect(r).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  it('pochta topilmasa yoki kuryeri yo‘q bo‘lsa — hisob yo‘q', async () => {
    const { manager, inserted } = makeManager({
      post: { id: POST_ID, created_at: T0, courier_id: null as never },
    });
    expect(
      await service.recordForOrder(manager, {
        order: order(),
        markedAt: T0 + 30 * DAY,
      }),
    ).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  /**
   * ⚠️ TASHQI PROVAYDER. Elchi/LDG posilkasini virtual vakil-kuryer
   * nomidan webhook belgilaydi — mavjud bo'lmagan odamga shtraf yozilmasin.
   */
  it('tashqi provayder kuryeriga tegilmaydi', async () => {
    const { manager, inserted } = makeManager({
      courier: {
        id: 'elchi-proxy',
        external_provider: 'elchi',
        tariff_home: 20000,
      },
    });
    expect(
      await service.recordForOrder(manager, {
        order: order(),
        markedAt: T0 + 30 * DAY,
      }),
    ).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  it('qo‘lda istisno qilingan kuryerga tegilmaydi', async () => {
    const { manager, inserted } = makeManager({
      courier: { id: COURIER_ID, penalty_exempt: true, tariff_home: 20000 },
    });
    expect(
      await service.recordForOrder(manager, {
        order: order(),
        markedAt: T0 + 30 * DAY,
      }),
    ).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  /**
   * Muddat ichida yozuv YO'Q. Nol summali qator yozilsa daftar har sotuvda
   * o'sardi va «kechikkanlar» hisoboti ichida ming nolni filtrlab yurardi.
   */
  it('muddat ichida belgilansa daftarga yozilmaydi', async () => {
    const { manager, inserted } = makeManager();
    expect(
      await service.recordForOrder(manager, {
        order: order(),
        markedAt: T0 + 3 * DAY,
      }),
    ).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  it('takroriy yozuv (indeks konflikti) xato TASHLAMAYDI', async () => {
    const { manager, conflict } = makeManager();
    conflict.hit = true;
    await expect(
      service.recordForOrder(manager, {
        order: order(),
        markedAt: T0 + 6 * DAY,
      }),
    ).resolves.toBeNull();
  });
});

describe('daftar yozuvi', () => {
  it('2 kun kechikish → 4 000, soya rejimida', async () => {
    const { manager, inserted } = makeManager();
    const r = await service.recordForOrder(manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
      actorId: ADMIN_ID,
    });

    expect(r).not.toBeNull();
    expect(inserted).toHaveLength(1);
    const row = inserted[0];
    expect(row.amount).toBe(4000);
    expect(row.kind).toBe('penalty');
    expect(row.reason).toBe('late_mark');
    expect(row.late_days).toBe(2);
    expect(row.base_tariff).toBe(20000);
    // ⚠️ FAZA 1 SHARTNOMASI: pulga tegilmaydi.
    expect(row.shadow).toBe(true);
    expect(row.cashbox_history_id).toBeNull();
  });

  /**
   * ⚠️ ASOSIY SHARTNOMA: shtraf POCHTA kuryeriga tushadi, amal qiluvchiga
   * EMAS. Kechikkan buyurtmani ko'pincha admin kuryer nomidan belgilaydi;
   * amal qiluvchiga yozilsa shtraf ADMIN ga tushardi va kuryer «admin
   * belgilab bersin» deb yana ham kech harakat qilardi.
   */
  it('shtraf POCHTA kuryeriga yoziladi, amal qiluvchiga emas', async () => {
    const { manager, inserted } = makeManager();
    await service.recordForOrder(manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
      actorId: ADMIN_ID,
    });
    expect(inserted[0].courier_id).toBe(COURIER_ID);
    // Amal qiluvchi faqat DALIL sifatida saqlanadi.
    expect(inserted[0].applied_by).toBe(ADMIN_ID);
  });

  it('shtraf tarifdan oshmaydi — pol 0', async () => {
    const { manager, inserted } = makeManager();
    await service.recordForOrder(manager, {
      order: order({ courier_tariff: 20000 }),
      markedAt: T0 + 40 * DAY,
    });
    // 36 × 2 000 = 72 000, lekin tarif 20 000
    expect(inserted[0].amount).toBe(20000);
  });

  /**
   * BEKOR yo'lida `order.courier_tariff` BO'SH qoladi (bekorda tarif
   * to'lanmaydi). Chegara u holda kuryer stavkasidan olinadi — «shu
   * buyurtma ko'pi bilan qancha keltirardi».
   */
  it('tarif bo‘sh bo‘lsa kuryer stavkasidan olinadi (bekor yo‘li)', async () => {
    const { manager, inserted } = makeManager({
      courier: { id: COURIER_ID, tariff_center: 9000, tariff_home: 15000 },
    });
    await service.recordForOrder(manager, {
      order: order({
        courier_tariff: null,
        where_deliver: Where_deliver.CENTER,
      }),
      markedAt: T0 + 40 * DAY,
    });
    expect(inserted[0].base_tariff).toBe(9000);
    expect(inserted[0].amount).toBe(9000);
  });
});

describe('grandfathering', () => {
  /**
   * ⚠️ SOYADA LANGAR — `shadow_since`. Aks holda soya hisobi butun eski
   * to'planmani bir marta sanab, yoqilgandan keyingi haqiqatdan ANCHA
   * katta raqam ko'rsatardi va muddat/narx qarori noto'g'ri burilardi.
   */
  it('soya boshlanishidan OLDIN jo‘natilgan buyurtma sanalmaydi', async () => {
    const { manager, inserted } = makeManager({
      config: { shadow_since: T0 + DAY },
    });
    expect(
      await service.recordForOrder(manager, {
        order: order(),
        markedAt: T0 + 30 * DAY,
      }),
    ).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  it('soya boshlangandan KEYIN jo‘natilgan buyurtma sanaladi', async () => {
    const { manager, inserted } = makeManager({
      config: { shadow_since: T0 - DAY },
    });
    await service.recordForOrder(manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
    });
    expect(inserted).toHaveLength(1);
  });

  /** Yoqilgandan keyin langar `activated_at` — soya langari ustidan o'tadi. */
  it('yoqilgandan keyin `activated_at` ustun keladi', async () => {
    const { manager, inserted } = makeManager({
      config: { is_active: true, activated_at: T0 + DAY, shadow_since: 0 },
    });
    expect(
      await service.recordForOrder(manager, {
        order: order(),
        markedAt: T0 + 30 * DAY,
      }),
    ).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  it('kalit qatori yo‘q bo‘lsa hisob to‘xtamaydi', async () => {
    const { manager, inserted } = makeManager({ config: null });
    await service.recordForOrder(manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
    });
    expect(inserted).toHaveLength(1);
  });
});

/**
 * ⚠️ FAZA 1 NI QULFLAYDI. Modul qo'lda yoqilsa ham kassa ulanishi hali
 * yo'q — bu holat JIM o'tmasligi kerak, aks holda admin «yoqdim» deb
 * o'ylab, aslida hech kim shtraf to'lamayotganini bilmasdi.
 */
describe('yoqilgan holat — Faza 3 gacha ogohlantiradi', () => {
  it('is_active bo‘lsa xato jurnaliga yozadi, yozuv esa soya qoladi', async () => {
    const { manager, inserted } = makeManager({
      config: { is_active: true, activated_at: T0 - DAY },
    });
    const spy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => {});

    await service.recordForOrder(manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('Faza 3');
    expect(inserted[0].shadow).toBe(true);
    expect(inserted[0].cashbox_history_id).toBeNull();
  });
});

/**
 * KURYER MUDDAT HISOBOTI.
 *
 * ⚠️ ENG MUHIM QULF: ekran va kassa BIR xil sonni ko'rsatishi kerak.
 * Hisobot `computeCourierAdjustment` ni qayta chaqiradi — qo'lda
 * `kun × narx` hisoblamaydi. Agar kimdir «tezlik uchun» uni qo'lda
 * hisoblashga o'tkazsa, pol/chegara/grandfathering takrorlanib, vaqt o'tib
 * ekran kassaga qarshi chiqardi: kuryer «menga 12 000 deb turgan edi»
 * deyib haqli e'tiroz bildirardi.
 */
describe('myDeadlines — kuryer sanog‘i', () => {
  const DEADLINE = 4;

  /** Hisobot uchun kengaytirilgan manager taqlidi (xom SQL qatorlari ham). */
  function makeReportManager(opts: {
    rows: Array<Record<string, unknown>>;
    courier?: Partial<UserEntity> | null;
    config?: Partial<CourierPenaltyConfigEntity> | null;
    rules?: Array<Partial<CourierPenaltyRuleEntity>>;
  }) {
    const base = makeManager({
      courier: opts.courier,
      config: opts.config,
      rules: opts.rules,
    });
    const qb: Record<string, unknown> = {};
    const chain = () => qb;
    Object.assign(qb, {
      select: chain,
      from: chain,
      innerJoin: chain,
      leftJoin: chain,
      where: chain,
      andWhere: chain,
      orderBy: chain,
      getRawMany: async () => opts.rows,
      // Yozuv yo'li uchun (bu testlarda ishlatilmaydi)
      insert: chain,
      into: chain,
      values: chain,
      orIgnore: chain,
      returning: chain,
      execute: async () => ({ raw: [] }),
    });
    (base.manager as unknown as Record<string, unknown>).createQueryBuilder =
      () => qb;
    return base.manager;
  }

  const row = (dispatchedDaysAgo: number, over: Record<string, unknown> = {}) => ({
    id: `o-${dispatchedDaysAgo}`,
    order_number: 100000 + dispatchedDaysAgo,
    // ⚠️ SATR — xom SQL `bigint` ni shunday qaytaradi.
    courier_tariff: '20000',
    where_deliver: 'address',
    post_created_at: String(T0 - dispatchedDaysAgo * DAY),
    post_region_id: null,
    market_name: 'Test market',
    ...over,
  });

  it('istisno qilingan kuryerga bo‘sh hisobot', async () => {
    const manager = makeReportManager({
      rows: [row(10)],
      courier: { id: COURIER_ID, penalty_exempt: true, tariff_home: 20000 },
    });
    const r = await service.myDeadlines(manager, COURIER_ID, T0);
    expect(r.module.exempt).toBe(true);
    expect(r.orders).toHaveLength(0);
  });

  it('muddat ichidagi buyurtma — qolgan kun, shtraf 0', async () => {
    const manager = makeReportManager({
      rows: [row(1)],
      config: { shadow_since: T0 - 90 * DAY },
    });
    const r = await service.myDeadlines(manager, COURIER_ID, T0);
    expect(r.orders).toHaveLength(1);
    const o = r.orders[0];
    expect(o.days_left).toBe(DEADLINE); // 5 kun oyna, 1 kun o'tdi → 4
    expect(o.late_days).toBe(0);
    expect(o.penalty_now).toBe(0);
    expect(o.due_today).toBe(false);
    // Ertaga ham hali muddat ichida
    expect(o.penalty_tomorrow).toBe(0);
  });

  /**
   * «Bugun muddati tugaydi» — ayni shu holat uchun ogohlantirish chiqadi.
   * Ertaga bosilsa shtraf BOSHLANADI, shuning uchun `penalty_tomorrow`
   * musbat bo'lishi SHART — aks holda ogohlantirishning ma'nosi yo'q.
   */
  it('bugun oxirgi kun — ertaga shtraf boshlanadi', async () => {
    const manager = makeReportManager({
      rows: [row(4)],
      config: { shadow_since: T0 - 90 * DAY },
    });
    const r = await service.myDeadlines(manager, COURIER_ID, T0);
    const o = r.orders[0];
    expect(o.due_today).toBe(true);
    expect(o.penalty_now).toBe(0);
    expect(o.penalty_tomorrow).toBe(2000);
    expect(r.summary.due_today).toBe(1);
    expect(r.summary.penalty_tomorrow).toBe(2000);
  });

  it('kechikkan buyurtma — hozirgi va ertangi summa', async () => {
    const manager = makeReportManager({
      rows: [row(7)],
      config: { shadow_since: T0 - 90 * DAY },
    });
    const r = await service.myDeadlines(manager, COURIER_ID, T0);
    const o = r.orders[0];
    expect(o.late_days).toBe(3);
    expect(o.penalty_now).toBe(6000);
    expect(o.penalty_tomorrow).toBe(8000);
    expect(o.days_left).toBeNull();
    expect(r.summary.overdue).toBe(1);
  });

  /**
   * ⚠️ `penalty_max` — POL. Eng yomon holat tarif bilan chegaralangan,
   * «kun × narx» cheksiz o'smaydi. Kuryerga cheksiz o'sadigan son
   * ko'rsatilsa, u modulni jazo emas, qarz tuzog'i deb qabul qilardi.
   */
  it('eng yomon holat tarif bilan chegaralangan', async () => {
    const manager = makeReportManager({
      rows: [row(40)],
      config: { shadow_since: T0 - 90 * DAY },
    });
    const r = await service.myDeadlines(manager, COURIER_ID, T0);
    expect(r.orders[0].penalty_max).toBe(20000);
    expect(r.orders[0].penalty_now).toBe(20000);
    expect(r.orders[0].capped).toBe(true);
  });

  /**
   * Grandfathering: modul yoqilishidan oldin jo'natilgan buyurtma
   * ro'yxatda KO'RINADI (kuryer uni ko'rib turishi kerak), lekin
   * summalari 0 va `immune` belgisi bor — «nega bunga shtraf yo'q»
   * savoli tug'ilmasin.
   */
  it('modul yoqilishidan oldingi buyurtma — immune, summalar 0', async () => {
    const manager = makeReportManager({
      rows: [row(40)],
      config: { shadow_since: T0 - 10 * DAY },
    });
    const r = await service.myDeadlines(manager, COURIER_ID, T0);
    const o = r.orders[0];
    expect(o.immune).toBe(true);
    expect(o.penalty_now).toBe(0);
    expect(o.penalty_max).toBe(0);
    // Xulosaga ham kirmaydi
    expect(r.summary.overdue).toBe(0);
    expect(r.summary.penalty_max).toBe(0);
  });

  it('xulosa bir nechta buyurtmani jamlaydi', async () => {
    const manager = makeReportManager({
      rows: [row(1), row(4), row(7), row(9)],
      config: { shadow_since: T0 - 90 * DAY },
    });
    const r = await service.myDeadlines(manager, COURIER_ID, T0);
    expect(r.summary.pending).toBe(4);
    expect(r.summary.due_today).toBe(1);
    expect(r.summary.overdue).toBe(2);
    // 3 kun × 2000 + 5 kun × 2000 = 6000 + 10000
    expect(r.summary.penalty_now).toBe(16000);
    // ertaga: 2000 (bugun tugaydigan) + 8000 + 12000
    expect(r.summary.penalty_tomorrow).toBe(22000);
  });

  /** Soya rejimi klientga OCHIQ aytiladi — ekran yolg'on gapirmasin. */
  it('soya rejimi hisobotda ko‘rinadi', async () => {
    const manager = makeReportManager({
      rows: [row(7)],
      config: { is_active: false, shadow_since: T0 - 90 * DAY },
    });
    const r = await service.myDeadlines(manager, COURIER_ID, T0);
    expect(r.module.active).toBe(false);
  });
});

/**
 * ⚠️ XOM SQL SATR TUZOG'I. `bigint`/`numeric` ustunlar `getRawMany()` dan
 * SATR bo'lib keladi. Loyihada bu nuqson allaqachon bir marta pul
 * hisobini buzgan — shuning uchun tur bu yerda qulflanadi.
 */
describe('xom SQL turlari', () => {
  it('order_number raqam bo‘lib qaytadi, satr emas', async () => {
    const base = makeManager({ config: { shadow_since: T0 - 90 * DAY } });
    const qb: Record<string, unknown> = {};
    const chain = () => qb;
    Object.assign(qb, {
      select: chain,
      from: chain,
      innerJoin: chain,
      leftJoin: chain,
      where: chain,
      andWhere: chain,
      orderBy: chain,
      getRawMany: async () => [
        {
          id: 'o-1',
          order_number: '100155',
          courier_tariff: '20000',
          where_deliver: 'address',
          post_created_at: String(T0 - 7 * DAY),
          post_region_id: null,
          market_name: 'M',
        },
      ],
    });
    (base.manager as unknown as Record<string, unknown>).createQueryBuilder =
      () => qb;

    const r = await service.myDeadlines(base.manager, COURIER_ID, T0);
    expect(typeof r.orders[0].order_number).toBe('number');
    expect(r.orders[0].order_number).toBe(100155);
    // Tarif ham raqam — chegara hisobi satr bilan buzilmasin
    expect(r.orders[0].penalty_max).toBe(20000);
  });
});
