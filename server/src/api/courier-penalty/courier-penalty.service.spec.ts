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
