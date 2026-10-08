/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CourierPenaltyAdminService } from './courier-penalty-admin.service';
import { CourierPenaltyService } from './courier-penalty.service';
import {
  CourierPenaltyCalc,
  CourierPenaltyEvent,
  CourierPenaltyScope,
  type PenaltyRule,
} from '../order/utils/courier-penalty.util';
import { CourierPenaltyEntryEntity } from 'src/core/entity/courier-penalty-entry.entity';
import { ActivityLogService } from 'src/api/activity-log/activity-log.service';

/** Audit yozuvi testlarni to'smasin — `log()` jimgina o'tadi. */
const noopLog = { log: jest.fn(async () => undefined) } as unknown as ActivityLogService;

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

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

/** Kechikkanlar so'rovining xom qatori. */
const row = (over: Record<string, unknown> = {}) => ({
  id: 'o-1',
  order_number: '100001',
  courier_tariff: null,
  where_deliver: 'address',
  total_price: '250000',
  post_created_at: String(NOW - 10 * DAY),
  post_region_id: null,
  courier_id: 'c-1',
  courier_name: 'Kuryer A',
  courier_phone: '+998900000001',
  courier_region_id: 'r-1',
  tariff_center: '30000',
  tariff_home: '50000',
  penalty_exempt: false,
  market_name: 'Market',
  ...over,
});

function makeService(opts: {
  rows?: Array<Record<string, unknown>>;
  rules?: PenaltyRule[];
  config?: Record<string, unknown> | null;
}) {
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
    getRawMany: async () => opts.rows ?? [],
  });

  const dataSource = {
    manager: { createQueryBuilder: () => qb },
  } as unknown as DataSource;

  const core = {
    loadConfig: async () =>
      opts.config === undefined ? { shadow_since: 0 } : opts.config,
    loadRules: async () => opts.rules ?? [rule()],
  } as unknown as CourierPenaltyService;

  return new CourierPenaltyAdminService(dataSource, core, noopLog);
}

describe('kechikkanlar ro‘yxati', () => {
  /**
   * ⚠️ MODULNING ENG MUHIM EKRANI. Shtraf faqat kuryer tugmani bosganda
   * yoziladi; umuman bosmagan kuryer hech narsa to'lamaydi. Bu ro'yxat
   * bo'lmasa modul eng intizomli kuryerni jazolab, eng beparvosini
   * tegmay qo'yardi.
   */
  it('kechikkan buyurtmani kuryer bo‘yicha guruhlaydi', async () => {
    const s = makeService({ rows: [row(), row({ id: 'o-2' })] });
    const r = await s.overdue({}, NOW);
    expect(r.couriers).toHaveLength(1);
    expect(r.couriers[0].overdue_count).toBe(2);
    expect(r.couriers[0].oldest_late_days).toBe(6);
    // 2 × (6 kun × 2 000)
    expect(r.summary.penalty_now).toBe(24000);
  });

  it('muddat ichidagilar ro‘yxatga tushmaydi', async () => {
    const s = makeService({
      rows: [row({ post_created_at: String(NOW - 2 * DAY) })],
    });
    expect((await s.overdue({}, NOW)).couriers).toHaveLength(0);
  });

  it('istisno qilingan kuryer ro‘yxatda yo‘q', async () => {
    const s = makeService({ rows: [row({ penalty_exempt: true })] });
    expect((await s.overdue({}, NOW)).couriers).toHaveLength(0);
  });

  /**
   * Tartib «kimga birinchi qo'ng'iroq qilish kerak» degan savolga javob
   * berishi kerak — eng uzoq kechikkan yuqorida.
   */
  it('eng og‘ir kuryer birinchi o‘rinda', async () => {
    const s = makeService({
      rows: [
        row({ courier_id: 'c-1', post_created_at: String(NOW - 7 * DAY) }),
        row({
          id: 'o-9',
          courier_id: 'c-2',
          courier_name: 'Kuryer B',
          post_created_at: String(NOW - 40 * DAY),
        }),
      ],
    });
    const r = await s.overdue({}, NOW);
    expect(r.couriers[0].courier_id).toBe('c-2');
  });

  /**
   * ⚠️ Ro'yxatdagi son kuryer ekranidagi son bilan AYNI bo'lishi SHART:
   * ikkalasi ham `computeCourierAdjustment` dan chiqadi. Pol ham shu
   * yerda ishlaydi.
   */
  it('pol ro‘yxatda ham ishlaydi', async () => {
    const s = makeService({
      rows: [row({ post_created_at: String(NOW - 60 * DAY) })],
    });
    const o = (await s.overdue({}, NOW)).couriers[0].orders[0];
    // 55 kun × 2 000 = 110 000, lekin uy tarifi 50 000
    expect(o.penalty_now).toBe(50000);
    expect(o.capped).toBe(true);
  });

  /** Yoqilishdan oldin jo'natilganlar ko'rinadi, lekin summasi 0. */
  it('grandfathering: immune buyurtma 0 summa bilan ko‘rinadi', async () => {
    const s = makeService({
      rows: [row({ post_created_at: String(NOW - 60 * DAY) })],
      config: { shadow_since: NOW - 10 * DAY },
    });
    const o = (await s.overdue({}, NOW)).couriers[0].orders[0];
    expect(o.immune).toBe(true);
    expect(o.penalty_now).toBe(0);
  });

  it('minDays filtri', async () => {
    const s = makeService({
      rows: [
        row({ post_created_at: String(NOW - 6 * DAY) }), // 1 kun kechikish
        row({ id: 'o-2', post_created_at: String(NOW - 20 * DAY) }), // 15 kun
      ],
    });
    expect((await s.overdue({ minDays: 10 }, NOW)).couriers[0].overdue_count).toBe(1);
  });
});

