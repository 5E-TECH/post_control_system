/// <reference types="jest" />
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  CarrierPublicController,
  readCarrierIdempotencyKey,
} from './carrier-public.controller';
import { CarrierService } from './carrier.service';
import { CarrierAccountService } from './carrier-account.service';
import { CarrierApiKeyGuard } from './guards/carrier-api-key.guard';
import { CarrierThrottlerGuard } from './guards/carrier-throttler.guard';
import { generateCarrierOpenApiDocument } from './carrier-openapi.offline';
import { CARRIER_SWAGGER_GUIDE } from './carrier-swagger';
import {
  CARRIER_ORDER_STATUS_EXAMPLES,
  CARRIER_UUID_RE,
} from './dto/carrier-public.dto';

/**
 * `POST /carrier/orders/{id}/status` — SWAGGER MISOLLARI QULFI.
 *
 * NEGA. Ega test Swagger'ini ochib, kompaniya "sotildi / bekor" ni qayerga
 * yuborishini sezmadi. Endi operatsiya sarlavhasi aniq va "Try it out" da
 * nomli misollar bor. Misol — tashqi dasturchi nusxa olib yuboradigan
 * birinchi so'rov: yaroqsiz misol (noma'lum maydon, kasr summa, izohsiz
 * `OTHER`, qatori tushib qolgan `partly_sold`) kompaniyani birinchi
 * qadamdayoq 400 ga uradi.
 *
 * Bu yerda STATIK SPEC'dagi (`generateCarrierOpenApiDocument` — repodagi
 * `docs/carrier-openapi.json` manbai) har bir misol endpointning AYNI
 * yo'lidan o'tkaziladi: HTTP → global ValidationPipe (`app.service.ts`
 * sozlamasi) → `CarrierExceptionFilter` → controller (id, `Idempotency-Key`
 * — Swagger'dagi misol kalit bilan) → HAQIQIY `CarrierService` kontrakt
 * shartlari (`OTHER` → izoh, butun `total_price`, `partly_sold` da har bir
 * qator, "faqat waiting", rollback "faqat sold/cancelled"). Chegaradagi
 * narsalar soxta: baza (buyurtma xotirada), PCS `OrderService` amallari,
 * idempotency daftari va kalit guard'i.
 *
 * Yangi misol qo'shilsa u ham avtomatik tekshiriladi; yaroqsiz bo'lsa test
 * qaysi misol va qaysi xabar bilan yiqilganini ko'rsatadi.
 */

const STATUS_PATH = '/carrier/orders/{id}/status';

const EXPECTED_SUMMARY =
  'Buyurtma holatini yuborish: sotildi (sold), qisman (partly_sold), bekor (cancelled), rollback';
const EXPECTED_DESCRIPTION_START =
  'Kuryeringiz posilkani topshirganda yoki topshira olmaganda shu so‘rovni yuboring — ' +
  'bizda buyurtma holati darhol o‘zgaradi. ';
const EXPECTED_EXAMPLES: Array<[string, string]> = [
  ['sold', 'Sotildi'],
  ['sold_exchange', 'Sotildi (almashtirish, eski tovar olindi)'],
  ['partly_sold', 'Qisman sotildi (har bir qator + sotilgan dona)'],
  ['cancelled', 'Bekor qilindi (mijoz rad etdi)'],
  ['cancelled_other', 'Bekor qilindi (boshqa sabab — izoh majburiy)'],
  ['rollback', 'Xato natijani bekor qilish (rollback)'],
];

const CARRIER = {
  id: '0d1e2f3a-4b5c-4d6e-8f9a-0b1c2d3e4f5a',
  name: 'BTS Express',
  courier_user_id: '11111111-2222-4333-8444-555555555555',
};
const ORDER_ID = '3f6c2a9e-8b1d-4c7e-9a2f-1d5b8e7c4a90';

/**
 * `partly_sold` misoli tasvirlagan buyurtma: 2 ta qator, har birida 1 dona,
 * summa 200 000 so'm. Misoldagi `order_item_id` lar shu qatorlar
 * (scan javobidagi `items[].id`).
 */
const EXAMPLE_ORDER_TOTAL = 200000;
const EXAMPLE_ORDER_ROWS = [
  {
    id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
    productId: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
    quantity: 1,
    created_at: 1,
  },
  {
    id: '8e4b1f7a-2c3d-4e5f-9a6b-7c8d9e0f1a2b',
    productId: '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e',
    quantity: 1,
    created_at: 2,
  },
];

