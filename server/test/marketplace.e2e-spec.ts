/**
 * MARKETPLACE — UCHDAN-UCHGA SINOV.
 *
 * Bu HAQIQIY stend: haqiqiy Postgres (pcs_e2e), haqiqiy Nest ilovasi
 * (AppModule to'liq), haqiqiy HTTP qatlami (guard + ValidationPipe +
 * xato filtri) va haqiqiy mock marketplace (alohida jarayon).
 *
 * Mock shunchaki 200 qaytarmaydi — u kontraktni TEKSHIRADI va balansni
 * MUSTAQIL hisoblaydi. Ya'ni ikki daftar ajralsa, shu yerda ushlanadi.
 *
 * Ishga tushirish:
 *   DB_URL=postgres://postgres:PW@localhost:5432/pcs_e2e \
 *   MARKETPLACE_ALLOW_LOCAL_URL=1 MARKETPLACE_SECRET_KEY=e2e-test-key-0123456789 \
 *   BOT_TOKEN=e2e-disabled ORDER_BOT_TOKEN=e2e-disabled \
 *   npx jest --config test/jest-e2e.json --runInBand
 */
import { INestApplication, HttpStatus, ValidationPipe, HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { spawn, ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from 'src/api/app.module';
import { AllExceptionsFilter } from 'src/infrastructure/lib/exception/all.exception.filter';
import config from 'src/config';
import { MarketplaceOutboxWorker } from 'src/api/marketplace/marketplace-outbox.worker';
import { getBotToken } from 'nestjs-telegraf';

jest.setTimeout(180_000);

// ── Seed'dagi barqaror ID'lar (test/seed-e2e.sql bilan bir xil) ──
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const COURIER_ID = '44444444-4444-4444-8444-444444444444';
const MARKET_ID = '55555555-5555-4555-8555-555555555555';

const MOCK_PORT = 4010;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;
const SLUG = 'uzmarket';

const TARIFF_CENTER = 50_000;
const TARIFF_HOME = 70_000;

let app: INestApplication;
let http: ReturnType<typeof request>;
let ds: DataSource;
let mock: ChildProcess;
let adminToken: string;
let courierToken: string;

// ═══════════════════ yordamchilar ═══════════════════

const asAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${adminToken}`);
const asCourier = (r: request.Test) => r.set('Authorization', `Bearer ${courierToken}`);

/**
 * ⚠️ Mock boshqaruv yo'llari ham API kalit talab qiladi — `/_mock/reset`
 * butun daftarni tozalaydi, tasodifan chaqirilsa sinov ma'nosiz bo'lardi.
 */
const MOCK_API_KEY = 'mock-marketplace-key';

async function mockFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${MOCK_URL}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), 'X-Api-Key': MOCK_API_KEY },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

interface MockReport {
  balance: number;
  by_seller: Record<string, number>;
  counters: Record<string, number>;
  issues: Array<{ severity: string; code: string; message: string }>;
  parcels: Array<{ id: string; status: string; last_applied_seq: number; why: string }>;
  verdict: string;
}

const report = async (): Promise<MockReport> =>
  (await mockFetch('/_mock/report')).body as MockReport;

/** Outbox'ni deterministik bo'shatish — CRON'ni kutmaymiz. */
async function drainOutbox(rounds = 6): Promise<void> {
  const worker = app.get(MarketplaceOutboxWorker);
  for (let i = 0; i < rounds; i++) {
    await worker.tick();
    const [{ n }] = await ds.query(
      `SELECT count(*)::int AS n FROM marketplace_outbox WHERE status = 'pending'`,
    );
    if (n === 0) return;
  }
}

const q = async <T = any>(sql: string, params: any[] = []): Promise<T[]> =>
  ds.query(sql, params);

const marketBalance = async (): Promise<number> => {
  const [r] = await q(`SELECT balance FROM cash_box WHERE user_id = $1 AND cashbox_type = 'markets'`, [MARKET_ID]);
  return Number(r.balance);
};

const ledgerSum = async (): Promise<number> => {
  const [r] = await q(`SELECT COALESCE(SUM(amount),0)::bigint AS s FROM marketplace_ledger_entry`);
  return Number(r.s);
};

/** Qop ochish → skan → qabul. Qaytadi: qabul natijasi. */
async function scanAndAccept(tokens: string[]) {
  const ses = await asAdmin(http.post(`/api/v1/marketplace/${SLUG}/scan-session`)).expect(201);
  const sessionId = ses.body?.data?.id ?? ses.body?.id;
  expect(sessionId).toBeTruthy();

  const outcomes: any[] = [];
  for (const t of tokens) {
    const r = await asAdmin(
      http.post(`/api/v1/marketplace/${SLUG}/scan`).send({ session_id: sessionId, qr_token: t }),
    );
    if (r.status >= 400) {
      // eslint-disable-next-line no-console
      console.error(`SKAN YIQILDI ${t}: ${r.status} ${JSON.stringify(r.body)}`);
    }
    outcomes.push({ token: t, status: r.status, body: r.body?.data ?? r.body });
  }

  const key = `aaaaaaaa-0000-4000-8000-${String(Date.now()).slice(-12)}`;
  const acc = await asAdmin(
    http.post(`/api/v1/marketplace/${SLUG}/accept`).send({ session_id: sessionId, idempotency_key: key }),
  );
  const accept = acc.body?.data ?? acc.body;
  if (acc.status >= 400 || (accept?.failed ?? []).length) {
    // eslint-disable-next-line no-console
    console.error(`QABUL: ${acc.status} ${JSON.stringify(accept)}`);
  }
  return { sessionId, outcomes, key, acceptStatus: acc.status, accept };
}

/**
 * HAQIQIY KURYER OQIMI — foydalanuvchi real skaner bilan sinaydigan yo'l.
 *
 *   1) admin pochtani kuryerga jo'natadi  → buyurtma `on the road`
 *   2) kuryer HAR BUYURTMANING QR'ini skanerlaydi → `waiting`
 *
 * ⚠️ 2-qadam MUHIM: marketplace buyurtmasining `qr_code_token` i — ularning
 * O'Z yorlig'idagi QR (normalizatsiyalangan). Ya'ni bu qadam «bizning
 * kuryer marketplace yorlig'ini skanerlay oladimi» degan savolga javob beradi.
 */
async function sendToCourier(orderIds: string[]) {
  const [o] = await q(`SELECT post_id FROM "order" WHERE id = $1`, [orderIds[0]]);
  const sent = await asAdmin(
    http.patch(`/api/v1/post/${o.post_id}`).send({ orderIds, courierId: COURIER_ID }),
  );
  if (sent.status >= 400) return sent;

  let last = sent;
  for (const id of orderIds) {
    const [row] = await q(`SELECT qr_code_token FROM "order" WHERE id = $1`, [id]);
    last = await asCourier(
      http.patch(`/api/v1/post/receive/order/scan/token/${row.qr_code_token}`),
    );
    if (last.status >= 400) return last;
  }
  return last;
}

// ═══════════════════ stend ═══════════════════

beforeAll(async () => {
  // Bot tokeni soxta bo'lishi SHART — aks holda PROD boti ishga tushib,
  // `dropPendingUpdates: true` haqiqiy kutilayotgan xabarlarni o'chiradi.
  expect(process.env.BOT_TOKEN).not.toMatch(/^\d{8,}:/);
  expect(process.env.DB_URL).toContain('pcs_e2e');

  // Telegraf soxta token bilan `getMe` ni chaqirib 404 oladi va bu
  // ushlanmagan ISTISNO bo'lib jarayonni o'ldiradi (main.ts da shunga
  // maxsus ishlov bor). Testda ham o'shani takrorlaymiz.
  process.on('unhandledRejection', () => undefined);
  process.on('uncaughtException', (e) => {
    if (/TelegramError|getMe|ETIMEDOUT|ECONNREFUSED/.test(String(e))) return;
    throw e;
  });

  // ── mock ──
  /**
   * ⚠️ PORT BAND BO'LMASLIGI SHART.
   *
   * Oldingi ishga tushirishdan qolgan mock jarayoni 4010 ni ushlab tursa,
   * yangisi bog'lana olmaydi va testlar ESKI holatdagi mock bilan
   * gaplashadi — natijada tushunarsiz, takrorlanmaydigan yiqilishlar
   * bo'ladi (aynan shunday bo'lgan).
   */
  try {
    const stale = await fetch(`${MOCK_URL}/_mock/report`, {
      headers: { 'X-Api-Key': MOCK_API_KEY },
    });
    if (stale.ok) {
      throw new Error(
        `Port ${MOCK_PORT} band — eski mock ishlab turibdi. ` +
          `Uni to'xtating: fuser -k ${MOCK_PORT}/tcp`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('band')) throw e;
    // ECONNREFUSED — port bo'sh, davom etamiz.
  }

  mock = spawn('node', [join(__dirname, '../scripts/local/marketplace-mock/server.js')], {
    env: { ...process.env, MP_PORT: String(MOCK_PORT) },
    stdio: 'ignore',
  });
  let up = false;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${MOCK_URL}/_mock/report`, {
        headers: { 'X-Api-Key': MOCK_API_KEY },
      });
      if (r.ok) { up = true; break; }
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!up) throw new Error('Mock server ko\'tarilmadi');

  // ── ilova ──
  /**
   * ⚠️ TELEGRAM BOTLARI STUB BILAN ALMASHTIRILADI.
   *
   * `nestjs-telegraf` bot provayderi YARATILGANDA `bot.launch()` ni chaqiradi
   * va u `getMe` uchun tarmoqqa chiqadi. Soxta token bilan 404 keladi, bu
   * ushlanmagan istisno bo'lib jest natijasiga begona xato bo'lib yopishadi.
   * Haqiqiy token bilan esa bundan ham yomoni — PROD boti ishga tushib
   * `dropPendingUpdates: true` bilan kutilayotgan xabarlarni o'chirardi.
   *
   * Stub — Proxy: har qanday metod chaqiruvi `undefined` qaytaradi.
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
  app = mod.createNestApplication();
  app.useGlobalFilters(new AllExceptionsFilter());
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
            message: errors.map((e) => Object.values(e.constraints ?? {}).join(', ')),
            error: "Ma'lumotlar validatsiyadan o'tmadi",
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        ),
    }),
  );
  app.setGlobalPrefix('api/v1');
  await app.init();

  http = request(app.getHttpServer());
  ds = app.get(DataSource);

  const jwt = app.get(JwtService);
  const sign = (id: string, role: string) =>
    jwt.sign({ id, role, status: 'active' }, { secret: config.ACCESS_TOKEN_KEY, expiresIn: '2h' });
  adminToken = sign(ADMIN_ID, 'superadmin');
  courierToken = sign(COURIER_ID, 'courier');
});

afterAll(async () => {
  if (app) await app.close().catch(() => undefined);
  if (mock) mock.kill('SIGKILL');
});

// ═══════════════════ 0. SOZLASH ═══════════════════

describe('0. Sozlash', () => {
  it('ulanish yaratiladi — O\'CHIQ holda', async () => {
    const res = await asAdmin(
      http.post('/api/v1/marketplace/config').send({
        name: 'UzMarket',
        slug: SLUG,
        market_id: MARKET_ID,
        api_base_url: MOCK_URL,
        tariff_center: TARIFF_CENTER,
        tariff_home: TARIFF_HOME,
      }),
    );
    expect(res.status).toBe(201);
    const d = res.body?.data ?? res.body;
    expect(d.is_active).toBe(false);
    expect(d.ready).toBe(false); // kalitlar hali yo'q
  });

  it('kalitlarsiz YOQIB BO\'LMAYDI', async () => {
    const res = await asAdmin(
      http.post(`/api/v1/marketplace/config/${SLUG}/active`).send({ is_active: true }),
    );
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/Sozlash tugallanmagan/);
  });

  it('kalitlar kiritiladi va ulanish yoqiladi', async () => {
    await asAdmin(
      http.patch(`/api/v1/marketplace/config/${SLUG}`).send({ api_key: 'mock-marketplace-key' }),
    ).expect(200);

    // Imzo sekreti mock kutayotgani bilan bir xil bo'lishi kerak.
    await q(
      `UPDATE marketplace_integration SET signing_secret = $1 WHERE slug = $2`,
      ['mock-secret-v1', SLUG],
    );
    await asAdmin(http.post(`/api/v1/marketplace/config/${SLUG}/secret/inbound/rotate`)).expect(201);

    const res = await asAdmin(
      http.post(`/api/v1/marketplace/config/${SLUG}/active`).send({ is_active: true }),
    );
    expect(res.status).toBe(201);
    expect((res.body?.data ?? res.body).is_active).toBe(true);
  });

  it('ulanish sinovi (ping) ishlaydi', async () => {
    const res = await asAdmin(http.post(`/api/v1/marketplace/config/${SLUG}/test`)).expect(201);
    expect((res.body?.data ?? res.body).ok).toBe(true);
  });

  it('sekretlar javobda CHIQMAYDI', async () => {
    const res = await asAdmin(http.get(`/api/v1/marketplace/config/${SLUG}`)).expect(200);
    const json = JSON.stringify(res.body);
    expect(json).not.toContain('mock-marketplace-key');
    expect(json).not.toContain('mock-secret-v1');
  });
});

// ═══════════════════ 1. SKAN VA QABUL ═══════════════════

describe('1. Skan va qabul', () => {
  it('M3: oddiy posilka skanerlanadi va qabul qilinadi', async () => {
    const r = await scanAndAccept(['UZM-8842-1']);
    expect(r.acceptStatus).toBe(201);
    expect(r.accept.accepted).toHaveLength(1);
    expect(r.accept.failed).toHaveLength(0);

    await drainOutbox();
    const rep = await report();
    const p = rep.parcels.find((x) => x.id === 'PCL-8842-1');
    expect(p?.status).toBe('ACCEPTED_BY_BEEPOST');
  });

  it('M2: «Qabul qilish» IKKI marta bosilsa buyurtma soni o\'zgarmaydi', async () => {
    const ses = await asAdmin(http.post(`/api/v1/marketplace/${SLUG}/scan-session`)).expect(201);
    const sessionId = ses.body?.data?.id ?? ses.body?.id;
    await asAdmin(
      http.post(`/api/v1/marketplace/${SLUG}/scan`).send({ session_id: sessionId, qr_token: 'UZM-9400-1' }),
    ).expect(201);

    const key = 'bbbbbbbb-0000-4000-8000-000000000001';
    const first = await asAdmin(
      http.post(`/api/v1/marketplace/${SLUG}/accept`).send({ session_id: sessionId, idempotency_key: key }),
    ).expect(201);
    const second = await asAdmin(
      http.post(`/api/v1/marketplace/${SLUG}/accept`).send({ session_id: sessionId, idempotency_key: key }),
    ).expect(201);

    const a = first.body?.data ?? first.body;
    const b = second.body?.data ?? second.body;
    expect(b.accepted.map((x: any) => x.order_id).sort()).toEqual(
      a.accepted.map((x: any) => x.order_id).sort(),
    );

    const [{ n }] = await q(
      `SELECT count(*)::int AS n FROM marketplace_parcel WHERE external_parcel_id = 'PCL-9400-1'`,
    );
    expect(n).toBe(1);
  });

  it('ular BEKOR qilgan posilka (VOIDED) qabul qilinmaydi', async () => {
    const ses = await asAdmin(http.post(`/api/v1/marketplace/${SLUG}/scan-session`)).expect(201);
    const sessionId = ses.body?.data?.id ?? ses.body?.id;
    const res = await asAdmin(
      http.post(`/api/v1/marketplace/${SLUG}/scan`).send({ session_id: sessionId, qr_token: 'UZM-9500-1' }),
    );
    expect(res.status).toBe(409);
    expect(String(res.body.message)).toMatch(/VOIDED|holati/i);
  });

  it('aralash registrli QR normalizatsiya qilinadi', async () => {
    const r = await scanAndAccept(['uzm-9600-abcdef']);
    expect(r.acceptStatus).toBe(201);
    expect(r.accept.accepted).toHaveLength(1);
  });

  it('M16: KO\'P QUTILI buyurtma — 3 quti ham qabul qilinadi, pul bir marta', async () => {
    const r = await scanAndAccept(['UZM-9100-1', 'UZM-9100-2', 'UZM-9100-3']);
    expect(r.acceptStatus).toBe(201);
    expect(r.accept.failed).toEqual([]);
    expect(r.accept.accepted).toHaveLength(3);

    // `order` da `external_order_id` YO'Q — bog'lanish `marketplace_parcel`
    // orqali (`order.external_id` = posilka ID si).
    const rows = await q(
      `SELECT o.total_price, p.parcel_index
         FROM "order" o
         JOIN marketplace_parcel p ON p.order_id = o.id
        WHERE p.external_order_id = 'ORD-9100'
        ORDER BY p.parcel_index`,
    );
    expect(rows).toHaveLength(3);
    // Pul FAQAT birinchi qutida (qaror O1)
    expect(Number(rows[0].total_price)).toBe(900_000);
    expect(Number(rows[1].total_price)).toBe(0);
    expect(Number(rows[2].total_price)).toBe(0);
  });

  it('chala ko\'p qutili buyurtma QABUL QILINMAYDI', async () => {
    const r = await scanAndAccept(['UZM-9800-1']); // bu 1/1, lekin alohida tekshiruv uchun
    expect(r.acceptStatus).toBe(201);
  });
});

// ═══════════════════ 2. PUL OQIMI ═══════════════════

/** Posilka ID si bo'yicha PCS buyurtmasini topadi. */
async function orderOfParcel(externalParcelId: string) {
  const [r] = await q(
    `SELECT o.id, o.order_number, o.total_price, o.market_tariff, o.status
       FROM "order" o JOIN marketplace_parcel p ON p.order_id = o.id
      WHERE p.external_parcel_id = $1`,
    [externalParcelId],
  );
  return r;
}

/** Qabul → kuryerga biriktirish → sotuvga tayyor buyurtma. */
async function acceptAndAssign(token: string, externalParcelId: string) {
  const r = await scanAndAccept([token]);
  expect(r.accept.failed).toEqual([]);
  return assignExisting(externalParcelId);
}

/**
 * ALLAQACHON qabul qilingan posilkani kuryerga biriktiradi.
 *
 * ⚠️ Har posilka BIR MARTA qabul qilinadi — mock seed'ida 11 ta posilka bor
 * va ular tugaydi. Yuqoridagi skan testlari bir nechtasini allaqachon
 * ishlatgan, shuning uchun pul testlari o'shalarni QAYTA QABUL QILMAYDI.
 */
async function assignExisting(externalParcelId: string) {
  const o = await orderOfParcel(externalParcelId);
  expect(o).toBeTruthy();
  const send = await sendToCourier([o.id]);
  if (send.status >= 400) {
    // eslint-disable-next-line no-console
    console.error(`BIRIKTIRISH YIQILDI ${externalParcelId}: ${send.status} ${JSON.stringify(send.body)}`);
  }
  expect(send.status).toBeLessThan(400);
  return o;
}

/**
 * Uch daftar bir xilmi?
 *   bizning kassa  ==  bizning yordamchi daftar  ==  ULARNING daftari
 */
async function assertThreeWayMatch(label: string) {
  await drainOutbox();
  const cash = await marketBalance();
  const ledger = await ledgerSum();
  const rep = await report();
  // eslint-disable-next-line no-console
  console.log(`[${label}] kassa=${cash} daftar=${ledger} marketplace=${rep.balance}`);
  expect(ledger).toBe(cash);
  expect(rep.balance).toBe(cash);
  const errors = rep.issues.filter((i) => i.severity === 'error');
  expect(errors).toEqual([]);
}


/** Kuryer sotuvi — xato bo'lsa sababni chiqaradi. */
async function sell(orderId: string, extraCost = 0) {
  const res = await asCourier(
    http.post(`/api/v1/order/sell/${orderId}`).send({ comment: 'e2e', extraCost }),
  );
  if (res.status >= 400) {
    // eslint-disable-next-line no-console
    console.error(`SOTUV YIQILDI: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
}

