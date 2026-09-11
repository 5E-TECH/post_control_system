/// <reference types="jest" />
import { ElchiConfigService } from './elchi-config.service';

/**
 * Elchi sozlash servisi — sozlama maskalash, SOATO moslash va DARVOZA.
 *
 * Eng muhim ikki invariant shu yerda qulflangan:
 *   1. `syncDistricts` HECH QACHON `is_enabled`ga tegmaydi — moslash texnik
 *      amal, jo'natishga ruxsat esa operatorning ataylab qilgan qarori.
 *      Aks holda "moslashni yangilash" tugmasi darvozani bilvosita ochib
 *      yuborishi mumkin edi.
 *   2. Qo'lda moslangan qator avtomatik moslash tomonidan ustidan YOZILMAYDI.
 */
function buildSvc(over: {
  config?: unknown;
  elchiDistricts?: Array<Record<string, unknown>>;
  courier?: Record<string, unknown> | null;
  getTariffImpl?: jest.Mock;
  ourDistricts?: Array<Record<string, unknown>>;
  mapRows?: Array<Record<string, unknown>>;
} = {}) {
  const saved: any[] = [];
  const svc: any = Object.create(ElchiConfigService.prototype);

  svc.repo = {
    findOne: jest.fn().mockResolvedValue(over.config ?? { id: 'cfg-1' }),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
  };
  svc.mapRepo = {
    find: jest.fn().mockResolvedValue(over.mapRows ?? []),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: any) => {
      saved.push(x);
      return Promise.resolve({ id: 'row-1', ...x });
    }),
  };
  svc.districtRepo = {
    find: jest.fn().mockResolvedValue(over.ourDistricts ?? []),
  };
  svc.userRepo = {
    findOne: jest.fn().mockResolvedValue((over as any).courier ?? null),
  };
  svc.api = {
    getDistricts: jest.fn().mockResolvedValue(over.elchiDistricts ?? []),
    ping: jest.fn().mockResolvedValue({ authenticated: true }),
    getTariff:
      (over as any).getTariffImpl ??
      jest.fn((_id: string, where: string) =>
        Promise.resolve({
          market_tariff: where === 'center' ? 15000 : 20000,
        }),
      ),
  };
  svc.activityLog = { log: jest.fn().mockResolvedValue(undefined) };
  svc.logger = { warn: jest.fn(), error: jest.fn() };

  return { svc, saved };
}

describe('ElchiConfigService — getSafe (sirlar sizmaydi)', () => {
  it('maxfiy maydonlar QAYTARILMAYDI, faqat *_set bayroqlari', async () => {
    const { svc } = buildSvc({
      config: {
        id: 'cfg-1',
        is_active: true,
        api_base_url: 'https://api.elchi.uz',
        api_key: 'super-secret-key',
        webhook_secret: 'hmac-secret',
        webhook_secret_previous: null,
      },
    });

    const safe: any = await svc.getSafe();

    expect(safe.api_key).toBeUndefined();
    expect(safe.webhook_secret).toBeUndefined();
    expect(safe.webhook_secret_previous).toBeUndefined();
    expect(safe.api_key_set).toBe(true);
    expect(safe.webhook_secret_set).toBe(true);
    expect(safe.webhook_secret_previous_set).toBe(false);
    // Maxfiy bo'lmagan maydonlar ko'rinadi.
    expect(safe.api_base_url).toBe('https://api.elchi.uz');
    expect(safe.is_active).toBe(true);
  });
});

