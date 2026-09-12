/// <reference types="jest" />
import { ElchiReconcileService } from './elchi-reconcile.service';

/**
 * P5 — solishtiruvchi (reconcile) CRON.
 *
 * NEGA MAJBURIY: Elchi webhookni outbox orqali yuboradi va 4 urinishdan keyin
 * BOSHQA HECH QACHON urinmaydi. Tarmoq uzilishi yoki deploy oynasi webhookni
 * butunlay yo'q qilishi mumkin — bunday buyurtma bizda abadiy "kutilmoqda"da
 * qolib, pul esa Elchi'da yig'ilgan bo'lardi.
 *
 * Qulflanadigan invariantlar:
 *   - kill-switch o'chirilgan bo'lsa hech qanday so'rov YUBORILMAYDI;
 *   - status o'zgarmasa ham `last_synced_at` YANGILANADI (aylanish kafolati);
 *   - xato bo'lgan posilka navbatni BLOKLAMAYDI;
 *   - `cod_collected` solishtiruvdan HAM yuboriladi (Elchi `GET`ga qo'shildi);
 *   - PUL NOMUVOFIQLIGI (narx / tarif farqi) sotuvda TUTILADI;
 *   - hammasi mos bo'lsa SOXTA nomuvofiqlik chiqmaydi;
 *   - qo'llash mantiqi webhook bilan AYNI (`applyStatusUpdate`).
 */
function buildSvc(over: {
  config?: unknown;
  shipments?: Array<Record<string, unknown>>;
  remoteStatus?: string | ((id: string) => string);
  getShipmentImpl?: jest.Mock;
  applyImpl?: jest.Mock;
  order?: Record<string, unknown> | null;
  courier?: Record<string, unknown> | null;
} = {}) {
  const touched: string[] = [];
  const applyCalls: any[] = [];
  const svc: any = Object.create(ElchiReconcileService.prototype);

  const qb: any = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    limit: jest.fn(() => qb),
    getMany: jest.fn(() => Promise.resolve(over.shipments ?? [])),
  };

  svc.configRepo = {
    findOne: jest.fn().mockResolvedValue(
      over.config === undefined
        ? {
            id: 'cfg',
            is_active: true,
            reconcile_enabled: true,
            elchi_courier_user_id: 'c-1',
          }
        : over.config,
    ),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
  };
  svc.shipmentRepo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn().mockResolvedValue(over.shipments?.[0] ?? null),
    update: jest.fn((where: any) => {
      touched.push(where.id);
      return Promise.resolve({ affected: 1 });
    }),
  };
  svc.orderRepo = {
    findOne: jest.fn().mockResolvedValue(
      over.order === undefined
        ? {
            id: 'o-1',
            order_number: 100001,
            total_price: 500000,
            where_deliver: 'center',
          }
        : over.order,
    ),
  };
  svc.userRepo = {
    findOne: jest.fn().mockResolvedValue(
      over.courier === undefined
        ? { id: 'c-1', tariff_center: 15000, tariff_home: 25000 }
        : over.courier,
    ),
  };
  svc.api = {
    getShipment:
      over.getShipmentImpl ??
      jest.fn((id: string) =>
        Promise.resolve({
          shipment_id: id,
          status:
            typeof over.remoteStatus === 'function'
              ? over.remoteStatus(id)
              : (over.remoteStatus ?? 'sold'),
        }),
      ),
  };
  svc.webhookService = {
    applyStatusUpdate:
      over.applyImpl ??
      jest.fn((cfg: unknown, payload: unknown) => {
        applyCalls.push(payload);
        return Promise.resolve({ status: 'success', message: 'qo‘llanildi' });
      }),
  };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  svc.running = false;

  return {
    svc,
    touched,
    applyCalls,
    qb,
    svcShipmentUpdate: svc.shipmentRepo.update as jest.Mock,
  };
}

const shipment = (over: Record<string, unknown> = {}) => ({
  id: 's-1',
  order_id: 'o-1',
  elchi_shipment_id: '9001',
  elchi_status: 'on the road',
  ...over,
});