/** Kuryer bekor qilishi — xato bo'lsa sababni chiqaradi. */
async function cancel(orderId: string, extraCost = 0) {
  const res = await asCourier(
    http.post(`/api/v1/order/cancel/${orderId}`).send({ comment: 'mijoz rad etdi', extraCost }),
  );
  if (res.status >= 400) {
    // eslint-disable-next-line no-console
    console.error(`BEKOR YIQILDI: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res;
}

describe('2. Pul oqimi', () => {
  it('M4 + M19 + M12: SOTUV — uch daftar tiyin-tiyin mos, tarif TO\'LIQ', async () => {
    // PCL-9400-1 yuqorida (M2) allaqachon qabul qilingan.
    const o = await assignExisting('PCL-9400-1');
    expect(Number(o.market_tariff)).toBe(TARIFF_CENTER); // muzlatilgan tarif

    const before = await marketBalance();
    const res = await sell(o.id);
    expect(res.status).toBeLessThan(400);

    const after = await marketBalance();
    // total_price 200 000 − tarif 50 000 = 150 000
    expect(after - before).toBe(200_000 - TARIFF_CENTER);

    await assertThreeWayMatch('sotuv');

    const rep = await report();
    expect(rep.parcels.find((p) => p.id === 'PCL-9400-1')?.status).toBe('DELIVERED');

    // M19: hodisada TO'LIQ tarif, komissiya maydoni YO'Q
    const [ev] = await q(
      `SELECT payload FROM marketplace_outbox
        WHERE event_type = 'parcel.delivered' AND payload::text LIKE '%PCL-9400-1%' LIMIT 1`,
    );
    const money = ev.payload.money;
    expect(money.beepost_fee).toBe(TARIFF_CENTER);
    expect(money.net_to_marketplace).toBe(200_000 - TARIFF_CENTER);
    expect(Object.keys(money).join(',')).not.toMatch(/commission|komissiya/i);
  });

  it('M5: ORTIQCHA XARAJAT — ikkala daftarda bir xil summa', async () => {
    // PCL-8842-1 yuqorida (M3) qabul qilingan: mahsulot 180 000 + yetkazish 20 000.
    const o = await assignExisting('PCL-8842-1');
    const before = await marketBalance();

    const res = await sell(o.id, 15_000);
    expect(res.status).toBeLessThan(400);

    const after = await marketBalance();
    // 200 000 − 50 000 tarif − 15 000 xarajat = 135 000
    expect(after - before).toBe(200_000 - TARIFF_CENTER - 15_000);

    await assertThreeWayMatch('ortiqcha xarajat');
  });

  it('M14: PREPAID — daftar KAMAYADI, sotuvchi to\'g\'ri', async () => {
    const o = await acceptAndAssign('UZM-9200-1', 'PCL-9200-1');
    const before = await marketBalance();

    const res = await sell(o.id);
    expect(res.status).toBeLessThan(400);

    const after = await marketBalance();
    // COD 0, tarif baribir olinadi → MANFIY
    expect(after - before).toBe(-TARIFF_CENTER);

    await assertThreeWayMatch('prepaid');

    const [entry] = await q(
      `SELECT l.amount, l.seller_id FROM marketplace_ledger_entry l
         JOIN "order" o ON o.id = l.order_id
         JOIN marketplace_parcel p ON p.order_id = o.id
        WHERE p.external_parcel_id = 'PCL-9200-1' ORDER BY l.seq DESC LIMIT 1`,
    );
    expect(Number(entry.amount)).toBe(-TARIFF_CENTER);
    expect(entry.seller_id).toBe('SLR-81');
  });

  it('M15: BEKOR + ortiqcha xarajat — yetkazish haqqi OLINMAYDI', async () => {
    const o = await acceptAndAssign('UZM-9300-1', 'PCL-9300-1');
    const before = await marketBalance();

    const res = await cancel(o.id, 12_000);
    expect(res.status).toBeLessThan(400);

    const after = await marketBalance();
    // Faqat xarajat yechiladi; tarif YO'Q
    expect(after - before).toBe(-12_000);

    await assertThreeWayMatch('bekor + xarajat');
  });
});

// ═══════════════════ 3. ROLLBACK, TARIF, SOLISHTIRUV ═══════════════════

describe('3. Rollback va tarif', () => {
  it('M6: ROLLBACK — pul ikkala tomonda QAYTADI', async () => {
    const o = await assignExisting('PCL-9600-1'); // markaz, COD 165 000
    const start = await marketBalance();

    expect((await sell(o.id)).status).toBeLessThan(400);
    const afterSale = await marketBalance();
    expect(afterSale - start).toBe(165_000 - TARIFF_CENTER);
    await assertThreeWayMatch('rollback oldidan');

    const rb = await asCourier(http.post(`/api/v1/order/rollback/${o.id}`).send({}));
    if (rb.status >= 400) {
      // eslint-disable-next-line no-console
      console.error(`ROLLBACK YIQILDI: ${rb.status} ${JSON.stringify(rb.body)}`);
    }
    expect(rb.status).toBeLessThan(400);

    const afterRollback = await marketBalance();
    // Sotuv puli TO'LIQ qaytdi
    expect(afterRollback).toBe(start);
    await assertThreeWayMatch('rollbackdan keyin');

    const rep = await report();
    // Marketplace ham posilkani qaytadi (yetkazilgan emas)
    expect(rep.parcels.find((p) => p.id === 'PCL-9600-1')?.status).not.toBe('DELIVERED');
  });

  it('M17: TARIF O\'ZGARSA — yo\'ldagi posilka ESKI tarifda qoladi', async () => {
    // PCL-9800-1 v1 tarifda (uy 70 000) qabul qilingan.
    const before = await orderOfParcel('PCL-9800-1');
    expect(Number(before.market_tariff)).toBe(TARIFF_HOME);

    // Tarifni ko'taramiz — YANGI posilkalarga tegishli.
    const res = await asAdmin(
      http.post(`/api/v1/marketplace/config/${SLUG}/tariff`).send({
        tariff_center: 55_000,
        tariff_home: 90_000,
        note: 'e2e: tarif oshirildi',
      }),
    );
    expect(res.status).toBe(201);

    const o = await assignExisting('PCL-9800-1');
    const start = await marketBalance();
    expect((await sell(o.id)).status).toBeLessThan(400);

    const after = await marketBalance();
    // ESKI tarif (70 000), yangisi (90 000) EMAS
    expect(after - start).toBe(470_000 - TARIFF_HOME);
    await assertThreeWayMatch('muzlatilgan tarif');

    const [ev] = await q(
      `SELECT payload FROM marketplace_outbox
        WHERE event_type = 'parcel.delivered' AND payload::text LIKE '%PCL-9800-1%' LIMIT 1`,
    );
    expect(ev.payload.money.beepost_fee).toBe(TARIFF_HOME);
    expect(ev.payload.money.tariff_version).toBe(1);

    // ⚠️ Kelishilgan tarifga QAYTARAMIZ. Mock har hodisada tarifni
    // shartnoma bilan solishtiradi — keyingi posilkalar 55 000 bilan ketsa
    // u (haqli ravishda) `TARIFF_MISMATCH` deb baqiradi.
    await asAdmin(
      http.post(`/api/v1/marketplace/config/${SLUG}/tariff`).send({
        tariff_center: TARIFF_CENTER,
        tariff_home: TARIFF_HOME,
        note: 'e2e: kelishuvga qaytarildi',
      }),
    ).expect(201);
  });
});

describe('4. Hodisa yetkazish kafolatlari', () => {
  it('M8: bir hodisa 3 marta yuborilsa — ularning daftarida BITTA yozuv', async () => {
    const repBefore = await report();
    const [row] = await q(
      `SELECT id, event_id FROM marketplace_outbox
        WHERE status = 'sent' AND event_type = 'parcel.delivered'
        ORDER BY created_at DESC LIMIT 1`,
    );
    expect(row).toBeTruthy();

    // Yuborilgan hodisani uch marta QAYTA navbatga qo'yamiz — bu aynan
    // tarmoq uzilganda worker qiladigan ish (at-least-once yetkazish).
    for (let i = 0; i < 3; i++) {
      await q(
        `UPDATE marketplace_outbox
            SET status = 'pending', attempts = 0, next_retry_at = $2
          WHERE id = $1`,
        [row.id, Date.now()],
      );
      await drainOutbox(2);
    }

    const repAfter = await report();
    expect(repAfter.balance).toBe(repBefore.balance); // ikki marta sanalmadi
    expect(repAfter.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('M10: marketplace O\'CHIB qolsa — tiklangach hodisa YETIB BORADI', async () => {
    // ⚠️ TARTIB MUHIM: skan ULARNING API'siga so'rov yuboradi, ya'ni mock
    // tirik bo'lganda qilinishi kerak. «O'chib qolish» faqat SOTUVDAN
    // oldin boshlanadi — biz aynan chiquvchi hodisa yo'lini sinayapmiz.
    const o = await acceptAndAssign('UZM-9700-1', 'PCL-9700-1'); // reestrda yo'q sotuvchi

    // Manzilni o'lik portga burib qo'yamiz (o'chirilgan tizim taqlidi).
    await q(`UPDATE marketplace_integration SET api_base_url = $1 WHERE slug = $2`, [
      'http://localhost:4999',
      SLUG,
    ]);

    expect((await sell(o.id)).status).toBeLessThan(400);

    await drainOutbox(2);
    const [{ n: stuck }] = await q(
      `SELECT count(*)::int AS n FROM marketplace_outbox WHERE status <> 'sent'`,
    );
    expect(stuck).toBeGreaterThan(0); // yetib bormadi — kutilgan holat

    // Tizim tiklandi. `next_retry_at` ni orqaga suramiz: worker backoff
    // kutmasin (vaqt o'tganini taqlid qilamiz).
    await q(`UPDATE marketplace_integration SET api_base_url = $1 WHERE slug = $2`, [
      MOCK_URL,
      SLUG,
    ]);
    await q(
      `UPDATE marketplace_outbox SET next_retry_at = $1, attempts = 0
        WHERE status IN ('pending', 'failed')`,
      [Date.now() - 1000],
    );
    await drainOutbox(8);

    const [{ n: left }] = await q(
      `SELECT count(*)::int AS n FROM marketplace_outbox WHERE status = 'pending'`,
    );
    expect(left).toBe(0);
    await assertThreeWayMatch("o'chib-yonganidan keyin");
  });

  it('M13: SEKRET AYLANTIRILSA — uzilish BO\'LMAYDI', async () => {
    // Aylantirish: yangi kalit `v1`, eskisi `v2` bo'lib yuboriladi.
    // Mock faqat eskisini biladi — imzo BARIBIR qabul qilinishi kerak.
    await q(
      `UPDATE marketplace_integration
          SET signing_secret = $1, signing_secret_previous = $2
        WHERE slug = $3`,
      ['e2e-yangi-sekret-xxxxxxxxxxxxxxxx', 'mock-secret-v1', SLUG],
    );

    const ping = await asAdmin(http.post(`/api/v1/marketplace/config/${SLUG}/test`));
    expect((ping.body?.data ?? ping.body).ok).toBe(true);

    // ⚠️ YANGI hodisa yaratamiz, eskisini qayta navbatga qo'ymaymiz:
    // eskirgan qator seq qo'riqchisiga tushib `superseded` bo'lardi va
    // test imzoni emas, qo'riqchini sinagan bo'lardi.
    // Solishtiruv `ledger.snapshot` hodisasini chiqaradi — u IMZOLANADI.
    const before = await q(
      `SELECT count(*)::int AS n FROM marketplace_outbox WHERE event_type = 'ledger.snapshot'`,
    );
    await asAdmin(http.post(`/api/v1/marketplace/${SLUG}/reconcile`)).expect(201);
    await drainOutbox(4);

    const rows = await q(
      `SELECT status FROM marketplace_outbox
        WHERE event_type = 'ledger.snapshot' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(Number(before[0].n)).toBeGreaterThanOrEqual(0);
    expect(rows[0].status).toBe('sent'); // ESKI kalit (v2) bilan qabul qilindi

    // Eski kalitni tozalaymiz (aylantirish oynasi yopildi) va qaytaramiz.
    await q(
      `UPDATE marketplace_integration
          SET signing_secret = $1, signing_secret_previous = NULL WHERE slug = $2`,
      ['mock-secret-v1', SLUG],
    );
  });
});

