/// <reference types="jest" />
import { EntityManager } from 'typeorm';
import { Where_deliver } from 'src/common/enums';
import { CourierPenaltyService } from './courier-penalty.service';
import { CourierPenaltyConfigEntity } from 'src/core/entity/courier-penalty-config.entity';
import { CourierPenaltyRuleEntity } from 'src/core/entity/courier-penalty-rule.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { CourierPenaltyEntryEntity } from 'src/core/entity/courier-penalty-entry.entity';

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
  actor?: Partial<UserEntity> | null;
  config?: Partial<CourierPenaltyConfigEntity> | null;
  rules?: Array<Partial<CourierPenaltyRuleEntity>>;
  cashbox?: Partial<CashEntity> | null;
  courierBalance?: number;
  entries?: Array<Partial<CourierPenaltyEntryEntity>>;
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
  /** Kassa yozuvlari — `applyCashboxDelta` ularni shu yerga tushiradi. */
  const cashWrites: Array<Record<string, unknown>> = [];
  /** Moliyaviy tarozi qatorlari. */
  const fbhWrites: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  let balance = rows.courierBalance ?? 0;

  const manager = {
    findOne: jest.fn(async (entity: unknown, opts?: any) => {
      if (entity === PostEntity)
        return rows.post === undefined
          ? { id: POST_ID, created_at: T0, courier_id: COURIER_ID, region_id: null }
          : rows.post;
      if (entity === UserEntity) {
        // Aktyor tekshiruvi: boshqa id so'ralsa aktyor qaytariladi.
        if (opts?.where?.id && opts.where.id !== COURIER_ID)
          return rows.actor ?? null;
        return rows.courier === undefined
          ? { id: COURIER_ID, tariff_center: 20000, tariff_home: 20000 }
          : rows.courier;
      }
      if (entity === CourierPenaltyConfigEntity)
        return rows.config === undefined ? { shadow_since: null } : rows.config;
      if (entity === CashEntity)
        return rows.cashbox === undefined
          ? { id: 'cb-1', user_id: COURIER_ID, balance }
          : rows.cashbox;
      return null;
    }),
    find: jest.fn(async (entity: unknown) => {
      if (entity === CashEntity) return [];
      if (entity === CourierPenaltyEntryEntity) return rows.entries ?? [];
      return rows.rules ?? [defaultRule()];
    }),
    update: jest.fn(async (_e: unknown, id: unknown, data: unknown) => {
      updates.push({ id, ...(data as Record<string, unknown>) });
      return { affected: 1 };
    }),
    /** `applyCashboxDelta` ning atomik UPDATE ... RETURNING yo'li. */
    query: jest.fn(async (_sql: string, params: unknown[]) => {
      balance += Number(params[0]);
      return [[{ balance: String(balance) }], 1];
    }),
    create: jest.fn((entity: unknown, data: Record<string, unknown>) => ({
      __entity: entity,
      ...data,
    })),
    save: jest.fn(async (a: unknown, b?: unknown) => {
      const row = (b ?? a) as Record<string, unknown>;
      if (row?.operation_type) cashWrites.push(row);
      else if (row?.balance_before !== undefined) fbhWrites.push(row);
      return { id: 'hist-1', ...row };
    }),
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

  return {
    manager: manager as unknown as EntityManager,
    inserted,
    conflict,
    cashWrites,
    fbhWrites,
    updates,
    get balance() {
      return balance;
    },
  };
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
 * ══════════════ YOQILGAN REJIM — PUL HAQIQATAN KO'CHADI ══════════════
 *
 * Bu bo'lim Faza 3 ning shartnomasini qulflaydi. Har bir test aniq bir
 * tarzda noto'g'ri bo'lishi mumkin bo'lgan narsani qotiradi.
 */
describe('yoqilgan rejim — kassaga yozish', () => {
  const activeCfg = (over: Record<string, unknown> = {}) => ({
    is_active: true,
    activated_at: T0 - 90 * DAY,
    shadow_since: T0 - 200 * DAY,
    ...over,
  });

  it('shtraf kuryer kassasiga INCOME bo‘lib tushadi', async () => {
    const h = makeManager({ config: activeCfg(), courierBalance: 100000 });
    await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
      actorId: COURIER_ID,
    });

    expect(h.inserted[0].shadow).toBe(false);
    expect(h.cashWrites).toHaveLength(1);
    /**
     * ⚠️ Kuryer kassasida musbat balans = QARZ. Shtraf qarzni OSHIRISHI
     * kerak, ya'ni `income`. `expense` yozilsa jazo o'rniga mukofot
     * bo'lib qolardi.
     */
    expect(h.cashWrites[0].operation_type).toBe('income');
    expect(h.cashWrites[0].amount).toBe(4000);
    expect(h.cashWrites[0].source_type).toBe('courier_penalty');
    expect(h.balance).toBe(104000);
  });

  /** Daftar qatori kassa yozuviga BOG'LANISHI shart (invariant I-CP1). */
  it('daftar qatori kassa langarini oladi', async () => {
    const h = makeManager({ config: activeCfg(), courierBalance: 100000 });
    await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
    });
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].cashbox_history_id).toBeTruthy();
  });

  /** Moliyaviy tarozi sababsiz siljimasin. */
  it('moliyaviy tarozi qatori yoziladi', async () => {
    const h = makeManager({ config: activeCfg(), courierBalance: 100000 });
    await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
    });
    expect(h.fbhWrites).toHaveLength(1);
    expect(h.fbhWrites[0].source_type).toBe('courier_penalty');
    expect(h.fbhWrites[0].amount).toBe(4000);
  });

  /**
   * ⚠️ ENG MUHIM TEST. Takroriy chaqiruvda daftar `orIgnore` bilan jim
   * o'tadi — kassa yozuvi SHUNGA bog'langan bo'lishi shart. Aks holda
   * daftarda bitta qator qolib, kassadan pul IKKI MARTA yechilardi.
   */
  it('takroriy chaqiruvda kassaga TEGILMAYDI', async () => {
    const h = makeManager({ config: activeCfg(), courierBalance: 100000 });
    h.conflict.hit = true;
    await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
    });
    expect(h.cashWrites).toHaveLength(0);
    expect(h.fbhWrites).toHaveLength(0);
    expect(h.balance).toBe(100000);
  });

  /**
   * ⚠️ SOTUV SHTRAF TUFAYLI YIQILMASIN. Kassasiz kuryer amalda
   * bo'lmasligi kerak, lekin bo'lsa shtraf soyada qoladi.
   */
  it('kassa topilmasa sotuv yiqilmaydi, shtraf soyada qoladi', async () => {
    const h = makeManager({ config: activeCfg(), cashbox: null });
    const spy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => {});
    const r = await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
    });
    expect(r).not.toBeNull();
    expect(h.inserted[0].shadow).toBe(true);
    expect(h.cashWrites).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });

  /**
   * ⚠️ YOQILGANDA LANGAR FAQAT `activated_at`.
   *
   * `shadow_since` ga tushib ketsa, yoqilgan kuni soya boshlanganidan
   * beri jo'natilgan HAMMA buyurtma uchun kuryerlardan birdan haqiqiy
   * pul yechilardi.
   */
  it('yoqilganda langar shadow_since ga TUSHMAYDI', async () => {
    const h = makeManager({
      // Pochta soya davrida jo'natilgan, lekin yoqilishdan OLDIN
      config: activeCfg({ activated_at: T0 + DAY }),
      courierBalance: 100000,
    });
    const r = await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + 30 * DAY,
    });
    expect(r).toBeNull();
    expect(h.cashWrites).toHaveLength(0);
  });

  /**
   * ⚠️ TASHQI PROVAYDER AKTYOR. Egalik darvozasi `external_provider`
   * aktyorni chetlab o'tadi, ya'ni Elchi/LDG webhooki haqiqiy kuryerning
   * buyurtmasini belgilashi mumkin — u holda shtraf begunoh odamga
   * tushardi.
   */
  it('tashqi provayder aktyor nomidan shtraf yozilmaydi', async () => {
    const h = makeManager({
      config: activeCfg(),
      actor: { id: 'elchi-proxy', external_provider: 'elchi' },
    });
    const r = await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + 6 * DAY,
      actorId: 'elchi-proxy',
    });
    expect(r).toBeNull();
    expect(h.cashWrites).toHaveLength(0);
  });
});

