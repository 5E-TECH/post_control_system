/// <reference types="jest" />
import 'reflect-metadata';
import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CarrierPublicController } from './carrier-public.controller';
import { CarrierService } from './carrier.service';
import { CarrierAccountService } from './carrier-account.service';
import { CarrierApiKeyGuard } from './guards/carrier-api-key.guard';
import { CarrierThrottlerGuard } from './guards/carrier-throttler.guard';
import {
  CarrierRollbackGateInterceptor,
  stripDisabledRollback,
} from './carrier-rollback-gate.interceptor';
import {
  CARRIER_PUBLIC_ORDER_STATUSES,
  CARRIER_STATUS_INVALID_MESSAGE,
  CarrierOrderStatus,
} from './dto/carrier-public.dto';
import {
  CreateCarrierAccountDto,
  UpdateCarrierAccountDto,
} from './dto/carrier-admin.dto';

/**
 * YASHIRIN ROLLBACK — akkaunt bo'yicha yoqiladi, SUKUT O'CHIQ (ega
 * qarori 2026-11-14).
 *
 * Kontrakt (Elchi bilan bir xil):
 *   - o'chiq akkaunt `status: "rollback"` uchun noma'lum status qiymati
 *     oladigan javobning O'ZINI oladi: 400, ayni xabar (faqat `sold,
 *     partly_sold, cancelled`), `code` yo'q — va HECH QANDAY yon ta'sirsiz
 *     (egalik o'qilmaydi, Idempotency-Key band qilinmaydi, PCS amali yo'q);
 *   - yoqilgan akkauntda rollback avvalgidek ishlaydi;
 *   - har qanday boshqa validatsiya xabari ham rollback'ni sanamaydi;
 *   - o'zgarish keyingi so'rovdayoq kuchga kiradi (guard kesh qilmaydi).
 *
 * HTTP yo'li haqiqiy: global ValidationPipe (`app.service.ts` sozlamasi) →
 * `CarrierExceptionFilter` → controller (multer + gate) → HAQIQIY
 * `CarrierService`. Soxta — baza (buyurtma xotirada), PCS amallari,
 * idempotentlik daftari va kalit guard'i (bayroqni testdan oladi).
 */

const CARRIER_BASE = {
  id: '0d1e2f3a-4b5c-4d6e-8f9a-0b1c2d3e4f5a',
  name: 'BTS Express',
  courier_user_id: '11111111-2222-4333-8444-555555555555',
};
const ORDER_ID = '3f6c2a9e-8b1d-4c7e-9a2f-1d5b8e7c4a90';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** `app.service.ts` dagi global ValidationPipe bilan bir xil. */
const pcsValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    transform: true,
    exceptionFactory: (errors) =>
      new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: errors.map((e) => {
            const c = Object.values(e.constraints ?? {});
            return c.length ? c.join(', ') : `${e.property} - noto'g'ri qiymat`;
          }),
          error: "Ma'lumotlar validatsiyadan o'tmadi",
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
  });

describe('stripDisabledRollback — darvoza (sof funksiya)', () => {
  const run = (body: unknown, carrier?: unknown) => {
    const req = { body, carrier } as Parameters<
      typeof stripDisabledRollback
    >[0];
    return { removed: stripDisabledRollback(req), body: req?.body };
  };

  it('o‘chiq / bayroqsiz / principal yo‘q — `status` olib tashlanadi (fail-closed)', () => {
    for (const carrier of [
      { rollback_enabled: false },
      {},
      undefined,
      { rollback_enabled: 'true' },
      { rollback_enabled: 1 },
    ]) {
      const { removed, body } = run(
        { status: 'rollback', comment: 'x' },
        carrier,
      );
      expect(removed).toBe(true);
      expect(body).toEqual({ comment: 'x' });
    }
  });

  it('multipart tanasi (prototipsiz obyekt) ham', () => {
    const multipart = Object.assign(Object.create(null) as object, {
      status: 'rollback',
    });
    expect(run(multipart, { rollback_enabled: false }).removed).toBe(true);
    expect('status' in multipart).toBe(false);
  });

  it('yoqilgan akkaunt yoki boshqa qiymat — tegilmaydi', () => {
    expect(
      run({ status: 'rollback' }, { rollback_enabled: true }).body,
    ).toEqual({ status: 'rollback' });
    for (const status of [
      'sold',
      'partly_sold',
      'cancelled',
      'ROLLBACK',
      ' rollback',
      ['rollback'],
    ]) {
      const { removed, body } = run({ status }, { rollback_enabled: false });
      expect(removed).toBe(false);
      expect(body).toEqual({ status });
    }
    for (const body of [undefined, null, 'rollback', ['rollback']]) {
      expect(run(body, { rollback_enabled: false }).removed).toBe(false);
    }
  });
});

