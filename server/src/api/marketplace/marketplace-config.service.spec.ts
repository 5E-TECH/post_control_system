import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MarketplaceConfigService } from './marketplace-config.service';
import { JwtPayload } from 'src/common/utils/types/user.type';

const USER = { id: 'admin-1', role: 'superadmin' } as JwtPayload;

/**
 * ⚠️ Shifrlash kaliti tayyorlik checklistiga KIRADI: kalit yo'q bo'lsa
 * sekretlar bazada OCHIQ MATN saqlanadi va ulanishni yoqib bo'lmaydi.
 * Testlarda prod holatini taqlid qilamiz.
 */
process.env.MARKETPLACE_SECRET_KEY =
  process.env.MARKETPLACE_SECRET_KEY || 'unit-test-key-0123456789abcdef';

const READY = {
  id: 'int-1',
  name: 'UzMarket',
  slug: 'uzmarket',
  market_id: 'market-1',
  api_base_url: 'https://api.uzmarket.uz',
  api_key: 'KEY-abcd1234',
  signing_secret: 'SEC-wxyz9999',
  signing_secret_previous: null,
  inbound_api_key: 'IN-qqqq7777',
  ip_allowlist: null,
  is_active: false,
  is_sandbox: false,
  request_timeout_ms: 10000,
  settlement_period_days: 7,
  last_ping_at: null,
  last_reconcile_at: null,
  last_settlement_at: null,
  created_at: 1,
};

const TARIFF_V1 = {
  id: 't-1',
  integration_id: 'int-1',
  version: 1,
  tariff_center: 50000,
  tariff_home: 70000,
  effective_from: 1,
  effective_to: null,
};

function build(
  opts: {
    integration?: any;
    tariff?: any;
    bySlug?: any;
    market?: any;
    cashbox?: any;
    boundTo?: any;
    ping?: any;
    synced?: number;
  } = {},
) {
  const saved: any[] = [];
  const findArgs: any[] = [];
  const manager = {
    findOne: jest.fn(async (entity: any, _q: any) => {
      const n = entity?.name ?? '';
      if (n === 'UserEntity')
        return opts.market === undefined ? { id: 'market-1', name: 'UzMarket' } : opts.market;
      if (n === 'MarketplaceIntegrationEntity') return opts.boundTo ?? null;
      if (n === 'CashEntity')
        return opts.cashbox === undefined ? { id: 'cb-1', balance: 0 } : opts.cashbox;
      if (n === 'MarketplaceTariffEntity')
        return opts.tariff === undefined ? null : opts.tariff;
      return null;
    }),
    create: jest.fn((_e: any, v: any) => ({ ...v })),
    save: jest.fn(async (a: any, b?: any) => {
      const v = b ?? a;
      const row = { id: v.id ?? `row-${saved.length + 1}`, ...v };
      saved.push(row);
      return row;
    }),
  };
  const qr = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    manager,
  };

  const integrationRepo = {
    find: jest.fn(async (q?: any) => {
      findArgs.push(q);
      return [opts.integration ?? { ...READY }];
    }),
    // ⚠️ Har chaqiruvda NUSXA. `READY` modul darajasidagi obyekt —
    // `setActive` uni joyida o'zgartirsa, keyingi testlar buzilgan
    // holatni meros qilib olardi (aynan shunday bo'lgan ham).
    findOne: jest.fn(async () =>
      opts.bySlug === undefined
        ? (opts.integration === undefined ? { ...READY } : opts.integration)
        : opts.bySlug,
    ),
    save: jest.fn(async (r: any) => {
      saved.push(r);
      return r;
    }),
  };
  const tariffRepo = {
    findOne: jest.fn(async () => (opts.tariff === undefined ? TARIFF_V1 : opts.tariff)),
    find: jest.fn(async () => [TARIFF_V1]),
  };
  const api = {
    ping: jest.fn(async () => opts.ping ?? { ok: true, version: '1.2', latency_ms: 42 }),
  };
  const activityLog = { log: jest.fn() };
  const ledger = {
    verifyInvariant: jest.fn(async () => ({
      ok: true, ledger_sum: 0, cashbox_balance: 0, diff: 0,
    })),
  };

  const reconcile = {
    syncSellers: jest.fn(async () => ({ synced: opts.synced ?? 3, pages: 1 })),
  };

  const svc = new MarketplaceConfigService(
    integrationRepo as any,
    tariffRepo as any,
    {
      createQueryRunner: () => qr,
      /**
       * ⚠️ Sozlash javobi BIRIKTIRILGAN MARKET nomini ham qaytaradi —
       * avval faqat `market_id` (UUID) bor edi va ekran uni chizmasdi,
       * natijada admin «marketga biriktirilmagan» deb o'ylardi.
       */
      getRepository: (entity: any) => ({
        findOne: jest.fn(async () =>
          (entity?.name ?? '') === 'CashEntity'
            ? { id: 'cb-1', balance: 1_250_000 }
            : { id: 'market-1', name: 'UzMarket', phone_number: '+998900000003' },
        ),
        // Operator ro'yxati market nomlarini BITTA so'rov bilan oladi.
        find: jest.fn(async () => [{ id: 'market-1', name: 'UzMarket' }]),
      }),
    } as any,
    api as any,
    ledger as any,
    // ⚠️ Sozlash amallari (kalit aylantirish, kill-switch, `api_key`)
    // audit jurnaliga yoziladi — «kim o'chirib qo'ydi?» savoliga javob.
    activityLog as any,
    reconcile as any,
  );
  return { svc, integrationRepo, tariffRepo, manager, saved, api, ledger, qr, findArgs, activityLog, reconcile };
}

