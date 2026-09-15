/// <reference types="jest" />
import { ElchiShipmentService } from './elchi-shipment.service';
import { Order_status, Status, Where_deliver } from 'src/common/enums';

/**
 * P3 — Elchi'ga jo'natish: kill-switch, HUDUD DARVOZASI, dispatch va
 * BOSHQARUVNI QAYTARIB OLISH.
 *
 * Eng muhim invariantlar:
 *   - darvoza "hammasi yoki hech biri" (qisman jo'natish yetim buyurtma qoldiradi);
 *   - dispatch muvaffaqiyatda `control_owner = 'elchi'` qo'yadi (pul ikki
 *     daftarda paydo bo'lishining oldini oladi);
 *   - `subtotal` va `cod_amount` TENG yuboriladi (M3);
 *   - qaytarib olish AVVAL Elchi posilkasini bekor qiladi, keyin boshqaruvni
 *     bo'shatadi — ikki tomon bir vaqtda faol bo'lib qolmaydi.
 */
function buildSvc(
  over: {
    config?: unknown;
    courier?: unknown;
    order?: Record<string, unknown> | null;
    shipment?: Record<string, unknown> | null;
    geo?: { elchi_district_id: string; elchi_region_id: string | null } | null;
    allowedDistricts?: Set<string>;
    createShipmentImpl?: jest.Mock;
    /** Pochtadagi buyurtmalar soni — qop hajmi zaxirasi uchun. */
    postOrderCount?: number;
    cancelShipmentImpl?: jest.Mock;
    ordersForPreview?: Array<Record<string, unknown>>;
    shipmentsForPost?: Array<Record<string, unknown>>;
  } = {},
) {
  const savedShipments: any[] = [];
  const orderUpdates: any[] = [];
  const svc: any = Object.create(ElchiShipmentService.prototype);

  svc.configRepo = {
    findOne: jest.fn().mockResolvedValue(
      over.config === undefined
        ? {
            id: 'cfg',
            is_active: true,
            elchi_market_id: '500',
            elchi_courier_user_id: null,
          }
        : over.config,
    ),
  };
  svc.userRepo = {
    findOne: jest.fn().mockResolvedValue(over.courier ?? null),
  };
  svc.orderRepo = {
    /**
     * ⚠️ `count` — QOP HAJMI zaxirasi uchun. Chaqiruvchi hajmni bermasa
     * (qayta jo'natish yo'li), servis pochtadagi buyurtmalarni sanaydi.
     * Mockda bo'lmasa `this.orderRepo.count is not a function` chiqadi.
     */
    count: jest.fn().mockResolvedValue(over.postOrderCount ?? 5),
    findOne: jest.fn().mockResolvedValue(
      over.order === undefined
        ? {
            id: 'o-1',
            order_number: 100042,
            status: Order_status.RECEIVED,
            post_id: 'p-1',
            // JISMONIY YORLIQDAGI token — Elchi ga `label_token` bolib ketadi.
            qr_code_token: 'PCS-LABEL-XYZ',
            district_id: 'd-1',
            district: { name: 'Chilonzor' },
            address: 'Chilonzor 12',
            where_deliver: Where_deliver.ADDRESS,
            // ATAYLAB FARQLI: `to_be_paid` PCS'da "marketga qarz" ma'nosini
            // bildiradi va yaratilganda 0 bo'ladi. Mijoz `total_price` to'laydi.
            to_be_paid: 0,
            total_price: 250000,
            customer: { name: 'Aliyev Vali', phone_number: '+998901234567' },
            items: [{ quantity: 2, product: { name: 'Futbolka' } }],
          }
        : over.order,
    ),
    update: jest.fn((where: any, patch: any) => {
      orderUpdates.push({ where, patch });
      return Promise.resolve({ affected: 1 });
    }),
    find: jest.fn().mockResolvedValue((over as any).ordersForPreview ?? []),
  };
  svc.shipmentRepo = {
    findOne: jest.fn().mockResolvedValue(over.shipment ?? null),
    create: jest.fn((x: unknown) => ({ ...(x as object) })),
    save: jest.fn((x: any) => {
      savedShipments.push({ ...x });
      return Promise.resolve(x);
    }),
    find: jest.fn().mockResolvedValue((over as any).shipmentsForPost ?? []),
  };
  svc.api = {
    createShipment:
      over.createShipmentImpl ??
      jest.fn().mockResolvedValue({
        shipment_id: '9001',
        qr_code_token: 'tok-abc',
        order_status: 'new',
      }),
    cancelShipment:
      over.cancelShipmentImpl ??
      jest.fn().mockResolvedValue({ shipment_id: '9001', status: 'cancelled' }),
  };
  svc.configService = {
    resolveElchiGeo: jest
      .fn()
      .mockResolvedValue(
        over.geo === undefined
          ? { elchi_district_id: '482', elchi_region_id: '17' }
          : over.geo,
      ),
    isDistrictAllowed: jest.fn((id: string) =>
      Promise.resolve((over.allowedDistricts ?? new Set(['d-1'])).has(id)),
    ),
  };
  svc.activityLog = { log: jest.fn().mockResolvedValue(undefined) };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  return { svc, savedShipments, orderUpdates };
}

