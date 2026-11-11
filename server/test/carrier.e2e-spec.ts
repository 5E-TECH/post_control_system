/**
 * CARRIER API — UCHDAN-UCHGA SINOV (`/api/v1/carrier/*`).
 *
 * HAQIQIY stend: haqiqiy Postgres (`pcs_e2e`), haqiqiy Nest ilovasi
 * (AppModule to'liq) va `app.service.ts` dagi bilan bir xil global sozlama
 * (`api/v1` prefiksi, ValidationPipe, AllExceptionsFilter, `trust proxy
 * 'loopback'`, helmet, carrier Swagger). Seed'da faqat bazaviy ma'lumot
 * (`test/carrier-e2e-seed.sql`); akkaunt, buyurtma, pochta, jo'natish
 * (`sendPost` — kuryer tarifi muzlatilishi bilan) HTTP orqali yaratiladi.
 *
 * Pul tekshiruvlari bazadan MUSTAQIL o'qiladi (`cash_box`,
 * `cashbox_history`) — javob ko'rinishiga ishonib qolinmaydi.
 *
 * Ishga tushirish: `npm run test:carrier-e2e`
 * (scripts/local/run-carrier-e2e.sh — baza, migratsiya, seed, env).
 */
import {
  HttpException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import * as express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import request from 'supertest';
import { AppModule } from 'src/api/app.module';
import { AllExceptionsFilter } from 'src/infrastructure/lib/exception/all.exception.filter';
import { requestContextMiddleware } from 'src/common/middleware/request-context.middleware';
import { CarrierModule } from 'src/api/carrier/carrier.module';
import { setupCarrierSwagger } from 'src/api/carrier/carrier-swagger';
import config from 'src/config';
import { CARRIER_COURIER_LOGIN_MESSAGE } from 'src/api/carrier/carrier-account.service';
import { getBotToken } from 'nestjs-telegraf';

jest.setTimeout(180_000);

// ── Seed'dagi barqaror ID'lar (test/carrier-e2e-seed.sql bilan bir xil) ──
const ADMIN_PHONE = '+998900100003';
const ADMIN_PASSWORD = 'e2e-carrier-admin-pass';
const REGION_ID = 'c1000000-0000-4000-8000-000000000001';
const DISTRICT_ID = 'c1000000-0000-4000-8000-000000000002';
const MARKET_ID = 'c1000000-0000-4000-8000-000000000004';
const CUSTOMER_ID = 'c1000000-0000-4000-8000-000000000005';
const INHOUSE_COURIER_ID = 'c1000000-0000-4000-8000-000000000006';
const CARRIER_COURIER_ID = 'c1000000-0000-4000-8000-000000000007';
const CARRIER_COURIER_2_ID = 'c1000000-0000-4000-8000-000000000008';
const PRODUCT_1 = 'c1000000-0000-4000-8000-000000000011';
const PRODUCT_2 = 'c1000000-0000-4000-8000-000000000012';

/** Carrier kuryerining HUDUD tarifi (markaz) — `sendPost` shuni muzlatishi kerak. */
const FROZEN_CENTER_TARIFF = 12_000;
const ORDER_TOTAL = 300_000;
const PARTLY_PRICE = 200_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let app: INestApplication;
let http: ReturnType<typeof request>;
let ds: DataSource;
let adminToken: string;

let accountId: string;
let carrierKey: string;
let account2Id: string;
let carrier2Key: string;

/** Sinov buyurtmalari (HTTP orqali yaratiladi). */
const ord: Record<string, { id: string; qr: string }> = {};
/** Faqat `on the road` da qoladigan to'ldiruvchi buyurtmalar (ro'yxat sahifalash uchun). */
const fillerIds: string[] = [];

// ═══════════════════ yordamchilar ═══════════════════

const q = async <T = any>(sql: string, params: unknown[] = []): Promise<T[]> =>
  ds.query(sql, params);

const asAdmin = (r: request.Test) =>
  r.set('Authorization', `Bearer ${adminToken}`);

const withKey = (r: request.Test, key: string | null = carrierKey) =>
  key === null ? r : r.set('X-Api-Key', key);

const ping = (key: string | null = carrierKey) =>
  withKey(http.get('/api/v1/carrier/ping'), key);

const scan = (qr_token: unknown, key: string | null = carrierKey) =>
  withKey(http.post('/api/v1/carrier/scan'), key).send({ qr_token });

const setStatus = (
  orderId: string,
  body: Record<string, unknown>,
  idemKey: string | null,
  key: string | null = carrierKey,
) => {
  const r = withKey(http.post(`/api/v1/carrier/orders/${orderId}/status`), key);
  if (idemKey !== null) r.set('Idempotency-Key', idemKey);
  return r.send(body);
};

const returns = (order_ids: unknown, key: string | null = carrierKey) =>
  withKey(http.post('/api/v1/carrier/returns'), key).send({ order_ids });

const listOrders = (query: Record<string, string | number> = {}) =>
  withKey(http.get('/api/v1/carrier/orders')).query(query);

const cashboxReq = (query: Record<string, string> = {}) =>
  withKey(http.get('/api/v1/carrier/cashbox')).query(query);

/** A buyurtmasining birinchi sotuv kaliti — 8-bo'limda "eskirgan kalit" sifatida qaytadi. */
const SOLD_KEY = `sold-A-${Date.now()}`;
const SOLD_BODY = { status: 'sold', comment: 'Mijoz oldi' };

let keySeq = 0;
const newIdemKey = () => `e2e-${Date.now()}-${++keySeq}`;

/**
 * KONTRAKT XATO SHAKLI: `{ statusCode, message, code?, trace_id }` +
 * `X-Trace-Id` sarlavhasi `trace_id` bilan bir xil.
 */
function expectCarrierError(
  res: request.Response,
  status: number,
  code?: string,
) {
  if (res.status !== status) {
    // eslint-disable-next-line no-console
    console.error(
      `KUTILGAN ${status}, KELDI ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  expect(res.status).toBe(status);
  expect(res.body.statusCode).toBe(status);
  expect(typeof res.body.message).toBe('string');
  expect(res.body.message.length).toBeGreaterThan(0);
  expect(res.body.trace_id).toMatch(UUID_RE);
  expect(res.headers['x-trace-id']).toBe(res.body.trace_id);
  if (code) expect(res.body.code).toBe(code);
  else expect(res.body.code).toBeUndefined();
}

function expectOk(res: request.Response, status = 200) {
  if (res.status !== status) {
    // eslint-disable-next-line no-console
    console.error(
      `KUTILGAN ${status}, KELDI ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  expect(res.status).toBe(status);
}

const courierBalance = async (
  courierId = CARRIER_COURIER_ID,
): Promise<number> => {
  const [row] = await q(
    `SELECT balance FROM cash_box WHERE user_id = $1 AND cashbox_type = 'couriers'`,
    [courierId],
  );
  return Number(row?.balance ?? NaN);
};

const courierHistory = async (
  orderId: string,
  courierId = CARRIER_COURIER_ID,
) =>
  q<{
    operation_type: string;
    source_type: string;
    amount: string;
    balance_after: string;
  }>(
    `SELECT h.operation_type, h.source_type, h.amount, h.balance_after
       FROM cashbox_history h
       JOIN cash_box c ON c.id = h.cashbox_id
      WHERE c.user_id = $1 AND c.cashbox_type = 'couriers' AND h.source_id = $2
      ORDER BY h.created_at ASC, h.id ASC`,
    [courierId, orderId],
  );

/**
 * Audit yozuvi (`ActivityLogService.log`) javobdan KEYIN yoziladi (PCS
 * naqshi: fire-and-forget) — shuning uchun qisqa kutish bilan o'qiladi.
 */
async function waitForCarrierLog(orderId: string, action: string) {
  for (let i = 0; i < 40; i++) {
    const [row] = await q(
      `SELECT action, metadata FROM activity_logs WHERE entity_type = 'order' AND entity_id = $1 AND action = $2`,
      [orderId, action],
    );
    if (row) return row;
    await new Promise((r) => setTimeout(r, 50));
  }
  return undefined;
}

const orderRow = async (id: string) => {
  const [row] = await q(`SELECT * FROM "order" WHERE id = $1`, [id]);
  return row;
};

/** Toshkent kuni (YYYY-MM-DD) — `from`/`to` filtrlar uchun. */
const tashkentDay = (offsetDays = 0) =>
  new Date(Date.now() + 5 * 3600_000 + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** Admin buyurtma yaratadi (HTTP) → `new`. */
async function createOrder(
  items: Array<{ product_id: string; quantity: number }>,
  total = ORDER_TOTAL,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await asAdmin(http.post('/api/v1/order')).send({
    market_id: MARKET_ID,
    customer_id: CUSTOMER_ID,
    order_item_info: items,
    total_price: total,
    where_deliver: 'center',
    district_id: DISTRICT_ID,
    comment: 'e2e',
    ...extra,
  });
  expectOk(res, 201);
  const id = res.body?.data?.id;
  expect(id).toMatch(UUID_RE);
  return id;
}

/** Buyurtmalarni omborga qabul qilish (HTTP) → `received`, hudud pochtasiga. */
async function receiveOrders(ids: string[]): Promise<string> {
  const res = await asAdmin(http.post('/api/v1/order/receive')).send({
    order_ids: ids,
  });
  expectOk(res, 201);
  const [row] = await q(`SELECT post_id FROM "order" WHERE id = $1`, [ids[0]]);
  expect(row.post_id).toMatch(UUID_RE);
  return row.post_id;
}

/** Pochtani kuryerga jo'natish (HAQIQIY `sendPost`) → `on the road`. */
async function sendPost(postId: string, orderIds: string[], courierId: string) {
  const res = await asAdmin(http.patch(`/api/v1/post/${postId}`)).send({
    orderIds,
    courierId,
  });
  expectOk(res, 200);
}

const TWO_ITEMS = [
  { product_id: PRODUCT_1, quantity: 2 },
  { product_id: PRODUCT_2, quantity: 1 },
];

/**
 * Yangi buyurtmalar: yaratish → ombor → `sendPost` (`courierId` ga). Natija
 * `ord[name]` ga yoziladi; qaytadi — yuborilgan pochta id.
 */
async function dispatch(
  names: string[],
  courierId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  for (const name of names) {
    ord[name] = {
      id: await createOrder(TWO_ITEMS, ORDER_TOTAL, extra),
      qr: '',
    };
  }
  const ids = names.map((n) => ord[n].id);
  const newPostId = await receiveOrders(ids);
  await sendPost(newPostId, ids, courierId);
  for (const name of names) {
    const row = await orderRow(ord[name].id);
    expect(row.status).toBe('on the road');
    ord[name].qr = row.qr_code_token;
  }
  return (await orderRow(ord[names[0]].id)).post_id;
}

/** Multipart (`multipart/form-data`) status so'rovi — isbot fayli bilan. */
function multipartStatus(
  orderId: string,
  fields: Array<[string, string]>,
  idemKey: string,
  proof?: { buffer: Buffer; filename: string; contentType: string },
) {
  let r = withKey(http.post(`/api/v1/carrier/orders/${orderId}/status`)).set(
    'Idempotency-Key',
    idemKey,
  );
  for (const [name, value] of fields) r = r.field(name, value);
  if (proof) {
    r = r.attach('proof', proof.buffer, {
      filename: proof.filename,
      contentType: proof.contentType,
    });
  }
  return r;
}

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// ═══════════════════ stend ═══════════════════

beforeAll(async () => {
  // Faqat alohida e2e bazasi — dev/prod bazaga hech qachon tegilmaydi.
  expect(process.env.DB_URL).toMatch(/\/[^/?]*e2e[^/?]*(\?|$)/);
  // Bot tokeni soxta bo'lishi SHART (haqiqiysi bilan PROD boti ishga tushardi).
  expect(process.env.BOT_TOKEN ?? '').not.toMatch(/^\d{8,}:/);
  expect(process.env.ORDER_BOT_TOKEN ?? '').not.toMatch(/^\d{8,}:/);
  expect(config.BOTS_ENABLED).toBe(false);

  process.on('unhandledRejection', () => undefined);

  /**
   * ⚠️ TELEGRAM BOTLARI STUB BILAN (marketplace e2e bilan bir xil naqsh).
   *
   * `BOTS_ENABLED=false` da bot ishga tushirilmaydi, lekin `app.close()`
   * da `nestjs-telegraf` baribir `bot.stop()` ni chaqiradi va u "Bot is not
   * running!" deb XATO otadi — qolgan yopish hook'lari (TypeORM pool, HTTP
   * server) bajarilmay qoladi va jest jarayoni tugamaydi. Stub — Proxy:
   * har qanday metod chaqiruvi `undefined` qaytaradi.
   */
  const botStub: any = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then') return undefined; // await qilinsa promise deb o'ylamasin
        return new Proxy(() => undefined, {
          get: () => () => undefined,
          apply: () => undefined,
        });
      },
    },
  );

  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getBotToken(config.BOT_NAME))
    .useValue(botStub)
    .overrideProvider(getBotToken(config.ORDER_BOT_NAME))
    .useValue(botStub)
    .compile();
  app = mod.createNestApplication<NestExpressApplication>({
    bufferLogs: false,
  });

  // ── app.service.ts bilan BIR XIL global sozlama ──
  (app as NestExpressApplication).set('trust proxy', 'loopback');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());
  app.use(requestContextMiddleware);
  app.useGlobalPipes(
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
              return c.length
                ? c.join(', ')
                : `${e.property} - noto'g'ri qiymat`;
            }),
            error: "Ma'lumotlar validatsiyadan o'tmadi",
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        ),
    }),
  );
  app.setGlobalPrefix('api/v1');
  expect(setupCarrierSwagger(app, { include: [CarrierModule] })).toBe(
    'mounted',
  );
  await app.init();

  http = request(app.getHttpServer());
  ds = app.get(DataSource);

  const login = await http
    .post('/api/v1/user/signin')
    .send({ phone_number: ADMIN_PHONE, password: ADMIN_PASSWORD });
  expectOk(login, 201);
  adminToken = login.body?.data?.access_token;
  expect(adminToken).toBeTruthy();
});

