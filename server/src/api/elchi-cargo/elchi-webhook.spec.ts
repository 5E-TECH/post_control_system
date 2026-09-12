/// <reference types="jest" />
import { createHmac } from 'crypto';
import { ElchiWebhookService } from './elchi-webhook.service';

/**
 * P4 — Elchi webhookini qabul qilish.
 *
 * Eng muhim invariantlar:
 *   - imzo XOM tana ustidan tekshiriladi, xato bo'lsa 401 va holat TEGILMAYDI;
 *   - takror himoyasi `event_id` bo'yicha (status bo'yicha EMAS — bir status
 *     qayta yuz berishi mumkin);
 *   - oldingi urinish `failed` bo'lsa QAYTA ISHLASHGA ruxsat (aks holda
 *     vaqtinchalik xato hodisani abadiy yo'q qilardi);
 *   - integratsiya o'chirilgan bo'lsa 200 qaytadi (Elchi cheksiz urinmasin),
 *     lekin buyurtma tegilmaydi.
 */
const SECRET = 'topsecret';
const sign = (body: string) =>
  createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');

function buildSvc(over: {
  config?: unknown;
  shipment?: Record<string, unknown> | null;
  existingLog?: Record<string, unknown> | null;
  logSaveError?: unknown;
  terminal?: Record<string, jest.Mock>;
} = {}) {
  const savedLogs: any[] = [];
  const logUpdates: any[] = [];
  const savedShipments: any[] = [];
  const svc: any = Object.create(ElchiWebhookService.prototype);

  svc.configRepo = {
    findOne: jest.fn().mockResolvedValue(
      over.config === undefined
        ? {
            id: 'cfg',
            is_active: true,
            webhook_enabled: true,
            webhook_secret: SECRET,
            webhook_secret_previous: null,
            elchi_courier_user_id: 'c-elchi',
          }
        : over.config,
    ),
  };
  svc.shipmentRepo = {
    findOne: jest.fn().mockResolvedValue(
      over.shipment === undefined
        ? { id: 's-1', order_id: 'o-1', elchi_shipment_id: '9001' }
        : over.shipment,
    ),
    save: jest.fn((x: any) => {
      savedShipments.push({ ...x });
      return Promise.resolve(x);
    }),
  };
  svc.logRepo = {
    create: jest.fn((x: unknown) => ({ ...(x as object) })),
    save: jest.fn((x: any) => {
      if (over.logSaveError) return Promise.reject(over.logSaveError);
      savedLogs.push({ ...x });
      return Promise.resolve(x);
    }),
    findOne: jest.fn().mockResolvedValue(over.existingLog ?? null),
    update: jest.fn((where: any, patch: any) => {
      logUpdates.push({ where, patch });
      return Promise.resolve({ affected: 1 });
    }),
  };
  svc.orderService = {
    markDeliveredByElchi:
      over.terminal?.markDeliveredByElchi ??
      jest.fn().mockResolvedValue({ kind: 'applied' }),
    markCancelledByElchi:
      over.terminal?.markCancelledByElchi ??
      jest.fn().mockResolvedValue({ kind: 'applied' }),
    markReturnedByElchi:
      over.terminal?.markReturnedByElchi ??
      jest.fn().mockResolvedValue({ kind: 'applied' }),
  };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  return { svc, savedLogs, logUpdates, savedShipments };
}

const payload = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    event: 'shipment.status_changed',
    event_id: 'ev-1',
    external_order_id: 'o-1',
    shipment_id: '9001',
    status: 'sold',
    cod_collected: 240000,
    ...over,
  });