describe('ElchiConfigService — syncDistricts (SOATO moslash)', () => {
  it('SOATO bo‘yicha moslaydi va DARVOZANI OCHMAYDI', async () => {
    const { svc, saved } = buildSvc({
      ourDistricts: [{ id: 'd-1', name: 'Chilonzor', sato_code: '1726269' }],
      elchiDistricts: [
        { id: '482', name: 'Chilonzor', region_id: '17', sato_code: '1726269' },
      ],
    });

    const res: any = await svc.syncDistricts();

    expect(res.matched).toBe(1);
    expect(saved[0]).toEqual(
      expect.objectContaining({
        district_id: 'd-1',
        elchi_district_id: '482',
        elchi_region_id: '17',
        sato_code: '1726269',
        matched_automatically: true,
      }),
    );
    // INVARIANT 1: `is_enabled` umuman BERILMAYDI -> entity default `false`.
    expect(saved[0]).not.toHaveProperty('is_enabled');
  });

  it('QO‘LDA moslangan qator ustidan yozilmaydi', async () => {
    const { svc, saved } = buildSvc({
      ourDistricts: [{ id: 'd-1', name: 'Chilonzor', sato_code: '1726269' }],
      elchiDistricts: [
        { id: '999', name: 'Boshqa', region_id: '17', sato_code: '1726269' },
      ],
      mapRows: [
        {
          id: 'row-1',
          district_id: 'd-1',
          elchi_district_id: '482', // operator qo'lda tanlagan
          matched_automatically: false,
          is_enabled: true,
        },
      ],
    });

    const res: any = await svc.syncDistricts();

    expect(res.kept_manual).toBe(1);
    expect(res.matched).toBe(0);
    expect(saved).toHaveLength(0);
  });

  it('avtomatik qator Elchi id o‘zgarsa yangilanadi, is_enabled TEGILMAYDI', async () => {
    const existing = {
      id: 'row-1',
      district_id: 'd-1',
      elchi_district_id: '482',
      elchi_region_id: '17',
      sato_code: '1726269',
      matched_automatically: true,
      is_enabled: true, // operator ruxsat bergan
    };
    const { svc, saved } = buildSvc({
      ourDistricts: [{ id: 'd-1', name: 'Chilonzor', sato_code: '1726269' }],
      elchiDistricts: [
        { id: '777', name: 'Chilonzor', region_id: '18', sato_code: '1726269' },
      ],
      mapRows: [existing],
    });

    const res: any = await svc.syncDistricts();

    expect(res.refreshed).toBe(1);
    expect(saved[0].elchi_district_id).toBe('777');
    expect(saved[0].elchi_region_id).toBe('18');
    // INVARIANT 1: ruxsat o'z holida qoladi — sync uni o'chirmaydi ham, yoqmaydi ham.
    expect(saved[0].is_enabled).toBe(true);
  });

  it('mos SOATO topilmagan tumanlar javobda qaytariladi', async () => {
    const { svc, saved } = buildSvc({
      ourDistricts: [
        { id: 'd-1', name: 'Yangi tuman', sato_code: '9999999' },
        { id: 'd-2', name: 'Kodsiz tuman', sato_code: null },
      ],
      elchiDistricts: [
        { id: '482', name: 'Chilonzor', region_id: '17', sato_code: '1726269' },
      ],
    });

    const res: any = await svc.syncDistricts();

    expect(res.matched).toBe(0);
    expect(res.unmatched).toHaveLength(2);
    expect(res.unmatched.map((u: any) => u.district_id)).toEqual(['d-1', 'd-2']);
    expect(saved).toHaveLength(0);
  });

  it('Elchi tomonda takroriy SOATO -> birinchisi olinadi va ogohlantiriladi', async () => {
    const { svc, saved } = buildSvc({
      ourDistricts: [{ id: 'd-1', name: 'Chilonzor', sato_code: '1726269' }],
      elchiDistricts: [
        { id: '482', name: 'Chilonzor', region_id: '17', sato_code: '1726269' },
        { id: '483', name: 'Chilonzor-2', region_id: '17', sato_code: '1726269' },
      ],
    });

    const res: any = await svc.syncDistricts();

    expect(res.matched).toBe(1);
    expect(saved[0].elchi_district_id).toBe('482');
    // Jimgina o'tkazib yubormaymiz — Elchi ma'lumotida dublikat bor degani.
    expect(svc.logger.warn).toHaveBeenCalled();
  });
});