afterAll(async () => {
  // Yopish xatosi yutilmaydi: yarim yopilgan ilova (DB pool, HTTP server)
  // jest jarayonini osiltirib qo'yardi — sabab ko'rinib tursin.
  if (app) await app.close();
});

// ═══════════════════ 0. HUJJAT VA AKKAUNT ═══════════════════

describe('0. Carrier Swagger va akkaunt (admin)', () => {
  it("carrier OpenAPI JSON test rejimida beriladi — faqat /carrier/* yo'llari", async () => {
    const res = await http.get('/api/v1/carrier-docs-json');
    expectOk(res);
    const paths = Object.keys(res.body.paths ?? {});
    expect(paths).toEqual(
      expect.arrayContaining([
        '/carrier/ping',
        '/carrier/scan',
        '/carrier/orders/{id}/status',
        '/carrier/returns',
        '/carrier/orders',
        '/carrier/cashbox',
      ]),
    );
    expect(paths.every((p) => p.startsWith('/carrier/'))).toBe(true);
    expect(
      res.body.components?.securitySchemes?.['carrier-api-key'],
    ).toMatchObject({
      type: 'apiKey',
      in: 'header',
    });
  });

  it("jonli hujjat commit qilingan docs/carrier-openapi.json bilan bir xil (server'dan tashqari)", async () => {
    const live = (await http.get('/api/v1/carrier-docs-json')).body;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const committed = require('../../docs/carrier-openapi.json');
    expect(live.servers).toEqual([{ url: '/api/v1' }]);
    const strip = (doc: any) => ({ ...doc, servers: undefined });
    expect(strip(live)).toEqual(strip(committed));
  });

  it("kuryer bo'lmagan foydalanuvchiga akkaunt ochilmaydi (400)", async () => {
    const res = await asAdmin(http.post('/api/v1/carrier-accounts')).send({
      name: 'Xato',
      courier_id: MARKET_ID,
    });
    expect(res.status).toBe(400);
  });

  it("akkaunt yaratiladi — kalit BIR MARTA, bazada faqat xesh; kuryer bog'lanadi", async () => {
    const res = await asAdmin(http.post('/api/v1/carrier-accounts')).send({
      name: 'E2E Express',
      courier_id: CARRIER_COURIER_ID,
    });
    expectOk(res, 201);
    const data = res.body.data;
    carrierKey = data.api_key;
    accountId = data.account.id;
    expect(carrierKey).toMatch(/^bpc_[0-9a-f]{64}$/);
    expect(accountId).toMatch(UUID_RE);
    expect(data.account.api_key_masked).toBe(`bpc_…${carrierKey.slice(-4)}`);
    expect(data.account.courier_user_id).toBe(CARRIER_COURIER_ID);

    const [acc] = await q(`SELECT * FROM carrier_account WHERE id = $1`, [
      accountId,
    ]);
    expect(acc.api_key_hash).toBe(
      createHash('sha256').update(carrierKey).digest('hex'),
    );
    expect(JSON.stringify(acc)).not.toContain(carrierKey);

    const [courier] = await q(
      `SELECT external_provider, password FROM users WHERE id = $1`,
      [CARRIER_COURIER_ID],
    );
    expect(courier.external_provider).toBe('carrier');
    expect(courier.password).toMatch(/^\$2[aby]\$/);
    // Kuryer kassasi ochildi (0).
    expect(await courierBalance()).toBe(0);
  });

  it("o'sha kuryerga ikkinchi akkaunt — 409", async () => {
    const res = await asAdmin(http.post('/api/v1/carrier-accounts')).send({
      name: 'Takror',
      courier_id: CARRIER_COURIER_ID,
    });
    expect(res.status).toBe(409);
  });

  it("ikkinchi akkaunt (limit/o'chirish sinovi uchun)", async () => {
    const res = await asAdmin(http.post('/api/v1/carrier-accounts')).send({
      name: 'E2E Express 2',
      courier_id: CARRIER_COURIER_2_ID,
    });
    expectOk(res, 201);
    carrier2Key = res.body.data.api_key;
    account2Id = res.body.data.account.id;
    expect(carrier2Key).not.toBe(carrierKey);
  });

  it("ro'yxatda kalit yo'q — faqat niqob", async () => {
    const res = await asAdmin(http.get('/api/v1/carrier-accounts'));
    expectOk(res);
    const json = JSON.stringify(res.body);
    expect(json).not.toContain(carrierKey);
    expect(json).not.toContain(carrier2Key);
    const mine = res.body.data.find((a: any) => a.id === accountId);
    expect(mine).toMatchObject({
      name: 'E2E Express',
      is_active: true,
      courier: { id: CARRIER_COURIER_ID, status: 'active' },
    });
  });
});

// ═══════════════════ 1. AUTENTIFIKATSIYA ═══════════════════