describe('controller ulanishi', () => {
  it('⭐ gate FAQAT holat endpointida, multer (FileInterceptor) dan KEYIN', () => {
    const handler = Object.getOwnPropertyDescriptor(
      CarrierPublicController.prototype,
      'updateStatus',
    )?.value as object;
    const interceptors = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      handler,
    ) as unknown[];
    expect(interceptors).toHaveLength(2);
    expect(interceptors[1]).toBe(CarrierRollbackGateInterceptor);
    expect(interceptors[0]).not.toBe(CarrierRollbackGateInterceptor);

    for (const name of ['scan', 'returns', 'listOrders', 'cashbox', 'ping']) {
      const other = Object.getOwnPropertyDescriptor(
        CarrierPublicController.prototype,
        name,
      )?.value as object;
      expect(Reflect.getMetadata(INTERCEPTORS_METADATA, other)).toBeUndefined();
    }
  });

  it('ochiq statuslar va xabar — rollback yo‘q', () => {
    expect([...CARRIER_PUBLIC_ORDER_STATUSES]).toEqual([
      'sold',
      'partly_sold',
      'cancelled',
    ]);
    expect(CARRIER_STATUS_INVALID_MESSAGE).toBe(
      'status must be one of the following values: sold, partly_sold, cancelled',
    );
    expect(CARRIER_STATUS_INVALID_MESSAGE.toLowerCase()).not.toContain(
      'rollback',
    );
  });
});

