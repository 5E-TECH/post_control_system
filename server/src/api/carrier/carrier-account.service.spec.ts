/// <reference types="jest" />
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { MoreThanOrEqual } from 'typeorm';
import config from 'src/config';
import { ActivityLogEntity } from 'src/core/entity/activity-log.entity';
import {
  CARRIER_EXTERNAL_PROVIDER,
  CarrierAccountService,
  carrierBindLoginLookbackMs,
  generateCarrierApiKey,
  hashApiKey,
  isActiveCarrierCourier,
  maskCarrierApiKey,
} from './carrier-account.service';
import { CarrierAccountEntity } from 'src/core/entity/carrier-account.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { PostEntity } from 'src/core/entity/post.entity';
import { CashEntity } from 'src/core/entity/cash-box.entity';
import { Cashbox_type, Roles, Status } from 'src/common/enums';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const COURIER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN: any = {
  id: '33333333-3333-4333-8333-333333333333',
  role: 'admin',
};

const courier = (over: Partial<UserEntity> = {}): any => ({
  id: COURIER_ID,
  name: 'BTS kuryeri',
  phone_number: '+998901112233',
  role: Roles.COURIER,
  status: Status.ACTIVE,
  is_deleted: false,
  external_provider: null,
  ...over,
});

const account = (over: Partial<CarrierAccountEntity> = {}): any => ({
  id: ACCOUNT_ID,
  name: 'BTS Express',
  courier_user_id: COURIER_ID,
  api_key_hash: 'a'.repeat(64),
  api_key_last4: 'beef',
  ip_allowlist: null,
  is_active: true,
  is_deleted: false,
  last_used_at: null,
  created_by: ADMIN.id,
  created_at: 1_700_000_000_000,
  updated_at: 1_700_000_000_000,
  courier: courier({ external_provider: CARRIER_EXTERNAL_PROVIDER }),
  ...over,
});