describe('ElchiConfigService — DARVOZA', () => {
  it('moslama yo‘q -> jo‘natishga ruxsat YO‘Q', async () => {
    const { svc } = buildSvc();
    svc.mapRepo.findOne = jest.fn().mockResolvedValue(null);

    await expect(svc.isDistrictAllowed('d-1')).resolves.toBe(false);
  });

  it('bo‘sh district id -> ruxsat YO‘Q (so‘rov ham yuborilmaydi)', async () => {
    const { svc } = buildSvc();
    await expect(svc.isDistrictAllowed('')).resolves.toBe(false);
    expect(svc.mapRepo.findOne).not.toHaveBeenCalled();
  });

  it('yoqilgan, lekin Elchi tumani belgilanmagan -> ruxsat YO‘Q', async () => {
    const { svc } = buildSvc();
    svc.mapRepo.findOne = jest
      .fn()
      .mockResolvedValue({ id: 'row-1', elchi_district_id: null });

    await expect(svc.isDistrictAllowed('d-1')).resolves.toBe(false);
  });

  it('moslangan + yoqilgan -> RUXSAT', async () => {
    const { svc } = buildSvc();
    svc.mapRepo.findOne = jest
      .fn()
      .mockResolvedValue({ id: 'row-1', elchi_district_id: '482' });

    await expect(svc.isDistrictAllowed('d-1')).resolves.toBe(true);
  });

  it('setDistrictEnabled: moslama yo‘q -> xato', async () => {
    const { svc } = buildSvc();
    svc.mapRepo.findOne = jest.fn().mockResolvedValue(null);

    await expect(svc.setDistrictEnabled('d-1', true)).rejects.toThrow(
      /moslamasi yo'q/,
    );
  });

  it('setDistrictEnabled: Elchi tumaniga moslanmagan holda YOQIB bo‘lmaydi', async () => {
    const { svc } = buildSvc();
    svc.mapRepo.findOne = jest.fn().mockResolvedValue({
      id: 'row-1',
      district_id: 'd-1',
      elchi_district_id: null,
      is_enabled: false,
    });

    await expect(svc.setDistrictEnabled('d-1', true)).rejects.toThrow(
      /moslanmagan/,
    );
  });

  it('setDistrictEnabled: o‘chirish moslamasiz ham ishlaydi (xavfsiz yo‘nalish)', async () => {
    const { svc } = buildSvc();
    svc.mapRepo.findOne = jest.fn().mockResolvedValue({
      id: 'row-1',
      district_id: 'd-1',
      elchi_district_id: null,
      is_enabled: true,
    });

    const res: any = await svc.setDistrictEnabled('d-1', false);
    expect(res.is_enabled).toBe(false);
  });

  it('resolveElchiGeo: yoqilmagan tuman -> null', async () => {
    const { svc } = buildSvc();
    svc.mapRepo.findOne = jest.fn().mockResolvedValue(null);

    await expect(svc.resolveElchiGeo('d-1')).resolves.toBeNull();
  });

  it('resolveElchiGeo: yoqilgan tuman -> Elchi hudud id‘lari', async () => {
    const { svc } = buildSvc();
    svc.mapRepo.findOne = jest.fn().mockResolvedValue({
      elchi_district_id: '482',
      elchi_region_id: '17',
    });

    await expect(svc.resolveElchiGeo('d-1')).resolves.toEqual({
      elchi_district_id: '482',
      elchi_region_id: '17',
    });
  });
});