describe('ElchiReconcileService — kill switch', () => {
  it("sozlama yo'q -> so'rov yubormaydi", async () => {
    const { svc } = buildSvc({ config: null });
    const res = await svc.reconcileBatch();
    expect(res.checked).toBe(0);
    expect(svc.api.getShipment).not.toHaveBeenCalled();
  });

  it("master kalit o'chirilgan -> so'rov yubormaydi", async () => {
    const { svc } = buildSvc({
      config: { id: 'cfg', is_active: false, reconcile_enabled: true },
      shipments: [shipment()],
    });
    const res = await svc.reconcileBatch();
    expect(res.checked).toBe(0);
    expect(svc.api.getShipment).not.toHaveBeenCalled();
  });

  it("solishtirish alohida o'chirilgan -> so'rov yubormaydi", async () => {
    const { svc } = buildSvc({
      config: { id: 'cfg', is_active: true, reconcile_enabled: false },
      shipments: [shipment()],
    });
    const res = await svc.reconcileBatch();
    expect(res.checked).toBe(0);
    expect(svc.api.getShipment).not.toHaveBeenCalled();
  });
});

describe('ElchiReconcileService — solishtirish', () => {
  it("status o'zgargan -> webhook bilan AYNI mantiq chaqiriladi", async () => {
    const { svc, applyCalls, touched } = buildSvc({
      shipments: [shipment()],
      remoteStatus: 'sold',
    });

    const res = await svc.reconcileBatch();

    expect(res.applied).toBe(1);
    expect(applyCalls).toHaveLength(1);
    expect(applyCalls[0]).toMatchObject({
      external_order_id: 'o-1',
      shipment_id: '9001',
      status: 'sold',
    });
    expect(touched).toContain('s-1');
  });

  /**
   * Ilgari bu test `cod_collected` YUBORILMASLIGINI talab qilardi, chunki
   * `GET` javobida bunday maydon yo'q edi va `cod_amount` boshqa miqdor edi.
   * Endi Elchi `GET`ga alohida `cod_collected` qo'shildi — shuning uchun
   * invariant TESKARI: u uzatilishi kerak.
   */
  it('cod_collected solishtiruvdan HAM uzatiladi', async () => {
    const { svc, applyCalls } = buildSvc({
      shipments: [shipment()],
      getShipmentImpl: jest.fn().mockResolvedValue({
        shipment_id: '9001',
        status: 'sold',
        cod_amount: 485000,
        cod_collected: 120000,
        total_price: 500000,
      }),
    });

    await svc.reconcileBatch();

    expect(applyCalls[0].cod_collected).toBe(120000);
  });

  // AYLANISH KAFOLATI: status o'zgarmasa ham belgi yangilanadi, aks holda
  // tartib o'zgarmay ayni posilkalar qayta-qayta tekshirilardi.
  it("status o'zgarmagan -> qo'llanmaydi, lekin last_synced_at YANGILANADI", async () => {
    const { svc, applyCalls, touched } = buildSvc({
      shipments: [shipment({ elchi_status: 'sold' })],
      remoteStatus: 'sold',
    });

    const res = await svc.reconcileBatch();

    expect(res.unchanged).toBe(1);
    expect(applyCalls).toHaveLength(0);
    expect(touched).toContain('s-1');
  });

  it("status normalizatsiya bilan solishtiriladi (SOLD == sold)", async () => {
    const { svc, applyCalls } = buildSvc({
      shipments: [shipment({ elchi_status: 'SOLD' })],
      remoteStatus: '  sold ',
    });

    const res = await svc.reconcileBatch();

    expect(res.unchanged).toBe(1);
    expect(applyCalls).toHaveLength(0);
  });

  it("Elchi status qaytarmasa -> tegilmaydi, belgi yangilanadi", async () => {
    const { svc, applyCalls, touched } = buildSvc({
      shipments: [shipment()],
      remoteStatus: '',
    });

    const res = await svc.reconcileBatch();

    expect(res.unchanged).toBe(1);
    expect(applyCalls).toHaveLength(0);
    expect(touched).toContain('s-1');
  });

  // Bitta muammoli posilka navbatni bloklab qo'ymasligi kerak.
  it("bitta posilka xato bersa -> qolganlari tekshirilishda davom etadi", async () => {
    const { svc, touched } = buildSvc({
      shipments: [shipment({ id: 's-1' }), shipment({ id: 's-2', order_id: 'o-2' })],
      getShipmentImpl: jest.fn((id: string) => {
        void id;
        return Promise.reject(new Error('Elchi 500'));
      }),
    });

    const res = await svc.reconcileBatch();

    expect(res.checked).toBe(2);
    expect(res.failed).toBe(2);
    // Xato bo'lsa HAM belgi yangilanadi — aks holda navbat bloklanardi.
    expect(touched).toEqual(expect.arrayContaining(['s-1', 's-2']));
  });

  it('nomuvofiqlik alohida hisoblanadi', async () => {
    const { svc } = buildSvc({
      shipments: [shipment()],
      applyImpl: jest.fn().mockResolvedValue({
        status: 'success',
        message: 'Nomuvofiqlik qayd etildi: bizda bekor qilingan',
        note: 'bizda bekor qilingan',
      }),
    });

    const res = await svc.reconcileBatch();

    expect(res.mismatched).toBe(1);
    expect(res.applied).toBe(0);
  });

  it("posilka yo'q -> hech narsa qilinmaydi", async () => {
    const { svc } = buildSvc({ shipments: [] });
    const res = await svc.reconcileBatch();
    expect(res).toMatchObject({ checked: 0, applied: 0, failed: 0 });
    expect(svc.configRepo.save).not.toHaveBeenCalled();
  });
});