function queryBuilderMock(result: unknown) {
  const qb: any = {};
  for (const m of ['leftJoin', 'addSelect', 'where', 'andWhere']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getOne =
    result instanceof Error
      ? jest.fn().mockRejectedValue(result)
      : jest.fn().mockResolvedValue(result);
  return qb;
}

function createQueryRunnerMock() {
  const manager: any = {
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((_entity: unknown, data: any) => ({ ...data })),
    save: jest.fn(async (entity: any) => ({
      id: entity.id ?? ACCOUNT_ID,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...entity,
    })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };
  return { qr, manager };
}

function setup() {
  const accountRepo: any = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const { qr, manager } = createQueryRunnerMock();
  const dataSource: any = { createQueryRunner: jest.fn(() => qr) };
  const activityLog: any = { log: jest.fn().mockResolvedValue(undefined) };
  const bcrypt: any = {
    encrypt: jest.fn(async (p: string) => `$2b$10$hash-of-${p.length}`),
  };
  const service = new CarrierAccountService(
    accountRepo,
    dataSource,
    activityLog,
    bcrypt,
  );
  return { service, accountRepo, dataSource, qr, manager, activityLog, bcrypt };
}

/** create() uchun tranzaksiya ichidagi `findOne` ketma-ketligi. */
function mockCreateLookups(
  manager: any,
  opts: { user?: any; existing?: any; cashbox?: any; login?: any } = {},
) {
  manager.findOne.mockImplementation(async (entity: unknown) => {
    if (entity === UserEntity)
      return opts.user === undefined ? courier() : opts.user;
    if (entity === CarrierAccountEntity) return opts.existing ?? null;
    if (entity === CashEntity) return opts.cashbox ?? null;
    if (entity === ActivityLogEntity) return opts.login ?? null;
    return null;
  });
}

describe('Carrier kalit yordamchilari', () => {
  it('kalit: bpc_ + 64 hex (Elchi elc_ generatori bilan bir xil uzunlik), har safar yangi', () => {
    const a = generateCarrierApiKey();
    const b = generateCarrierApiKey();
    expect(a).toMatch(/^bpc_[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('xesh — sha256 hex; niqob faqat oxirgi 4 belgi', () => {
    expect(hashApiKey('bpc_x')).toBe(
      createHash('sha256').update('bpc_x').digest('hex'),
    );
    expect(maskCarrierApiKey('beef')).toBe('bpc_…beef');
  });

  it("kuryer faol: courier + active + o'chirilmagan + external_provider='carrier'", () => {
    const ok = courier({ external_provider: 'carrier' });
    expect(isActiveCarrierCourier(ok)).toBe(true);
    expect(isActiveCarrierCourier({ ...ok, status: Status.INACTIVE })).toBe(
      false,
    );
    expect(isActiveCarrierCourier({ ...ok, is_deleted: true })).toBe(false);
    expect(isActiveCarrierCourier({ ...ok, role: Roles.MARKET })).toBe(false);
    // Kimdir uni Elchi vakili qilib qo'ysa — egalik tekshiruvi o'chadi, kalit ham.
    expect(isActiveCarrierCourier({ ...ok, external_provider: 'elchi' })).toBe(
      false,
    );
    expect(isActiveCarrierCourier(null)).toBe(false);
  });
});

describe('CarrierAccountService.validateKey', () => {
  it("bo'sh kalit — bazaga bormaydi, null", async () => {
    const { service, accountRepo } = setup();
    await expect(service.validateKey('   ')).resolves.toBeNull();
    expect(accountRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('BITTA so‘rov: xesh bo‘yicha akkaunt + kuryer join, courierActive hisoblanadi', async () => {
    const { service, accountRepo } = setup();
    const row = account();
    const qb = queryBuilderMock(row);
    accountRepo.createQueryBuilder.mockReturnValue(qb);

    const res = await service.validateKey('  bpc_secret  ');

    expect(res).toEqual({ account: row, courierActive: true });
    expect(accountRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(qb.leftJoin).toHaveBeenCalledWith('account.courier', 'courier');
    expect(qb.where).toHaveBeenCalledWith('account.api_key_hash = :hash', {
      hash: hashApiKey('bpc_secret'),
    });
    expect(qb.andWhere).toHaveBeenCalledWith('account.is_deleted = false');
  });

  it("bloklangan / provayderi o'zgargan kuryer — courierActive=false", async () => {
    const { service, accountRepo } = setup();
    accountRepo.createQueryBuilder.mockReturnValue(
      queryBuilderMock(
        account({ courier: courier({ external_provider: 'ldg' }) }),
      ),
    );
    const res = await service.validateKey('bpc_x');
    expect(res?.courierActive).toBe(false);
  });

  it('topilmasa — null', async () => {
    const { service, accountRepo } = setup();
    accountRepo.createQueryBuilder.mockReturnValue(queryBuilderMock(null));
    await expect(service.validateKey('bpc_x')).resolves.toBeNull();
  });

  it('⭐ baza xatosi YUTILMAYDI (guard uni 503 qiladi, 401 emas)', async () => {
    const { service, accountRepo } = setup();
    accountRepo.createQueryBuilder.mockReturnValue(
      queryBuilderMock(new Error('connection terminated')),
    );
    await expect(service.validateKey('bpc_x')).rejects.toThrow(
      'connection terminated',
    );
  });
});

describe('CarrierAccountService.touchLastUsed', () => {
  afterEach(() => jest.restoreAllMocks());

  it('60 s ichida bir martadan ko‘p yozmaydi, keyin yana yozadi', () => {
    const { service, accountRepo } = setup();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    service.touchLastUsed(ACCOUNT_ID);
    service.touchLastUsed(ACCOUNT_ID);
    expect(accountRepo.update).toHaveBeenCalledTimes(1);
    expect(accountRepo.update).toHaveBeenCalledWith(
      { id: ACCOUNT_ID },
      { last_used_at: 1_000_000 },
    );

    now.mockReturnValue(1_000_000 + 60_000);
    service.touchLastUsed(ACCOUNT_ID);
    expect(accountRepo.update).toHaveBeenCalledTimes(2);
  });

  it('⭐ yozish xatosi so‘rovni to‘xtatmaydi (sinxron ham, asinxron ham)', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service, accountRepo } = setup();
    accountRepo.update.mockRejectedValueOnce(new Error('db down'));
    expect(() => service.touchLastUsed('a')).not.toThrow();
    accountRepo.update.mockImplementationOnce(() => {
      throw new Error('sync boom');
    });
    expect(() => service.touchLastUsed('b')).not.toThrow();
    // Rad etilgan promise ushlanganini kutamiz (unhandled rejection yo'q).
    await new Promise((r) => setImmediate(r));
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('CarrierAccountService.create', () => {
  it('⭐ toza kuryer: bitta tranzaksiya, kuryer qulflanadi, kassa ochiladi, provayder va tasodifiy parol', async () => {
    const { service, manager, qr, bcrypt } = setup();
    mockCreateLookups(manager);

    const res = await service.create(
      {
        name: '  BTS Express ',
        courier_id: COURIER_ID,
        ip_allowlist: ['203.0.113.10'],
      },
      ADMIN,
    );

    // Kuryer qatori qulf bilan o'qiladi (parallel create navbatga turadi).
    expect(manager.findOne).toHaveBeenCalledWith(UserEntity, {
      where: { id: COURIER_ID },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.count).toHaveBeenCalledWith(PostEntity, {
      where: { courier_id: COURIER_ID },
    });
    // Kassa yo'q edi — yaratiladi (sotuv oqimi uchun majburiy).
    expect(manager.create).toHaveBeenCalledWith(CashEntity, {
      cashbox_type: Cashbox_type.FOR_COURIER,
      user_id: COURIER_ID,
    });
    // Kuryer: provayder + hech kim bilmaydigan parol.
    expect(bcrypt.encrypt).toHaveBeenCalledTimes(1);
    const userUpdate = manager.update.mock.calls.find(
      (c: any[]) => c[0] === UserEntity,
    );
    expect(userUpdate[1]).toEqual({ id: COURIER_ID });
    expect(userUpdate[2]).toEqual(
      expect.objectContaining({
        external_provider: CARRIER_EXTERNAL_PROVIDER,
        password: await bcrypt.encrypt.mock.results[0].value,
      }),
    );
    // Akkaunt: faqat xesh va oxirgi 4 belgi saqlanadi.
    expect(res.api_key).toMatch(/^bpc_[0-9a-f]{64}$/);
    const accountCreate = manager.create.mock.calls.find(
      (c: any[]) => c[0] === CarrierAccountEntity,
    );
    expect(accountCreate[1]).toEqual(
      expect.objectContaining({
        name: 'BTS Express',
        courier_user_id: COURIER_ID,
        api_key_hash: hashApiKey(res.api_key),
        api_key_last4: res.api_key.slice(-4),
        ip_allowlist: ['203.0.113.10'],
        is_active: true,
        created_by: ADMIN.id,
      }),
    );
    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(qr.release).toHaveBeenCalled();

    // Javobda xesh yo'q, niqoblangan kalit bor.
    expect(res.account).not.toHaveProperty('api_key_hash');
    expect(res.account.api_key_masked).toBe(`bpc_…${res.api_key.slice(-4)}`);
    expect(res.account.courier).toEqual({
      id: COURIER_ID,
      name: 'BTS kuryeri',
      phone_number: '+998901112233',
      status: Status.ACTIVE,
    });
  });

  it('⭐ kalit ham, xeshi ham activity-log ga TUSHMAYDI', async () => {
    const { service, manager, activityLog } = setup();
    mockCreateLookups(manager);
    const res = await service.create(
      { name: 'BTS', courier_id: COURIER_ID },
      ADMIN,
    );
    const logged = JSON.stringify(activityLog.log.mock.calls);
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'CarrierAccount',
        action: 'created',
        user: ADMIN,
      }),
    );
    expect(logged).not.toContain(res.api_key);
    expect(logged).not.toContain(hashApiKey(res.api_key));
    expect(logged).not.toContain('$2b$');
  });

  it('mavjud nol kassa qayta yaratilmaydi', async () => {
    const { service, manager } = setup();
    mockCreateLookups(manager, {
      cashbox: { id: 'cb', balance: 0, balance_cash: 0, balance_card: 0 },
    });
    await service.create({ name: 'BTS', courier_id: COURIER_ID }, ADMIN);
    expect(
      manager.create.mock.calls.filter((c: any[]) => c[0] === CashEntity),
    ).toHaveLength(0);
  });

  it('kuryer topilmasa — 404 va rollback', async () => {
    const { service, manager, qr } = setup();
    mockCreateLookups(manager, { user: null });
    await expect(
      service.create({ name: 'BTS', courier_id: COURIER_ID }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });

  it('kuryerda tirik akkaunt bor — 409', async () => {
    const { service, manager } = setup();
    mockCreateLookups(manager, {
      user: courier({ external_provider: CARRIER_EXTERNAL_PROVIDER }),
      existing: { id: ACCOUNT_ID, name: 'Eski' },
    });
    await expect(
      service.create({ name: 'BTS', courier_id: COURIER_ID }, ADMIN),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    ['Elchi vakili', { external_provider: 'elchi' }],
    ['LDG vakili', { external_provider: 'ldg' }],
    ['market roli', { role: Roles.MARKET }],
    ['bloklangan', { status: Status.INACTIVE }],
    ["o'chirilgan", { is_deleted: true }],
  ])(
    '⭐ bog‘lab bo‘lmaydigan kuryer (%s) — 400, hech narsa yozilmaydi',
    async (_t, over) => {
      const { service, manager, qr } = setup();
      mockCreateLookups(manager, { user: courier(over as any) });
      await expect(
        service.create({ name: 'BTS', courier_id: COURIER_ID }, ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    },
  );

  it("⭐ pochtasi bor kuryer — 400 (eski buyurtmalar kompaniyaga ko'rinib qolmasin)", async () => {
    const { service, manager } = setup();
    mockCreateLookups(manager);
    manager.count.mockResolvedValue(3);
    await expect(
      service.create({ name: 'BTS', courier_id: COURIER_ID }, ADMIN),
    ).rejects.toThrow(/3 ta pochta/);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('⭐ kassasi 0 emas — 400', async () => {
    const { service, manager } = setup();
    mockCreateLookups(manager, {
      cashbox: { id: 'cb', balance: -15000, balance_cash: 0, balance_card: 0 },
    });
    await expect(
      service.create({ name: 'BTS', courier_id: COURIER_ID }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  describe('tirik JWT sessiya (bog‘lashdan oldin kirilgan kuryer)', () => {
    const saved = {
      access: config.ACCESS_TOKEN_TIME,
      refresh: config.REFRESH_TOKEN_TIME,
    };
    afterEach(() => {
      config.ACCESS_TOKEN_TIME = saved.access;
      config.REFRESH_TOKEN_TIME = saved.refresh;
    });

    it('⭐ oynada login bor — 400, kuryer bog‘lanmaydi (parol/provayder yozilmaydi), rollback', async () => {
      config.ACCESS_TOKEN_TIME = '1d';
      config.REFRESH_TOKEN_TIME = '7d';
      const { service, manager, qr } = setup();
      mockCreateLookups(manager, {
        login: { id: 'log-1', created_at: Date.now() - 3_600_000 },
      });
      const before = Date.now();
      await expect(
        service.create({ name: 'BTS', courier_id: COURIER_ID }, ADMIN),
      ).rejects.toThrow(/yaqinda tizimga kirilgan/);
      expect(manager.update).not.toHaveBeenCalled();
      expect(qr.rollbackTransaction).toHaveBeenCalled();

      // Oyna = access + refresh muddati: refresh cookie bog'lash paytida tirik
      // bo'lsa, undan olingan access token yana bir kun yashaydi.
      const call = manager.findOne.mock.calls.find(
        (c: any[]) => c[0] === ActivityLogEntity,
      );
      expect(call[1].where).toMatchObject({
        entity_type: 'user',
        entity_id: COURIER_ID,
        action: 'login',
      });
      const bound = call[1].where.created_at;
      expect(bound).toEqual(MoreThanOrEqual(expect.any(Number)));
      const eightDays = 8 * 86_400_000;
      expect(bound.value).toBeGreaterThanOrEqual(before - eightDays - 5);
      expect(bound.value).toBeLessThanOrEqual(Date.now() - eightDays);
    });

    it('token muddatlari o‘qilmasa — oyna cheksiz (har qanday login rad etadi)', () => {
      config.ACCESS_TOKEN_TIME = 'undefined';
      expect(carrierBindLoginLookbackMs()).toBeNull();
      config.ACCESS_TOKEN_TIME = '15m';
      config.REFRESH_TOKEN_TIME = '30d';
      expect(carrierBindLoginLookbackMs()).toBe(15 * 60_000 + 30 * 86_400_000);
    });

    it('oynada login yo‘q — bog‘lanadi', async () => {
      config.ACCESS_TOKEN_TIME = 'yaroqsiz';
      const { service, manager } = setup();
      mockCreateLookups(manager);
      await service.create({ name: 'BTS', courier_id: COURIER_ID }, ADMIN);
      const call = manager.findOne.mock.calls.find(
        (c: any[]) => c[0] === ActivityLogEntity,
      );
      expect(call[1].where).not.toHaveProperty('created_at');
      expect(manager.update).toHaveBeenCalledWith(
        UserEntity,
        { id: COURIER_ID },
        expect.objectContaining({
          external_provider: CARRIER_EXTERNAL_PROVIDER,
        }),
      );
    });
  });

  it('noto‘g‘ri IP yozuvi — 400, tranzaksiya umuman ochilmaydi', async () => {
    const { service, dataSource } = setup();
    await expect(
      service.create(
        {
          name: 'BTS',
          courier_id: COURIER_ID,
          ip_allowlist: ['2001:db8::/32'],
        },
        ADMIN,
      ),
    ).rejects.toThrow(/tushunilmagan yozuv: 2001:db8::\/32/);
    await expect(
      service.create(
        {
          name: 'BTS',
          courier_id: COURIER_ID,
          ip_allowlist: Array.from({ length: 51 }, (_, i) => `10.0.0.${i}`),
        },
        ADMIN,
      ),
    ).rejects.toThrow(/50 tadan/);
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it("bo'sh nom / UUID bo'lmagan courier_id — 400", async () => {
    const { service } = setup();
    await expect(
      service.create({ name: '  ', courier_id: COURIER_ID }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ name: 'BTS', courier_id: '55' }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('parallel yaratish (unique 23505) — 409', async () => {
    const { service, manager, qr } = setup();
    mockCreateLookups(manager);
    manager.save.mockImplementation(async (entity: any) => {
      if ('api_key_hash' in entity) {
        throw Object.assign(new Error('duplicate key'), {
          driverError: { code: '23505' },
        });
      }
      return entity;
    });
    await expect(
      service.create({ name: 'BTS', courier_id: COURIER_ID }, ADMIN),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });
});

describe('CarrierAccountService — ro‘yxat va o‘zgartirish', () => {
  it('list: niqoblangan kalit, kuryerning 4 maydoni, xesh yo‘q', async () => {
    const { service, accountRepo } = setup();
    accountRepo.find.mockResolvedValue([
      account({ courier: { ...courier(), password: 'x', tariff_home: 5 } }),
    ]);
    const [view] = await service.list();
    expect(accountRepo.find).toHaveBeenCalledWith({
      where: { is_deleted: false },
      relations: { courier: true },
      order: { created_at: 'DESC' },
    });
    expect(view.api_key_masked).toBe('bpc_…beef');
    expect(view).not.toHaveProperty('api_key_hash');
    expect(view).not.toHaveProperty('api_key_last4');
    expect(Object.keys(view.courier ?? {}).sort()).toEqual(
      ['id', 'name', 'phone_number', 'status'].sort(),
    );
  });

  it("update: maydonsiz — 400; noma'lum id — 404", async () => {
    const { service, accountRepo } = setup();
    await expect(service.update(ACCOUNT_ID, {}, ADMIN)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    accountRepo.findOne.mockResolvedValue(null);
    await expect(
      service.update(ACCOUNT_ID, { name: 'Yangi' }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.update('not-a-uuid', { name: 'Yangi' }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('⭐ update: faqat O‘ZGARGAN ustunlar yoziladi, IP kanonik shaklda', async () => {
    const { service, accountRepo, activityLog } = setup();
    accountRepo.findOne.mockResolvedValue(account());
    await service.update(
      ACCOUNT_ID,
      { name: 'BTS Express', ip_allowlist: ['2001:0DB8::1', '203.0.113.0/24'] },
      ADMIN,
    );
    expect(accountRepo.update).toHaveBeenCalledTimes(1);
    const [criteria, changes] = accountRepo.update.mock.calls[0];
    expect(criteria).toEqual({ id: ACCOUNT_ID, is_deleted: false });
    // Nom o'zgarmagan — yozilmaydi.
    expect(changes).not.toHaveProperty('name');
    expect(changes.ip_allowlist).toEqual(['2001:db8::1', '203.0.113.0/24']);
    expect(changes).not.toHaveProperty('is_active');
    expect(changes).not.toHaveProperty('api_key_hash');
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'updated' }),
    );
  });

  it("update: bo'sh IP ro'yxati cheklovni olib tashlaydi (null)", async () => {
    const { service, accountRepo } = setup();
    accountRepo.findOne.mockResolvedValue(
      account({ ip_allowlist: ['203.0.113.10'] }),
    );
    await service.update(ACCOUNT_ID, { ip_allowlist: [] }, ADMIN);
    expect(accountRepo.update.mock.calls[0][1].ip_allowlist).toBeNull();
  });

  it("update: hech narsa o'zgarmasa — yozuvsiz qaytadi", async () => {
    const { service, accountRepo } = setup();
    accountRepo.findOne.mockResolvedValue(account());
    await service.update(ACCOUNT_ID, { name: 'BTS Express' }, ADMIN);
    expect(accountRepo.update).not.toHaveBeenCalled();
  });
});

describe('CarrierAccountService — kalit va holat', () => {
  it('⭐ rotateKey: yangi xesh yoziladi (eski darhol o‘ladi), kalit bir marta qaytadi', async () => {
    const { service, accountRepo, activityLog } = setup();
    accountRepo.findOne.mockResolvedValue(account());
    const res = await service.rotateKey(ACCOUNT_ID, ADMIN);
    expect(res.api_key).toMatch(/^bpc_[0-9a-f]{64}$/);
    expect(accountRepo.update).toHaveBeenCalledWith(
      { id: ACCOUNT_ID, is_deleted: false },
      expect.objectContaining({
        api_key_hash: hashApiKey(res.api_key),
        api_key_last4: res.api_key.slice(-4),
      }),
    );
    expect(JSON.stringify(activityLog.log.mock.calls)).not.toContain(
      res.api_key,
    );
  });

  it('rotateKey: kuryer bloklangan / provayderi o‘zgargan — 400, kalit chiqarilmaydi', async () => {
    const { service, accountRepo } = setup();
    accountRepo.findOne.mockResolvedValue(
      account({
        courier: courier({
          external_provider: CARRIER_EXTERNAL_PROVIDER,
          status: Status.INACTIVE,
        }),
      }),
    );
    await expect(service.rotateKey(ACCOUNT_ID, ADMIN)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    accountRepo.findOne.mockResolvedValue(
      account({ courier: courier({ external_provider: 'elchi' }) }),
    );
    await expect(service.rotateKey(ACCOUNT_ID, ADMIN)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(accountRepo.update).not.toHaveBeenCalled();
  });

  it('setActive: yoqishda kuryer faol bo‘lishi shart; o‘chirish har doim mumkin', async () => {
    const { service, accountRepo } = setup();
    const blocked = courier({
      external_provider: CARRIER_EXTERNAL_PROVIDER,
      status: Status.INACTIVE,
    });
    accountRepo.findOne.mockResolvedValue(
      account({ is_active: false, courier: blocked }),
    );
    await expect(
      service.setActive(ACCOUNT_ID, true, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);

    accountRepo.findOne.mockResolvedValue(
      account({ is_active: true, courier: blocked }),
    );
    await service.setActive(ACCOUNT_ID, false, ADMIN);
    expect(accountRepo.update).toHaveBeenCalledWith(
      { id: ACCOUNT_ID, is_deleted: false },
      expect.objectContaining({ is_active: false }),
    );
  });

  it('⭐ remove: yumshoq o‘chirish + kuryer faqat hali carrier bo‘lsa bo‘shatiladi, bitta tranzaksiyada', async () => {
    const { service, manager, qr, activityLog } = setup();
    manager.findOne.mockResolvedValue(account());
    const res = await service.remove(ACCOUNT_ID, ADMIN);

    expect(manager.findOne).toHaveBeenCalledWith(CarrierAccountEntity, {
      where: { id: ACCOUNT_ID, is_deleted: false },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      CarrierAccountEntity,
      { id: ACCOUNT_ID },
      expect.objectContaining({ is_deleted: true, is_active: false }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      UserEntity,
      { id: COURIER_ID, external_provider: CARRIER_EXTERNAL_PROVIDER },
      expect.objectContaining({ external_provider: null }),
    );
    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(res).toEqual({
      id: ACCOUNT_ID,
      deleted: true,
      courier_released: true,
    });
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'user',
        action: 'carrier_unbound',
      }),
    );
  });

  it("remove: noma'lum / o'chirilgan akkaunt — 404, rollback", async () => {
    const { service, manager, qr } = setup();
    manager.findOne.mockResolvedValue(null);
    await expect(service.remove(ACCOUNT_ID, ADMIN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });
});