describe('ElchiConfigService — TAYYORLIK va TARIF MOSLIGI', () => {
  const fullConfig = {
    id: 'cfg-1',
    api_base_url: 'https://api.elchi.uz',
    api_key: 'k',
    webhook_secret: 's',
    elchi_market_id: '500',
    elchi_courier_user_id: 'c-1',
  };

  it('tariflar TENG -> tayyorlik bandi o‘tadi', async () => {
    const { svc } = buildSvc({
      config: fullConfig,
      // Bizdagi kuryer tarifi Elchi bilan bir xil (20000 / 15000).
      courier: {
        id: 'c-1',
        name: 'Elchi',
        status: 'active',
        tariff_home: 20000,
        tariff_center: 15000,
      },
      mapRows: [{ id: 'r1', is_enabled: true }],
    });
    svc.mapRepo.count = jest.fn().mockResolvedValue(1);

    const res: any = await svc.getReadiness();
    const tariff = res.checks.find((c: any) => c.key === 'tariff_match');

    expect(tariff.ok).toBe(true);
    expect(tariff.detail).toMatch(/mos/);
  });

  // ⚠️ ASOSIY HIMOYA: mos kelmasa hech qanday xato chiqmaydi, farq jimgina
  // to'planadi. Shu bois mashina solishtiradi va OCHIQ aytadi.
  it('tariflar MOS KELMASA -> ochiq nomuvofiqlik xabari', async () => {
    const { svc } = buildSvc({
      config: fullConfig,
      courier: {
        id: 'c-1',
        name: 'Elchi',
        status: 'active',
        tariff_home: 25000, // Elchi'da 20000
        tariff_center: 15000,
      },
    });
    svc.mapRepo.count = jest.fn().mockResolvedValue(1);

    const res: any = await svc.getReadiness();
    const tariff = res.checks.find((c: any) => c.key === 'tariff_match');

    expect(tariff.ok).toBe(false);
    expect(tariff.detail).toMatch(/NOMUVOFIQ/);
    expect(tariff.detail).toMatch(/25000/);
    expect(tariff.detail).toMatch(/20000/);
    expect(res.ready).toBe(false);
    expect(svc.logger.error).toHaveBeenCalled();
  });

  it("Elchi tarifini o'qib bo'lmasa -> band muvaffaqiyatsiz, tekshiruv yiqilmaydi", async () => {
    const { svc } = buildSvc({
      config: fullConfig,
      courier: { id: 'c-1', name: 'E', status: 'active', tariff_home: 1 },
      getTariffImpl: jest.fn().mockRejectedValue(new Error('Elchi 503')),
    });
    svc.mapRepo.count = jest.fn().mockResolvedValue(0);

    const res: any = await svc.getReadiness();
    const tariff = res.checks.find((c: any) => c.key === 'tariff_match');

    expect(tariff.ok).toBe(false);
    expect(tariff.detail).toMatch(/Elchi 503/);
  });

  it("sozlanmagan -> ready=false va yetishmayotgan bandlar ko'rinadi", async () => {
    const { svc } = buildSvc({ config: { id: 'cfg-1' } });
    svc.mapRepo.count = jest.fn().mockResolvedValue(0);

    const res: any = await svc.getReadiness();

    expect(res.ready).toBe(false);
    const failed = res.checks.filter((c: any) => !c.ok).map((c: any) => c.key);
    expect(failed).toEqual(
      expect.arrayContaining([
        'api_base_url',
        'api_key',
        'webhook_secret',
        'elchi_market_id',
        'virtual_courier',
        'districts',
      ]),
    );
  });

  it("hech bir tuman yoqilmagan -> tayyor EMAS (xavfsiz standart)", async () => {
    const { svc } = buildSvc({
      config: fullConfig,
      courier: {
        id: 'c-1', name: 'E', status: 'active',
        tariff_home: 20000, tariff_center: 15000,
      },
    });
    // 3 ta moslangan, lekin 0 tasi yoqilgan.
    svc.mapRepo.count = jest
      .fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0);

    const res: any = await svc.getReadiness();
    const districts = res.checks.find((c: any) => c.key === 'districts');

    expect(districts.ok).toBe(false);
    expect(districts.detail).toMatch(/ruxsat berilgan: 0/);
  });
});

/**
 * QO'LDA MOSLASH — 2026-09-11 real testda paydo bo'lgan ehtiyoj.
 *
 * Avtomatik moslash SOATO bo'yicha ishlaydi, lekin Elchi produksiyasida
 * tumanlarning `sato_code` qiymati HAQIQIY SOATO emas — o'rinbosar satr
 * (`REG-03-DIS-02`). PCS'da esa haqiqiy kod (`1703224`). Kesishma NOL:
 * `syncDistricts` 184 tumandan hech birini moslay olmadi.
 */
describe('ElchiConfigService — tumanni qo\'lda moslash', () => {
  const withDistrict = (over: any = {}) => {
    const built = buildSvc(over);
    built.svc.districtRepo.findOne = jest
      .fn()
      .mockResolvedValue({ id: 'd-1', name: 'Asaka tumani', sato_code: '1703224' });
    return built;
  };

  it('yangi qator yaratadi va QO\'LDA deb belgilaydi', async () => {
    const { svc, saved } = withDistrict();
    const row: any = await svc.setDistrictMapping('d-1', '29', '3');

    expect(row.elchi_district_id).toBe('29');
    expect(row.elchi_region_id).toBe('3');
    // Eng muhimi: `syncDistricts` shu bayroqqa qarab qatorni saqlab qoladi.
    expect(saved[0].matched_automatically).toBe(false);
  });

  it('DARVOZAGA TEGMAYDI — moslash texnik amal, ruxsat alohida qaror', async () => {
    const { svc, saved } = withDistrict();
    await svc.setDistrictMapping('d-1', '29', '3');
    expect(saved[0].is_enabled).toBe(false);
  });

  it('mavjud qatorni yangilaydi, darvozasini o\'zgartirmaydi', async () => {
    const { svc, saved } = withDistrict();
    svc.mapRepo.findOne = jest.fn().mockResolvedValue({
      id: 'row-1',
      district_id: 'd-1',
      elchi_district_id: '11',
      is_enabled: true,
      matched_automatically: true,
    });

    await svc.setDistrictMapping('d-1', '29', '3');

    expect(saved[0].elchi_district_id).toBe('29');
    expect(saved[0].is_enabled).toBe(true); // ochiq darvoza ochiq qoladi
    expect(saved[0].matched_automatically).toBe(false);
  });

  it('bo\'sh Elchi tumani RAD ETILADI', async () => {
    const { svc } = withDistrict();
    await expect(svc.setDistrictMapping('d-1', '   ', null)).rejects.toThrow();
  });

  it('mavjud bo\'lmagan tuman RAD ETILADI', async () => {
    const { svc } = buildSvc();
    svc.districtRepo.findOne = jest.fn().mockResolvedValue(null);
    await expect(svc.setDistrictMapping('yo-q', '29', null)).rejects.toThrow();
  });
});