describe('ElchiReconcileService — bitta posilkani sinxronlash', () => {
  it("Elchi'da bog'lanmagan posilka -> tekshirilmaydi", async () => {
    const { svc } = buildSvc({ shipments: [] });
    svc.shipmentRepo.findOne = jest
      .fn()
      .mockResolvedValue({ id: 's-1', order_id: 'o-1', elchi_shipment_id: null });

    const res = await svc.reconcileOne('o-1');

    expect(res.checked).toBe(false);
    expect(svc.api.getShipment).not.toHaveBeenCalled();
  });

  it("bog'langan posilka -> tekshiriladi", async () => {
    const { svc, applyCalls } = buildSvc({
      shipments: [shipment()],
      remoteStatus: 'cancelled',
    });
    svc.shipmentRepo.findOne = jest.fn().mockResolvedValue(shipment());

    const res = await svc.reconcileOne('o-1');

    expect(res.checked).toBe(true);
    expect(res.outcome).toBe('applied');
    expect(applyCalls[0].status).toBe('cancelled');
  });
});

describe('ElchiReconcileService — CRON', () => {
  it("ustma-ust tik -> ikkinchisi o'tkazib yuboriladi", async () => {
    const { svc } = buildSvc({ shipments: [] });
    svc.running = true;

    await svc.scheduledReconcile();

    expect(svc.configRepo.findOne).not.toHaveBeenCalled();
    expect(svc.logger.warn).toHaveBeenCalled();
  });

  it('xato bo‘lsa CRON yiqilmaydi va qulf bo‘shatiladi', async () => {
    const { svc } = buildSvc({ shipments: [] });
    svc.configRepo.findOne = jest.fn().mockRejectedValue(new Error('DB down'));

    await expect(svc.scheduledReconcile()).resolves.toBeUndefined();
    expect(svc.logger.error).toHaveBeenCalled();
    expect(svc.running).toBe(false);
  });
});

/**
 * PUL NOMUVOFIQLIGI.
 *
 * Sotuvda bizda kuryer kassasiga `total_price − bizdagi_Elchi_tarifi` yoziladi,
 * Elchi esa `total_price − O'ZINING_tarifi` ni bizga qarz deb yozadi. Ikki
 * tarif ajralsa, farq HAR BUYURTMADA jimgina yo'qoladi va hech qaysi ekranda
 * ko'rinmaydi — ikkala tomon ham o'zicha "to'g'ri" hisoblaydi.
 *
 * Eng muhim talab: hammasi mos bo'lganda SOXTA nomuvofiqlik CHIQMASLIGI.
 * Soxta ogohlantirish tez orada e'tiborsiz qoldiriladi va keyin haqiqiysi ham
 * ko'rinmay ketadi.
 */