/**
 * ⚠️ ISHORA TEKSHIRUVI. Shtraf MANFIY, bonus MUSBAT summa bilan
 * yoziladi va hisob yadrosi turni ishoraga qarab ajratadi. Admin xato
 * ishora kiritsa, «bonus» deb o'ylagan qoidasi SHTRAF bo'lib ishlardi —
 * va buni faqat kuryer kassasida pul ko'paygach payqashardi.
 */
describe('qoida tekshiruvi', () => {
  const s = () => makeService({});
  const valid = {
    scope_type: CourierPenaltyScope.GLOBAL,
    scope_id: null,
    event: CourierPenaltyEvent.LATE_MARK,
    threshold_days: 4,
    calc: CourierPenaltyCalc.PER_DAY,
    amount: -2000,
  };
  const check = (over: Record<string, unknown>) =>
    (s() as unknown as { assertRule: (d: unknown) => void }).assertRule({
      ...valid,
      ...over,
    });

  it('to‘g‘ri qoida o‘tadi', () => {
    expect(() => check({})).not.toThrow();
  });

  it('shtraf MUSBAT bo‘lsa rad etiladi', () => {
    expect(() => check({ amount: 2000 })).toThrow(BadRequestException);
  });

  it('bonus MANFIY bo‘lsa rad etiladi', () => {
    expect(() =>
      check({ event: CourierPenaltyEvent.EARLY_MARK, amount: -2000 }),
    ).toThrow(BadRequestException);
  });

  it('summa 0 bo‘lsa rad etiladi', () => {
    expect(() => check({ amount: 0 })).toThrow(BadRequestException);
  });

  it('kuryer qamrovida nishon majburiy', () => {
    expect(() =>
      check({ scope_type: CourierPenaltyScope.COURIER, scope_id: null }),
    ).toThrow(BadRequestException);
  });

  it('global qamrovda nishon bo‘lmaydi', () => {
    expect(() => check({ scope_id: 'c-1' })).toThrow(BadRequestException);
  });

  it('tugash sanasi boshlanishdan oldin bo‘lmasin', () => {
    expect(() => check({ active_from: NOW, active_to: NOW - DAY })).toThrow(
      BadRequestException,
    );
  });
});

/**
 * SHTRAFNI BEKOR QILISH.
 *
 * ⚠️ PUL YO'LI YADRO SERVISDA. `waive` endi `core.reverseForOrder` ni
 * chaqiradi — rollback ham AYNI yo'ldan o'tadi. Ikki nusxa yozilsa ular
 * vaqt o'tib ajralib ketardi va biri pulni qaytarib, ikkinchisi
 * qaytarmay qo'yardi.
 */