/**
 * MARKET OCHISH — tarif KURYERDAN olinadi (M4).
 *
 * PCS'dagi vakil-kuryer tarifi va Elchi'dagi market tarifi TENG bo'lishi
 * shart; ikki joyga qo'lda kiritish aynan farqni tug'diradi.
 */
describe('ElchiConfigService — market ochish', () => {
  const ready = (courier: any) =>
    buildSvc({
      config: {
        id: 'cfg-1',
        api_base_url: 'https://api.elchi.uz',
        api_key: 'k',
        elchi_courier_user_id: 'c-1',
      },
      courier,
    });

  it('tarifni KURYERDAN oladi va Elchi\'ga yuboradi', async () => {
    const { svc } = ready({
      id: 'c-1',
      phone_number: '+998900000000',
      tariff_home: 25000,
      tariff_center: 15000,
    });
    svc.api.provisionMarket = jest
      .fn()
      .mockResolvedValue({ elchi_market_id: 'm-77' });

    const res: any = await svc.provisionMarket();

    const sent = svc.api.provisionMarket.mock.calls[0][0];
    expect(sent.tariff_home).toBe(25000);
    expect(sent.tariff_center).toBe(15000);
    // Barqaror kalit — takroriy chaqiruv yangi market ochmasin.
    expect(sent.external_seller_id).toBe('cfg-1');
    expect(res.elchi_market_id).toBe('m-77');
  });

  it('NOL tarif RAD ETILADI — Elchi bepul yetkazib qo\'yardi (M4)', async () => {
    const { svc } = ready({
      id: 'c-1',
      phone_number: '+998900000000',
      tariff_home: 0,
      tariff_center: 15000,
    });
    svc.api.provisionMarket = jest.fn();

    await expect(svc.provisionMarket()).rejects.toThrow(/tarif/i);
    expect(svc.api.provisionMarket).not.toHaveBeenCalled();
  });

  it('kuryer biriktirilmagan bo\'lsa RAD ETILADI', async () => {
    const { svc } = buildSvc({
      config: { id: 'cfg-1', api_base_url: 'https://x', api_key: 'k' },
    });
    svc.api.provisionMarket = jest.fn();

    await expect(svc.provisionMarket()).rejects.toThrow(/kuryer/i);
    expect(svc.api.provisionMarket).not.toHaveBeenCalled();
  });

  it('kalit yoki manzil yo\'q bo\'lsa RAD ETILADI', async () => {
    const { svc } = buildSvc({ config: { id: 'cfg-1' } });
    svc.api.provisionMarket = jest.fn();
    await expect(svc.provisionMarket()).rejects.toThrow();
    expect(svc.api.provisionMarket).not.toHaveBeenCalled();
  });

  it('javobda market id bo\'lmasa SAQLAMAYDI', async () => {
    const { svc } = ready({
      id: 'c-1',
      phone_number: '+998900000000',
      tariff_home: 25000,
      tariff_center: 15000,
    });
    svc.api.provisionMarket = jest.fn().mockResolvedValue({});
    await expect(svc.provisionMarket()).rejects.toThrow(/elchi_market_id/i);
  });
});