describe('ElchiReconcileService — pul nomuvofiqligi', () => {
  const sold = (over: Record<string, unknown> = {}) => ({
    shipment_id: '9001',
    status: 'sold',
    total_price: 500000,
    cod_amount: 485000, // 500000 − 15000 (markaz tarifi) — MOS
    cod_collected: 0,
    ...over,
  });

  const ship = () => ({
    id: 's-1',
    order_id: 'o-1',
    elchi_shipment_id: '9001',
    elchi_status: 'waiting',
    cod_amount_sent: '500000.00',
  });

  it("TC1: hammasi mos -> SOXTA nomuvofiqlik YO'Q", async () => {
    const { svc } = buildSvc({
      shipments: [ship()],
      getShipmentImpl: jest.fn().mockResolvedValue(sold()),
    });

    const res = await svc.reconcileBatch();

    expect(res.mismatched).toBe(0);
    expect(res.applied).toBe(1);
  });

  it('TC2: Elchi tarifini oshirgan -> TUTILADI', async () => {
    // Elchi 20000 ushlab qoldi (bizda tarif 15000) -> har buyurtmada 5000
    // jimgina yo'qolardi.
    const { svc, svcShipmentUpdate } = buildSvc({
      shipments: [ship()],
      getShipmentImpl: jest.fn().mockResolvedValue(sold({ cod_amount: 480000 })),
    });

    const res = await svc.reconcileBatch();

    expect(res.mismatched).toBe(1);
    const patch = svcShipmentUpdate.mock.calls.at(-1)?.[1];
    expect(patch.mismatch_at).toBeGreaterThan(0);
    expect(patch.mismatch_reason).toMatch(/tarif farqi/);
    expect(patch.mismatch_reason).toContain('20000');
    expect(patch.mismatch_reason).toContain('15000');
  });

  it("TC3: Elchi tomonda NARX o'zgargan -> TUTILADI", async () => {
    const { svc, svcShipmentUpdate } = buildSvc({
      shipments: [ship()],
      getShipmentImpl: jest
        .fn()
        .mockResolvedValue(sold({ total_price: 400000, cod_amount: 385000 })),
    });

    const res = await svc.reconcileBatch();

    expect(res.mismatched).toBe(1);
    const patch = svcShipmentUpdate.mock.calls.at(-1)?.[1];
    expect(patch.mismatch_reason).toMatch(/narx farqi/);
  });

  it('TC4: uyga yetkazishda UY tarifi olinadi', async () => {
    // where_deliver=address -> tariff_home=25000. 500000−25000=475000 MOS.
    const { svc } = buildSvc({
      shipments: [ship()],
      order: {
        id: 'o-1',
        order_number: 100001,
        total_price: 500000,
        where_deliver: 'address',
      },
      getShipmentImpl: jest.fn().mockResolvedValue(sold({ cod_amount: 475000 })),
    });

    const res = await svc.reconcileBatch();

    expect(res.mismatched).toBe(0);
  });

  it("TC5: SOTILMAGAN posilkada tarif tekshirilMAYDI (soxta oldini olish)", async () => {
    // ⭐ Sotuvgacha `to_be_paid` to'liq COD ga teng — tarif hali ushlanmagan.
    // Bu holatda (B) tekshiruvini qo'llasak, HAR BIR yo'ldagi posilka
    // "tarif farqi 0 != 15000" deb nomuvofiq bo'lib chiqardi.
    const { svc } = buildSvc({
      shipments: [ship()],
      getShipmentImpl: jest.fn().mockResolvedValue({
        shipment_id: '9001',
        status: 'on the road',
        total_price: 500000,
        cod_amount: 500000,
      }),
    });

    const res = await svc.reconcileBatch();

    expect(res.mismatched).toBe(0);
  });

  it("TC6: kuryer/tarif yo'q -> tekshiruv O'TKAZIB YUBORILADI", async () => {
    // Ma'lumot yetarli bo'lmasa jim qolish kerak — taxminga asoslangan
    // ogohlantirish soxta bo'ladi.
    const { svc } = buildSvc({
      shipments: [ship()],
      courier: null,
      getShipmentImpl: jest.fn().mockResolvedValue(sold({ cod_amount: 1 })),
    });

    const res = await svc.reconcileBatch();

    expect(res.mismatched).toBe(0);
  });

  it("TC7: Elchi summa qaytarmasa -> tekshiruv O'TKAZIB YUBORILADI", async () => {
    const { svc } = buildSvc({
      shipments: [ship()],
      getShipmentImpl: jest
        .fn()
        .mockResolvedValue({ shipment_id: '9001', status: 'sold' }),
    });

    const res = await svc.reconcileBatch();

    expect(res.mismatched).toBe(0);
  });
});