describe('ElchiShipmentService — kill switch', () => {
  it("sozlama yo'q -> jo'natilmaydi", async () => {
    const { svc } = buildSvc({ config: null });
    await expect(svc.assertElchiDispatchEnabled()).rejects.toThrow(
      /sozlamalari topilmadi/,
    );
  });

  it("master kalit o'chirilgan -> jo'natilmaydi", async () => {
    const { svc } = buildSvc({
      config: { id: 'cfg', is_active: false, elchi_market_id: '500' },
    });
    await expect(svc.assertElchiDispatchEnabled()).rejects.toThrow(
      /o'chirilgan/,
    );
  });

  it('virtual kuryer BLOKLANGAN -> tez tormoz ishlaydi', async () => {
    const { svc } = buildSvc({
      config: {
        id: 'cfg',
        is_active: true,
        elchi_market_id: '500',
        elchi_courier_user_id: 'c-1',
      },
      courier: { id: 'c-1', status: Status.INACTIVE },
    });
    await expect(svc.assertElchiDispatchEnabled()).rejects.toThrow(
      /bloklangan/,
    );
  });

  it("market akkaunti sozlanmagan -> jo'natilmaydi", async () => {
    const { svc } = buildSvc({
      config: { id: 'cfg', is_active: true, elchi_market_id: null },
    });
    await expect(svc.assertElchiDispatchEnabled()).rejects.toThrow(/market/);
  });

  it('hammasi joyida -> config qaytadi', async () => {
    const { svc } = buildSvc({
      config: {
        id: 'cfg',
        is_active: true,
        elchi_market_id: '500',
        elchi_courier_user_id: 'c-1',
      },
      courier: { id: 'c-1', status: Status.ACTIVE },
    });
    await expect(svc.assertElchiDispatchEnabled()).resolves.toMatchObject({
      id: 'cfg',
    });
  });
});