/** Status → kontrakt qaysi PCS amaliga yo'naltirishi kerak. */
const PCS_ACTION: Record<string, string> = {
  sold: 'sellOrder',
  partly_sold: 'partlySold',
  cancelled: 'cancelOrder',
  rollback: 'rollbackOrderToWaiting',
};

type Body = Record<string, unknown>;
type FakeOrder = Record<string, unknown> & { id: string; status: string };

/**
 * Misol qaysi holatdagi buyurtmaga yuborilishi — misol mazmunidan:
 * rollback — xato `sold` qilingan buyurtma; `old_item_collected: true` —
 * eski tovarni olish shart bo'lgan almashtirish buyurtmasi; qolgani —
 * kompaniya qo'lidagi `waiting` buyurtma.
 */
function orderFor(body: Body): FakeOrder {
  return {
    id: ORDER_ID,
    status: body.status === 'rollback' ? 'sold' : 'waiting',
    parent_order_id: null,
    replacement_of_order_id:
      body.old_item_collected === true
        ? '7b2e4d3c-1a9f-4e6b-8c5d-2f3a4b5c6d7e'
        : null,
    replacement_state: null,
    total_price: EXAMPLE_ORDER_TOTAL,
    original_total_price: null,
    items: [],
  };
}

/** PCS `app.service.ts` dagi global ValidationPipe bilan bir xil sozlama. */
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
          message: errors.map((e) =>
            Object.values(e.constraints ?? {}).join(', '),
          ),
          error: "Ma'lumotlar validatsiyadan o'tmadi",
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
  });

type MediaType = {
  schema?: unknown;
  examples?: Record<string, { summary?: string; value?: unknown }>;
};
type StatusOperation = {
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: { type?: string; example?: unknown };
  }>;
  requestBody: { content: Record<string, MediaType> };
};

const statusOperation = (doc: OpenAPIObject): StatusOperation =>
  doc.paths[STATUS_PATH].post as unknown as StatusOperation;