/**
 * BONUS — QARZ HAJMIDA CHEKLANADI.
 *
 * ⚠️ Tizimda kuryerga PUL BERISH yo'li YO'Q, faqat undan olish bor.
 * Cheklovsiz bonus kassani manfiyga tushirib, hisob-kitob qilinmaydigan
 * majburiyat yaratardi. Bu shtrafdagi «tarif poli» qoidasining aynasi.
 */
describe('bonus chegarasi', () => {
  const bonusRule = () => ({
    ...defaultRule(),
    id: 'b-1',
    event: 'early_mark',
    threshold_days: 2,
    calc: 'once',
    amount: 5000,
  });

  const cfg = { is_active: true, activated_at: T0 - 90 * DAY };

  it('qarz yetarli bo‘lsa to‘liq bonus', async () => {
    const h = makeManager({
      config: cfg,
      rules: [bonusRule()],
      courierBalance: 50000,
    });
    await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + DAY,
    });
    expect(h.cashWrites[0].operation_type).toBe('expense');
    expect(h.cashWrites[0].amount).toBe(5000);
    expect(h.balance).toBe(45000);
  });

  it('qarz kam bo‘lsa bonus qisqaradi', async () => {
    const h = makeManager({
      config: cfg,
      rules: [bonusRule()],
      courierBalance: 2000,
    });
    await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + DAY,
    });
    // Daftarga ham AMALDAGI summa yoziladi
    expect(h.inserted[0].amount).toBe(-2000);
    expect(h.cashWrites[0].amount).toBe(2000);
    expect(h.balance).toBe(0);
  });

  /** Qarz yo'q — bonus ham yo'q, kassa manfiyga tushmaydi. */
  it('qarz bo‘lmasa bonus yozilmaydi', async () => {
    const h = makeManager({
      config: cfg,
      rules: [bonusRule()],
      courierBalance: 0,
    });
    const r = await service.recordForOrder(h.manager, {
      order: order(),
      markedAt: T0 + DAY,
    });
    expect(r).toBeNull();
    expect(h.cashWrites).toHaveLength(0);
  });
});