/**
 * VILOYAT DARVOZASI.
 *
 * Elchi — BeePost uchun "super kuryer": operator butun viloyat pochtasini
 * jo'nata olishi kerak, 16 ta tumanni bittalab yoqmasdan.
 *
 * Eng muhim shart: viloyatda MOSLANMAGAN tuman qolsa, buni jimgina o'tkazib
 * yuborish mumkin emas. Darvoza "hammasi yoki hech biri" ishlagani uchun bitta
 * moslanmagan tuman butun viloyat pochtasini to'sadi.
 */
function buildRegionSvc(
  districts: Array<{ id: string; name: string }>,
  mapRows: Array<{
    id: string;
    district_id: string;
    elchi_district_id: string | null;
    is_enabled: boolean;
  }>,
) {
  const updates: any[] = [];
  const svc: any = Object.create(ElchiConfigService.prototype);
  svc.districtRepo = {
    find: jest.fn().mockResolvedValue(
      districts.map((d) => ({ ...d, region: { name: 'Andijon viloyati' } })),
    ),
  };
  svc.mapRepo = {
    find: jest.fn().mockResolvedValue(mapRows),
    update: jest.fn((where: any, patch: any) => {
      updates.push({ where, patch });
      return Promise.resolve({ affected: where.id?._value?.length ?? 0 });
    }),
  };
  svc.activityLog = { log: jest.fn().mockResolvedValue(undefined) };
  svc.logger = { warn: jest.fn(), error: jest.fn() };
  return { svc, updates };
}