describe('POST /carrier/orders/{id}/status — Swagger sarlavhasi va misollari', () => {
  let op: StatusOperation;
  let jsonExamples: Record<string, { summary?: string; value?: unknown }>;
  let headerExample: string;

  // Haqiqiy CarrierService uchun chegaradagi soxtalar (har so'rovda yangilanadi).
  let current: FakeOrder;
  /** PCS amali: buyurtma holatini o'zgartiradi (haqiqiy servis kabi). */
  const setStatus = (status: string) => () => {
    current.status = status;
    return Promise.resolve();
  };
  const orderService = {
    sellOrder: jest.fn(setStatus('sold')),
    partlySold: jest.fn(
      (_actor: unknown, _id: string, dto: { totalPrice: number }) => {
        current.original_total_price = current.total_price;
        current.total_price = dto.totalPrice;
        return setStatus('sold')();
      },
    ),
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
  /** `ownedOrders()` QueryBuilder zanjiri — natija `getOne` da (joriy buyurtma). */
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
  const service = new CarrierService(
    {
      createQueryBuilder: () => qb,
      find: () => Promise.resolve([]),
    } as never,
    {
      find: () =>
        Promise.resolve(EXAMPLE_ORDER_ROWS.map((row) => ({ ...row }))),
    } as never,
    {} as never,
    {} as never,
    orderService as never,
    {} as never,
    idempotency as never,
    { log: () => Promise.resolve() } as never,
  );
  let app: INestApplication;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const doc = await generateCarrierOpenApiDocument();
    op = statusOperation(doc);
    jsonExamples = op.requestBody.content['application/json'].examples ?? {};
    const header = (op.parameters ?? []).find(
      (p) => p.in === 'header' && p.name === 'Idempotency-Key',
    );
    expect(header?.schema?.example).toBeUndefined();
    headerExample = '3f1c2a9e-8b7d-4c21-9f0a-5d6e7b8c9a10';

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
          req.carrier = CARRIER;
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

  type Sent = {
    status: number;
    message: unknown;
    pcsCalls: string[];
  };

  /** Misolni Swagger "Try it out" kabi yuboradi (JSON + misol kalit). */
  async function send(body: Body): Promise<Sent> {
    current = orderFor(body);
    for (const mock of [
      ...Object.values(orderService),
      ...Object.values(idempotency),
    ]) {
      mock.mockClear();
    }
    const res = await request(app.getHttpServer() as App)
      .post(`/api/v1/carrier/orders/${ORDER_ID}/status`)
      .set('Idempotency-Key', headerExample)
      .send(body);
    const pcsCalls = Object.entries(orderService)
      .filter(([, mock]) => mock.mock.calls.length > 0)
      .map(([name]) => name);
    return {
      status: res.status,
      message: (res.body as { message?: unknown }).message,
      pcsCalls,
    };
  }

  describe('hujjat', () => {
    it('⭐ summary — aniq matn (operatsiyalar ro‘yxatida darhol ko‘rinsin)', () => {
      expect(op.summary).toBe(EXPECTED_SUMMARY);
    });

    it('description yangi gap bilan boshlanadi, avvalgi matn va multipart isbot saqlangan', () => {
      expect(op.description?.startsWith(EXPECTED_DESCRIPTION_START)).toBe(true);
      expect(op.description).toContain(
        '`sold`, `partly_sold`, `cancelled` — faqat `waiting` holatida',
      );
      expect(op.description).toContain(
        'Isbot — `multipart/form-data` bilan `proof` fayli',
      );
    });

    it('⭐ JSON misollari: kalitlar, tartib va sarlavhalar aynan', () => {
      expect(
        Object.entries(jsonExamples).map(([key, ex]) => [key, ex.summary]),
      ).toEqual(EXPECTED_EXAMPLES);
      // Statik spec'dagi misollar — koddagi yagona manbaning o'zi.
      expect(jsonExamples).toEqual(
        JSON.parse(JSON.stringify(CARRIER_ORDER_STATUS_EXAMPLES)),
      );
    });

    it('partly_sold misoli: 2 qatorli buyurtmaning HAR BIR qatori, butun summa', () => {
      const value = jsonExamples.partly_sold?.value as {
        total_price: unknown;
        items: Array<{ order_item_id: string; quantity: number }>;
      };
      expect(Number.isInteger(value.total_price)).toBe(true);
      expect(value.items.map((item) => item.order_item_id)).toEqual(
        EXAMPLE_ORDER_ROWS.map((row) => row.id),
      );
      expect(value.items.map((item) => item.quantity)).toEqual([1, 0]);
    });

    it('misollar faqat application/json da; multipart sxemasi o‘zgarmagan (proof binary)', () => {
      const multipart = op.requestBody.content['multipart/form-data'];
      expect(multipart.examples).toBeUndefined();
      expect(JSON.stringify(multipart.schema)).toContain('"format":"binary"');
      expect(op.requestBody.content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/CarrierOrderStatusRequestDto',
      });
    });

    it('Idempotency-Key: majburiy, tavsifli, oldindan to‘ldirilmaydi va controller UUID ni qabul qiladi', () => {
      const header = (op.parameters ?? []).find(
        (p) => p.in === 'header' && p.name === 'Idempotency-Key',
      );
      expect(header?.required).toBe(true);
      expect(header?.description).toContain('YANGI kalit');
      expect(header?.description).toContain('YANGI UUID');
      // Doimiy misol kalit har sinovda takrorlanib 422/409 berardi.
      expect(header?.schema).toEqual({ type: 'string' });
      expect(headerExample).toMatch(CARRIER_UUID_RE);
      expect(
        readCarrierIdempotencyKey({ 'idempotency-key': headerExample }),
      ).toBe(headerExample);
    });

    it('qo‘llanma tepasida qisqa ish tartibi — holat yuborish 2-qadam', () => {
      const flow = CARRIER_SWAGGER_GUIDE.indexOf('## Ish tartibi (qisqa)');
      expect(flow).toBeGreaterThan(0);
      expect(flow).toBeLessThan(CARRIER_SWAGGER_GUIDE.indexOf('## 1. Kirish'));
      const section = CARRIER_SWAGGER_GUIDE.slice(
        flow,
        CARRIER_SWAGGER_GUIDE.indexOf('## 1. Kirish'),
      );
      expect(section).toContain('1. `POST /carrier/scan`');
      expect(section).toContain('2. **`POST /carrier/orders/{id}/status`**');
      expect(section).toContain('3. `POST /carrier/returns`');
      expect(section).toContain('4. `GET /carrier/cashbox`');
    });

    it('test ValidationPipe sozlamasi app.service.ts dagi global pipe bilan bir xil', () => {
      const bootstrap = fs.readFileSync(
        path.join(__dirname, '../app.service.ts'),
        'utf8',
      );
      const start = bootstrap.indexOf('new ValidationPipe({');
      expect(start).toBeGreaterThanOrEqual(0);
      const block = bootstrap.slice(
        start,
        bootstrap.indexOf('exceptionFactory', start),
      );
      expect(block).toContain('whitelist: true');
      expect(block).toContain('forbidNonWhitelisted: true');
      expect(block).toContain('transform: true');
      expect(block).toContain('HttpStatus.UNPROCESSABLE_ENTITY');
    });
  });

  describe('har bir misol endpoint validatsiyasidan o‘tadi', () => {
    it('⭐ Swagger’dagi BARCHA misollar → 200 va kerakli PCS amali (yaroqsiz misol bu yerda yiqiladi)', async () => {
      const keys = Object.keys(jsonExamples);
      expect(keys.length).toBeGreaterThan(0);
      const results: Record<string, string> = {};
      const expected: Record<string, string> = {};
      for (const key of keys) {
        const body = jsonExamples[key].value as Body;
        const sent = await send(body);
        results[key] =
          sent.status === 200
            ? `200 ${sent.pcsCalls.join(',')}`
            : `${sent.status} ${JSON.stringify(sent.message)}`;
        expected[key] = `200 ${PCS_ACTION[String(body.status)]}`;
      }
      expect(results).toEqual(expected);
      expect(idempotency.fail).not.toHaveBeenCalled();
    });
  });

  describe('qulf bo‘sh emas: shu yo‘l yaroqsiz misolni rad etadi', () => {
    const [row1, row2] = EXAMPLE_ORDER_ROWS;
    const partly = (over: Body): Body => ({
      status: 'partly_sold',
      total_price: 150000,
      items: [
        { order_item_id: row1.id, quantity: 1 },
        { order_item_id: row2.id, quantity: 0 },
      ],
      ...over,
    });

    it.each<[string, Body, string]>([
      [
        'noma’lum maydon (forbidNonWhitelisted)',
        { status: 'sold', extraCost: 5000 },
        'extraCost should not exist',
      ],
      ['noma’lum status', { status: 'delivered' }, 'status must be one of'],
      [
        'cancelled — reason yo‘q',
        { status: 'cancelled' },
        'reason must be one of',
      ],
      [
        'OTHER — izohsiz',
        { status: 'cancelled', reason: 'OTHER' },
        'izoh (comment) majburiy',
      ],
      [
        'OTHER — bo‘sh izoh',
        { status: 'cancelled', reason: 'OTHER', comment: '  ' },
        'izoh (comment) majburiy',
      ],
      [
        'partly_sold — total_price yo‘q',
        partly({ total_price: undefined }),
        'total_price must be a number',
      ],
      [
        'partly_sold — items yo‘q',
        partly({ items: undefined }),
        'items must be an array',
      ],
      [
        'partly_sold — kasr total_price',
        partly({ total_price: 150000.5 }),
        "total_price manfiy bo'lmagan butun son",
      ],
      [
        'partly_sold — buyurtma summasidan katta',
        partly({ total_price: 250000 }),
        'buyurtma summasidan',
      ],
      [
        'partly_sold — bir qator tushib qolgan',
        partly({ items: [{ order_item_id: row1.id, quantity: 1 }] }),
        `Product not found in request: ${row2.productId}`,
      ],
      [
        'partly_sold — qatordan ko‘p dona',
        partly({
          items: [
            { order_item_id: row1.id, quantity: 2 },
            { order_item_id: row2.id, quantity: 0 },
          ],
        }),
        'Quantity cannot exceed original amount',
      ],
      [
        'partly_sold — hech narsa kamaymagan (bu sold)',
        partly({
          items: [
            { order_item_id: row1.id, quantity: 1 },
            { order_item_id: row2.id, quantity: 1 },
          ],
        }),
        'kamida bitta mahsulot soni kamaytirilishi kerak',
      ],
    ])('%s → 400, PCS chaqirilmaydi', async (_name, body, reason) => {
      const sent = await send(body);
      expect(sent.status).toBe(400);
      expect(JSON.stringify(sent.message)).toContain(reason);
      expect(sent.pcsCalls).toEqual([]);
    });
  });
});