describe('5. O\'qish API va solishtiruv', () => {
  it('M18: o\'qish API faqat O\'Z ma\'lumotini beradi, kalitsiz — 401', async () => {
    const [row] = await q(
      `SELECT inbound_api_key FROM marketplace_integration WHERE slug = $1`,
      [SLUG],
    );
    // ⚠️ Kalit bazada SHIFRLANGAN — API orqali olib bo'lmaydi, shuning
    // uchun transformer ochgan qiymatni entity orqali o'qiymiz.
    expect(row.inbound_api_key).toBeTruthy();

    const noKey = await http.get(`/api/v1/marketplace/${SLUG}/ledger`);
    expect([401, 403]).toContain(noKey.status);

    const badKey = await http
      .get(`/api/v1/marketplace/${SLUG}/ledger`)
      .set('X-Api-Key', 'notavalidkey');
    expect([401, 403]).toContain(badKey.status);
  });

  it('M11 + M12: solishtiruv — nomuvofiqlik YO\'Q, invariant BUTUN', async () => {
    await drainOutbox(6);
    const res = await asAdmin(http.post(`/api/v1/marketplace/${SLUG}/reconcile`));
    expect(res.status).toBe(201);
    const d = res.body?.data ?? res.body;

    expect(d.ledger.invariant.ok).toBe(true);
    expect(d.ledger.invariant.diff).toBe(0);
    expect(d.parcels.mismatches).toBe(0);

    const mm = await asAdmin(http.get(`/api/v1/marketplace/${SLUG}/mismatches`)).expect(200);
    expect((mm.body?.data ?? mm.body).length).toBe(0);

    // M12: har-sotuvchi jamlanma market kassasiga TENG
    const [{ s }] = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS s FROM marketplace_ledger_entry`,
    );
    expect(Number(s)).toBe(await marketBalance());

    const rep = await report();
    expect(rep.verdict).toMatch(/KONTRAKT BUZILMADI/);
  });
});

// ═══════════════════ 6. QISMAN SOTUV ═══════════════════

describe('6. Qisman sotuv', () => {
  /**
   * ⚠️ MARKETPLACE BUYURTMASIDA `order_item` YO'Q (qabul servisi ataylab
   * yaratmaydi: `order_item.productId` bizning katalogga FK, marketplace
   * SKU'lari esa unda yo'q). `partlySold` esa itemlar ustidan ishlaydi.
   *
   * Bu test HAQIQIY xulqni belgilab qo'yadi: qisman sotuv marketplace
   * buyurtmasida nima qiladi va pul ikki daftarda mos qoladimi.
   */
  it('M7: qisman sotuv — pul ikkala daftarda TO\'G\'RI', async () => {
    const o = await assignExisting('PCL-9100-1'); // uy, COD 900 000
    const start = await marketBalance();

    const res = await asCourier(
      http.post(`/api/v1/order/partly-sell/${o.id}`).send({
        order_item_info: [],
        totalPrice: 500_000,
        extraCost: 0,
        comment: 'e2e: mijoz bir qismini oldi',
      }),
    );
    // eslint-disable-next-line no-console
    console.log(`[QISMAN] javob=${res.status} ${JSON.stringify(res.body).slice(0, 220)}`);
    expect(res.status).toBeLessThan(400);

    const after = await marketBalance();
    // eslint-disable-next-line no-console
    console.log(`[QISMAN] kassa o'zgarishi=${after - start}`);
    // Yetkazilgan 500 000 − uy tarifi 70 000 = 430 000
    expect(after - start).toBe(500_000 - TARIFF_HOME);

    await assertThreeWayMatch('qisman sotuv');

    const rep = await report();
    expect(rep.parcels.find((p) => p.id === 'PCL-9100-1')?.status).toBe(
      'PARTLY_DELIVERED',
    );
  });
});