describe('ElchiWebhookService — imzo', () => {
  it("imzo xato -> 401 va buyurtma TEGILMAYDI", async () => {
    const { svc, savedLogs } = buildSvc();
    const body = payload();

    const res = await svc.process({
      rawBody: body,
      signatureHeader: 'deadbeef',
    });

    expect(res.http_status).toBe(401);
    expect(svc.orderService.markDeliveredByElchi).not.toHaveBeenCalled();
    expect(savedLogs[0]).toMatchObject({
      status: 'invalid_signature',
      signature_valid: false,
    });
  });

  it("sozlama yo'q -> 200, hech narsa qilinmaydi", async () => {
    const { svc } = buildSvc({ config: null });
    const res = await svc.process({ rawBody: payload(), signatureHeader: 'x' });
    expect(res.http_status).toBe(200);
    expect(svc.orderService.markDeliveredByElchi).not.toHaveBeenCalled();
  });

  // Elchi 2xx bo'lmasa cheksiz qayta yuboradi — o'chirilgan holatda 200 berish
  // ATAYLAB, lekin buyurtma tegilmaydi.
  it("integratsiya o'chirilgan -> 200 (skipped), buyurtma tegilmaydi", async () => {
    const { svc, savedLogs } = buildSvc({
      config: {
        id: 'cfg',
        is_active: false,
        webhook_enabled: true,
        webhook_secret: SECRET,
        elchi_courier_user_id: 'c-elchi',
      },
    });
    const body = payload();

    const res = await svc.process({
      rawBody: body,
      signatureHeader: sign(body),
    });

    expect(res.http_status).toBe(200);
    expect(savedLogs[0].status).toBe('skipped');
    expect(svc.orderService.markDeliveredByElchi).not.toHaveBeenCalled();
  });
});

describe('ElchiWebhookService — takror himoyasi', () => {
  const uniqueViolation = { code: '23505' };

  it("ayni event_id ikkinchi marta -> TAKROR (200, amal bajarilmaydi)", async () => {
    const { svc } = buildSvc({
      logSaveError: uniqueViolation,
      existingLog: { event_id: 'ev-1', status: 'success' },
    });
    const body = payload();

    const res = await svc.process({
      rawBody: body,
      signatureHeader: sign(body),
    });

    expect(res.message).toMatch(/Takror/);
    expect(svc.orderService.markDeliveredByElchi).not.toHaveBeenCalled();
  });

  // MUHIM: vaqtinchalik xato hodisani ABADIY yo'q qilmasligi kerak.
  it("oldingi urinish 'failed' bo'lsa -> QAYTA ishlanadi", async () => {
    const { svc } = buildSvc({
      logSaveError: uniqueViolation,
      existingLog: { event_id: 'ev-1', status: 'failed' },
    });
    const body = payload();

    const res = await svc.process({
      rawBody: body,
      signatureHeader: sign(body),
    });

    expect(res.http_status).toBe(200);
    expect(svc.orderService.markDeliveredByElchi).toHaveBeenCalledTimes(1);
  });

  it("event_id yo'q -> xom tana hashidan zaxira kalit yasaydi", async () => {
    const { svc, savedLogs } = buildSvc();
    const body = payload({ event_id: undefined });

    await svc.process({ rawBody: body, signatureHeader: sign(body) });

    expect(savedLogs[0].event_id).toMatch(/^syn_[0-9a-f]{48}$/);
    expect(savedLogs[0].synthesized_key).toBe(true);
    expect(svc.logger.warn).toHaveBeenCalled();
  });
});

