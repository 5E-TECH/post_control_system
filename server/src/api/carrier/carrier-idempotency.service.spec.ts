import { HttpException, Logger } from '@nestjs/common';
import {
  CARRIER_IDEMPOTENCY_LEASE_MS,
  CarrierIdempotencyService,
  carrierOpBinding,
  carrierOpFingerprint,
  hashIdempotencyKey,
} from './carrier-idempotency.service';

/**
 * `Idempotency-Key` daftari. Haqiqiy SQL o'rniga kichik xotira jadvali:
 * INSERT … ON CONFLICT DO NOTHING / SELECT … FOR UPDATE / UPDATE
 * semantikasini takrorlaydi — shunda testlar xizmat qaysi so'rovni qaysi
 * holatda yuborishini emas, NATIJANI (kalit holati) tekshiradi.
 */

type KeyRow = {
  id: string;
  account: string;
  key_hash: string;
  binding: string;
  state: string;
  lease_until: string | null;
  http_status: number | null;
};

function fakeStore() {
  const rows: KeyRow[] = [];
  const byId = (id: string) => rows.find((r) => r.id === id);

  const manager = {
    query: jest.fn(async (sql: string, params: any[]) => {
      if (sql.includes('INSERT INTO')) {
        const [id, , account, keyHash, binding, , , leaseUntil] = params;
        if (rows.some((r) => r.account === account && r.key_hash === keyHash)) {
          return [];
        }
        rows.push({
          id,
          account,
          key_hash: keyHash,
          binding,
          state: 'in_progress',
          // pg bigint satr bo'lib qaytadi
          lease_until: String(leaseUntil),
          http_status: null,
        });
        return [{ id }];
      }
      if (sql.includes('FOR UPDATE')) {
        const [account, keyHash] = params;
        const found = rows.find(
          (r) => r.account === account && r.key_hash === keyHash,
        );
        return found ? [{ ...found }] : [];
      }
      if (sql.includes('UPDATE')) {
        const [leaseUntil, , id] = params;
        const found = byId(id)!;
        found.state = 'in_progress';
        found.lease_until = String(leaseUntil);
        found.http_status = null;
        return [[], 1];
      }
      throw new Error(`kutilmagan SQL: ${sql}`);
    }),
  };

  const dataSource = {
    transaction: jest.fn(async (cb: (m: typeof manager) => unknown) =>
      cb(manager),
    ),
    // complete / fail — tranzaksiyasiz bitta UPDATE.
    query: jest.fn(async (sql: string, params: any[]) => {
      const [httpStatus, , id] = params;
      const found = byId(id);
      if (!found) return [[], 0];
      if (sql.includes(`"state" = 'completed'`)) {
        found.state = 'completed';
      } else if (sql.includes(`"state" = 'failed'`)) {
        // `WHERE … AND "state" = 'in_progress'`
        if (!sql.includes(`AND "state" = 'in_progress'`)) {
          throw new Error(
            'fail() faqat in_progress qatorni o‘zgartirishi shart',
          );
        }
        if (found.state !== 'in_progress') return [[], 0];
        found.state = 'failed';
      }
      found.lease_until = null;
      found.http_status = httpStatus;
      return [[], 1];
    }),
  };

  const service = new CarrierIdempotencyService(dataSource as any);
  return { rows, manager, dataSource, service };
}