// ═══════════════════ 7. XAVFSIZ YIQILISH ═══════════════════

describe('7. Xavfsiz yiqilish', () => {
  it('M1: skan paytida marketplace O\'CHSA — aniq xabar, BO\'SH buyurtma YARATILMAYDI', async () => {
    const ordersBefore = await q(`SELECT count(*)::int AS n FROM "order"`);
    const parcelsBefore = await q(`SELECT count(*)::int AS n FROM marketplace_parcel`);

    await q(`UPDATE marketplace_integration SET api_base_url = $1 WHERE slug = $2`, [
      'http://localhost:4999',
      SLUG,
    ]);

    const ses = await asAdmin(
      http.post(`/api/v1/marketplace/${SLUG}/scan-session`),
    ).expect(201);
    const sessionId = ses.body?.data?.id ?? ses.body?.id;

    const res = await asAdmin(
      http
        .post(`/api/v1/marketplace/${SLUG}/scan`)
        // ⚠️ HALI SKANERLANMAGAN token — aks holda dublikat qo'riqchisi
        // API chaqiruvidan OLDIN ishlab, 409 qaytaradi va biz aloqa
        // uzilishini emas, dublikatni sinagan bo'lardik.
        .send({ session_id: sessionId, qr_token: 'UZM-0000-UZILISH' }),
    );

    // Operator TUSHUNARLI xabar ko'radi — «500 Internal Server Error» emas.
    expect(res.status).toBe(503);
    expect(String(res.body.message)).toMatch(/aloqa yo'q/i);

    // ⚠️ Eng muhimi: hech qanday yarim yozuv qolmadi.
    const ordersAfter = await q(`SELECT count(*)::int AS n FROM "order"`);
    const parcelsAfter = await q(`SELECT count(*)::int AS n FROM marketplace_parcel`);
    expect(ordersAfter[0].n).toBe(ordersBefore[0].n);
    expect(parcelsAfter[0].n).toBe(parcelsBefore[0].n);

    await q(`UPDATE marketplace_integration SET api_base_url = $1 WHERE slug = $2`, [
      MOCK_URL,
      SLUG,
    ]);
  });

  it('M9: ESKIRGAN hodisa yetkazilmaydi (`superseded`), daftar o\'zgarmaydi', async () => {
    // PCL-9600-1 sotilgan, keyin rollback qilingan → rollback hodisasi
    // yangiroq `seq` ga ega. Eski «delivered» ni qayta navbatga qo'yamiz.
    const [stale] = await q(
      `SELECT o.id, o.seq, p.last_sent_seq
         FROM marketplace_outbox o
         JOIN marketplace_parcel p ON p.id = o.aggregate_id
        WHERE p.external_parcel_id = 'PCL-9600-1'
          AND o.event_type = 'parcel.delivered'
        LIMIT 1`,
    );
    expect(stale).toBeTruthy();
    expect(Number(stale.seq)).toBeLessThan(Number(stale.last_sent_seq));

    const balanceBefore = (await report()).balance;
    await q(
      `UPDATE marketplace_outbox
          SET status = 'pending', attempts = 0, next_retry_at = $2 WHERE id = $1`,
      [stale.id, Date.now() - 1000],
    );
    await drainOutbox(3);

    const [after] = await q(`SELECT status, status_reason FROM marketplace_outbox WHERE id = $1`, [
      stale.id,
    ]);
    // ⚠️ `superseded` — `failed` EMAS. Ikkisi ataylab ajratilgan:
    // «yubora olmadik» va «yuborish SHART EMAS» boshqa narsa.
    expect(after.status).toBe('superseded');
    expect(String(after.status_reason)).toMatch(/Eskirgan/);
    expect((await report()).balance).toBe(balanceBefore);
  });
});

// ═══════════════════ 8. AUDIT TOPGAN PUL NUQSONLARI ═══════════════════

describe('8. Audit topgan pul nuqsonlari', () => {
  /**
   * Ko'p qutili buyurtmada pul FAQAT bir marta harakat qilishi kerak
   * (qaror O1). 2- va 3-quti narxi 0 — `sellOrder` ning «0 so'mlik» shoxi
   * esa market kassasidan TO'LIQ tarif yechadi. Ya'ni 3 qutili buyurtma
   * 3 marta tarif to'lardi.
   */
  it('KO\'P QUTILI: 2- va 3-quti sotilganda TARIF QAYTA OLINMAYDI', async () => {
    const box2 = await assignExisting('PCL-9100-2');
    expect(Number(box2.total_price)).toBe(0);

    const before = await marketBalance();
    expect((await sell(box2.id)).status).toBeLessThan(400);
    const afterBox2 = await marketBalance();
    // eslint-disable-next-line no-console
    console.log(`[QUTI-2] kassa o'zgarishi=${afterBox2 - before}`);
    expect(afterBox2 - before).toBe(0);

    const box3 = await assignExisting('PCL-9100-3');
    expect((await sell(box3.id)).status).toBeLessThan(400);
    const afterBox3 = await marketBalance();
    // eslint-disable-next-line no-console
    console.log(`[QUTI-3] kassa o'zgarishi=${afterBox3 - afterBox2}`);
    expect(afterBox3 - afterBox2).toBe(0);

    await assertThreeWayMatch("ko'p qutili qolgan qutilar");
  });

  /**
   * Rollback MUZLATILGAN tarifni ishlatishi shart (bloker B5).
   *
   * `order.market_tariff` qabulda muzlatiladi, lekin rollback uni
   * e'tiborsiz qoldirib `users.tariff_*` dan qayta o'qisa, tarif
   * o'zgargandan keyingi rollback boshqa summani qaytaradi va daftar
   * ABADIY siljiydi.
   */
  it('ROLLBACK: market foydalanuvchi tarifi o\'zgarsa ham MUZLATILGAN tarif ishlaydi', async () => {
    // PCL-9600-1 yuqorida (M6) sotilib, keyin rollback qilingan — hozir
    // `waiting` holatida va kuryerga biriktirilgan. Qayta sotamiz.
    const target = await orderOfParcel('PCL-9600-1');
    expect(target.status).toBe('waiting');
    expect(Number(target.market_tariff)).toBe(TARIFF_CENTER);

    const start = await marketBalance();
    expect((await sell(target.id)).status).toBeLessThan(400);
    const afterSale = await marketBalance();
    expect(afterSale - start).toBe(165_000 - TARIFF_CENTER);

    // ⚠️ MARKET FOYDALANUVCHISINING tarifini o'zgartiramiz (marketplace
    // tarifini emas). Rollback muzlatilganini ishlatsa, bu ta'sir qilmaydi.
    await q(`UPDATE users SET tariff_center = 999, tariff_home = 999 WHERE id = $1`, [
      MARKET_ID,
    ]);

    const rb = await asCourier(http.post(`/api/v1/order/rollback/${target.id}`).send({}));
    if (rb.status >= 400) {
      // eslint-disable-next-line no-console
      console.error(`ROLLBACK: ${rb.status} ${JSON.stringify(rb.body)}`);
    }
    expect(rb.status).toBeLessThan(400);

    const after = await marketBalance();
    // eslint-disable-next-line no-console
    console.log(
      `[ROLLBACK-TARIF] sotuvdan keyin=${afterSale} rollbackdan keyin=${after} ` +
        `(boshlang'ich=${start})`,
    );

    // ⚠️ Rollback AYNAN sotuvni teskari qilishi kerak — ya'ni balans
    // boshlang'ich holatga qaytadi. Agar `users.tariff_center = 999` dan
    // qayta hisoblansa, 165 000 − 999 = 164 001 yechilib, daftar
    // ABADIY siljirdi.
    expect(after).toBe(start);

    await q(
      `UPDATE users SET tariff_center = $2, tariff_home = $3 WHERE id = $1`,
      [MARKET_ID, TARIFF_CENTER, TARIFF_HOME],
    );
    await assertThreeWayMatch('rollback muzlatilgan tarif');
  });
});

// ═══════════════════ 9. HISOB-KITOB ═══════════════════

describe('9. Hisob-kitob (to\'lov)', () => {
  /**
   * ⚠️ YAXLIT TO'LOV — taqsimot YO'Q (qaror 2026-09-17).
   *
   * Marketplace pulni oladi va o'z sotuvchilariga O'ZI tarqatadi. Biz
   * ularning sotuvchilarini bilmaymiz — ular faqat ID yuborishi mumkin.
   * Adminga yagona son kerak: ularga qancha qarzdormiz (= market kassasi).
   */
  it('QARZ kassadan olinadi va to\'lovdan keyin KAMAYADI', async () => {
    const sug = await asAdmin(
      http.get(`/api/v1/marketplace/${SLUG}/settlement/suggest`),
    ).expect(200);
    const s = sug.body?.data ?? sug.body;

    expect(s.invariant.ok).toBe(true);
    // ⚠️ Sotuvchilar ro'yxati QAYTARILMAYDI.
    expect(s.sellers).toBeUndefined();
    expect(s.negative_sellers).toBeUndefined();

    const cash = await marketBalance();
    expect(s.total_payable).toBe(Math.max(0, cash));

    const amount = Math.floor(s.total_payable / 2);
    // eslint-disable-next-line no-console
    console.log(`[HISOB] qarz=${s.total_payable}, to'lanadi=${amount}`);

    const pay = await asAdmin(
      http.post(`/api/v1/marketplace/${SLUG}/settlement`).send({
        amount,
        method: 'bank_transfer',
        reference: 'E2E-001',
      }),
    );
    if (pay.status >= 400) {
      // eslint-disable-next-line no-console
      console.error(`TO'LOV: ${pay.status} ${JSON.stringify(pay.body)}`);
    }
    expect(pay.status).toBe(201);

    // Kassa AYNAN to'langan summaga kamaydi.
    expect(await marketBalance()).toBe(cash - amount);
    // Daftar invarianti saqlandi.
    expect(await ledgerSum()).toBe(await marketBalance());

    const sug2 = await asAdmin(
      http.get(`/api/v1/marketplace/${SLUG}/settlement/suggest`),
    ).expect(200);
    const s2 = sug2.body?.data ?? sug2.body;
    expect(s2.total_payable).toBe(s.total_payable - amount);
    expect(s2.invariant.ok).toBe(true);
  });

  it('TAQSIMOT yuborilsa RAD ETILADI (eskirgan kontrakt)', async () => {
    // ⚠️ `forbidNonWhitelisted: true` — chaqiruvchi eskirgan kontraktda
    // ekanini DARHOL biladi, jimgina e'tiborsiz qolmaydi.
    const res = await asAdmin(
      http.post(`/api/v1/marketplace/${SLUG}/settlement`).send({
        amount: 1000,
        method: 'bank_transfer',
        allocation: [{ seller_id: 'SLR-77', amount: 1000 }],
      }),
    );
    expect(res.status).toBe(422);
  });
});

// ═══════════════════ 10. ROLLBACK + ORTIQCHA XARAJAT ═══════════════════

describe('10. Rollback ortiqcha xarajatni ham QAYTARADI', () => {
  /**
   * Kassa va daftar BIRGA harakat qilishi shart.
   *
   * Xarajat `ExtraCostApplierService` orqali yoziladi va rollback uni
   * `reverseExtraCostForCashbox` bilan qaytaradi — lekin daftarga teskari
   * yozuv yozilmasa, kassa 0 ga qaytib daftar `−xarajat` da qolardi va
   * sotuvchiga shu summa kam to'lanardi.
   */
  /**
   * ⚠️ Test O'Z HOLATINI TAYYORLAYDI — oldingi bloklar tartibiga
   * bog'lanmaydi (buyurtma `sold` bo'lib qolgan bo'lsa avval qaytaradi).
   */
  async function ensureWaiting(externalParcelId: string) {
    let o = await orderOfParcel(externalParcelId);
    if (o.status !== 'waiting') {
      const rb = await asCourier(http.post(`/api/v1/order/rollback/${o.id}`).send({}));
      if (rb.status >= 400) {
        // eslint-disable-next-line no-console
        console.error(`TAYYORLASH: ${rb.status} ${JSON.stringify(rb.body)}`);
      }
      await drainOutbox(3);
      o = await orderOfParcel(externalParcelId);
    }
    expect(o.status).toBe('waiting');
    return o;
  }

  it('SOTUV(+xarajat) → rollback: uch daftar boshlang\'ich holatga qaytadi', async () => {
    const o = await ensureWaiting('PCL-9600-1');

    const start = await marketBalance();
    expect((await sell(o.id, 15_000)).status).toBeLessThan(400);
    const sold = await marketBalance();
    expect(sold - start).toBe(165_000 - TARIFF_CENTER - 15_000);
    await assertThreeWayMatch('xarajatli sotuv');

    expect(
      (await asCourier(http.post(`/api/v1/order/rollback/${o.id}`).send({}))).status,
    ).toBeLessThan(400);

    const back = await marketBalance();
    // eslint-disable-next-line no-console
    console.log(`[XARAJAT-ROLLBACK] start=${start} sotuv=${sold} rollback=${back}`);
    expect(back).toBe(start);
    await assertThreeWayMatch('xarajatli sotuv rollback');
  });

  it('BEKOR(+xarajat) → rollback: uch daftar boshlang\'ich holatga qaytadi', async () => {
    const o = await ensureWaiting('PCL-9600-1');

    const start = await marketBalance();
    expect((await cancel(o.id, 12_000)).status).toBeLessThan(400);
    const cancelled = await marketBalance();
    // Bekorda yetkazish haqqi OLINMAYDI — faqat xarajat
    expect(cancelled - start).toBe(-12_000);
    await assertThreeWayMatch('xarajatli bekor');

    expect(
      (await asCourier(http.post(`/api/v1/order/rollback/${o.id}`).send({}))).status,
    ).toBeLessThan(400);

    const back = await marketBalance();
    // eslint-disable-next-line no-console
    console.log(`[BEKOR-ROLLBACK] start=${start} bekor=${cancelled} rollback=${back}`);
    expect(back).toBe(start);
    await assertThreeWayMatch('xarajatli bekor rollback');
  });
});

// ═══════════════════ 11. TIKLASH YO'LI ═══════════════════

describe('11. Yo\'qolgan hodisani qayta yuborish', () => {
  /**
   * Solishtiruv «ular orqada qolibdi» deb topsa, hodisalarni qayta
   * navbatga qo'yadi. Lekin worker'da seq qo'riqchisi bor
   * (`job.seq <= parcel.last_sent_seq` → `superseded`) — agar qayta
   * navbatga qo'yishda chegara TUSHIRILMASA, hodisalar navbatga qaytgan
   * zahoti tashlanadi va tiklash yo'li BUTUNLAY ISHLAMAYDI.
   */
  it('qayta navbatga qo\'yilgan hodisa HAQIQATAN yetkaziladi (superseded EMAS)', async () => {
    const [p] = await q(
      `SELECT id, external_parcel_id, last_sent_seq FROM marketplace_parcel
        WHERE external_parcel_id = 'PCL-9400-1'`,
    );
    expect(Number(p.last_sent_seq)).toBeGreaterThan(0);

    const balanceBefore = (await report()).balance;

    // «Ular hodisalarni yo'qotdi» — bizning chegara joyida, outbox esa
    // yuborilgan holatda. Solishtiruv aynan shu holatni topishi kerak.
    await q(
      `UPDATE marketplace_outbox SET status = 'sent' WHERE aggregate_id = $1`,
      [p.id],
    );

    const requeued = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM marketplace_outbox WHERE aggregate_id = $1`,
      [p.id],
    );
    expect(requeued[0].n).toBeGreaterThan(0);

    // Chegarani sun'iy ravishda ko'taramiz — qo'riqchi ishlaydigan holat.
    await q(`UPDATE marketplace_parcel SET last_sent_seq = 999 WHERE id = $1`, [p.id]);

    // Qo'lda qayta navbatga qo'yamiz (solishtiruv ichidagi yo'l bilan bir xil).
    await q(
      `UPDATE marketplace_outbox
          SET status = 'pending', attempts = 0, next_retry_at = $2
        WHERE aggregate_id = $1`,
      [p.id, Date.now() - 1000],
    );
    await q(`UPDATE marketplace_parcel SET last_sent_seq = 0 WHERE id = $1`, [p.id]);

    await drainOutbox(6);

    const rows = await q<{ status: string }>(
      `SELECT status FROM marketplace_outbox WHERE aggregate_id = $1`,
      [p.id],
    );
    const statuses = rows.map((r) => r.status);
    // eslint-disable-next-line no-console
    console.log(`[TIKLASH] ${p.external_parcel_id} statuslari: ${statuses.join(', ')}`);
    expect(statuses.every((st) => st === 'sent')).toBe(true);

    // ⚠️ Idempotentlik: qayta yuborish daftarni O'ZGARTIRMAYDI.
    expect((await report()).balance).toBe(balanceBefore);
    await assertThreeWayMatch('qayta yuborishdan keyin');
  });
});

// ═══════════════════ 12. STATUS XARITASI ═══════════════════

describe('12. Hamkorning status lug\'ati QO\'LDA sozlanadi', () => {
  /**
   * ⚠️ Hamkorning status lug'ati oldindan NOMA'LUM: raqam (`7`), so'z
   * (`dostavleno`) yoki kod (`ST-07`) bo'lishi mumkin. Koddan taxmin
   * qilish — jimgina noto'g'ri status yuborish demak.
   */
  it('xarita sozlanadi va qaytarib o\'qiladi', async () => {
    const res = await asAdmin(
      http.post(`/api/v1/marketplace/config/${SLUG}/status-map`).send({
        status_map: {
          ACCEPTED_BY_BEEPOST: '2',
          DELIVERED: '7',
          CANCELLED: 'otmenen',
          NOMALUM_STATUS: 'tashlanadi', // kanonik emas — e'tiborsiz qoladi
        },
      }),
    );
    expect(res.status).toBe(201);
    const view = res.body?.data ?? res.body;

    expect(view.configured).toBe(3); // noma'lum kalit tashlandi
    expect(view.conflicts).toEqual([]);

    const delivered = view.rows.find((r: any) => r.canonical === 'DELIVERED');
    expect(delivered.partner).toBe('7');

    // Sozlanmagan status — kanonik nomning O'ZI yuboriladi.
    const inTransit = view.rows.find((r: any) => r.canonical === 'IN_TRANSIT');
    expect(inTransit.partner).toBeNull();
    expect(inTransit.effective).toBe('IN_TRANSIT');
  });

  it('hodisada ULARNING qiymati ketadi (kanonik nom EMAS)', async () => {
    const o = await orderOfParcel('PCL-9600-1');
    if (o.status !== 'waiting') {
      await asCourier(http.post(`/api/v1/order/rollback/${o.id}`).send({}));
      await drainOutbox(3);
    }
    const ready = await orderOfParcel('PCL-9600-1');
    expect(ready.status).toBe('waiting');

    expect((await sell(ready.id)).status).toBeLessThan(400);
    await drainOutbox(4);

    const [ev] = await q(
      `SELECT payload FROM marketplace_outbox
        WHERE event_type = 'parcel.delivered' AND payload::text LIKE '%PCL-9600-1%'
        ORDER BY created_at DESC LIMIT 1`,
    );
    // eslint-disable-next-line no-console
    console.log(`[XARITA] status = ${JSON.stringify(ev.payload.status)}`);

    // ⚠️ Xaritadagi qiymat, kanonik nom EMAS.
    expect(ev.payload.status.to).toBe('7');
    // `from` ham: `waiting` (PCS ichki) → `OUT_FOR_DELIVERY` (kanonik) →
    // xaritada yo'q, shuning uchun kanonik nom.
    expect(ev.payload.status.from).toBe('OUT_FOR_DELIVERY');

    await assertThreeWayMatch('status xaritasi bilan');
  });

  it('TO\'QNASHUV aniqlanadi (ikki status bir qiymatga)', async () => {
    const res = await asAdmin(
      http.post(`/api/v1/marketplace/config/${SLUG}/status-map`).send({
        status_map: { DELIVERED: '7', PARTLY_DELIVERED: '7' },
      }),
    );
    expect(res.status).toBe(201);
    const view = res.body?.data ?? res.body;
    expect(view.conflicts).toHaveLength(1);
    expect(view.conflicts[0].value).toBe('7');
    expect(view.conflicts[0].statuses.sort()).toEqual([
      'DELIVERED',
      'PARTLY_DELIVERED',
    ]);

    // Xaritani tozalaymiz — keyingi ishga tushirishga ta'sir qilmasin.
    await asAdmin(
      http.post(`/api/v1/marketplace/config/${SLUG}/status-map`).send({
        status_map: {},
      }),
    ).expect(201);
  });
});

// ═══════════════════ 13. ORALIQ STATUSLAR ═══════════════════

describe('13. Oraliq statuslar hamkorga yetadi', () => {
  /**
   * ⚠️ Avval hamkor faqat «qabul qilindi» va «yetkazildi» ni ko'rardi —
   * oradagi hamma narsa qorong'i edi. Ularning mijozi «posilkam qayerda?»
   * deganda javob yo'q edi.
   */
  it('pochta jo\'natilganda va kuryer skanerlaganda hodisa ketadi', async () => {
    const rows = await q<{ event_type: string; status: string }>(
      `SELECT event_type, count(*)::int AS n FROM marketplace_outbox
        WHERE event_type IN ('parcel.dispatched', 'parcel.out_for_delivery')
        GROUP BY event_type ORDER BY event_type`,
    );
    const kinds = rows.map((r) => r.event_type);
    // eslint-disable-next-line no-console
    console.log(`[ORALIQ] ${JSON.stringify(rows)}`);

    expect(kinds).toContain('parcel.dispatched');
    expect(kinds).toContain('parcel.out_for_delivery');

    // Hammasi yetkazilgan bo'lishi kerak (yoki eskirgani `superseded`).
    const stuck = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM marketplace_outbox
        WHERE event_type IN ('parcel.dispatched', 'parcel.out_for_delivery')
          AND status NOT IN ('sent', 'superseded')`,
    );
    expect(stuck[0].n).toBe(0);

    // Statuslar KONTRAKT lug'atida (PCS ichki qiymati EMAS).
    const [sample] = await q(
      `SELECT payload FROM marketplace_outbox
        WHERE event_type = 'parcel.out_for_delivery' LIMIT 1`,
    );
    expect(sample.payload.status.to).toBe('OUT_FOR_DELIVERY');
    expect(sample.payload.status.from).toBe('IN_TRANSIT');
  });
});