describe('ElchiConfigService — VILOYAT darvozasi', () => {
  const REGION = 'reg-1';

  it("TC1: viloyat ochilganda moslangan tumanlarning HAMMASI yoqiladi", async () => {
    const { svc, updates } = buildRegionSvc(
      [
        { id: 'd1', name: 'Asaka' },
        { id: 'd2', name: 'Baliqchi' },
        { id: 'd3', name: 'Marhamat' },
      ],
      [
        { id: 'm1', district_id: 'd1', elchi_district_id: '10', is_enabled: false },
        { id: 'm2', district_id: 'd2', elchi_district_id: '11', is_enabled: false },
        { id: 'm3', district_id: 'd3', elchi_district_id: '12', is_enabled: false },
      ],
    );

    const res = await svc.setRegionEnabled(REGION, true);

    expect(res.changed).toBe(3);
    expect(res.enabled_after).toBe(3);
    expect(res.fully_open).toBe(true);
    expect(updates).toHaveLength(1); // bitta ommaviy UPDATE, 3 ta emas
  });

  it("TC2: MOSLANMAGAN tuman ochilmaydi va JIMGINA o'tmaydi", async () => {
    const { svc } = buildRegionSvc(
      [
        { id: 'd1', name: 'Asaka' },
        { id: 'd2', name: 'Andijon shahri' },
      ],
      [
        { id: 'm1', district_id: 'd1', elchi_district_id: '10', is_enabled: false },
        // d2 uchun moslama YO'Q — Elchi'da bunday tuman mavjud emas
      ],
    );

    const res = await svc.setRegionEnabled(REGION, true);

    expect(res.changed).toBe(1);
    expect(res.unmapped_names).toEqual(['Andijon shahri']);
    // ⭐ Asosiy shart: 1 ta tuman ochilgan bo'lsa-da, viloyat TO'LIQ emas —
    // "Andijon shahri"dan bitta buyurtma butun pochtani to'sadi.
    expect(res.fully_open).toBe(false);
  });

  it('TC3: qayta bosilsa hech narsa yozilmaydi (idempotent)', async () => {
    const { svc, updates } = buildRegionSvc(
      [{ id: 'd1', name: 'Asaka' }],
      [{ id: 'm1', district_id: 'd1', elchi_district_id: '10', is_enabled: true }],
    );

    const res = await svc.setRegionEnabled(REGION, true);

    expect(res.changed).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it('TC4: yopish — moslanganlarning hammasi bloklanadi', async () => {
    const { svc } = buildRegionSvc(
      [
        { id: 'd1', name: 'Asaka' },
        { id: 'd2', name: 'Baliqchi' },
      ],
      [
        { id: 'm1', district_id: 'd1', elchi_district_id: '10', is_enabled: true },
        { id: 'm2', district_id: 'd2', elchi_district_id: '11', is_enabled: true },
      ],
    );

    const res = await svc.setRegionEnabled(REGION, false);

    expect(res.changed).toBe(2);
    expect(res.enabled_after).toBe(0);
    expect(res.fully_open).toBe(false);
  });

  it("TC5: moslamasi bor-u Elchi tumani belgilanmagan qator OCHILMAYDI", async () => {
    // Tumanlik qoida bilan bir xil: `elchi_district_id` yo'q bo'lsa yoqib
    // bo'lmaydi — aks holda dispatch'da "qayerga jo'natish" noaniq bo'lardi.
    const { svc } = buildRegionSvc(
      [{ id: 'd1', name: 'Buvaida' }],
      [{ id: 'm1', district_id: 'd1', elchi_district_id: null, is_enabled: false }],
    );

    const res = await svc.setRegionEnabled(REGION, true);

    expect(res.changed).toBe(0);
    expect(res.mapped).toBe(0);
    expect(res.unmapped_names).toEqual(['Buvaida']);
  });

  it("TC6: tumani yo'q viloyat — 404", async () => {
    const { svc } = buildRegionSvc([], []);
    await expect(svc.setRegionEnabled(REGION, true)).rejects.toThrow();
  });
});

/**
 * TAKRORIY SOATO — bog'lanish sakramasligi kerak.
 *
 * Elchi bazasida bir joy ikki nom bilan yozilgan bo'lishi mumkin (1724206 →
 * "Oqoltin" va "Akaltyn"). Ilgari "massivdagi birinchisi" olinardi, API
 * javobining tartibi esa kafolatlanmagan — ya'ni keyingi sinxronda mavjud
 * bog'lanish sababsiz boshqasiga ko'chib ketardi.
 */
describe('ElchiConfigService — takroriy SOATO barqaror hal qilinadi', () => {
  const DUP = [
    { id: '149', name: 'Oqoltin', sato_code: '1724206', region_id: '9' },
    { id: '145', name: 'Akaltyn', sato_code: '1724206', region_id: '9' },
  ];
  const OURS = [{ id: 'd-oq', name: 'Oqoltin', sato_code: '1724206' }];

  it("TC1: mavjud bog'lanish SAQLANADI — tartib teskari bo'lsa ham", async () => {
    const { svc } = buildSvc({
      // Elchi javobida "Akaltyn" BIRINCHI keladi...
      elchiDistricts: [DUP[1], DUP[0]],
      ourDistricts: OURS,
      // ...lekin biz allaqachon #149 ga bog'langanmiz.
      mapRows: [
        {
          id: 'm1',
          district_id: 'd-oq',
          elchi_district_id: '149',
          elchi_region_id: '9',
          sato_code: '1724206',
          matched_automatically: true,
          is_enabled: true,
        },
      ],
    });

    const res: any = await svc.syncDistricts();

    // ⭐ Hech narsa o'zgarmasligi kerak — aks holda bog'lanish har
    // sinxronda sakrab turardi.
    expect(res.refreshed).toBe(0);
    expect(res.matched).toBe(0);
  });

  it("TC2: yangi moslashda TO'G'RI O'ZBEKCHA nom olinadi (id emas)", async () => {
    const { svc, saved } = buildSvc({
      elchiDistricts: [DUP[0], DUP[1]],
      ourDistricts: OURS,
      mapRows: [],
    });

    await svc.syncDistricts();

    // ⭐ #145 "Akaltyn" id bo'yicha kichikroq, lekin u ruscha
    // transliteratsiya. To'g'ri nom — "Oqoltin" (#149).
    expect(saved[0].elchi_district_id).toBe('149');
  });

  it('TC3: teskari tartibda ham AYNI natija (tartibga bog\'liq emas)', async () => {
    const { svc, saved } = buildSvc({
      elchiDistricts: [DUP[1], DUP[0]],
      ourDistricts: OURS,
      mapRows: [],
    });

    await svc.syncDistricts();

    expect(saved[0].elchi_district_id).toBe('149');
  });

  it("TC4: takrorsiz SOATO xulqi O'ZGARMAYDI", async () => {
    const { svc, saved } = buildSvc({
      elchiDistricts: [
        { id: '28', name: 'Andijon', sato_code: '1703203', region_id: '3' },
      ],
      ourDistricts: [{ id: 'd-a', name: 'Andijon tumani', sato_code: '1703203' }],
      mapRows: [],
    });

    const res: any = await svc.syncDistricts();

    expect(res.matched).toBe(1);
    expect(saved[0].elchi_district_id).toBe('28');
  });
});