describe('1. Autentifikatsiya', () => {
  it('kalitsiz — 401 (trace_id + X-Trace-Id)', async () => {
    expectCarrierError(await ping(null), 401);
  });

  it("noto'g'ri kalit — 401 (ayni matn)", async () => {
    const missing = await ping(null);
    const bad = await ping('bpc_' + '0'.repeat(64));
    expectCarrierError(bad, 401);
    expect(bad.body.message).toBe(missing.body.message);
  });

  it('ping — akkaunt nomi', async () => {
    const res = await ping();
    expectOk(res);
    expect(res.body).toMatchObject({
      statusCode: 200,
      message: 'ok',
      data: {
        authenticated: true,
        carrier: { id: accountId, name: 'E2E Express' },
      },
    });
  });

  it('last_used_at yoziladi', async () => {
    let lastUsed: unknown = null;
    for (let i = 0; i < 20 && !lastUsed; i++) {
      const [row] = await q(
        `SELECT last_used_at FROM carrier_account WHERE id = $1`,
        [accountId],
      );
      lastUsed = row.last_used_at;
      if (!lastUsed) await new Promise((r) => setTimeout(r, 50));
    }
    expect(Number(lastUsed)).toBeGreaterThan(0);
  });

  it("IP ro'yxati: ruxsatsiz manzil — 403 (aniqlangan IP xabarda), ruxsatlisi — 200", async () => {
    const patch = await asAdmin(
      http.patch(`/api/v1/carrier-accounts/${accountId}`),
    ).send({
      ip_allowlist: ['203.0.113.0/24'],
    });
    expectOk(patch);
    expect(patch.body.data.ip_allowlist).toEqual(['203.0.113.0/24']);

    // To'g'ridan-to'g'ri ulanish (loopback) — ro'yxatda yo'q.
    const direct = await ping();
    expectCarrierError(direct, 403);
    expect(direct.body.message).toContain('127.0.0.1');

    // nginx orqali (trust proxy 'loopback' → X-Forwarded-For haqiqiy mijoz).
    const allowed = await ping().set('X-Forwarded-For', '203.0.113.7');
    expectOk(allowed);

    const denied = await ping().set('X-Forwarded-For', '198.51.100.9');
    expectCarrierError(denied, 403);
    expect(denied.body.message).toContain('198.51.100.9');

    // CF-Connecting-IP ISHONILMAYDI (BeePost oldida Cloudflare yo'q).
    const spoof = await ping().set('CF-Connecting-IP', '203.0.113.7');
    expectCarrierError(spoof, 403);

    const reset = await asAdmin(
      http.patch(`/api/v1/carrier-accounts/${accountId}`),
    ).send({
      ip_allowlist: [],
    });
    expectOk(reset);
    expect(reset.body.data.ip_allowlist).toBeNull();
    expectOk(await ping());
  });

  it("kalit atrofidagi bo'shliq kechiriladi", async () => {
    expectOk(await ping(`  ${carrierKey}  `));
  });

  it("X-Forwarded-For zanjiri: mijoz yozgan manzil emas, nginx qo'shgani olinadi", async () => {
    expectOk(
      await asAdmin(http.patch(`/api/v1/carrier-accounts/${accountId}`)).send({
        ip_allowlist: ['203.0.113.7', '2001:db8::1'],
      }),
    );
    try {
      // Mijoz o'zini 203.0.113.7 deb yozgan, nginx haqiqiy manzilni qo'shgan.
      const spoof = await ping().set(
        'X-Forwarded-For',
        '203.0.113.7, 198.51.100.9',
      );
      expectCarrierError(spoof, 403);
      expect(spoof.body.message).toContain('198.51.100.9');
      // IPv6 (kanonik bo'lmagan yozuv ham) mos keladi.
      expectOk(await ping().set('X-Forwarded-For', '2001:0db8:0:0:0:0:0:1'));
    } finally {
      expectOk(
        await asAdmin(http.patch(`/api/v1/carrier-accounts/${accountId}`)).send(
          {
            ip_allowlist: [],
          },
        ),
      );
    }
  });

  it("⭐ katta harfli yo'l nginx carrier blokini chetlab o'tolmaydi — soxta XFF bilan ham 404, kalit tekshirilmaydi", async () => {
    expectOk(
      await asAdmin(http.patch(`/api/v1/carrier-accounts/${accountId}`)).send({
        ip_allowlist: ['203.0.113.7'],
      }),
    );
    try {
      // Prod'da bu yo'llar umumiy `/api/` blokiga tushadi — u XFF ni qayta
      // yozmasa, mijoz yozgan manzil `req.ip` bo'lardi (ro'yxatdagi IP).
      for (const path of [
        '/api/v1/CARRIER/ping',
        '/api/v1/Carrier/ping',
        '/API/V1/carrier/ping',
      ]) {
        const res = await withKey(http.get(path)).set(
          'X-Forwarded-For',
          '203.0.113.7',
        );
        expectCarrierError(res, 404);
        expect(res.body.message).toContain('/api/v1/carrier/');
      }
      // Kanonik yo'l — odatdagidek (prod'da XFF ni carrier bloki yozadi).
      expectOk(await ping().set('X-Forwarded-For', '203.0.113.7'));
    } finally {
      expectOk(
        await asAdmin(http.patch(`/api/v1/carrier-accounts/${accountId}`)).send(
          { ip_allowlist: [] },
        ),
      );
    }
  });

  it('⭐ kalitdan OLDINGI IP limiti — kalitsiz oqim ham 429 oladi, boshqa IP ta’sirlanmaydi', async () => {
    const saved = config.CARRIER_IP_THROTTLE_LIMIT;
    (
      config as { CARRIER_IP_THROTTLE_LIMIT: number }
    ).CARRIER_IP_THROTTLE_LIMIT = 3;
    // Alohida (soxta) IP — loopback savati boshqa sinovlarga qoladi.
    const FLOOD_IP = '198.51.100.77';
    const guess = `bpc_${'f'.repeat(64)}`;
    try {
      for (let i = 0; i < 3; i++) {
        expectCarrierError(
          await ping(guess).set('X-Forwarded-For', FLOOD_IP),
          401,
        );
      }
      const limited = await ping(guess).set('X-Forwarded-For', FLOOD_IP);
      expectCarrierError(limited, 429);
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
      // To'g'ri kalit ham shu IP'dan — limit kalit tekshiruvidan OLDIN.
      expectCarrierError(await ping().set('X-Forwarded-For', FLOOD_IP), 429);
    } finally {
      (
        config as { CARRIER_IP_THROTTLE_LIMIT: number }
      ).CARRIER_IP_THROTTLE_LIMIT = saved;
    }
    expectOk(await ping());
  });

  it("noto'g'ri IP yozuvi — 400", async () => {
    const res = await asAdmin(
      http.patch(`/api/v1/carrier-accounts/${accountId}`),
    ).send({
      ip_allowlist: ['not-an-ip'],
    });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════ 2. BUYURTMALAR VA JO'NATISH (HTTP) ═══════════════════

describe("2. Buyurtmalar yaratiladi va carrier kuryeriga jo'natiladi", () => {
  it('buyurtmalar → ombor → sendPost (carrier va ichki kuryer)', async () => {
    const twoItems = [
      { product_id: PRODUCT_1, quantity: 2 },
      { product_id: PRODUCT_2, quantity: 1 },
    ];
    for (const name of ['A', 'B', 'C', 'D', 'X']) {
      ord[name] = { id: await createOrder(twoItems), qr: '' };
    }
    for (let i = 0; i < 9; i++) {
      fillerIds.push(
        await createOrder([{ product_id: PRODUCT_1, quantity: 1 }], 50_000),
      );
    }
    const all = [...Object.values(ord).map((o) => o.id), ...fillerIds];
    const postId = await receiveOrders(all);

    const carrierIds = [ord.A.id, ord.B.id, ord.C.id, ord.D.id, ...fillerIds];
    await sendPost(postId, carrierIds, CARRIER_COURIER_ID);
    await sendPost(postId, [ord.X.id], INHOUSE_COURIER_ID);

    for (const o of Object.values(ord)) {
      const row = await orderRow(o.id);
      o.qr = row.qr_code_token;
      expect(row.status).toBe('on the road');
    }
    // Elchi nazoratidagi posilka (masalan Elchi'ga topshirilgan).
    await q(`UPDATE "order" SET control_owner = 'elchi' WHERE id = $1`, [
      ord.D.id,
    ]);
  });

  it('sendPost carrier (super) kuryerining HUDUD tarifini muzlatdi', async () => {
    for (const id of [ord.A.id, ord.B.id, ord.C.id, ...fillerIds]) {
      expect(Number((await orderRow(id)).courier_tariff)).toBe(
        FROZEN_CENTER_TARIFF,
      );
    }
    // Ichki (super emas) kuryer — muzlatish yo'q.
    expect((await orderRow(ord.X.id)).courier_tariff).toBeNull();
  });
});

// ═══════════════════ 3. SKAN ═══════════════════

describe('3. Skan', () => {
  it("yo'ldagi o'z posilkasi — received:true, waiting, kontrakt ko'rinishi", async () => {
    const res = await scan(ord.A.qr);
    expectOk(res);
    expect(res.body.message).toBe('Posilka qabul qilindi');
    const { received, order, refreshed } = res.body.data;
    expect(received).toBe(true);
    expect(refreshed).toBe(true);
    expect(order).toMatchObject({
      id: ord.A.id,
      qr_token: ord.A.qr,
      parent_order_id: null,
      status: 'waiting',
      total_price: ORDER_TOTAL,
      paid_online_amount: 0,
      cod_amount: ORDER_TOTAL,
      where_deliver: 'center',
      customer: {
        name: 'E2E Mijoz',
        phone_number: '+998900100005',
        extra_number: '+998900100055',
      },
      region: { id: REGION_ID, soato_code: '1726' },
      district: { id: DISTRICT_ID, soato_code: '1726266' },
      market: { id: MARKET_ID, name: 'E2E Market' },
      replacement: null,
    });
    expect(typeof order.order_number).toBe('string');
    expect(order.items).toHaveLength(2);
    expect(order.items.map((i: any) => i.product_id).sort()).toEqual(
      [PRODUCT_1, PRODUCT_2].sort(),
    );
    expect(new Date(order.created_at).getTime()).toBeGreaterThan(0);
    expect((await orderRow(ord.A.id)).status).toBe('waiting');
  });

  it('takroriy skan — received:false', async () => {
    const res = await scan(ord.A.qr);
    expectOk(res);
    expect(res.body.data.received).toBe(false);
    expect(res.body.data.order.status).toBe('waiting');
    expect(res.body.message).toBe('Buyurtma topildi');
  });

  it("katta harf / bo'shliq bilan QR ham topiladi", async () => {
    const res = await scan(`  ${ord.A.qr.toUpperCase()} `);
    expectOk(res);
    expect(res.body.data.order.id).toBe(ord.A.id);
  });

  it("boshqa kuryerning QR'i — 404 (mavjudligi bilinmaydi)", async () => {
    const res = await scan(ord.X.qr);
    expectCarrierError(res, 404);
    expect((await orderRow(ord.X.id)).status).toBe('on the road');
  });

  it('Elchi nazoratidagi posilka (control_owner=elchi) — 404', async () => {
    expectCarrierError(await scan(ord.D.qr), 404);
    expect((await orderRow(ord.D.id)).status).toBe('on the road');
  });

  it("noma'lum QR — 404; bo'sh QR — 400", async () => {
    const unknown = await scan('ffffffffffffffffffffffff');
    expectCarrierError(unknown, 404);
    const missing = await scan(ord.X.qr);
    expect(unknown.body.message).toBe(missing.body.message);
    expectCarrierError(await scan(''), 400);
  });

  it('B va C qabul qilinadi', async () => {
    for (const o of [ord.B, ord.C]) {
      const res = await scan(o.qr);
      expectOk(res);
      expect(res.body.data.received).toBe(true);
    }
  });
});

// ═══════════════════ 4. SOTUV (sold) + IDEMPOTENTLIK ═══════════════════

describe('4. sold va Idempotency-Key', () => {
  const soldBody = SOLD_BODY;
  let balanceBefore = 0;

  it("Idempotency-Key yo'q — 400 CARRIER_IDEMPOTENCY_KEY_REQUIRED", async () => {
    expectCarrierError(
      await setStatus(ord.A.id, soldBody, null),
      400,
      'CARRIER_IDEMPOTENCY_KEY_REQUIRED',
    );
    expectCarrierError(
      await setStatus(ord.A.id, soldBody, '   '),
      400,
      'CARRIER_IDEMPOTENCY_KEY_REQUIRED',
    );
  });

  it('Idempotency-Key 255 belgidan uzun — 400 CARRIER_IDEMPOTENCY_KEY_REQUIRED', async () => {
    expectCarrierError(
      await setStatus(ord.A.id, soldBody, 'k'.repeat(256)),
      400,
      'CARRIER_IDEMPOTENCY_KEY_REQUIRED',
    );
  });

  it('extraCost maydoni — 400 (validatsiya 422 emas)', async () => {
    const res = await setStatus(
      ord.A.id,
      { ...soldBody, extraCost: 5000 },
      newIdemKey(),
    );
    expectCarrierError(res, 400);
    const res2 = await setStatus(
      ord.A.id,
      { ...soldBody, paidAmount: 5000 },
      newIdemKey(),
    );
    expectCarrierError(res2, 400);
  });

  it("UUID bo'lmagan id — 400; begona UUID — 404; Elchi nazoratidagi — 404", async () => {
    expectCarrierError(await setStatus('abc', soldBody, newIdemKey()), 400);
    expectCarrierError(
      await setStatus(
        '11111111-1111-4111-8111-111111111111',
        soldBody,
        newIdemKey(),
      ),
      404,
    );
    expectCarrierError(await setStatus(ord.D.id, soldBody, newIdemKey()), 404);
    expectCarrierError(await setStatus(ord.X.id, soldBody, newIdemKey()), 404);
  });

  it("noma'lum status — 400", async () => {
    expectCarrierError(
      await setStatus(ord.A.id, { status: 'delivered' }, newIdemKey()),
      400,
    );
  });

  it('sold — 200, kuryer kassasi +(narx − muzlatilgan tarif), tarix qatori', async () => {
    balanceBefore = await courierBalance();
    const res = await setStatus(ord.A.id, soldBody, SOLD_KEY);
    expectOk(res);
    expect(res.body.message).toBe('Holat qabul qilindi');
    expect(res.body.data.refreshed).toBe(true);
    expect(res.body.data.order).toMatchObject({ id: ord.A.id, status: 'sold' });

    expect(await courierBalance()).toBe(
      balanceBefore + ORDER_TOTAL - FROZEN_CENTER_TARIFF,
    );
    const hist = await courierHistory(ord.A.id);
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({
      operation_type: 'income',
      source_type: 'sell',
    });
    expect(Number(hist[0].amount)).toBe(ORDER_TOTAL - FROZEN_CENTER_TARIFF);

    const log = await waitForCarrierLog(ord.A.id, 'carrier.sold');
    expect(log?.metadata).toMatchObject({
      source: 'carrier_api',
      carrier_account_id: accountId,
    });
    // Kalitning o'zi logga tushmaydi — faqat xesh prefiksi.
    expect(JSON.stringify(log)).not.toContain(SOLD_KEY);
  });

  it("GET /carrier/cashbox sotuvni ko'rsatadi", async () => {
    const res = await cashboxReq();
    expectOk(res);
    const d = res.body.data;
    expect(d.balance).toBe(await courierBalance());
    expect(d.from).toBe(tashkentDay(-29));
    expect(d.to).toBe(tashkentDay(0));
    const sale = d.history.find((h: any) => h.order_id === ord.A.id);
    expect(sale).toMatchObject({
      type: 'income',
      source_type: 'sell',
      amount: ORDER_TOTAL - FROZEN_CENTER_TARIFF,
    });
    expect(d.income).toBeGreaterThanOrEqual(ORDER_TOTAL - FROZEN_CENTER_TARIFF);
    // Xodim ma'lumotlari chiqmaydi.
    expect(JSON.stringify(d)).not.toMatch(
      /created_by|createdByUser|sourceUser/,
    );
  });

  it('ayni kalit + ayni tana takrori — 200, pul IKKINCHI marta yozilmaydi', async () => {
    const balance = await courierBalance();
    const res = await setStatus(ord.A.id, soldBody, SOLD_KEY);
    expectOk(res);
    expect(res.body.data.order.status).toBe('sold');
    expect(await courierBalance()).toBe(balance);
    expect(await courierHistory(ord.A.id)).toHaveLength(1);
  });

  it('ayni kalit + boshqa tana — 422 IDEMPOTENCY_KEY_MISMATCH', async () => {
    expectCarrierError(
      await setStatus(
        ord.A.id,
        { status: 'sold', comment: 'boshqa' },
        SOLD_KEY,
      ),
      422,
      'IDEMPOTENCY_KEY_MISMATCH',
    );
    // Boshqa buyurtma bilan ham.
    expectCarrierError(
      await setStatus(ord.B.id, soldBody, SOLD_KEY),
      422,
      'IDEMPOTENCY_KEY_MISMATCH',
    );
  });

  it("sotilgan buyurtmani yangi kalit bilan qayta sotish — 400, pul o'zgarmaydi", async () => {
    const balance = await courierBalance();
    expectCarrierError(await setStatus(ord.A.id, soldBody, newIdemKey()), 400);
    expect(await courierBalance()).toBe(balance);
  });

  it('kalitlar bazada ochiq saqlanmaydi', async () => {
    const rows = await q(
      `SELECT key_hash, binding, state FROM carrier_idempotency_key`,
    );
    expect(JSON.stringify(rows)).not.toContain(SOLD_KEY);
    const own = rows.find(
      (r: any) =>
        r.key_hash === createHash('sha256').update(SOLD_KEY).digest('hex'),
    );
    expect(own?.state).toBe('completed');
  });
});

// ═══════════════════ 5. QISMAN SOTUV (partly_sold) ═══════════════════

describe('5. partly_sold', () => {
  let items: Array<{ id: string; productId: string; quantity: number }> = [];

  beforeAll(async () => {
    items = await q(
      `SELECT id, "productId", quantity FROM order_item WHERE "orderId" = $1 ORDER BY "productId"`,
      [ord.B.id],
    );
    expect(items).toHaveLength(2);
  });

  const item = (productId: string) =>
    items.find((i) => i.productId === productId)!;

  it('qator tushib qolgan — 400', async () => {
    const res = await setStatus(
      ord.B.id,
      {
        status: 'partly_sold',
        total_price: PARTLY_PRICE,
        items: [{ product_id: PRODUCT_1, quantity: 1 }],
      },
      newIdemKey(),
    );
    expectCarrierError(res, 400);
    expect(res.body.message).toContain(PRODUCT_2);
  });

  it("dona asl sondan ko'p — 400", async () => {
    expectCarrierError(
      await setStatus(
        ord.B.id,
        {
          status: 'partly_sold',
          total_price: PARTLY_PRICE,
          items: [
            { product_id: PRODUCT_1, quantity: 3 },
            { product_id: PRODUCT_2, quantity: 0 },
          ],
        },
        newIdemKey(),
      ),
      400,
    );
  });

  it('total_price buyurtma summasidan katta — 400', async () => {
    expectCarrierError(
      await setStatus(
        ord.B.id,
        {
          status: 'partly_sold',
          total_price: ORDER_TOTAL + 1,
          items: [
            { product_id: PRODUCT_1, quantity: 1 },
            { product_id: PRODUCT_2, quantity: 1 },
          ],
        },
        newIdemKey(),
      ),
      400,
    );
  });

  it('total_price kasr son — 400 (kassa bigint)', async () => {
    expectCarrierError(
      await setStatus(
        ord.B.id,
        {
          status: 'partly_sold',
          total_price: 150000.5,
          items: [
            { product_id: PRODUCT_1, quantity: 1 },
            { product_id: PRODUCT_2, quantity: 1 },
          ],
        },
        newIdemKey(),
      ),
      400,
    );
  });

  it("total_price / items yo'q, hech narsa kamaymagan, hech narsa sotilmagan — 400", async () => {
    expectCarrierError(
      await setStatus(
        ord.B.id,
        {
          status: 'partly_sold',
          items: [{ product_id: PRODUCT_1, quantity: 1 }],
        },
        newIdemKey(),
      ),
      400,
    );
    expectCarrierError(
      await setStatus(
        ord.B.id,
        { status: 'partly_sold', total_price: 1000 },
        newIdemKey(),
      ),
      400,
    );
    expectCarrierError(
      await setStatus(
        ord.B.id,
        {
          status: 'partly_sold',
          total_price: PARTLY_PRICE,
          items: [
            { product_id: PRODUCT_1, quantity: 2 },
            { product_id: PRODUCT_2, quantity: 1 },
          ],
        },
        newIdemKey(),
      ),
      400,
    );
    expectCarrierError(
      await setStatus(
        ord.B.id,
        {
          status: 'partly_sold',
          total_price: 0,
          items: [
            { product_id: PRODUCT_1, quantity: 0 },
            { product_id: PRODUCT_2, quantity: 0 },
          ],
        },
        newIdemKey(),
      ),
      400,
    );
    expect((await orderRow(ord.B.id)).status).toBe('waiting');
  });

  it("qisman sotuv — 200, bola (bekor) buyurtma, pul to'g'ri", async () => {
    const balance = await courierBalance();
    const res = await setStatus(
      ord.B.id,
      {
        status: 'partly_sold',
        total_price: PARTLY_PRICE,
        comment: 'Bittasini oldi',
        items: [
          // order_item_id bo'yicha ham, product_id bo'yicha ham moslash.
          { order_item_id: item(PRODUCT_1).id, quantity: 1 },
          { product_id: PRODUCT_2, quantity: 1 },
        ],
      },
      newIdemKey(),
    );
    expectOk(res);
    expect(res.body.data.order).toMatchObject({
      id: ord.B.id,
      status: 'sold',
      total_price: PARTLY_PRICE,
    });

    expect(await courierBalance()).toBe(
      balance + PARTLY_PRICE - FROZEN_CENTER_TARIFF,
    );
    const hist = await courierHistory(ord.B.id);
    expect(hist).toHaveLength(1);
    expect(Number(hist[0].amount)).toBe(PARTLY_PRICE - FROZEN_CENTER_TARIFF);

    const row = await orderRow(ord.B.id);
    expect(Number(row.original_total_price)).toBe(ORDER_TOTAL);

    const children = await q(
      `SELECT * FROM "order" WHERE parent_order_id = $1`,
      [ord.B.id],
    );
    expect(children).toHaveLength(1);
    expect(children[0].status).toBe('cancelled');
    ord.Bchild = { id: children[0].id, qr: children[0].qr_code_token };
    const childItems = await q(
      `SELECT "productId", quantity FROM order_item WHERE "orderId" = $1`,
      [ord.Bchild.id],
    );
    expect(childItems).toEqual([{ productId: PRODUCT_1, quantity: 1 }]);
  });

  it("qisman sotuvdan ajralgan bolani rollback qilib bo'lmaydi — 400", async () => {
    const res = await setStatus(
      ord.Bchild.id,
      { status: 'rollback' },
      newIdemKey(),
    );
    expectCarrierError(res, 400);
    expect(res.body.message).toMatch(/parent_order_id/);
    expect((await orderRow(ord.Bchild.id)).status).toBe('cancelled');
  });
});

// ═══════════════════ 6. BEKOR (cancelled) ═══════════════════

describe('6. cancelled', () => {
  it('sababsiz — 400; OTHER izohsiz — 400', async () => {
    expectCarrierError(
      await setStatus(ord.C.id, { status: 'cancelled' }, newIdemKey()),
      400,
    );
    expectCarrierError(
      await setStatus(
        ord.C.id,
        { status: 'cancelled', reason: 'NOPE' },
        newIdemKey(),
      ),
      400,
    );
    expectCarrierError(
      await setStatus(
        ord.C.id,
        { status: 'cancelled', reason: 'OTHER' },
        newIdemKey(),
      ),
      400,
    );
  });

  it('sabab bilan bekor — cancelled, izoh boshida [SABAB]', async () => {
    const balance = await courierBalance();
    const res = await setStatus(
      ord.C.id,
      {
        status: 'cancelled',
        reason: 'CUSTOMER_REFUSED',
        comment: 'Mijoz rad etdi',
      },
      newIdemKey(),
    );
    expectOk(res);
    expect(res.body.data.order.status).toBe('cancelled');
    const row = await orderRow(ord.C.id);
    expect(row.status).toBe('cancelled');
    expect(row.comment).toContain('[CUSTOMER_REFUSED] Mijoz rad etdi');
    expect(await courierBalance()).toBe(balance);

    const log = await waitForCarrierLog(ord.C.id, 'carrier.cancelled');
    expect(log?.metadata?.reason).toBe('CUSTOMER_REFUSED');
  });
});

// ═══════════════════ 7. QAYTARISH (returns) ═══════════════════

describe('7. returns', () => {
  let returnPostId: string;

  it('id UUID emas — 400; begona — 404; cancelled emas — 400', async () => {
    expectCarrierError(await returns(['abc']), 400);
    expectCarrierError(await returns([]), 400);
    expectCarrierError(await returns([ord.X.id]), 404);
    expectCarrierError(await returns([ord.D.id]), 404);
    const wrong = await returns([ord.A.id]);
    expectCarrierError(wrong, 400);
    expect(wrong.body.message).toContain(ord.A.id);
  });

  it("bekor + qisman sotuv qoldig'i qaytariladi — CANCELED pochta", async () => {
    const res = await returns([ord.C.id, ord.Bchild.id]);
    expectOk(res);
    returnPostId = res.body.data.post_id;
    expect(returnPostId).toMatch(UUID_RE);
    expect(res.body.data.order_ids.sort()).toEqual(
      [ord.C.id, ord.Bchild.id].sort(),
    );

    const [post] = await q(
      `SELECT status, courier_id FROM post WHERE id = $1`,
      [returnPostId],
    );
    expect(post).toEqual({
      status: 'canceled',
      courier_id: CARRIER_COURIER_ID,
    });
    for (const id of [ord.C.id, ord.Bchild.id]) {
      const row = await orderRow(id);
      expect(row.status).toBe('cancelled (sent)');
      expect(row.canceled_post_id).toBe(returnPostId);
    }
  });

  it("takroriy so'rov — ayni post_id", async () => {
    const res = await returns([ord.C.id]);
    expectOk(res);
    expect(res.body.data.post_id).toBe(returnPostId);
    const [{ n }] = await q(
      `SELECT count(*)::int AS n FROM post WHERE courier_id = $1 AND status = 'canceled'`,
      [CARRIER_COURIER_ID],
    );
    expect(n).toBe(1);
  });

  it('qaytarilgan posilka skan qilinsa — 200, received:false', async () => {
    const res = await scan(ord.C.qr);
    expectOk(res);
    expect(res.body.data).toMatchObject({
      received: false,
      order: { status: 'cancelled (sent)' },
    });
  });

  it("bolasi qaytarilgan qisman sotuvni rollback qilib bo'lmaydi — 400 (narx tiklanmaydi)", async () => {
    const res = await setStatus(ord.B.id, { status: 'rollback' }, newIdemKey());
    expectCarrierError(res, 400);
    expect((await orderRow(ord.B.id)).status).toBe('sold');
  });

  it("⭐ ayni ro'yxat bilan PARALLEL /returns — qaytarish pochtasi hisoblagichlari BIR marta oshadi", async () => {
    await dispatch(['U'], CARRIER_COURIER_ID);
    expectOk(await scan(ord.U.qr));
    expectOk(
      await setStatus(
        ord.U.id,
        { status: 'cancelled', reason: 'CUSTOMER_REFUSED' },
        newIdemKey(),
      ),
    );
    const [before] = await q(
      `SELECT order_quantity, post_total_price FROM post WHERE id = $1`,
      [returnPostId],
    );
    const results = await Promise.all([
      returns([ord.U.id]),
      returns([ord.U.id]),
      returns([ord.U.id]),
    ]);
    for (const r of results) {
      expectOk(r);
      expect(r.body.data.post_id).toBe(returnPostId);
    }
    const [after] = await q(
      `SELECT order_quantity, post_total_price FROM post WHERE id = $1`,
      [returnPostId],
    );
    expect(Number(after.order_quantity)).toBe(
      Number(before.order_quantity) + 1,
    );
    expect(Number(after.post_total_price)).toBe(
      Number(before.post_total_price) + ORDER_TOTAL,
    );
    expect((await orderRow(ord.U.id)).status).toBe('cancelled (sent)');
  });
});

// ═══════════════════ 8. ROLLBACK + ESKI KALIT ═══════════════════

describe('8. rollback va eskirgan kalit', () => {
  it('sold → waiting, kassada rollback_correction', async () => {
    const balance = await courierBalance();
    const res = await setStatus(ord.A.id, { status: 'rollback' }, newIdemKey());
    expectOk(res);
    expect(res.body.data.order.status).toBe('waiting');
    expect(await courierBalance()).toBe(
      balance - (ORDER_TOTAL - FROZEN_CENTER_TARIFF),
    );

    const hist = await courierHistory(ord.A.id);
    expect(hist.map((h) => h.source_type)).toEqual([
      'sell',
      'rollback_correction',
    ]);
    expect(hist[1].operation_type).toBe('expense');
    expect(Number(hist[1].amount)).toBe(ORDER_TOTAL - FROZEN_CENTER_TARIFF);

    // Kassa ko'rinishida `correction` sifatida.
    const cb = await cashboxReq();
    const corr = cb.body.data.history.find(
      (h: any) => h.order_id === ord.A.id && h.type === 'expense',
    );
    expect(corr?.source_type).toBe('correction');
  });

  it('rollback faqat sold/cancelled — waiting buyurtmada 400', async () => {
    expectCarrierError(
      await setStatus(ord.A.id, { status: 'rollback' }, newIdemKey()),
      400,
    );
  });

  it('eski sold kaliti (sold → rollback → ayni kalit) — 409 CARRIER_IDEMPOTENCY_KEY_STALE, pul yozilmaydi', async () => {
    const balance = await courierBalance();
    const stale = await setStatus(ord.A.id, SOLD_BODY, SOLD_KEY);
    expectCarrierError(stale, 409, 'CARRIER_IDEMPOTENCY_KEY_STALE');
    expect(await courierBalance()).toBe(balance);
    expect((await orderRow(ord.A.id)).status).toBe('waiting');
    expect(await courierHistory(ord.A.id)).toHaveLength(2);
  });

  it('yangi kalit bilan qayta sotiladi', async () => {
    const balance = await courierBalance();
    expectOk(await setStatus(ord.A.id, { status: 'sold' }, newIdemKey()));
    expect(await courierBalance()).toBe(
      balance + ORDER_TOTAL - FROZEN_CENTER_TARIFF,
    );
  });
});

// ═══════════════════ 9. RO'YXAT ═══════════════════

describe('9. GET /carrier/orders', () => {
  it("sukut — o'z buyurtmalari; begona, Elchi nazoratidagi va qaytarilganlar yo'q", async () => {
    const res = await listOrders({ limit: 100 });
    expectOk(res);
    const ids = res.body.data.items.map((o: any) => o.id);
    expect(ids).toEqual(
      expect.arrayContaining([ord.A.id, ord.B.id, ...fillerIds]),
    );
    expect(ids).not.toContain(ord.X.id);
    expect(ids).not.toContain(ord.D.id);
    expect(ids).not.toContain(ord.C.id);
    expect(ids).not.toContain(ord.Bchild.id);
    expect(res.body.data).toMatchObject({
      total: ids.length,
      page: 1,
      limit: 100,
    });
    expect(res.body.data.total).toBe(2 + fillerIds.length);
  });

  it('status filtri', async () => {
    const road = await listOrders({ status: 'on the road', limit: 100 });
    expectOk(road);
    expect(road.body.data.items.map((o: any) => o.id).sort()).toEqual(
      [...fillerIds].sort(),
    );

    const sold = await listOrders({ status: 'sold,paid', limit: 100 });
    expect(sold.body.data.items.map((o: any) => o.id).sort()).toEqual(
      [ord.A.id, ord.B.id].sort(),
    );

    const elchiOnly = await listOrders({ status: 'waiting_customer' });
    expectOk(elchiOnly);
    expect(elchiOnly.body.data).toMatchObject({ items: [], total: 0 });

    expectCarrierError(await listOrders({ status: 'bogus' }), 400);
  });

  it('sahifalash', async () => {
    const p1 = await listOrders({ limit: 10, page: 1 });
    const p2 = await listOrders({ limit: 10, page: 2 });
    expectOk(p1);
    expectOk(p2);
    const total = 2 + fillerIds.length;
    expect(p1.body.data.total).toBe(total);
    expect(p2.body.data.total).toBe(total);
    expect(p1.body.data.items).toHaveLength(10);
    expect(p2.body.data.items).toHaveLength(total - 10);
    const overlap = p1.body.data.items.filter((a: any) =>
      p2.body.data.items.some((b: any) => b.id === a.id),
    );
    expect(overlap).toHaveLength(0);
    expectCarrierError(await listOrders({ limit: 7 }), 400);
    expectCarrierError(await listOrders({ page: 0 }), 400);
  });

  it('sana filtri (Toshkent kuni)', async () => {
    const today = await listOrders({
      from: tashkentDay(0),
      to: tashkentDay(0),
      limit: 100,
    });
    expect(today.body.data.total).toBe(2 + fillerIds.length);
    const tomorrow = await listOrders({ from: tashkentDay(1), limit: 100 });
    expect(tomorrow.body.data.total).toBe(0);
    expectCarrierError(await listOrders({ from: '2026-02-31' }), 400);
    expectCarrierError(await listOrders({ from: '10-11-2026' }), 400);
  });
});

// ═══════════════════ 10. KASSA ═══════════════════

describe('10. GET /carrier/cashbox', () => {
  it("balans bazadagi bilan bir xil, kirim/chiqim oynadagi yig'indi", async () => {
    const res = await cashboxReq({ from: tashkentDay(-1), to: tashkentDay(0) });
    expectOk(res);
    const d = res.body.data;
    expect(d.balance).toBe(await courierBalance());
    const [sums] = await q(
      `SELECT COALESCE(SUM(CASE WHEN h.operation_type = 'income' THEN h.amount END), 0)::bigint AS inc,
              COALESCE(SUM(CASE WHEN h.operation_type = 'expense' THEN h.amount END), 0)::bigint AS exp,
              count(*)::int AS n
         FROM cashbox_history h JOIN cash_box c ON c.id = h.cashbox_id
        WHERE c.user_id = $1 AND c.cashbox_type = 'couriers'`,
      [CARRIER_COURIER_ID],
    );
    expect(d.income).toBe(Number(sums.inc));
    expect(d.outcome).toBe(Number(sums.exp));
    expect(d.history).toHaveLength(sums.n);
    expect(d.income - d.outcome).toBe(d.balance);
  });

  it("noto'g'ri oyna — 400", async () => {
    expectCarrierError(
      await cashboxReq({ from: tashkentDay(0), to: tashkentDay(-1) }),
      400,
    );
    expectCarrierError(
      await cashboxReq({ from: tashkentDay(-100), to: tashkentDay(0) }),
      400,
    );
    expectCarrierError(await cashboxReq({ from: '2026-13-01' }), 400);
  });
});

// ═══════════════════ 11. MULTIPART VA ISBOT FAYLI ═══════════════════

describe('11. multipart va isbot (proof)', () => {
  beforeAll(async () => {
    await dispatch(['E', 'F'], CARRIER_COURIER_ID);
    for (const name of ['E', 'F']) {
      const res = await scan(ord[name].qr);
      expectOk(res);
      expect(res.body.data.received).toBe(true);
    }
  });

  it("ruxsat etilmagan fayl turi — 400, buyurtma o'zgarmaydi", async () => {
    const res = await multipartStatus(
      ord.E.id,
      [['status', 'sold']],
      newIdemKey(),
      {
        buffer: Buffer.from('hello'),
        filename: 'a.txt',
        contentType: 'text/plain',
      },
    );
    expectCarrierError(res, 400);
    expect(res.body.message).toMatch(/Isbot fayli turi/);
    expect((await orderRow(ord.E.id)).status).toBe('waiting');
  });

  it('rasm 10 MB dan katta — 400', async () => {
    const res = await multipartStatus(
      ord.E.id,
      [['status', 'sold']],
      newIdemKey(),
      {
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 1),
        filename: 'big.png',
        contentType: 'image/png',
      },
    );
    expectCarrierError(res, 400);
  });

  it('isbot 50 MB dan katta — 413', async () => {
    const res = await multipartStatus(
      ord.E.id,
      [['status', 'sold']],
      newIdemKey(),
      {
        buffer: Buffer.alloc(50 * 1024 * 1024 + 1, 1),
        filename: 'huge.mp4',
        contentType: 'video/mp4',
      },
    );
    expectCarrierError(res, 413);
    expect((await orderRow(ord.E.id)).status).toBe('waiting');
  });

  it('rollback bilan isbot — 400', async () => {
    const res = await multipartStatus(
      ord.A.id,
      [['status', 'rollback']],
      newIdemKey(),
      {
        buffer: PNG_1PX,
        filename: 'p.png',
        contentType: 'image/png',
      },
    );
    expectCarrierError(res, 400);
    expect((await orderRow(ord.A.id)).status).toBe('sold');
  });

  it('multipart partly_sold: items — JSON massiv satri, isbot rasm bilan — 200', async () => {
    const balance = await courierBalance();
    const res = await multipartStatus(
      ord.E.id,
      [
        ['status', 'partly_sold'],
        ['total_price', '150000'],
        [
          'items',
          JSON.stringify([
            { product_id: PRODUCT_1, quantity: 1 },
            { product_id: PRODUCT_2, quantity: 1 },
          ]),
        ],
        ['comment', 'multipart'],
      ],
      newIdemKey(),
      { buffer: PNG_1PX, filename: 'p.png', contentType: 'image/png' },
    );
    expectOk(res);
    expect(res.body.data.order).toMatchObject({
      status: 'sold',
      total_price: 150_000,
    });
    expect(await courierBalance()).toBe(
      balance + 150_000 - FROZEN_CENTER_TARIFF,
    );
  });

  it('multipart partly_sold: items — takroriy qismlar (har biri JSON obyekt) — 200', async () => {
    const res = await multipartStatus(
      ord.F.id,
      [
        ['status', 'partly_sold'],
        ['total_price', '100000'],
        ['items', JSON.stringify({ product_id: PRODUCT_1, quantity: 0 })],
        ['items', JSON.stringify({ product_id: PRODUCT_2, quantity: 1 })],
      ],
      newIdemKey(),
    );
    expectOk(res);
    expect(res.body.data.order).toMatchObject({
      status: 'sold',
      total_price: 100_000,
    });
  });
});

// ═══════════════════ 12. ALMASHTIRISH (replacement) ═══════════════════

describe('12. almashtirish buyurtmasi', () => {
  beforeAll(async () => {
    expect((await orderRow(ord.A.id)).status).toBe('sold');
    await dispatch(['R'], CARRIER_COURIER_ID, { replaced_order_id: ord.A.id });
    const res = await scan(ord.R.qr);
    expectOk(res);
    expect(res.body.data.order.replacement).toEqual({
      of_order_id: ord.A.id,
      old_item_required: true,
    });
  });

  it("eski mahsulot tasdig'isiz sotib bo'lmaydi — 400", async () => {
    const res = await setStatus(ord.R.id, { status: 'sold' }, newIdemKey());
    expectCarrierError(res, 400);
    expect(res.body.message).toMatch(/old_item_collected/);
    expect((await orderRow(ord.R.id)).status).toBe('waiting');
  });

  it("almashtirishni qisman sotib bo'lmaydi — 400", async () => {
    expectCarrierError(
      await setStatus(
        ord.R.id,
        {
          status: 'partly_sold',
          total_price: 100_000,
          items: [
            { product_id: PRODUCT_1, quantity: 1 },
            { product_id: PRODUCT_2, quantity: 1 },
          ],
        },
        newIdemKey(),
      ),
      400,
    );
  });

  it('old_item_collected=true (multipart satr) — 200', async () => {
    const res = await multipartStatus(
      ord.R.id,
      [
        ['status', 'sold'],
        ['old_item_collected', 'true'],
      ],
      newIdemKey(),
    );
    expectOk(res);
    expect(res.body.data.order).toMatchObject({
      status: 'sold',
      replacement: { of_order_id: ord.A.id, old_item_required: false },
    });
  });

  it("rollback → qayta sotuv bayroqsiz o'tadi (tasdiq avval olingan)", async () => {
    const rb = await setStatus(ord.R.id, { status: 'rollback' }, newIdemKey());
    expectOk(rb);
    expect(rb.body.data.order).toMatchObject({
      status: 'waiting',
      replacement: { old_item_required: false },
    });
    expectOk(await setStatus(ord.R.id, { status: 'sold' }, newIdemKey()));
    expect((await orderRow(ord.R.id)).status).toBe('sold');
  });

  it('eski buyurtma (A) kompaniyada qoladi — skan 200, sotilgan', async () => {
    const res = await scan(ord.A.qr);
    expectOk(res);
    expect(res.body.data.order.status).toBe('sold');
  });
});

// ═══════════════════ 13. PARALLEL SO'ROVLAR ═══════════════════

describe("13. parallel so'rovlar", () => {
  beforeAll(async () => {
    await dispatch(['G', 'H'], CARRIER_COURIER_ID);
  });

  it('bir posilkani ikki marta parallel skan — faqat bittasi received:true', async () => {
    const results = await Promise.all([
      scan(ord.G.qr),
      scan(ord.G.qr),
      scan(ord.G.qr),
    ]);
    for (const r of results) expectOk(r);
    expect(results.filter((r) => r.body.data.received === true)).toHaveLength(
      1,
    );
    expect((await orderRow(ord.G.id)).status).toBe('waiting');
  });

  it('ayni kalit bilan parallel sold — pul BIR marta', async () => {
    const balance = await courierBalance();
    const key = newIdemKey();
    const results = await Promise.all([
      setStatus(ord.G.id, SOLD_BODY, key),
      setStatus(ord.G.id, SOLD_BODY, key),
      setStatus(ord.G.id, SOLD_BODY, key),
    ]);
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 200).length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      if (r.status !== 200)
        expectCarrierError(r, 409, 'IDEMPOTENCY_IN_PROGRESS');
    }
    expect(await courierBalance()).toBe(
      balance + ORDER_TOTAL - FROZEN_CENTER_TARIFF,
    );
    expect(await courierHistory(ord.G.id)).toHaveLength(1);
  });

  it("in_progress kalit — 409 IDEMPOTENCY_IN_PROGRESS; lease o'tgach qayta egallanadi", async () => {
    await dispatch(['W'], CARRIER_COURIER_ID);
    const key = newIdemKey();
    // Hali qabul qilinmagan (on the road) — 400, kalit `failed` bo'lib qoladi.
    expectCarrierError(await setStatus(ord.W.id, SOLD_BODY, key), 400);
    const hash = createHash('sha256').update(key).digest('hex');
    const [row] = await q(
      `SELECT state FROM carrier_idempotency_key WHERE key_hash = $1`,
      [hash],
    );
    expect(row.state).toBe('failed');

    expectOk(await scan(ord.W.qr));
    // Boshqa jarayon hozir shu kalit bilan ishlayapti (lease tirik).
    await q(
      `UPDATE carrier_idempotency_key SET state = 'in_progress', lease_until = $2 WHERE key_hash = $1`,
      [hash, Date.now() + 60_000],
    );
    const balance = await courierBalance();
    expectCarrierError(
      await setStatus(ord.W.id, SOLD_BODY, key),
      409,
      'IDEMPOTENCY_IN_PROGRESS',
    );
    expect(await courierBalance()).toBe(balance);

    // Jarayon o'lgan (lease o'tgan) — kalit qayta egallanadi va amal bajariladi.
    await q(
      `UPDATE carrier_idempotency_key SET lease_until = $2 WHERE key_hash = $1`,
      [hash, Date.now() - 1],
    );
    const res = await setStatus(ord.W.id, SOLD_BODY, key);
    expectOk(res);
    expect(res.body.data.order.status).toBe('sold');
    expect(await courierBalance()).toBe(
      balance + ORDER_TOTAL - FROZEN_CENTER_TARIFF,
    );
    const [after] = await q(
      `SELECT state FROM carrier_idempotency_key WHERE key_hash = $1`,
      [hash],
    );
    expect(after.state).toBe('completed');
  });

  it("⭐ crash oynasi: sotuv commit bo'ldi, kalit `completed` bo'lmadi (deploy) — ayni kalit bilan qayta urinish 200, pul BIR marta", async () => {
    await dispatch(['V'], CARRIER_COURIER_ID);
    expectOk(await scan(ord.V.qr));
    const balance = await courierBalance();
    const key = newIdemKey();
    expectOk(await setStatus(ord.V.id, SOLD_BODY, key));
    const afterSale = await courierBalance();
    expect(afterSale).toBe(balance + ORDER_TOTAL - FROZEN_CENTER_TARIFF);

    // Jarayon commit'dan keyin, `complete()` dan OLDIN o'ldi: kalit
    // `in_progress`, lease o'tgan. Avval shu holatda "waiting emas" 400
    // (qayta urinmang) qaytardi.
    const hash = createHash('sha256').update(key).digest('hex');
    await q(
      `UPDATE carrier_idempotency_key SET state = 'in_progress', lease_until = $2, http_status = NULL WHERE key_hash = $1`,
      [hash, Date.now() - 1],
    );
    const retry = await setStatus(ord.V.id, SOLD_BODY, key);
    expectOk(retry);
    expect(retry.body.data.order.status).toBe('sold');
    expect(await courierBalance()).toBe(afterSale);
    expect(await courierHistory(ord.V.id)).toHaveLength(1);
    const [row] = await q(
      `SELECT state FROM carrier_idempotency_key WHERE key_hash = $1`,
      [hash],
    );
    expect(row.state).toBe('completed');

    let recovered: any;
    for (let i = 0; i < 40 && !recovered; i++) {
      [recovered] = await q(
        `SELECT metadata FROM activity_logs WHERE entity_type = 'order' AND entity_id = $1 AND action = 'carrier.sold' AND metadata->>'recovered_after_takeover' = 'true'`,
        [ord.V.id],
      );
      if (!recovered) await new Promise((r) => setTimeout(r, 50));
    }
    expect(recovered).toBeDefined();
  });

  /**
   * Turli kalit, AYNI amal: yutqazganlar ham 200 olishi mumkin (spec I1
   * 1-qoida — buyurtma maqsad holatda va natija aynan shu amalniki) yoki
   * 400 (oldindan tekshiruvda allaqachon `sold`). Asosiysi — pul BIR marta.
   */
  it('turli kalitlar bilan parallel sold — pul BIR marta', async () => {
    expectOk(await scan(ord.H.qr));
    const balance = await courierBalance();
    const results = await Promise.all([
      setStatus(ord.H.id, SOLD_BODY, newIdemKey()),
      setStatus(ord.H.id, SOLD_BODY, newIdemKey()),
      setStatus(ord.H.id, SOLD_BODY, newIdemKey()),
    ]);
    expect(results.some((r) => r.status === 200)).toBe(true);
    for (const r of results) {
      if (r.status === 200) expect(r.body.data.order.status).toBe('sold');
      else expectCarrierError(r, 400);
    }
    expect(await courierBalance()).toBe(
      balance + ORDER_TOTAL - FROZEN_CENTER_TARIFF,
    );
    expect(await courierHistory(ord.H.id)).toHaveLength(1);
  });

  /**
   * sold va partly_sold bir vaqtda (turli kalit): yutqazgan 200 OLMASLIGI
   * kerak — aks holda kompaniya qisman summani yig'ib, BeePost to'liq
   * sotuv yozgan (yoki aksincha) bo'lardi.
   */
  it("parallel sold va partly_sold — faqat bittasi 200, pul g'olibniki", async () => {
    await dispatch(['M'], CARRIER_COURIER_ID);
    expectOk(await scan(ord.M.qr));
    const balance = await courierBalance();
    const [sold, partly] = await Promise.all([
      setStatus(ord.M.id, SOLD_BODY, newIdemKey()),
      setStatus(
        ord.M.id,
        {
          status: 'partly_sold',
          total_price: PARTLY_PRICE,
          items: [
            { product_id: PRODUCT_1, quantity: 1 },
            { product_id: PRODUCT_2, quantity: 1 },
          ],
        },
        newIdemKey(),
      ),
    ]);
    expect([sold.status, partly.status].sort()).toEqual([200, 400]);
    const row = await orderRow(ord.M.id);
    expect(row.status).toBe('sold');
    const expectedPrice = sold.status === 200 ? ORDER_TOTAL : PARTLY_PRICE;
    expect(Number(row.total_price)).toBe(expectedPrice);
    expect(await courierBalance()).toBe(
      balance + expectedPrice - FROZEN_CENTER_TARIFF,
    );
    expect(await courierHistory(ord.M.id)).toHaveLength(1);
  });
});

// ═══════════════════ 14. POCHTA O'TKAZISH (reassign) VA YOPILISH ═══════════════════

describe('14. reassign va pochta yopilishi', () => {
  let inhousePostId: string;
  let carrierPostId: string;

  it("ichki kuryerdan carrier'ga o'tkazish — tarif QAYTA muzlatiladi", async () => {
    inhousePostId = await dispatch(['I', 'J'], INHOUSE_COURIER_ID);
    expect((await orderRow(ord.I.id)).courier_tariff).toBeNull();
    expectCarrierError(await scan(ord.I.qr), 404);

    const res = await asAdmin(
      http.patch(`/api/v1/post/reassign/${inhousePostId}`),
    ).send({
      courier_id: CARRIER_COURIER_ID,
    });
    expectOk(res);
    for (const name of ['I', 'J']) {
      expect(Number((await orderRow(ord[name].id)).courier_tariff)).toBe(
        FROZEN_CENTER_TARIFF,
      );
    }
  });

  it('oxirgi posilka skanida pochta yopiladi (received)', async () => {
    const first = await scan(ord.I.qr);
    expectOk(first);
    expect(first.body.data.received).toBe(true);
    let [post] = await q(`SELECT status FROM post WHERE id = $1`, [
      inhousePostId,
    ]);
    expect(post.status).toBe('sent');
    expectOk(await scan(ord.J.qr));
    [post] = await q(`SELECT status FROM post WHERE id = $1`, [inhousePostId]);
    expect(post.status).toBe('received');
  });

  it("carrier pochtasini — sotilgan buyurtma bilan — o'tkazib bo'lmaydi (400)", async () => {
    const mainPostId = (await orderRow(ord.A.id)).post_id;
    const res = await asAdmin(
      http.patch(`/api/v1/post/reassign/${mainPostId}`),
    ).send({
      courier_id: INHOUSE_COURIER_ID,
    });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/Carrier/);
    const [post] = await q(`SELECT courier_id FROM post WHERE id = $1`, [
      mainPostId,
    ]);
    expect(post.courier_id).toBe(CARRIER_COURIER_ID);
  });

  it("carrier'dan ichki kuryerga (hammasi yo'lda) — mumkin, carrier endi ko'rmaydi", async () => {
    carrierPostId = await dispatch(['K', 'L'], CARRIER_COURIER_ID);
    const res = await asAdmin(
      http.patch(`/api/v1/post/reassign/${carrierPostId}`),
    ).send({
      courier_id: INHOUSE_COURIER_ID,
    });
    expectOk(res);
    expectCarrierError(await scan(ord.K.qr), 404);
    const list = await listOrders({ status: 'on the road', limit: 100 });
    expect(list.body.data.items.map((o: any) => o.id)).not.toContain(ord.K.id);
  });
});