describe('ElchiShipmentService — HUDUD DARVOZASI', () => {
  it('hamma tuman ruxsat etilgan -> o‘tadi', async () => {
    const { svc } = buildSvc({ allowedDistricts: new Set(['d-1', 'd-2']) });
    await expect(
      svc.assertDistrictsAllowedForPost([
        { id: 'o-1', order_number: 1, district_id: 'd-1' },
        { id: 'o-2', order_number: 2, district_id: 'd-2' },
      ]),
    ).resolves.toBeUndefined();
  });

  // ASOSIY INVARIANT: qisman jo'natish YO'Q.
  it('bitta ruxsatsiz tuman BUTUN pochtani bloklaydi', async () => {
    const { svc } = buildSvc({ allowedDistricts: new Set(['d-1']) });

    await expect(
      svc.assertDistrictsAllowedForPost([
        { id: 'o-1', order_number: 1, district_id: 'd-1' },
        {
          id: 'o-2',
          order_number: 2,
          district_id: 'd-9',
          district: { name: 'Yunusobod' },
        },
      ]),
    ).rejects.toThrow(/#2 \(Yunusobod\)/);
  });

  it('tumani belgilanmagan buyurtma ham bloklaydi', async () => {
    const { svc } = buildSvc({ allowedDistricts: new Set(['d-1']) });
    await expect(
      svc.assertDistrictsAllowedForPost([
        { id: 'o-1', order_number: 7, district_id: null },
      ]),
    ).rejects.toThrow(/tuman belgilanmagan/);
  });
});

describe('ElchiShipmentService — dispatch', () => {
  it('posilka yaratiladi va BOSHQARUV Elchiga o‘tadi', async () => {
    const { svc, savedShipments, orderUpdates } = buildSvc();

    const res: any = await svc.createShipmentForOrder('o-1');

    expect(res.elchi_shipment_id).toBe('9001');
    expect(savedShipments[0]).toMatchObject({
      elchi_shipment_id: '9001',
      qr_code_token: 'tok-abc',
      cod_amount_sent: '250000.00',
      last_error: null,
    });
    // Boshqaruv egasi — shundan keyin BeePostda sotish/bekor bloklanadi.
    expect(orderUpdates).toHaveLength(1);
    expect(orderUpdates[0].patch).toEqual({ control_owner: 'elchi' });
  });

  // M3: Elchi sotuv matematikasi `to_be_paid`ni o'qimaydi -> ikki maydon teng
  // bo'lishi SHART, aks holda pul hisobi biz kutgandan boshqacha chiqadi.
  // Bu test bir marta yuz bergan BUG'ni qulflaydi: `to_be_paid` yuborilganda
  // Elchi'ga cod_amount=0 ketib, kuryer mijozdan hech narsa undirmasdi.
  it('cod_amount = total_price (to_be_paid EMAS)', async () => {
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({ createShipmentImpl: createShipment });

    await svc.createShipmentForOrder('o-1');

    const body = createShipment.mock.calls[0][0];
    expect(body.cod_amount).toBe(250000);
    expect(body.cod_amount).not.toBe(0);
  });

  it('subtotal va cod_amount TENG yuboriladi (M3)', async () => {
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({ createShipmentImpl: createShipment });

    await svc.createShipmentForOrder('o-1');

    const body = createShipment.mock.calls[0][0];
    expect(body.cod_amount).toBe(250000);
    expect(body.subtotal).toBe(250000);
    expect(body.external_order_id).toBe('o-1');
    expect(body.district_id).toBe('482');
  });

  it('ayni post uchun allaqachon yuborilgan -> idempotent (API chaqirilmaydi)', async () => {
    const createShipment = jest.fn();
    const { svc, orderUpdates } = buildSvc({
      shipment: {
        order_id: 'o-1',
        post_id: 'p-1',
        elchi_shipment_id: '9001',
      },
      createShipmentImpl: createShipment,
    });

    const res: any = await svc.createShipmentForOrder('o-1');

    expect(res.elchi_shipment_id).toBe('9001');
    expect(createShipment).not.toHaveBeenCalled();
    expect(orderUpdates).toHaveLength(0);
  });

  it('yakunlangan buyurtma jo‘natilmaydi (nomuvofiqlik oldini olish)', async () => {
    const { svc } = buildSvc({
      order: {
        id: 'o-1',
        status: Order_status.SOLD,
        district_id: 'd-1',
        customer: { name: 'A', phone_number: '+998901234567' },
        items: [],
      },
    });

    await expect(svc.createShipmentForOrder('o-1')).rejects.toThrow(
      /yakunlangan/,
    );
  });

  it('tuman ruxsat etilmagan -> dispatch to‘xtaydi (ikkinchi qatlam)', async () => {
    const createShipment = jest.fn();
    const { svc } = buildSvc({ geo: null, createShipmentImpl: createShipment });

    await expect(svc.createShipmentForOrder('o-1')).rejects.toThrow(
      /ruxsat etilmagan/,
    );
    expect(createShipment).not.toHaveBeenCalled();
  });

  it('Elchi javobida shipment_id yo‘q -> aniq xato + boshqaruv O‘TMAYDI', async () => {
    const { svc, orderUpdates, savedShipments } = buildSvc({
      createShipmentImpl: jest.fn().mockResolvedValue({ ok: true }),
    });

    await expect(svc.createShipmentForOrder('o-1')).rejects.toThrow(
      /shipment_id topilmadi/,
    );
    // Boshqaruv Elchi'ga O'TMAYDI — aks holda buyurtma "muallaq" qolardi.
    expect(orderUpdates).toHaveLength(0);
    // Xato posilka yozuviga saqlanadi (qayta jo'natish uchun ko'rinadi).
    expect(savedShipments[savedShipments.length - 1].last_error).toMatch(
      /shipment_id topilmadi/,
    );
  });

  it('mijoz telefoni yo‘q -> jo‘natilmaydi', async () => {
    const { svc } = buildSvc({
      order: {
        id: 'o-1',
        status: Order_status.RECEIVED,
        district_id: 'd-1',
        customer: { name: 'A', phone_number: null },
        items: [],
      },
    });
    await expect(svc.createShipmentForOrder('o-1')).rejects.toThrow(/telefoni/);
  });
});

describe('ElchiShipmentService — boshqaruvni qaytarib olish', () => {
  it('AVVAL Elchi posilkasi bekor qilinadi, KEYIN boshqaruv bo‘shatiladi', async () => {
    const cancelShipment = jest
      .fn()
      .mockResolvedValue({ shipment_id: '9001', status: 'cancelled' });
    const { svc, orderUpdates } = buildSvc({
      order: { id: 'o-1', order_number: 5, control_owner: 'elchi' },
      shipment: { order_id: 'o-1', elchi_shipment_id: '9001' },
      cancelShipmentImpl: cancelShipment,
    });

    const res: any = await svc.reclaimControl('o-1');

    expect(cancelShipment).toHaveBeenCalledWith('9001');
    expect(res).toMatchObject({ reclaimed: true, elchi_cancelled: true });
    expect(orderUpdates[0].patch).toEqual({ control_owner: null });
  });

  // MUHIM: bekor qilinmasa boshqaruv QAYTARILMAYDI — aks holda ikki tomon
  // bir vaqtda faol bo'lib qoladi va pul ikki daftarda paydo bo'ladi.
  it('Elchi bekor qila olmasa -> boshqaruv QAYTARILMAYDI', async () => {
    const { svc, orderUpdates } = buildSvc({
      order: { id: 'o-1', order_number: 5, control_owner: 'elchi' },
      shipment: { order_id: 'o-1', elchi_shipment_id: '9001' },
      cancelShipmentImpl: jest
        .fn()
        .mockRejectedValue(new Error('409 yetkazib bo‘lingan')),
    });

    await expect(svc.reclaimControl('o-1')).rejects.toThrow(/qaytarilmadi/);
    expect(orderUpdates).toHaveLength(0);
  });

  it('force -> boshqaruv tortib olinadi va NOMUVOFIQLIK belgilanadi', async () => {
    const { svc, orderUpdates, savedShipments } = buildSvc({
      order: { id: 'o-1', order_number: 5, control_owner: 'elchi' },
      shipment: { order_id: 'o-1', elchi_shipment_id: '9001' },
      cancelShipmentImpl: jest
        .fn()
        .mockRejectedValue(new Error('Elchi API ishlamayapti')),
    });

    const res: any = await svc.reclaimControl('o-1', undefined, {
      force: true,
    });

    expect(res.reclaimed).toBe(true);
    expect(res.elchi_cancelled).toBe(false);
    expect(orderUpdates[0].patch).toEqual({ control_owner: null });
    expect(savedShipments[0].mismatch_at).toBeGreaterThan(0);
    expect(savedShipments[0].mismatch_reason).toMatch(/Majburiy/);
  });

  it('allaqachon BeePost nazoratida -> hech narsa qilinmaydi', async () => {
    const cancelShipment = jest.fn();
    const { svc, orderUpdates } = buildSvc({
      order: { id: 'o-1', control_owner: null },
      cancelShipmentImpl: cancelShipment,
    });

    const res: any = await svc.reclaimControl('o-1');

    expect(res.reclaimed).toBe(true);
    expect(cancelShipment).not.toHaveBeenCalled();
    expect(orderUpdates).toHaveLength(0);
  });
});

describe('ElchiShipmentService — DARVOZA oldindan tekshiruvi (P5b)', () => {
  it('hammasi ruxsat etilgan -> bloklangan yo‘q', async () => {
    const { svc } = buildSvc({
      allowedDistricts: new Set(['d-1']),
      ordersForPreview: [
        { id: 'o-1', order_number: 1, district_id: 'd-1' },
        { id: 'o-2', order_number: 2, district_id: 'd-1' },
      ],
    });

    const res: any = await svc.previewGate(['o-1', 'o-2']);

    expect(res).toMatchObject({ total: 2, allowed: 2 });
    expect(res.blocked).toHaveLength(0);
  });

  // Oldindan tekshiruv XATO TASHLAMAYDI — u faqat ma'lumot. Operator
  // muammoni jo'natishdan OLDIN ko'radi.
  it('bloklanganlar ro‘yxat bo‘lib qaytadi (xato tashlanmaydi)', async () => {
    const { svc } = buildSvc({
      allowedDistricts: new Set(['d-1']),
      ordersForPreview: [
        { id: 'o-1', order_number: 1, district_id: 'd-1' },
        {
          id: 'o-2',
          order_number: 2,
          district_id: 'd-9',
          district: { name: 'Yunusobod' },
        },
      ],
    });

    const res: any = await svc.previewGate(['o-1', 'o-2']);

    expect(res.total).toBe(2);
    expect(res.allowed).toBe(1);
    expect(res.blocked).toEqual([
      { order_id: 'o-2', label: '#2', district_name: 'Yunusobod' },
    ]);
  });

  it('bo‘sh ro‘yxat -> so‘rov yuborilmaydi', async () => {
    const { svc } = buildSvc();
    const res: any = await svc.previewGate([]);
    expect(res).toEqual({ total: 0, allowed: 0, blocked: [] });
    expect(svc.orderRepo.find).not.toHaveBeenCalled();
  });

  // Oldindan tekshiruv va haqiqiy guard AYNI mantiqni ishlatishi shart —
  // aks holda UI "joyida" deb ko'rsatib, jo'natishda xato chiqardi.
  it('oldindan tekshiruv va guard bir xil natija beradi', async () => {
    const orders = [
      {
        id: 'o-1',
        order_number: 1,
        district_id: 'd-9',
        district: { name: 'X' },
      },
    ];
    const { svc } = buildSvc({
      allowedDistricts: new Set(['d-1']),
      ordersForPreview: orders,
    });

    const preview: any = await svc.previewGate(['o-1']);
    expect(preview.blocked).toHaveLength(1);

    await expect(svc.assertDistrictsAllowedForPost(orders)).rejects.toThrow(
      /#1 \(X\)/,
    );
  });
});

describe('ElchiShipmentService — jo‘natish holati (P5b)', () => {
  it('yetgan va yetmagan buyurtmalar sanaladi', async () => {
    const { svc } = buildSvc({
      shipmentsForPost: [
        {
          order_id: 'o-1',
          elchi_shipment_id: '9001',
          last_error: null,
          send_attempts: 1,
        },
        {
          order_id: 'o-2',
          elchi_shipment_id: null,
          last_error: 'Elchi 503',
          send_attempts: 2,
        },
        {
          order_id: 'o-3',
          elchi_shipment_id: '9003',
          last_error: null,
          send_attempts: 1,
        },
      ],
    });

    const res: any = await svc.getDispatchStatusForPost('p-1');

    expect(res).toMatchObject({ total: 3, delivered: 2, failed: 1 });
    // Xato matni UI'da ko'rsatiladi — operator sababni bilishi kerak.
    expect(res.items.find((i: any) => i.order_id === 'o-2').last_error).toBe(
      'Elchi 503',
    );
  });

  it('posilka yo‘q -> nollar', async () => {
    const { svc } = buildSvc({ shipmentsForPost: [] });
    const res: any = await svc.getDispatchStatusForPost('p-1');
    expect(res).toMatchObject({ total: 0, delivered: 0, failed: 0 });
  });
});

/**
 * YORLIQ TOKENI — ELCHI SKANERIDA ISHLASHI UCHUN (real sinovda topilgan bug).
 *
 * ⚠️ NIMA BUZILGAN EDI. `label_token` UMUMAN YUBORILMASDI. Elchi o'z
 * tasodifiy `qr_code_token` ini yaratardi, jismoniy yorliqda esa BIZNING
 * tokenimiz turardi. Elchi ning "Kiruvchi buyurtmalar" ekranida operator
 * qopdagi yorliqni skanerlaganda Elchi uni ro'yxatida topa OLMASDI va
 * "topilmadi" deb javob berardi — ya'ni posilkalarni skaner bilan qabul
 * qilish UMUMAN ishlamasdi.
 *
 * Mexanizm Elchi da allaqachon bor edi (`label_token` -> buyurtmaning
 * `qr_code_token` i), biz uzatmagandik.
 */
describe('⭐ createShipmentForOrder — yorliq tokeni (label_token)', () => {
  it('⭐ `label_token` = PCS yorliq tokeni yuboriladi', async () => {
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({ createShipmentImpl: createShipment });

    await svc.createShipmentForOrder('o-1');

    const body = createShipment.mock.calls[0][0];
    expect(body.label_token).toBe('PCS-LABEL-XYZ');
  });

  it('⭐ AYNI qiymat — bizning skanerimiz ham shuni izlaydi', async () => {
    /**
     * Boshqa qiymat yuborilsa muammo shunchaki ikkinchi tomonga ko'chardi:
     * Elchi skaneri ishlardi, bizniki esa yo'q.
     */
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({
      createShipmentImpl: createShipment,
      order: {
        id: 'o-1',
        order_number: 7,
        status: Order_status.RECEIVED,
        post_id: 'p-1',
        district_id: 'd-1',
        district: { name: 'Chilonzor' },
        where_deliver: Where_deliver.CENTER,
        to_be_paid: 0,
        total_price: 100000,
        customer: { name: 'Test', phone_number: '+998901112233' },
        items: [],
        qr_code_token: 'BOSHQA-TOKEN-999',
      },
    });

    await svc.createShipmentForOrder('o-1');

    expect(createShipment.mock.calls[0][0].label_token).toBe(
      'BOSHQA-TOKEN-999',
    );
  });

  it('token bo`sh bo`lsa `undefined` — bo`sh satr YUBORILMAYDI', async () => {
    /**
     * Bo'sh satr yuborilsa Elchi uni "token berilgan" deb qabul qilib,
     * noyoblik tekshiruvini bo'sh qiymat bo'yicha bajarardi va ikkinchi
     * posilkada 409 chiqardi. `undefined` esa "token yo'q" degani.
     */
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({
      createShipmentImpl: createShipment,
      order: {
        id: 'o-1',
        order_number: 8,
        status: Order_status.RECEIVED,
        post_id: 'p-1',
        district_id: 'd-1',
        district: { name: 'Chilonzor' },
        where_deliver: Where_deliver.CENTER,
        to_be_paid: 0,
        total_price: 100000,
        customer: { name: 'Test', phone_number: '+998901112233' },
        items: [],
        qr_code_token: '   ',
      },
    });

    await svc.createShipmentForOrder('o-1');

    expect(createShipment.mock.calls[0][0].label_token).toBeUndefined();
  });
});

/**
 * QOP (batch) MA'LUMOTI — Elchi kiruvchi ekranida guruhlash va qop
 * yorlig'ini skanerlash uchun.
 *
 * ⚠️ NEGA KERAK. Elchi operatori 12 posilkani BITTALAB skanerlashga majbur
 * edi, va "12 kelayotgan edi, 11 yetdi" holatini KO'RMASDI. Endi qop
 * ustidagi umumiy yorliq bitta skan bilan butun qopni qabul qiladi.
 */
describe('⭐ createShipmentForOrder — qop (batch) ma`lumoti', () => {
  const callBody = (mock: jest.Mock) => mock.mock.calls[0][0];

  it('⭐ `batch_label_token` = POCHTA stikeridagi token', async () => {
    /**
     * ⚠️ Aynan `post.qr_code_token` — bizning pochta stikerida chop
     * etiladigan token. Boshqa qiymat yuborilsa Elchi operatori
     * skanerlagan yorliq mos kelmasdi.
     */
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({
      createShipmentImpl: createShipment,
      order: {
        id: 'o-1',
        order_number: 11,
        status: Order_status.RECEIVED,
        post_id: 'post-77',
        post: { id: 'post-77', qr_code_token: 'QOP-STIKER-77' },
        district_id: 'd-1',
        district: { name: 'Chilonzor' },
        where_deliver: Where_deliver.CENTER,
        to_be_paid: 0,
        total_price: 100000,
        customer: { name: 'Test', phone_number: '+998901112233' },
        items: [],
        qr_code_token: 'PCS-LABEL-11',
      },
    });

    await svc.createShipmentForOrder('o-1', undefined, { size: 12 });

    const body = callBody(createShipment);
    expect(body.batch_label_token).toBe('QOP-STIKER-77');
    expect(body.batch_ref).toBe('post-77');
    expect(body.batch_size).toBe(12);
    // Posilka yorlig'i ALOHIDA maydon — ikkisi aralashmasligi kerak.
    expect(body.label_token).toBe('PCS-LABEL-11');
  });

  it('pochta tokeni yo`q bo`lsa `undefined` — bo`sh satr yuborilmaydi', async () => {
    /**
     * Bo'sh satr yuborilsa Elchi tomonida barcha qopsiz posilkalar BITTA
     * soxta qopga yig'ilib qolardi — va qop skani ularning hammasini
     * qabul qilib yuborardi.
     */
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({
      createShipmentImpl: createShipment,
      order: {
        id: 'o-1',
        order_number: 12,
        status: Order_status.RECEIVED,
        post_id: 'post-78',
        post: { id: 'post-78', qr_code_token: '   ' },
        district_id: 'd-1',
        district: { name: 'Chilonzor' },
        where_deliver: Where_deliver.CENTER,
        to_be_paid: 0,
        total_price: 100000,
        customer: { name: 'Test', phone_number: '+998901112233' },
        items: [],
        qr_code_token: 'PCS-LABEL-12',
      },
    });

    await svc.createShipmentForOrder('o-1', undefined, { size: 3 });

    expect(callBody(createShipment).batch_label_token).toBeUndefined();
    // `batch_ref` esa qoladi — guruhlash pochta id'si bilan ham ishlaydi.
    expect(callBody(createShipment).batch_ref).toBe('post-78');
  });

  it('⭐ qop hajmi berilmasa POCHTADAN sanaladi (qayta jo`natish yo`li)', async () => {
    /**
     * ⚠️ NEGA ZAXIRA KERAK. Asosiy yo'l (`dispatchOrdersToElchi`) hajmni
     * uzatadi, lekin QAYTA JO'NATISH bitta buyurtma bilan chaqiriladi va
     * hajmni BILMAYDI. Zaxira bo'lmasa o'sha buyurtma Elchi tomonida
     * `batch_size = null` bo'lib qolardi — bitta qopdagi buyurtmalar HAR
     * XIL hajm ko'rsatardi va "11/12" hisobi ishonchsiz bo'lardi.
     *
     * Bu real jo'natishda ko'rindi: `dispatch-retry` dan keyin Elchi
     * bazasida `external_batch_size` bo'sh qoldi.
     */
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({
      createShipmentImpl: createShipment,
      postOrderCount: 7,
    });

    await svc.createShipmentForOrder('o-1');

    expect(callBody(createShipment).batch_size).toBe(7);
  });

  it('BERILGAN hajm ustun — pochtadan sanalmaydi', async () => {
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({
      createShipmentImpl: createShipment,
      postOrderCount: 7,
    });

    await svc.createShipmentForOrder('o-1', undefined, { size: 12 });

    // Chaqiruvchi aytgan son ANIQROQ: u aynan jo'natilayotganlarni biladi.
    expect(callBody(createShipment).batch_size).toBe(12);
  });

  it('⭐ pochta bo`sh bo`lsa `undefined` — 0 YUBORILMAYDI', async () => {
    /**
     * 0 "qopda nol posilka" degan ma'noli da'vo bo'lardi va Elchi
     * "hech narsa yetmadi" deb ko'rsatardi.
     */
    const createShipment = jest.fn().mockResolvedValue({ shipment_id: '9001' });
    const { svc } = buildSvc({
      createShipmentImpl: createShipment,
      postOrderCount: 0,
    });

    await svc.createShipmentForOrder('o-1');

    expect(callBody(createShipment).batch_size).toBeUndefined();
  });
});