describe('ElchiWebhookService — statusni qo‘llash', () => {
  it("sold -> sotuv oqimi + narx/xarajat uzatiladi", async () => {
    const { svc, savedShipments, logUpdates } = buildSvc();
    const body = payload();

    const res = await svc.process({
      rawBody: body,
      signatureHeader: sign(body),
    });

    expect(res.http_status).toBe(200);
    /**
     * 4-argument — Elchi tomonidagi YAKUNIY narx va qo'shimcha xarajat.
     * Ular berilsa PCS sotishdan oldin o'z narxini tenglashtiradi va
     * xarajatni marketdan yechadi; aks holda eski narx bo'yicha xato summa
     * yozilardi. Bu payloadda ular yo'q, shuning uchun `undefined`.
     */
    expect(svc.orderService.markDeliveredByElchi).toHaveBeenCalledWith(
      'o-1',
      'c-elchi',
      240000,
      { totalPrice: undefined, extraCost: undefined },
    );
    // `cod_collected` — Elchi marketga to'lab bergan qism; faqat qayd etamiz.
    expect(savedShipments[0].cod_collected_reported).toBe('240000.00');
    expect(savedShipments[0].elchi_status).toBe('sold');
    expect(logUpdates[0].patch.status).toBe('success');
  });

  it('cancelled -> bekor qilish oqimi', async () => {
    const { svc } = buildSvc();
    const body = payload({ status: 'cancelled' });
    await svc.process({ rawBody: body, signatureHeader: sign(body) });
    expect(svc.orderService.markCancelledByElchi).toHaveBeenCalledWith(
      'o-1',
      'c-elchi',
    );
  });

  it('returned_to_market -> qaytarish oqimi (CLOSED EMAS)', async () => {
    const { svc } = buildSvc();
    const body = payload({ status: 'returned_to_market' });
    await svc.process({ rawBody: body, signatureHeader: sign(body) });
    expect(svc.orderService.markReturnedByElchi).toHaveBeenCalledWith(
      'o-1',
      'c-elchi',
    );
  });

  // Oraliq status buyurtma holatiga TEGMAYDI — faqat posilkada qayd etiladi.
  it('oraliq status -> terminal amal chaqirilmaydi', async () => {
    const { svc, savedShipments } = buildSvc();
    const body = payload({ status: 'on the road' });

    const res = await svc.process({
      rawBody: body,
      signatureHeader: sign(body),
    });

    expect(res.message).toMatch(/Oraliq status/);
    expect(svc.orderService.markDeliveredByElchi).not.toHaveBeenCalled();
    expect(savedShipments[0].elchi_status).toBe('on the road');
  });

  it("`closed` -> e'tiborga olinmaydi", async () => {
    const { svc, logUpdates } = buildSvc();
    const body = payload({ status: 'closed' });

    await svc.process({ rawBody: body, signatureHeader: sign(body) });

    expect(svc.orderService.markDeliveredByElchi).not.toHaveBeenCalled();
    expect(logUpdates[0].patch.status).toBe('skipped');
  });

  it("posilka topilmadi -> skipped (xato emas)", async () => {
    const { svc, logUpdates } = buildSvc({ shipment: null });
    const body = payload();

    const res = await svc.process({
      rawBody: body,
      signatureHeader: sign(body),
    });

    expect(res.http_status).toBe(200);
    expect(logUpdates[0].patch.status).toBe('skipped');
  });

  it("Elchi id'si bog'lanmagan posilka -> BACKFILL qilinadi", async () => {
    const { svc, savedShipments } = buildSvc({
      shipment: { id: 's-1', order_id: 'o-1', elchi_shipment_id: null },
    });
    const body = payload();

    await svc.process({ rawBody: body, signatureHeader: sign(body) });

    expect(savedShipments[0].elchi_shipment_id).toBe('9001');
  });

  it('NOMUVOFIQLIK -> posilkaga belgilanadi (admin paneli topadi)', async () => {
    const { svc, savedShipments } = buildSvc({
      terminal: {
        markDeliveredByElchi: jest.fn().mockResolvedValue({
          kind: 'mismatch',
          reason: 'bizda bekor qilingan',
        }),
      },
    });
    const body = payload();

    const res = await svc.process({
      rawBody: body,
      signatureHeader: sign(body),
    });

    expect(res.http_status).toBe(200);
    const last = savedShipments[savedShipments.length - 1];
    expect(last.mismatch_at).toBeGreaterThan(0);
    expect(last.mismatch_reason).toMatch(/bekor qilingan/);
  });

  it("vakil-kuryer biriktirilmagan -> failed (terminal amal bajarilmaydi)", async () => {
    const { svc, logUpdates } = buildSvc({
      config: {
        id: 'cfg',
        is_active: true,
        webhook_enabled: true,
        webhook_secret: SECRET,
        elchi_courier_user_id: null,
      },
    });
    const body = payload();

    await svc.process({ rawBody: body, signatureHeader: sign(body) });

    expect(svc.orderService.markDeliveredByElchi).not.toHaveBeenCalled();
    expect(logUpdates[0].patch.status).toBe('failed');
  });

  // Elchi outboxi 2xx bo'lmasa qayta yuboradi — vaqtinchalik xatoda 500 TO'G'RI.
  it('terminal amal xato tashlasa -> 500 va jurnal `failed`', async () => {
    const { svc, logUpdates } = buildSvc({
      terminal: {
        markDeliveredByElchi: jest
          .fn()
          .mockRejectedValue(new Error('DB timeout')),
      },
    });
    const body = payload();

    const res = await svc.process({
      rawBody: body,
      signatureHeader: sign(body),
    });

    expect(res.http_status).toBe(500);
    expect(logUpdates[0].patch.status).toBe('failed');
    expect(logUpdates[0].patch.error_message).toMatch(/DB timeout/);
  });
});