describe('shtrafni bekor qilish', () => {
  function makeWaiveService(
    entry: Partial<CourierPenaltyEntryEntity> | null,
    existingWaiver: unknown = null,
    reverseResult = 1,
  ) {
    const reverse = jest.fn(
      async (_m: unknown, _p: Record<string, unknown>) => reverseResult,
    );
    const m = {
      findOne: jest.fn(async (_e: unknown, opts: any) =>
        opts?.where?.waives_entry_id ? existingWaiver : entry,
      ),
      create: (_e: unknown, data: Record<string, unknown>) => data,
      save: jest.fn(async (row: Record<string, unknown>) => row),
    };
    const dataSource = {
      manager: {},
      transaction: async (fn: (mm: unknown) => unknown) => fn(m),
    } as unknown as DataSource;
    const core = { reverseForOrder: reverse } as unknown as CourierPenaltyService;
    const svc = new CourierPenaltyAdminService(dataSource, core, noopLog);
    return { svc, reverse };
  }

  const penalty = {
    id: 'e-1',
    order_id: 'o-1',
    courier_id: 'c-1',
    rule_id: 'r-1',
    kind: 'penalty',
    amount: 6000,
    late_days: 3,
    base_tariff: 50000,
    shadow: true,
  } as Partial<CourierPenaltyEntryEntity>;

  it('yadro servisning teskari qaytarishini chaqiradi', async () => {
    const { svc, reverse } = makeWaiveService(penalty);
    await svc.waive('e-1', 'system_fault', 'ilova ishlamadi', 'admin-1');
    expect(reverse).toHaveBeenCalledTimes(1);
    const arg = reverse.mock.calls[0][1];
    expect(arg.entryId).toBe('e-1');
    expect(arg.reason).toBe('system_fault');
    expect(arg.actorId).toBe('admin-1');
    expect(arg.note).toBe('ilova ishlamadi');
  });

  /** Teskari qaytarish bajarilmasa amal MUVAFFAQIYATLI deb ko'rsatilmasin. */
  it('hech narsa qaytarilmasa xato beradi', async () => {
    const { svc } = makeWaiveService(penalty, null, 0);
    await expect(svc.waive('e-1', 'wrong_rule', null, 'a')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('sabab yopiq ro‘yxatdan bo‘lmasa rad etiladi', async () => {
    const { svc, reverse } = makeWaiveService(penalty);
    await expect(
      svc.waive('e-1', 'shunchaki' as never, null, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    // Pul yo'liga UMUMAN borilmasin
    expect(reverse).not.toHaveBeenCalled();
  });

  /** Ikki marta bekor qilinsa kuryer qarzi asossiz kamayardi. */
  it('allaqachon bekor qilingan yozuv qayta bekor qilinmaydi', async () => {
    const { svc } = makeWaiveService(penalty, { id: 'w-1' });
    await expect(svc.waive('e-1', 'wrong_rule', null, 'a')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('bekor qilish qatorining o‘zini bekor qilib bo‘lmaydi', async () => {
    const { svc } = makeWaiveService({ ...penalty, kind: 'waiver' });
    await expect(svc.waive('e-1', 'wrong_rule', null, 'a')).rejects.toThrow(
      BadRequestException,
    );
  });
});

/**
 * ⚠️ ISHLAMAYDIGAN TUGMA BO'LMASIN.
 *
 * Daftar SAHIFALANADI: shtraf bir sahifada, uni bekor qilgan qator esa
 * boshqasida bo'lishi mumkin. Agar `waived` belgisi faqat sahifadagi
 * qatorlardan hisoblansa, ekran bekor qilingan shtrafga yana «bekor
 * qilish» tugmasini ko'rsatib, admin bosganda server xato qaytarardi.
 */
describe('daftar — bekor qilingan belgisi', () => {
  function makeEntriesService(
    entries: Array<Record<string, unknown>>,
    waivers: Array<{ waives_entry_id: string }>,
  ) {
    const qb: Record<string, unknown> = {};
    const chain = () => qb;
    Object.assign(qb, {
      orderBy: chain,
      skip: chain,
      take: chain,
      andWhere: chain,
      getManyAndCount: async () => [entries, entries.length],
    });
    const manager = {
      createQueryBuilder: () => qb,
      find: jest.fn(async (_e: unknown, opts: any) =>
        opts?.where?.waives_entry_id ? waivers : [],
      ),
    };
    const dataSource = { manager } as unknown as DataSource;
    return new CourierPenaltyAdminService(
      dataSource,
      {} as unknown as CourierPenaltyService,
      noopLog,
    );
  }

  const entry = (id: string) => ({
    id,
    created_at: NOW,
    order_id: `o-${id}`,
    courier_id: 'c-1',
    kind: 'penalty',
    reason: 'late_mark',
    amount: '6000',
    late_days: 3,
    base_tariff: '50000',
    shadow: true,
    waives_entry_id: null,
    note: null,
  });

  it('boshqa sahifadagi bekor qilish ham hisobga olinadi', async () => {
    const s = makeEntriesService(
      [entry('e-1'), entry('e-2')],
      [{ waives_entry_id: 'e-1' }],
    );
    const r = await s.entries({});
    expect(r.items.find((i) => i.id === 'e-1')?.waived).toBe(true);
    expect(r.items.find((i) => i.id === 'e-2')?.waived).toBe(false);
  });

  /** `bigint` satrlari raqamga aylantirilsin. */
  it('summalar raqam bo‘lib qaytadi', async () => {
    const s = makeEntriesService([entry('e-1')], []);
    const item = (await s.entries({})).items[0];
    expect(item.amount).toBe(6000);
    expect(item.base_tariff).toBe(50000);
  });
});