const NEW_INPUT = {
  name: 'UzMarket',
  slug: 'uzmarket',
  market_id: 'market-1',
  api_base_url: 'https://api.uzmarket.uz',
  tariff_center: 50000,
  tariff_home: 70000,
};

describe('MarketplaceConfigService — yaratish', () => {
  it('band slugni rad etadi (route to\'qnashuvi)', async () => {
    const { svc } = build({ bySlug: null });
    await expect(
      svc.create({ ...NEW_INPUT, slug: 'scan-session' }, USER),
    ).rejects.toThrow(BadRequestException);
  });

  it('`config` ham band — admin yo\'llari bilan to\'qnashadi', async () => {
    const { svc } = build({ bySlug: null });
    await expect(svc.create({ ...NEW_INPUT, slug: 'config' }, USER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('noto\'g\'ri formatdagi slugni rad etadi', async () => {
    const { svc } = build({ bySlug: null });
    for (const slug of ['uz market', 'uz_market', 'a', '-uz', 'uz.market']) {
      await expect(svc.create({ ...NEW_INPUT, slug }, USER)).rejects.toThrow(
        BadRequestException,
      );
    }
  });

  it('katta harfli slugni RAD ETMAYDI — kichik harfga keltiradi', async () => {
    const { svc, saved } = build({ bySlug: null, tariff: null });
    const view: any = await svc.create({ ...NEW_INPUT, slug: '  UzMarket ' }, USER);
    expect(view.slug).toBe('uzmarket');
    expect(saved.some((r) => r.slug === 'uzmarket')).toBe(true);
  });

  it('takroriy slugni rad etadi', async () => {
    const { svc } = build({ bySlug: READY });
    await expect(svc.create(NEW_INPUT, USER)).rejects.toThrow(ConflictException);
  });

  it('tarif 0 yoki manfiy bo\'lsa rad etadi', async () => {
    const { svc } = build({ bySlug: null });
    await expect(
      svc.create({ ...NEW_INPUT, tariff_center: 0 }, USER),
    ).rejects.toThrow(BadRequestException);
    await expect(
      svc.create({ ...NEW_INPUT, tariff_home: -5 }, USER),
    ).rejects.toThrow(BadRequestException);
  });

  it('ichki manzilni rad etadi (SSRF)', async () => {
    const { svc } = build({ bySlug: null });
    await expect(
      svc.create({ ...NEW_INPUT, api_base_url: 'http://192.168.1.10' }, USER),
    ).rejects.toThrow(BadRequestException);
  });

  it('market topilmasa rad etadi', async () => {
    const { svc } = build({ bySlug: null, market: null });
    await expect(svc.create(NEW_INPUT, USER)).rejects.toThrow(NotFoundException);
  });

  it('market allaqachon boshqa ulanishga biriktirilgan bo\'lsa rad etadi', async () => {
    const { svc } = build({ bySlug: null, boundTo: { name: 'Boshqa' } });
    await expect(svc.create(NEW_INPUT, USER)).rejects.toThrow(ConflictException);
  });

  it('marketda kassa bo\'lmasa rad etadi', async () => {
    const { svc } = build({ bySlug: null, cashbox: null });
    await expect(svc.create(NEW_INPUT, USER)).rejects.toThrow(BadRequestException);
  });

  it('O\'CHIQ holda yaratadi va v1 tarif ochadi', async () => {
    const { svc, saved, qr } = build({ bySlug: null, tariff: null });
    await svc.create(NEW_INPUT, USER);

    const integration = saved.find((r) => r.slug === 'uzmarket');
    expect(integration.is_active).toBe(false); // sekretsiz yoqilmaydi
    const tariff = saved.find((r) => r.version === 1);
    expect(tariff.tariff_center).toBe(50000);
    expect(tariff.effective_to).toBeUndefined();
    expect(qr.commitTransaction).toHaveBeenCalled();
  });

  it('xatoda tranzaksiya qaytariladi', async () => {
    const { svc, qr } = build({ bySlug: null, market: null });
    await expect(svc.create(NEW_INPUT, USER)).rejects.toThrow();
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.commitTransaction).not.toHaveBeenCalled();
    expect(qr.release).toHaveBeenCalled();
  });
});

describe('MarketplaceConfigService — sekretlar javobda chiqmaydi', () => {
  it('faqat maska qaytaradi, xom qiymat emas', async () => {
    const { svc } = build();
    const view: any = await svc.getBySlug('uzmarket');
    const json = JSON.stringify(view);

    expect(json).not.toContain('KEY-abcd1234');
    expect(json).not.toContain('SEC-wxyz9999');
    expect(json).not.toContain('IN-qqqq7777');
    expect(view.secrets.api_key).toEqual({ set: true, hint: '••••1234' });
    expect(view.secrets.signing_secret_previous).toEqual({ set: false, hint: null });
  });

  it('ro\'yxatda ham sekret oqmaydi', async () => {
    const { svc } = build();
    const json = JSON.stringify(await svc.list());
    expect(json).not.toContain('KEY-abcd1234');
  });
});

describe('MarketplaceConfigService — tayyorlik va master kalit', () => {
  it('hamma narsa joyida bo\'lsa ready=true', async () => {
    const { svc } = build();
    const view: any = await svc.getBySlug('uzmarket');
    expect(view.ready).toBe(true);
  });

  it('tarif yo\'q bo\'lsa ready=false', async () => {
    const { svc } = build({ tariff: null });
    const view: any = await svc.getBySlug('uzmarket');
    expect(view.ready).toBe(false);
    expect(view.checklist.tariff).toBe(false);
  });

  it('sozlash tugallanmagan bo\'lsa YOQIB BO\'LMAYDI', async () => {
    const { svc } = build({ integration: { ...READY, api_key: null } });
    await expect(svc.setActive('uzmarket', true)).rejects.toThrow(
      /Sozlash tugallanmagan/,
    );
  });

  it('yetishmayotgan bandlarni xabarda sanab beradi', async () => {
    const { svc } = build({
      integration: { ...READY, api_key: null, inbound_api_key: null },
    });
    await expect(svc.setActive('uzmarket', true)).rejects.toThrow(
      /api_key.*inbound_api_key/,
    );
  });

  it('tayyor bo\'lsa yoqadi', async () => {
    const { svc, integrationRepo } = build();
    const view: any = await svc.setActive('uzmarket', true);
    expect(view.is_active).toBe(true);
    expect(integrationRepo.save).toHaveBeenCalled();
  });

  it('o\'chirish checklistdan qat\'i nazar ishlaydi (kill-switch)', async () => {
    const { svc } = build({ integration: { ...READY, api_key: null, is_active: true } });
    const view: any = await svc.setActive('uzmarket', false);
    expect(view.is_active).toBe(false);
  });

  it('topilmagan slug uchun 404', async () => {
    const { svc } = build({ bySlug: null });
    await expect(svc.getBySlug('yoq')).rejects.toThrow(NotFoundException);
  });
});

describe('MarketplaceConfigService — tahrirlash', () => {
  it('slug/market_id/is_active ni O\'ZGARTIRMAYDI', async () => {
    const { svc } = build({ integration: { ...READY } });
    const view: any = await svc.update('uzmarket', {
      name: 'Yangi nom',
      // DTO'da yo'q maydonlar — qasddan uzatilmoqda
      slug: 'boshqa',
      market_id: 'market-999',
      is_active: true,
    } as any);

    expect(view.name).toBe('Yangi nom');
    expect(view.slug).toBe('uzmarket');
    expect(view.market_id).toBe('market-1');
    expect(view.is_active).toBe(false);
  });

  it("YOQIQ ulanishda API manzilini BO'SHATIB bo'lmaydi", async () => {
    // ⚠️ Bo'sh satr validatsiyadan o'tib ketardi va manzil o'chib,
    // ulanish YOQIQ qolardi — birinchi skanda tushunarsiz xato.
    const { svc } = build({ integration: { ...READY, is_active: true } });
    await expect(
      svc.update('uzmarket', { api_base_url: '' }),
    ).rejects.toThrow(/bo'shatib bo'lmaydi/i);
  });

  it('tahrirlashda ham SSRF tekshiriladi', async () => {
    const { svc } = build();
    await expect(
      svc.update('uzmarket', { api_base_url: 'http://127.0.0.1:9000' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('MarketplaceConfigService — tarif versiyalari', () => {
  it('eskisini YOPADI va v2 ochadi', async () => {
    const current = { ...TARIFF_V1 };
    const { svc, saved } = build({ tariff: current });
    const res = await svc.setTariff(
      'uzmarket',
      { tariff_center: 55000, tariff_home: 75000, note: 'kelishuv' },
      USER,
    );

    expect(res.version).toBe(2);
    // eskisi o'chirilmaydi — yopiladi
    const closed = saved.find((r) => r.version === 1);
    expect(closed.effective_to).toEqual(expect.any(Number));
    const next = saved.find((r) => r.version === 2);
    expect(next.tariff_center).toBe(55000);
    expect(next.effective_to).toBeUndefined();
  });

  it('bir xil tarifni rad etadi (bo\'sh versiya yaratmaydi)', async () => {
    const { svc } = build({ tariff: { ...TARIFF_V1 } });
    await expect(
      svc.setTariff('uzmarket', { tariff_center: 50000, tariff_home: 70000 }, USER),
    ).rejects.toThrow(/o'zgarmadi/);
  });

  it('joriy tarif yo\'q bo\'lsa v1 dan boshlaydi', async () => {
    const { svc, saved } = build({ tariff: null });
    const res = await svc.setTariff(
      'uzmarket',
      { tariff_center: 40000, tariff_home: 60000 },
      USER,
    );
    expect(res.version).toBe(1);
    expect(saved.some((r) => r.effective_to !== undefined && r.version === 0)).toBe(false);
  });

  it('manfiy tarifni rad etadi', async () => {
    const { svc } = build();
    await expect(
      svc.setTariff('uzmarket', { tariff_center: -1, tariff_home: 70000 }, USER),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('MarketplaceConfigService — kalit aylantirish', () => {
  it('joriyni `previous` ga ko\'chiradi va yangisini BIR MARTA qaytaradi', async () => {
    const row = { ...READY };
    const { svc } = build({ integration: row });
    const res = await svc.rotateSigningSecret('uzmarket');

    expect(row.signing_secret_previous).toBe('SEC-wxyz9999');
    expect(row.signing_secret).toBe(res.signing_secret);
    expect(res.signing_secret).toHaveLength(64);
    expect(res.signing_secret).not.toBe('SEC-wxyz9999');
    expect(res.warning).toMatch(/BOSHQA KO'RSATILMAYDI/);
  });

  it('har chaqiruvda boshqa sekret', async () => {
    const { svc } = build({ integration: { ...READY } });
    const a = await svc.rotateSigningSecret('uzmarket');
    const b = await svc.rotateSigningSecret('uzmarket');
    expect(a.signing_secret).not.toBe(b.signing_secret);
  });

  it('eski sekretni tozalaydi', async () => {
    const row = { ...READY, signing_secret_previous: 'ESKI' };
    const { svc } = build({ integration: row });
    await svc.clearPreviousSecret('uzmarket');
    expect(row.signing_secret_previous).toBeNull();
  });

  it('kiruvchi kalitni aylantiradi', async () => {
    const row = { ...READY };
    const { svc } = build({ integration: row });
    const res = await svc.rotateInboundKey('uzmarket');
    expect(row.inbound_api_key).toBe(res.inbound_api_key);
    expect(res.inbound_api_key).toHaveLength(48);
  });
});

describe('MarketplaceConfigService — ulanishni sinash', () => {
  it('muvaffaqiyatda last_ping_at yoziladi', async () => {
    const row = { ...READY };
    const { svc } = build({ integration: row });
    const res: any = await svc.testConnection('uzmarket');
    expect(res.ok).toBe(true);
    expect(res.latency_ms).toBe(42);
    expect(row.last_ping_at).toEqual(expect.any(Number));
  });

  it('ular `ok:false` desa BIZ ham false qaytaramiz', async () => {
    const { svc } = build({ ping: { ok: false, latency_ms: 9 } });
    const res: any = await svc.testConnection('uzmarket');
    expect(res.ok).toBe(false);
  });

  it('xato PARTLAMAYDI — sabab qaytariladi', async () => {
    const { svc, api } = build();
    const err: any = new Error('ulanmadi');
    err.marketplaceError = { kind: 'network', message: 'Manzil javob bermadi' };
    api.ping.mockRejectedValueOnce(err);

    const res: any = await svc.testConnection('uzmarket');
    expect(res).toMatchObject({ ok: false, kind: 'network' });
  });

  it('manzil kiritilmagan bo\'lsa so\'rov YUBORMAYDI', async () => {
    const { svc, api } = build({ integration: { ...READY, api_base_url: null } });
    const res: any = await svc.testConnection('uzmarket');
    expect(res).toMatchObject({ ok: false, kind: 'config' });
    expect(api.ping).not.toHaveBeenCalled();
  });

  it('health daftar invariantini ham qaytaradi', async () => {
    const { svc, ledger } = build();
    const res: any = await svc.health('uzmarket');
    expect(res.invariant.ok).toBe(true);
    expect(ledger.verifyInvariant).toHaveBeenCalledWith('int-1');
  });
});

describe("MarketplaceConfigService — operator ro'yxati", () => {
  it('faqat uch maydon qaytaradi — sekret ham, sozlama ham yo\'q', async () => {
    const { svc } = build();
    const rows = await svc.listForOperator();

    /**
     * ⚠️ `market_name` ATAYLAB bor: skan ekrani sarlavhasida qaysi market
     * kassasiga ishlayotgani yozilishi kerak. `market_id` (UUID) esa
     * CHIQMAYDI — operatorga foydasiz.
     */
    expect(rows).toEqual([
      { id: 'int-1', name: 'UzMarket', slug: 'uzmarket', market_name: 'UzMarket' },
    ]);
    // Butun javobda sekretning izi ham bo'lmasligi kerak.
    const json = JSON.stringify(rows);
    expect(json).not.toContain('KEY-abcd1234');
    expect(json).not.toContain('api_base_url');
    expect(json).not.toContain('market_id');
  });

  it("faqat YOQILGAN ulanishlarni so'raydi", async () => {
    const { svc, findArgs } = build();
    await svc.listForOperator();
    expect(findArgs[0]?.where).toEqual({ is_active: true });
  });
});

describe('MarketplaceConfigService — sekret shifrlash', () => {
  it('kalit YO\'Q bo\'lsa ulanishni YOQIB BO\'LMAYDI', async () => {
    /**
     * ⚠️ Kalitsiz transformer sekretlarni OCHIQ MATN saqlaydi (ataylab:
     * kalitsiz server ko'tarilmasligi butun tizimni yiqitardi). Lekin
     * ulanishni yoqishga ruxsat bersak, admin «hammasi tayyor» deb
     * ishonch bilan ishlaydi va hamkor kaliti himoyasiz yotaveradi.
     */
    const saved = process.env.MARKETPLACE_SECRET_KEY;
    const savedAlt = process.env.SECRET_ENC_KEY;
    delete process.env.MARKETPLACE_SECRET_KEY;
    delete process.env.SECRET_ENC_KEY;
    jest.resetModules();
    try {
      const { svc } = build();
      const view: any = await svc.getBySlug('uzmarket');
      expect(view.checklist.encryption).toBe(false);
      expect(view.ready).toBe(false);
      await expect(svc.setActive('uzmarket', true)).rejects.toThrow(
        /encryption/,
      );
    } finally {
      if (saved) process.env.MARKETPLACE_SECRET_KEY = saved;
      if (savedAlt) process.env.SECRET_ENC_KEY = savedAlt;
    }
  });
});

describe('MarketplaceConfigService — audit jurnali', () => {
  it('kill-switch va kalit aylantirish YOZILADI, sekret esa YOZILMAYDI', async () => {
    /**
     * ⚠️ «Kim va qachon o'chirib qo'ydi?» — pul tizimida bu savolga
     * javob bo'lishi shart. Lekin sekretning O'ZI hech qachon jurnalga
     * tushmasligi kerak.
     */
    const { svc, activityLog } = build();
    await svc.setActive('uzmarket', false, USER);
    await svc.rotateSigningSecret('uzmarket', USER);
    await svc.rotateInboundKey('uzmarket', USER);

    const actions = activityLog.log.mock.calls.map((c: any[]) => c[0].action);
    expect(actions).toEqual([
      'marketplace_disabled',
      'signing_secret_rotated',
      'inbound_api_key_rotated',
    ]);

    const json = JSON.stringify(activityLog.log.mock.calls);
    expect(json).not.toContain('mock-secret-v1');
    expect(json).not.toMatch(/[0-9a-f]{64}/); // yangi sekret ham yo'q
    expect(activityLog.log.mock.calls[0][0].entity_type).toBe(
      'marketplace_integration',
    );
  });
});

describe('MarketplaceConfigService — biriktirilgan market', () => {
  it('javobda market NOMI va KASSA balansi qaytadi', async () => {
    /**
     * ⚠️ Avval faqat `market_id` (UUID) qaytardi va sozlash ekrani uni
     * umuman chizmasdi. Natijada admin «integratsiya hech qanday
     * marketga biriktirilmagan» deb o'ylardi — holbuki biriktirilgan.
     * Bu market marketplace pulining KASSASI: sotuvda oshadi, to'lovda
     * kamayadi. Eng muhim bog'lanishni yashirib bo'lmaydi.
     */
    const { svc } = build();
    const view: any = await svc.getBySlug('uzmarket');

    expect(view.market).toMatchObject({
      name: 'UzMarket',
      cashbox_balance: 1_250_000,
    });
    expect(view.market_id).toBe('market-1');
  });
});

describe("sotuvchi reestrini qo'lda sinxronlash", () => {
  it('sanoq qaytaradi va audit jurnaliga yozadi', async () => {
    const { svc, reconcile, activityLog } = build({ synced: 7 });
    await expect(svc.syncSellers('uzmarket', USER as any)).resolves.toEqual({
      synced: 7,
    });
    expect(reconcile.syncSellers).toHaveBeenCalledTimes(1);
    expect(activityLog.log).toHaveBeenCalled();
  });

  it("javobda sotuvchi ID lari BO'LMAYDI (qaror O5)", async () => {
    const { svc } = build({ synced: 7 });
    const res: any = await svc.syncSellers('uzmarket', USER as any);
    expect(Object.keys(res)).toEqual(['synced']);
  });
});