beforeAll(() => {
  // Kutilgan xato loglari test chiqishini to'ldirmasin.
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());

const NOW = 1_762_000_000_000;
const ORDER_ID = '3f6c2a9e-8b1d-4c7e-9a2f-1d5b8e7c4a90';
const BINDING = carrierOpBinding('sold', ORDER_ID, { comment: 'ok' });

const acquire = (
  service: CarrierIdempotencyService,
  over: Partial<Parameters<CarrierIdempotencyService['acquire']>[0]> = {},
) =>
  service.acquire({
    accountId: 'acc-1',
    key: 'key-1',
    action: 'sold',
    orderId: ORDER_ID,
    binding: BINDING,
    now: NOW,
    ...over,
  });

const caught = async (p: Promise<unknown>): Promise<HttpException> => {
  const error = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
};

describe('CarrierIdempotencyService.acquire', () => {
  it('yangi kalit → egallanadi, in_progress + 90 s lease, kalit XESH bilan saqlanadi', async () => {
    const { service, rows, manager } = fakeStore();
    const lease = await acquire(service);
    expect(lease).toMatchObject({
      kind: 'acquired',
      takeover: false,
      priorAttemptMayHaveRun: false,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe('in_progress');
    expect(Number(rows[0].lease_until)).toBe(
      NOW + CARRIER_IDEMPOTENCY_LEASE_MS,
    );
    // Ochiq kalit bazaga hech qachon yuborilmaydi.
    expect(rows[0].key_hash).toBe(hashIdempotencyKey('key-1'));
    const allParams = manager.query.mock.calls.flatMap(([, p]) => p);
    expect(allParams).not.toContain('key-1');
  });

  it('ayni kalit boshqa tana/buyurtma bilan → 422 IDEMPOTENCY_KEY_MISMATCH', async () => {
    const { service } = fakeStore();
    await acquire(service);
    const error = await caught(
      acquire(service, {
        binding: carrierOpBinding('sold', ORDER_ID, { comment: 'boshqa' }),
      }),
    );
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toMatchObject({
      code: 'IDEMPOTENCY_KEY_MISMATCH',
    });
  });

  it('bajarilgan kalit ham boshqa bog‘lanish bilan 422 (holatdan oldin tekshiriladi)', async () => {
    const { service } = fakeStore();
    const lease = await acquire(service);
    await service.complete(lease.id);
    const error = await caught(
      acquire(service, {
        action: 'cancelled',
        binding: carrierOpBinding('cancelled', ORDER_ID, {}),
      }),
    );
    expect(error.getStatus()).toBe(422);
  });

  it('ishlayotgan kalit (lease tirik) → 409 IDEMPOTENCY_IN_PROGRESS, amal ikkinchi marta yuritilmaydi', async () => {
    const { service } = fakeStore();
    await acquire(service);
    const error = await caught(
      acquire(service, { now: NOW + CARRIER_IDEMPOTENCY_LEASE_MS - 1 }),
    );
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({
      code: 'IDEMPOTENCY_IN_PROGRESS',
    });
  });

  it('lease o‘tgan in_progress (jarayon o‘lgan) → qayta egallanadi, yangi lease', async () => {
    const { service, rows } = fakeStore();
    const first = await acquire(service);
    const later = NOW + CARRIER_IDEMPOTENCY_LEASE_MS + 1;
    const second = await acquire(service, { now: later });
    expect(second).toMatchObject({
      kind: 'acquired',
      takeover: true,
      id: first.id,
      // Jarayon commit'dan keyin, `complete()` gacha o'lgan bo'lishi mumkin.
      priorAttemptMayHaveRun: true,
    });
    expect(Number(rows[0].lease_until)).toBe(
      later + CARRIER_IDEMPOTENCY_LEASE_MS,
    );
  });

  it('yiqilgan (failed, 4xx) kalit → qayta egallanadi; avvalgi urinish yozmagani aniq', async () => {
    const { service, rows } = fakeStore();
    const lease = await acquire(service);
    await service.fail(lease.id, 400);
    expect(rows[0].state).toBe('failed');
    const retry = await acquire(service, { now: NOW + 1 });
    expect(retry).toMatchObject({
      kind: 'acquired',
      takeover: true,
      priorAttemptMayHaveRun: false,
    });
    expect(rows[0].state).toBe('in_progress');
  });

  it('⭐ yiqilgan (failed, 5xx) kalit → avvalgi urinish commit qilgan bo‘lishi MUMKIN', async () => {
    // 503 — PCS xatosidan keyin qayta o'qish ham yiqilgan: natija noma'lum.
    const { service } = fakeStore();
    const lease = await acquire(service);
    await service.fail(lease.id, 503);
    const retry = await acquire(service, { now: NOW + 1 });
    expect(retry).toMatchObject({
      kind: 'acquired',
      takeover: true,
      priorAttemptMayHaveRun: true,
    });
  });

  it('bajarilgan (completed) kalit → `completed`, amal QAYTA yuritilmaydi', async () => {
    const { service, rows } = fakeStore();
    const lease = await acquire(service);
    await service.complete(lease.id, 200);
    expect(rows[0]).toMatchObject({ state: 'completed', http_status: 200 });
    const replay = await acquire(service, {
      now: NOW + 10 * CARRIER_IDEMPOTENCY_LEASE_MS,
    });
    expect(replay).toMatchObject({ kind: 'completed', id: lease.id });
    expect(rows[0].state).toBe('completed');
  });

  it('kalit akkaunt bo‘yicha ajratilgan: boshqa kompaniyaning ayni kaliti alohida', async () => {
    const { service, rows } = fakeStore();
    await acquire(service);
    const other = await acquire(service, { accountId: 'acc-2' });
    expect(other).toMatchObject({ kind: 'acquired', takeover: false });
    expect(rows).toHaveLength(2);
  });

  it('daftar xatosi (DB) → 503 CARRIER_TEMPORARILY_UNAVAILABLE (ayni kalit bilan qayta urinish xavfsiz)', async () => {
    const { service, dataSource } = fakeStore();
    dataSource.transaction.mockRejectedValueOnce(new Error('connection lost'));
    const error = await caught(acquire(service));
    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toMatchObject({
      code: 'CARRIER_TEMPORARILY_UNAVAILABLE',
    });
    expect(JSON.stringify(error.getResponse())).not.toContain(
      'connection lost',
    );
  });
});

describe('CarrierIdempotencyService.complete / fail', () => {
  it('kechikkan fail() bajarilgan kalitni `failed` ga qaytarmaydi', async () => {
    const { service, rows } = fakeStore();
    const lease = await acquire(service);
    await service.complete(lease.id);
    await service.fail(lease.id, 503);
    expect(rows[0].state).toBe('completed');
  });

  it('yozuv xatosi yutiladi — amal natijasi 5xx bo‘lib qaytmaydi', async () => {
    const { service, dataSource } = fakeStore();
    dataSource.query.mockRejectedValue(new Error('db down'));
    await expect(service.complete('x')).resolves.toBeUndefined();
    await expect(service.fail('x', 400)).resolves.toBeUndefined();
  });
});

describe('carrierOpFingerprint / carrierOpBinding', () => {
  it('JSON kalit tartibi barmoq iziga ta’sir qilmaydi', () => {
    expect(carrierOpFingerprint({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(
      carrierOpFingerprint({ b: { d: [1, 2], c: 2 }, a: 1 }),
    );
  });

  it('isbot fayli kalitlari kirmaydi (qayta yuklangan isbot 422 bermasin)', () => {
    expect(
      carrierOpFingerprint({
        comment: 'x',
        proofFileKeys: ['k1'],
        proofFileKeysVerified: true,
      }),
    ).toBe(carrierOpFingerprint({ comment: 'x' }));
  });

  it('tana o‘zgarsa barmoq izi o‘zgaradi; 32 hex', () => {
    const a = carrierOpFingerprint({ totalPrice: 100 });
    const b = carrierOpFingerprint({ totalPrice: 101 });
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it('bog‘lanish = amal:buyurtma:barmoq_izi', () => {
    expect(
      carrierOpBinding('rollback', ORDER_ID, { target_status: 'waiting' }),
    ).toBe(
      `rollback:${ORDER_ID}:${carrierOpFingerprint({ target_status: 'waiting' })}`,
    );
  });
});