describe('POST /carrier/orders/:id/status — yashirin rollback (HTTP)', () => {
  /** Guard har so'rovda shu qiymatni beradi — admin o'zgartirishi kabi. */
  let rollbackEnabled = false;

  let current: { id: string; status: string } & Record<string, unknown>;
  const setStatus = (status: string) => () => {
    current.status = status;
    return Promise.resolve();
  };
  const orderService = {
    sellOrder: jest.fn(setStatus('sold')),
    partlySold: jest.fn(setStatus('sold')),
    cancelOrder: jest.fn(setStatus('cancelled')),
    rollbackOrderToWaiting: jest.fn(setStatus('waiting')),
  };
  const idempotency = {
    acquire: jest.fn(() =>
      Promise.resolve({
        kind: 'acquired' as const,
        id: 'lease-1',
        keyHash: '0123456789abcdef0123',
        takeover: false,
        priorAttemptMayHaveRun: false,
      }),
    ),
    complete: jest.fn(() => Promise.resolve()),
    fail: jest.fn(() => Promise.resolve()),
  };
  const qb: unknown = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'then') return undefined;
        if (prop === 'getOne') return () => Promise.resolve({ ...current });
        return () => qb;
      },
    },
  );
  const orderRepo = {
    createQueryBuilder: jest.fn(() => qb),
    find: jest.fn(() => Promise.resolve([])),
  };
  const activityLog = { log: jest.fn(() => Promise.resolve()) };
  const service = new CarrierService(
    orderRepo as never,
    { find: () => Promise.resolve([]) } as never,
    {} as never,
    {} as never,
    orderService as never,
    {} as never,
    idempotency as never,
    activityLog as never,
  );
  let app: INestApplication;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1_000_000 }])],
      controllers: [CarrierPublicController],
      providers: [
        CarrierThrottlerGuard,
        { provide: CarrierService, useValue: service },
        { provide: CarrierAccountService, useValue: {} },
      ],
    })
      .overrideGuard(CarrierApiKeyGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context
            .switchToHttp()
            .getRequest<{ carrier?: unknown }>();
          req.carrier = { ...CARRIER_BASE, rollback_enabled: rollbackEnabled };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(pcsValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    rollbackEnabled = false;
    current = {
      id: ORDER_ID,
      status: 'sold',
      parent_order_id: null,
      replacement_of_order_id: null,
      replacement_state: null,
      total_price: 200000,
      original_total_price: null,
      items: [],
    };
    for (const mock of [
      ...Object.values(orderService),
      ...Object.values(idempotency),
      orderRepo.createQueryBuilder,
      activityLog.log,
    ]) {
      mock.mockClear();
    }
  });

  type Sent = { status: number; body: Record<string, unknown> };

  const post = (
    body: Record<string, unknown>,
    opts: { key?: string | null; id?: string } = {},
  ) => {
    const r = request(app.getHttpServer() as App).post(
      `/api/v1/carrier/orders/${opts.id ?? ORDER_ID}/status`,
    );
    if (opts.key !== null) r.set('Idempotency-Key', opts.key ?? 'key-1');
    return r.send(body);
  };

  const multipart = (status: string) =>
    request(app.getHttpServer() as App)
      .post(`/api/v1/carrier/orders/${ORDER_ID}/status`)
      .set('Idempotency-Key', 'key-mp')
      .field('status', status)
      .attach('proof', PNG, { filename: 'p.png', contentType: 'image/png' });

  const sent = async (r: request.Test): Promise<Sent> => {
    const res = await r;
    return { status: res.status, body: res.body as Record<string, unknown> };
  };

  /** Javobning kompaniya ko'radigan qismi (`trace_id` har safar yangi). */
  const visible = (s: Sent) => ({
    status: s.status,
    keys: Object.keys(s.body).sort(),
    statusCode: s.body.statusCode,
    message: s.body.message,
    code: s.body.code,
  });

  const expectNoSideEffects = () => {
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(idempotency.acquire).not.toHaveBeenCalled();
    expect(idempotency.complete).not.toHaveBeenCalled();
    expect(idempotency.fail).not.toHaveBeenCalled();
    for (const fn of Object.values(orderService)) {
      expect(fn).not.toHaveBeenCalled();
    }
    expect(activityLog.log).not.toHaveBeenCalled();
    expect(current.status).toBe('sold');
  };

  it('⭐ o‘chiq: rollback javobi noma’lum status javobi bilan AYNAN bir xil, yon ta’sir yo‘q', async () => {
    const unknown = await sent(post({ status: 'delivered' }));
    const hidden = await sent(post({ status: 'rollback' }));
    expect(visible(hidden)).toEqual(visible(unknown));
    expect(visible(hidden)).toEqual({
      status: 400,
      keys: ['message', 'statusCode', 'trace_id'],
      statusCode: 400,
      message: CARRIER_STATUS_INVALID_MESSAGE,
      code: undefined,
    });
    expectNoSideEffects();
  });

  it('o‘chiq: boshqa maydon xatolari bilan birlashgan xabar ham AYNI (rollback "taniladigan" bo‘lib qolmaydi)', async () => {
    const extra = { comment: 'x'.repeat(1001), extraCost: 5000 };
    const unknown = await sent(post({ status: 'sould', ...extra }));
    const hidden = await sent(post({ status: 'rollback', ...extra }));
    expect(visible(hidden)).toEqual(visible(unknown));
    expect(String(hidden.body.message)).toContain(
      CARRIER_STATUS_INVALID_MESSAGE,
    );
    expect(String(hidden.body.message)).toContain('comment');
    expectNoSideEffects();
  });

  it('o‘chiq: Idempotency-Key yo‘q yoki id noto‘g‘ri bo‘lsa ham — noma’lum statusdagidek (validatsiya birinchi)', async () => {
    for (const opts of [{ key: null }, { id: 'not-a-uuid' }]) {
      const unknown = await sent(post({ status: 'delivered' }, opts));
      const hidden = await sent(post({ status: 'rollback' }, opts));
      expect(visible(hidden)).toEqual(visible(unknown));
      expect(hidden.body.message).toBe(CARRIER_STATUS_INVALID_MESSAGE);
    }
    expectNoSideEffects();
  });

  it('o‘chiq: multipart + isbot fayli — ayni javob ("rollback uchun proof kerak emas" EMAS)', async () => {
    const unknown = await sent(multipart('delivered'));
    const hidden = await sent(multipart('rollback'));
    expect(visible(hidden)).toEqual(visible(unknown));
    expect(hidden.body.message).toBe(CARRIER_STATUS_INVALID_MESSAGE);
    expectNoSideEffects();
  });

  it('⭐ har qanday holatda typo xabari faqat sold, partly_sold, cancelled ni sanaydi', async () => {
    for (const enabled of [false, true]) {
      rollbackEnabled = enabled;
      for (const status of ['sould', 'ROLLBACK', 'roll back', '']) {
        const res = await sent(post({ status }));
        expect(res.status).toBe(400);
        expect(res.body.message).toBe(CARRIER_STATUS_INVALID_MESSAGE);
        expect(JSON.stringify(res.body).toLowerCase()).not.toContain(
          'rollback',
        );
      }
      const missing = await sent(post({ comment: 'x' }));
      expect(missing.body.message).toBe(CARRIER_STATUS_INVALID_MESSAGE);
    }
    expectNoSideEffects();
  });

  it('yoqilgan: rollback avvalgidek — 200, rollbackOrderToWaiting, kalit daftari ishlaydi', async () => {
    rollbackEnabled = true;
    const res = await sent(post({ status: 'rollback' }));
    expect(res.status).toBe(200);
    expect(orderService.rollbackOrderToWaiting).toHaveBeenCalledTimes(1);
    expect(idempotency.acquire).toHaveBeenCalledWith(
      expect.objectContaining({ action: CarrierOrderStatus.ROLLBACK }),
    );
    expect(current.status).toBe('waiting');
  });

  it('yoqilgan: rollback’da isbot — avvalgi xabar (imkoniyat ochiq bo‘lgani uchun)', async () => {
    rollbackEnabled = true;
    const res = await sent(multipart('rollback'));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('rollback uchun proof kerak emas');
    expect(orderService.rollbackOrderToWaiting).not.toHaveBeenCalled();
  });

  it('⭐ o‘zgarish KEYINGI so‘rovdayoq kuchga kiradi (kesh yo‘q): yoqildi → 200, o‘chirildi → 400', async () => {
    rollbackEnabled = true;
    expect(
      (await sent(post({ status: 'rollback' }, { key: 'a' }))).status,
    ).toBe(200);
    current.status = 'sold';
    rollbackEnabled = false;
    const off = await sent(post({ status: 'rollback' }, { key: 'b' }));
    expect(off.status).toBe(400);
    expect(off.body.message).toBe(CARRIER_STATUS_INVALID_MESSAGE);
    expect(orderService.rollbackOrderToWaiting).toHaveBeenCalledTimes(1);
  });

  it('o‘chiq akkaunt oddiy sotuvni avvalgidek bajaradi', async () => {
    current.status = 'waiting';
    const res = await sent(post({ status: 'sold' }));
    expect(res.status).toBe(200);
    expect(orderService.sellOrder).toHaveBeenCalledTimes(1);
  });
});