/**
 * TESKARI QAYTARISH — rollback va qo'lda bekor qilish uchun YAGONA yo'l.
 */
describe('reverseForOrder', () => {
  const realEntry = (over: Record<string, unknown> = {}) => ({
    id: 'e-1',
    order_id: ORDER_ID,
    courier_id: COURIER_ID,
    rule_id: 'r-1',
    kind: 'penalty',
    reason: 'late_mark',
    amount: 6000,
    late_days: 3,
    base_tariff: 50000,
    shadow: false,
    cashbox_history_id: 'hist-0',
    waives_entry_id: null,
    ...over,
  });

  it('haqiqiy shtrafni kassadan qaytaradi', async () => {
    const h = makeManager({ entries: [realEntry()], courierBalance: 100000 });
    const n = await service.reverseForOrder(h.manager, {
      orderId: ORDER_ID,
      reason: 'sale_rolled_back',
      actorId: ADMIN_ID,
    });
    expect(n).toBe(1);
    expect(h.cashWrites).toHaveLength(1);
    expect(h.cashWrites[0].operation_type).toBe('expense');
    expect(h.cashWrites[0].amount).toBe(6000);
    expect(h.balance).toBe(94000);
  });

  /**
   * ⚠️ SOYA QATORIGA PUL QAYTARILMAYDI. Shartsiz qaytarilsa, hech qachon
   * UNDIRILMAGAN shtraf uchun kuryerga haqiqiy pul berilardi — jazo
   * o'rniga mukofot.
   */
  it('soya qatoriga pul qaytarilmaydi', async () => {
    const h = makeManager({
      entries: [realEntry({ shadow: true, cashbox_history_id: null })],
      courierBalance: 100000,
    });
    const n = await service.reverseForOrder(h.manager, {
      orderId: ORDER_ID,
      reason: 'sale_rolled_back',
      actorId: ADMIN_ID,
    });
    // Daftar qatori yoziladi, LEKIN kassaga tegilmaydi
    expect(n).toBe(1);
    expect(h.cashWrites).toHaveLength(0);
    expect(h.balance).toBe(100000);
  });

  /** Ikki marta qaytarilsa kuryer qarzi asossiz kamayardi. */
  it('allaqachon qaytarilgan yozuv ikkinchi marta qaytarilmaydi', async () => {
    const h = makeManager({
      entries: [
        realEntry(),
        { id: 'w-1', kind: 'waiver', waives_entry_id: 'e-1', amount: -6000 },
      ],
      courierBalance: 100000,
    });
    const n = await service.reverseForOrder(h.manager, {
      orderId: ORDER_ID,
      reason: 'sale_rolled_back',
      actorId: ADMIN_ID,
    });
    expect(n).toBe(0);
    expect(h.cashWrites).toHaveLength(0);
  });

  /** Bitta yozuvni nishonlash — qo'lda bekor qilish yo'li. */
  it('entryId berilsa faqat o‘sha yozuv qaytariladi', async () => {
    const h = makeManager({ entries: [realEntry()], courierBalance: 100000 });
    const n = await service.reverseForOrder(h.manager, {
      orderId: ORDER_ID,
      entryId: 'e-1',
      reason: 'system_fault',
      actorId: ADMIN_ID,
    });
    expect(n).toBe(1);
  });

  it('qaytariladigan yozuv bo‘lmasa 0', async () => {
    const h = makeManager({ entries: [] });
    expect(
      await service.reverseForOrder(h.manager, {
        orderId: ORDER_ID,
        reason: 'sale_rolled_back',
        actorId: ADMIN_ID,
      }),
    ).toBe(0);
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

/**
 * BEKOR YO'LI — QULFLANGAN QAROR.
 *
 * ⚠️ BU TEST QASDDAN «NOTO'G'RI KO'RINADIGAN» XULQNI QULFLAYDI.
 *
 * Umumiy qoida: «shtraf 0 gacha tushsin, undan pastga emas» — ya'ni
 * kuryer hech qachon ustiga pul to'lamaydi. SOTUVDA bu ishlaydi: shtraf
 * tarifdan oshmaydi.
 *
 * BEKORDA esa kuryerga tarif UMUMAN to'lanmaydi, ya'ni uning shu
 * buyurtmadagi daromadi allaqachon NOL va shtraf boshqa buyurtmalardan
 * ishlagan pulidan yechiladi — CHO'NTAKDAN.
 *
 * Qoidani so'zma-so'z o'qisak bekorga shtraf bo'lmasligi kerak edi.
 * Shunday qilinmadi: u holda kuryer uchun eng foydali yo'l sotuvni
 * vaqtida bosib, bekorni UMUMAN bosmaslik bo'lardi va bekorlar abadiy
 * `waiting` bo'lib qolardi.
 *
 * Agar kelajakda kimdir «0 dan past emas» qoidasini bekorga ham
 * qo'llamoqchi bo'lsa — bu test yiqiladi va uni shu izohga qaytaradi.
 * Qarorni o'zgartirish KOD emas, SIYOSAT masalasi.
 */
describe('bekor yo‘li — qulflangan qaror', () => {
  const cancelOrder = () =>
    order({
      // ⚠️ Bekorda bu ustun BO'SH qoladi — sotuv yo'li uni to'ldiradi.
      courier_tariff: null,
      where_deliver: Where_deliver.CENTER,
    });

  it('kechikkan BEKOR uchun shtraf YOZILADI', async () => {
    const { manager, inserted } = makeManager({
      courier: { id: COURIER_ID, tariff_center: 30000, tariff_home: 50000 },
      config: { shadow_since: T0 - 90 * DAY },
    });
    await service.recordForOrder(manager, {
      order: cancelOrder(),
      markedAt: T0 + 7 * DAY,
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0].amount).toBe(6000); // 3 kun × 2 000
  });

  /**
   * Chegara — kuryerning STAVKASI, ya'ni «shu buyurtma ko'pi bilan
   * qancha keltirardi». Yetkazish turiga mos stavka olinishi SHART:
   * markazga 30 000, uyga 50 000.
   */
  it('chegara yetkazish turiga mos stavkadan olinadi', async () => {
    for (const [where, expected] of [
      [Where_deliver.CENTER, 30000],
      [Where_deliver.ADDRESS, 50000],
    ] as const) {
      const { manager, inserted } = makeManager({
        courier: { id: COURIER_ID, tariff_center: 30000, tariff_home: 50000 },
        config: { shadow_since: T0 - 90 * DAY },
      });
      await service.recordForOrder(manager, {
        order: order({ courier_tariff: null, where_deliver: where }),
        // Juda uzoq kechikish — chegara ishlashi uchun
        markedAt: T0 + 90 * DAY,
      });
      expect(inserted[0].base_tariff).toBe(expected);
      expect(inserted[0].amount).toBe(expected);
    }
  });

  /**
   * ⚠️ ENG MUHIM QATOR. Bekorda kuryer kassasiga HECH NARSA yozilmaydi,
   * ya'ni bu summa uning boshqa daromadidan ketadi. Shu bilan ham
   * shtraf NOLGA TUSHIRILMAYDI — qabul qilingan narx.
   */
  it('daromad nol bo‘lsa ham shtraf nolga tushirilmaydi', async () => {
    const { manager, inserted } = makeManager({
      courier: { id: COURIER_ID, tariff_center: 30000, tariff_home: 30000 },
      config: { shadow_since: T0 - 90 * DAY },
    });
    await service.recordForOrder(manager, {
      order: cancelOrder(),
      markedAt: T0 + 10 * DAY,
    });
    expect(inserted[0].amount).toBeGreaterThan(0);
  });

  /**
   * Stavkasi yo'q kuryer (yangi, hali tarif berilmagan) — chegara 0,
   * ya'ni shtraf ham 0. Bu YAGONA holat bekorda shtraf bo'lmaydi:
   * «ko'pi bilan qancha keltirardi» savolining javobi nol.
   */
  it('stavkasi yo‘q kuryerga shtraf yozilmaydi', async () => {
    const { manager, inserted } = makeManager({
      courier: { id: COURIER_ID, tariff_center: 0, tariff_home: 0 },
      config: { shadow_since: T0 - 90 * DAY },
    });
    expect(
      await service.recordForOrder(manager, {
        order: cancelOrder(),
        markedAt: T0 + 10 * DAY,
      }),
    ).toBeNull();
    expect(inserted).toHaveLength(0);
  });
});