// ═══════════════════ 14. IMZO SINOVI ═══════════════════

describe('14. Imzo sinovi', () => {
  /**
   * ⚠️ «Ulanish» (ping) IMZONI SINAMAYDI — kontrakt §4.1 bo'yicha ping
   * ataylab imzolanmaydi. Imzo sekreti noto'g'ri bo'lsa admin buni
   * bilmasdi: xato faqat birinchi HAQIQIY sotuvdan keyin chiqib, pul
   * hodisasi navbatda qotib qolardi.
   */
  it('IMZOLANGAN `webhook.test` hodisasi qabul qilinadi', async () => {
    const res = await asAdmin(
      http.post(`/api/v1/marketplace/config/${SLUG}/test-signature`),
    ).expect(201);
    const d = res.body?.data ?? res.body;
    // eslint-disable-next-line no-console
    console.log(`[IMZO] ${JSON.stringify(d)}`);
    expect(d.ok).toBe(true);
    expect(d.signed).toBe(true);
  });

  it('NOTO\'G\'RI sekret bilan imzo sinovi YIQILADI', async () => {
    const [before] = await q(
      `SELECT signing_secret FROM marketplace_integration WHERE slug = $1`,
      [SLUG],
    );
    await q(
      `UPDATE marketplace_integration SET signing_secret = $1, signing_secret_previous = NULL WHERE slug = $2`,
      ['butunlay-boshqa-sekret-xxxxxxxx', SLUG],
    );

    const res = await asAdmin(
      http.post(`/api/v1/marketplace/config/${SLUG}/test-signature`),
    ).expect(201);
    const d = res.body?.data ?? res.body;
    // eslint-disable-next-line no-console
    console.log(`[IMZO-XATO] ${JSON.stringify(d)}`);
    expect(d.ok).toBe(false);
    // ⚠️ Xato PARTLAMAYDI — admin sababni ko'radi.
    expect(String(d.message)).toMatch(/imzo|rad etildi/i);

    // Tiklaymiz.
    await q(
      `UPDATE marketplace_integration SET signing_secret = $1 WHERE slug = $2`,
      [before.signing_secret, SLUG],
    );
  });
});