describe('admin DTO — rollback_enabled faqat PATCH da', () => {
  /** Global ValidationPipe bilan bir xil (`whitelist` + `forbidNonWhitelisted`, implicit konversiyasiz). */
  const check = async <T extends object>(cls: new () => T, body: object) => {
    const errors = await validate(plainToInstance(cls, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return errors.map((e) => e.property);
  };
  const COURIER = '22222222-2222-4222-8222-222222222222';

  it('⭐ yaratishda — noma’lum maydon (rad etiladi, sukut doim false)', async () => {
    for (const value of [true, false]) {
      expect(
        await check(CreateCarrierAccountDto, {
          name: 'BTS',
          courier_id: COURIER,
          rollback_enabled: value,
        }),
      ).toEqual(['rollback_enabled']);
    }
    expect(
      await check(CreateCarrierAccountDto, {
        name: 'BTS',
        courier_id: COURIER,
      }),
    ).toEqual([]);
  });

  it('PATCH: yolg‘iz yoki name/ip_allowlist bilan; faqat boolean', async () => {
    for (const body of [
      { rollback_enabled: true },
      { rollback_enabled: false },
      { name: 'BTS', rollback_enabled: true },
      { ip_allowlist: ['203.0.113.10'], rollback_enabled: false },
    ]) {
      expect(await check(UpdateCarrierAccountDto, body)).toEqual([]);
    }
    // `null` ni `@IsOptional` o'tkazadi — servis uni 400 bilan rad etadi
    // (carrier-account.service.spec.ts).
    for (const value of ['true', 1, 'yes', {}]) {
      expect(
        await check(UpdateCarrierAccountDto, { rollback_enabled: value }),
      ).toEqual(['rollback_enabled']);
    }
  });
});