// ═══════════════════ 15. QO'SHIMCHA CHEGARALAR ═══════════════════

describe('15. bekor → rollback, tovar qatorlari chegaralari', () => {
  it('cancelled → rollback → waiting, keyin qayta bekor', async () => {
    await dispatch(['N'], CARRIER_COURIER_ID);
    expectOk(await scan(ord.N.qr));
    const balance = await courierBalance();
    expectOk(
      await setStatus(
        ord.N.id,
        { status: 'cancelled', reason: 'CUSTOMER_NO_ANSWER' },
        newIdemKey(),
      ),
    );
    const rb = await setStatus(ord.N.id, { status: 'rollback' }, newIdemKey());
    expectOk(rb);
    expect(rb.body.data.order.status).toBe('waiting');
    expect(await courierBalance()).toBe(balance);
    const again = await setStatus(
      ord.N.id,
      { status: 'cancelled', reason: 'OTHER', comment: 'Manzil yopiq' },
      newIdemKey(),
    );
    expectOk(again);
    expect((await orderRow(ord.N.id)).comment).toContain(
      '[OTHER] Manzil yopiq',
    );
  });

  it('qisman sotuv → rollback (bola hali qaytarilmagan) — asl narx, bola birlashadi, pul qaytadi', async () => {
    await dispatch(['S'], CARRIER_COURIER_ID);
    expectOk(await scan(ord.S.qr));
    const balance = await courierBalance();
    expectOk(
      await setStatus(
        ord.S.id,
        {
          status: 'partly_sold',
          total_price: PARTLY_PRICE,
          items: [
            { product_id: PRODUCT_1, quantity: 1 },
            { product_id: PRODUCT_2, quantity: 1 },
          ],
        },
        newIdemKey(),
      ),
    );
    expect(await courierBalance()).toBe(
      balance + PARTLY_PRICE - FROZEN_CENTER_TARIFF,
    );
    const [child] = await q(
      `SELECT id, status FROM "order" WHERE parent_order_id = $1`,
      [ord.S.id],
    );
    expect(child.status).toBe('cancelled');

    const rb = await setStatus(ord.S.id, { status: 'rollback' }, newIdemKey());
    expectOk(rb);
    expect(rb.body.data.order).toMatchObject({
      status: 'waiting',
      total_price: ORDER_TOTAL,
    });
    expect(await courierBalance()).toBe(balance);
    const items = await q(
      `SELECT "productId", quantity FROM order_item WHERE "orderId" = $1 ORDER BY "productId"`,
      [ord.S.id],
    );
    expect(items).toEqual([
      { productId: PRODUCT_1, quantity: 2 },
      { productId: PRODUCT_2, quantity: 1 },
    ]);
    // Bola endi kompaniya ro'yxatida ham, qaytarishda ham yo'q.
    const list = await listOrders({ limit: 100 });
    expect(list.body.data.items.map((o: any) => o.id)).not.toContain(child.id);
  });

  it("qaytarilgan posilkani rollback qilib bo'lmaydi — 400", async () => {
    expectOk(await returns([ord.N.id]));
    expectCarrierError(
      await setStatus(ord.N.id, { status: 'rollback' }, newIdemKey()),
      400,
    );
    expect((await orderRow(ord.N.id)).status).toBe('cancelled (sent)');
  });

  it("tovar qatorlari yo'q buyurtma (marketplace/tashqi) — partly_sold 400", async () => {
    await dispatch(['P'], CARRIER_COURIER_ID);
    expectOk(await scan(ord.P.qr));
    await q(`DELETE FROM order_item WHERE "orderId" = $1`, [ord.P.id]);
    const res = await setStatus(
      ord.P.id,
      {
        status: 'partly_sold',
        total_price: 100_000,
        items: [{ product_id: PRODUCT_1, quantity: 1 }],
      },
      newIdemKey(),
    );
    expectCarrierError(res, 400);
    expect(res.body.message).toMatch(/tovar qatorlari yo'q/);
    expect((await orderRow(ord.P.id)).status).toBe('waiting');
  });

  it('bitta mahsulot ikki qatorda — partly_sold 400', async () => {
    await dispatch(['Q'], CARRIER_COURIER_ID);
    expectOk(await scan(ord.Q.qr));
    await q(`UPDATE order_item SET "productId" = $1 WHERE "orderId" = $2`, [
      PRODUCT_1,
      ord.Q.id,
    ]);
    const res = await setStatus(
      ord.Q.id,
      {
        status: 'partly_sold',
        total_price: 100_000,
        items: [{ product_id: PRODUCT_1, quantity: 1 }],
      },
      newIdemKey(),
    );
    expectCarrierError(res, 400);
    expect(res.body.message).toMatch(/bir necha qatorda/);
  });
});

// ═══════════════════ 16. MARKAZ QAYTARISH POCHTASINI QABUL QILADI ═══════════════════

describe('16. markaz qaytarish pochtasini qabul qiladi', () => {
  let oldReturnPostId: string;

  it("qisman qabul: qabul qilinmagani kompaniyaga cancelled bo'lib qaytadi", async () => {
    oldReturnPostId = (await orderRow(ord.C.id)).canceled_post_id;
    expect((await orderRow(ord.N.id)).canceled_post_id).toBe(oldReturnPostId);

    const res = await asAdmin(
      http.post(`/api/v1/post/cancel/receive/${oldReturnPostId}`),
    ).send({
      order_ids: [ord.C.id, ord.Bchild.id],
    });
    expect(res.status).toBeLessThan(300);
    const [post] = await q(`SELECT status FROM post WHERE id = $1`, [
      oldReturnPostId,
    ]);
    expect(post.status).toBe('canceled_received');
    expect((await orderRow(ord.C.id)).status).toBe('cancelled (sent)');
    const n = await orderRow(ord.N.id);
    expect(n.status).toBe('cancelled');
    expect(n.canceled_post_id).toBeNull();

    // Qaytgan posilka yana kompaniya ro'yxatida, markazdagilari yo'q.
    const list = await listOrders({ status: 'cancelled', limit: 100 });
    const ids = list.body.data.items.map((o: any) => o.id);
    expect(ids).toContain(ord.N.id);
    expect(ids).not.toContain(ord.C.id);
  });

  it('qaytgan posilka qayta qaytariladi — YANGI qaytarish pochtasi', async () => {
    const res = await returns([ord.N.id]);
    expectOk(res);
    expect(res.body.data.post_id).not.toBe(oldReturnPostId);
    const n = await orderRow(ord.N.id);
    expect(n.status).toBe('cancelled (sent)');
    expect(n.canceled_post_id).toBe(res.body.data.post_id);
  });

  it("markazga yetgan posilka uchun takroriy returns — o'sha (eski) post_id", async () => {
    const res = await returns([ord.C.id]);
    expectOk(res);
    expect(res.body.data.post_id).toBe(oldReturnPostId);
    const scanned = await scan(ord.C.qr);
    expectOk(scanned);
    expect(scanned.body.data).toMatchObject({
      received: false,
      order: { status: 'cancelled (sent)' },
    });
  });
});

// ═══════════════════ 17. BAZA XATOLARI (503 / 500) ═══════════════════

/**
 * Baza xatosini haqiqiy Postgres'da hosil qilish: jadval vaqtincha qayta
 * nomlanadi (faqat `pcs_e2e`), `finally` da albatta tiklanadi.
 */
async function withTableRenamed(table: string, fn: () => Promise<void>) {
  await q(`ALTER TABLE "${table}" RENAME TO "${table}_e2e_off"`);
  try {
    await fn();
  } finally {
    await q(`ALTER TABLE "${table}_e2e_off" RENAME TO "${table}"`);
  }
}

describe('17. baza xatolari — kontrakt kodlari, ichki matn sizmaydi', () => {
  it("kalitni tekshirib bo'lmasa — 503 CARRIER_KEY_CHECK_UNAVAILABLE (401 emas) + Retry-After", async () => {
    await withTableRenamed('carrier_account', async () => {
      const res = await ping();
      expectCarrierError(res, 503, 'CARRIER_KEY_CHECK_UNAVAILABLE');
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      expect(JSON.stringify(res.body)).not.toMatch(
        /carrier_account|relation|SELECT/i,
      );
    });
    expectOk(await ping());
  });

  it('idempotency daftari ishlamasa — 503 CARRIER_TEMPORARILY_UNAVAILABLE, pul yozilmaydi', async () => {
    await dispatch(['Y'], CARRIER_COURIER_ID);
    expectOk(await scan(ord.Y.qr));
    const balance = await courierBalance();
    const key = newIdemKey();
    await withTableRenamed('carrier_idempotency_key', async () => {
      expectCarrierError(
        await setStatus(ord.Y.id, SOLD_BODY, key),
        503,
        'CARRIER_TEMPORARILY_UNAVAILABLE',
      );
    });
    expect(await courierBalance()).toBe(balance);
    expect((await orderRow(ord.Y.id)).status).toBe('waiting');
    // Ayni kalit bilan qayta urinish — endi bajariladi.
    expectOk(await setStatus(ord.Y.id, SOLD_BODY, key));
    expect(await courierBalance()).toBe(
      balance + ORDER_TOTAL - FROZEN_CENTER_TARIFF,
    );
  });

  it('kutilmagan xato — 500, umumiy matn (SQL sizmaydi), trace_id', async () => {
    await withTableRenamed('cashbox_history', async () => {
      const res = await cashboxReq();
      expectCarrierError(res, 500);
      expect(res.body.message).toMatch(/trace_id/);
      expect(JSON.stringify(res.body)).not.toMatch(
        /cashbox_history|relation|SELECT/i,
      );
    });
  });
});

// ═══════════════════ 18. ADMIN: KALIT, O'CHIRISH, BLOK, LIMIT ═══════════════════

describe('18. Admin boshqaruvi', () => {
  it('rotate-key — eski kalit darhol 401, yangisi ishlaydi', async () => {
    const res = await asAdmin(
      http.post(`/api/v1/carrier-accounts/${accountId}/rotate-key`),
    );
    expectOk(res);
    const newKey = res.body.data.api_key;
    expect(newKey).toMatch(/^bpc_[0-9a-f]{64}$/);
    expect(newKey).not.toBe(carrierKey);
    expectCarrierError(await ping(carrierKey), 401);
    carrierKey = newKey;
    expectOk(await ping());
  });

  it("akkaunt o'chirilsa (is_active=false) — 403, yoqilsa — 200", async () => {
    const off = await asAdmin(
      http.post(`/api/v1/carrier-accounts/${accountId}/status`),
    ).send({
      is_active: false,
    });
    expectOk(off);
    expect(off.body.data.is_active).toBe(false);
    const denied = await ping();
    expectCarrierError(denied, 403);
    expect(denied.body.code).toBeUndefined();

    const on = await asAdmin(
      http.post(`/api/v1/carrier-accounts/${accountId}/status`),
    ).send({
      is_active: true,
    });
    expectOk(on);
    expectOk(await ping());
  });

  it('kuryer bloklansa — DARHOL 403 CARRIER_COURIER_INACTIVE', async () => {
    await q(`UPDATE users SET status = 'inactive' WHERE id = $1`, [
      CARRIER_COURIER_ID,
    ]);
    try {
      expectCarrierError(await ping(), 403, 'CARRIER_COURIER_INACTIVE');
      expectCarrierError(await scan(ord.A.qr), 403, 'CARRIER_COURIER_INACTIVE');
      // Bloklangan kuryerga kalit berilmaydi.
      const rotate = await asAdmin(
        http.post(`/api/v1/carrier-accounts/${accountId}/rotate-key`),
      );
      expect(rotate.status).toBe(400);
    } finally {
      await q(`UPDATE users SET status = 'active' WHERE id = $1`, [
        CARRIER_COURIER_ID,
      ]);
    }
    expectOk(await ping());
  });

  it("rate limit — 429 + Retry-After + trace_id (akkaunt bo'yicha)", async () => {
    const saved = config.CARRIER_THROTTLE_LIMIT;
    (config as { CARRIER_THROTTLE_LIMIT: number }).CARRIER_THROTTLE_LIMIT = 3;
    try {
      for (let i = 0; i < 3; i++) expectOk(await ping(carrier2Key));
      const limited = await ping(carrier2Key);
      expectCarrierError(limited, 429);
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
      // Savat — BARCHA endpointlar uchun bitta (boshqa yo'l ham bloklangan).
      expectCarrierError(
        await withKey(http.get('/api/v1/carrier/orders'), carrier2Key),
        429,
      );
    } finally {
      (config as { CARRIER_THROTTLE_LIMIT: number }).CARRIER_THROTTLE_LIMIT =
        saved;
    }
    // Limit qaytarilgandan keyin ham 2-akkaunt blok muddati (ttl) davomida
    // bloklangan, 1-akkaunt esa ishlaydi — savatlar akkaunt bo'yicha alohida.
    expectCarrierError(await ping(carrier2Key), 429);
    expectOk(await ping(carrierKey));
  });

  it("DELETE — kalit 401, kuryer provayderdan bo'shaydi", async () => {
    const res = await asAdmin(
      http.delete(`/api/v1/carrier-accounts/${account2Id}`),
    );
    expectOk(res);
    expect(res.body.data).toEqual({
      id: account2Id,
      deleted: true,
      courier_released: true,
    });
    const [u] = await q(`SELECT external_provider FROM users WHERE id = $1`, [
      CARRIER_COURIER_2_ID,
    ]);
    expect(u.external_provider).toBeNull();
    const [acc] = await q(
      `SELECT is_deleted, is_active FROM carrier_account WHERE id = $1`,
      [account2Id],
    );
    expect(acc).toEqual({ is_deleted: true, is_active: false });
    expectCarrierError(await ping(carrier2Key), 401);

    const again = await asAdmin(
      http.delete(`/api/v1/carrier-accounts/${account2Id}`),
    );
    expect(again.status).toBe(404);
    const list = await asAdmin(http.get('/api/v1/carrier-accounts'));
    expect(list.body.data.map((a: any) => a.id)).not.toContain(account2Id);
  });

  it("o'chirilgan akkaunt kuryerni bo'shatadi — QISMAN noyob indeks yangi akkauntga yo'l qo'yadi", async () => {
    const res = await asAdmin(http.post('/api/v1/carrier-accounts')).send({
      name: 'E2E Express 2 (qayta)',
      courier_id: CARRIER_COURIER_2_ID,
    });
    expectOk(res, 201);
    expect(res.body.data.account.id).not.toBe(account2Id);
    const [{ n }] = await q(
      `SELECT count(*)::int AS n FROM carrier_account WHERE courier_user_id = $1`,
      [CARRIER_COURIER_2_ID],
    );
    expect(n).toBe(2);
    expectCarrierError(await ping(carrier2Key), 401);
    const fresh = await ping(res.body.data.api_key);
    // Yangi akkaunt — yangi savat (eski akkauntning 429 bloki unga o'tmaydi).
    expectOk(fresh);
    expect(fresh.body.data.carrier.name).toBe('E2E Express 2 (qayta)');
  });

  it('pochtasi bor kuryerga akkaunt ochilmaydi — 400', async () => {
    const res = await asAdmin(http.post('/api/v1/carrier-accounts')).send({
      name: 'Ichki kuryer',
      courier_id: INHOUSE_COURIER_ID,
    });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/pochta/);
    const [u] = await q(`SELECT external_provider FROM users WHERE id = $1`, [
      INHOUSE_COURIER_ID,
    ]);
    expect(u.external_provider).toBeNull();
  });

  it("admin endpointlari JWT'siz yopiq", async () => {
    const res = await http.get('/api/v1/carrier-accounts');
    expect([401, 403, 404]).toContain(res.status);
  });

  it("⭐ carrier kuryeri parol ma'lum bo'lsa ham tizimga KIRA OLMAYDI (token va cookie yo'q)", async () => {
    // Kimdir bazada parolni bilgan qiymatga qo'ygan bo'lsin.
    const hash = await bcrypt.hash('e2e-known-pass', 4);
    await q(`UPDATE users SET password = $2 WHERE id = $1`, [
      CARRIER_COURIER_ID,
      hash,
    ]);
    const res = await http
      .post('/api/v1/user/signin')
      .send({ phone_number: '+998900100007', password: 'e2e-known-pass' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(CARRIER_COURIER_LOGIN_MESSAGE);
    expect(res.body?.data?.access_token).toBeUndefined();
    expect(String(res.headers['set-cookie'] ?? '')).not.toMatch(
      /refreshToken=/,
    );
  });

  it("yaqinda kirilgan kuryer carrier'ga bog'lanmaydi — 400 (tirik sessiya)", async () => {
    const courierId = randomUUID();
    await q(
      `INSERT INTO users (id, created_at, updated_at, name, phone_number, role, status, region_id, tariff_center, tariff_home, default_tariff)
       VALUES ($1, 1, 1, 'E2E Sinab ko''rilgan', '+998900100099', 'courier', 'active', $2, 15000, 18000, 'center')`,
      [courierId, REGION_ID],
    );
    await q(
      `INSERT INTO activity_logs (id, created_at, updated_at, entity_type, entity_id, action, description, user_id)
       VALUES ($1, $2, $2, 'user', $3, 'login', 'e2e', $3)`,
      [randomUUID(), Date.now() - 3_600_000, courierId],
    );
    const res = await asAdmin(http.post('/api/v1/carrier-accounts')).send({
      name: 'Sinab ko‘rilgan',
      courier_id: courierId,
    });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/yaqinda tizimga kirilgan/);
    const [u] = await q(`SELECT external_provider FROM users WHERE id = $1`, [
      courierId,
    ]);
    expect(u.external_provider).toBeNull();
  });

  it("⭐ super EMAS carrier'ga o'tkazish: begona muzlatilgan tarif — 400; 0 va NULL — o'tadi, tegilmaydi", async () => {
    const postId = await dispatch(['T', 'T2'], INHOUSE_COURIER_ID);
    // Ichki kuryer sotib, rollback qilgan: sotuvdagi muzlatish qolgan
    // (`rollbackOrderToWaiting` `courier_tariff` ni tozalamaydi).
    await q(`UPDATE "order" SET courier_tariff = 20000 WHERE id = $1`, [
      ord.T.id,
    ]);
    const refused = await asAdmin(
      http.patch(`/api/v1/post/reassign/${postId}`),
    ).send({ courier_id: CARRIER_COURIER_2_ID });
    expect(refused.status).toBe(400);
    expect(String(refused.body.message)).toContain(
      `#${(await orderRow(ord.T.id)).order_number}`,
    );
    let [post] = await q(`SELECT courier_id FROM post WHERE id = $1`, [postId]);
    expect(post.courier_id).toBe(INHOUSE_COURIER_ID);

    // Marketplace ko'p qutili buyurtmaning to'lovsiz qutisi — buyurtma xossasi.
    await q(`UPDATE "order" SET courier_tariff = 0 WHERE id = $1`, [ord.T.id]);
    expectOk(
      await asAdmin(http.patch(`/api/v1/post/reassign/${postId}`)).send({
        courier_id: CARRIER_COURIER_2_ID,
      }),
    );
    [post] = await q(`SELECT courier_id FROM post WHERE id = $1`, [postId]);
    expect(post.courier_id).toBe(CARRIER_COURIER_2_ID);
    expect(Number((await orderRow(ord.T.id)).courier_tariff)).toBe(0);
    expect((await orderRow(ord.T2.id)).courier_tariff).toBeNull();
  });
});
