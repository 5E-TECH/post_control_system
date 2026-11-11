import {
  BadRequestException,
  ConflictException,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Brackets } from 'typeorm';
import { carrierActor } from './carrier-error-codes';
import { CarrierIdempotencyService } from './carrier-idempotency.service';
import {
  CARRIER_STATUS_TARGETS,
  CarrierService,
  NOT_YOURS_MESSAGE,
  assertCarrierProofFile,
} from './carrier.service';
import {
  CancelReason,
  CarrierOrderStatus,
  CarrierOrderStatusRequestDto,
} from './dto/carrier-public.dto';

/**
 * CarrierService — tashqi kompaniya amallari mavjud PCS kuryer amallariga
 * TO'G'RI yo'naltirilishi, kontrakt shartlari, idempotentlik va xato
 * xaritasi.
 *
 * Test muhiti:
 *   - buyurtmalar xotirada; `owned` bayrog'i egalik predikatining (SQL)
 *     natijasini bildiradi — predikatning o'zi alohida testda
 *     (QueryBuilder chaqiruvlari) tekshiriladi;
 *   - PCS servislari (`OrderService`, `PostService`) soxta — buyurtma
 *     holatini haqiqiydek o'zgartiradi;
 *   - `CarrierIdempotencyService` HAQIQIY, xotira jadvali ustida — takror,
 *     eski kalit va 422 oxirigacha sinaladi.
 */

const COURIER = '11111111-1111-4111-8111-111111111111';
const CARRIER = { id: 'acc-1', name: 'BTS Express', courier_user_id: COURIER };
const ORDER_ID = '3f6c2a9e-8b1d-4c7e-9a2f-1d5b8e7c4a90';
const ACTOR = carrierActor(COURIER);

type FakeOrder = Record<string, any> & {
  id: string;
  status: string;
  owned: boolean;
};

const order = (over: Partial<FakeOrder> = {}): FakeOrder => ({
  id: ORDER_ID,
  status: 'waiting',
  owned: true,
  qr_code_token: 'a1b2c3d4e5f6a7b8c9d0e1f2',
  created_at: 1_000,
  parent_order_id: null,
  replacement_of_order_id: null,
  replacement_state: null,
  total_price: 200000,
  where_deliver: 'address',
  district_id: null,
  items: [],
  ...over,
});

/** Chaqiruvlarni yozib boradigan QueryBuilder; natija `env` dan olinadi. */
function makeQb(env: Env) {
  const calls: Array<[string, unknown[]]> = [];
  const params: Record<string, any> = {};
  const qb: any = { calls, params };
  const chain =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, args]);
      if (name === 'setParameter') {
        params[args[0] as string] = args[1];
      } else {
        for (const arg of args) {
          if (
            arg &&
            typeof arg === 'object' &&
            !Array.isArray(arg) &&
            !(arg instanceof Brackets)
          ) {
            Object.assign(params, arg);
          }
        }
      }
      return qb;
    };
  for (const method of [
    'leftJoin',
    'innerJoin',
    'where',
    'andWhere',
    'orWhere',
    'select',
    'addSelect',
    'setParameter',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
  ]) {
    qb[method] = jest.fn(chain(method));
  }
  const clone = (o: FakeOrder) => JSON.parse(JSON.stringify(o));
  qb.getOne = jest.fn(async () => {
    env.readHook?.();
    const found = env.orders.get(params.orderId);
    return found && found.owned ? clone(found) : null;
  });
  qb.getMany = jest.fn(async () =>
    [...env.orders.values()]
      .filter((o) => o.owned && (params.tokens ?? []).includes(o.qr_code_token))
      .map(clone),
  );
  qb.getManyAndCount = jest.fn(async () => [env.list, env.listTotal]);
  qb.getRawMany = jest.fn(async () => env.rawRows);
  env.qbs.push(qb);
  return qb;
}

/** `carrier_idempotency_key` — xotira jadvali (INSERT/SELECT FOR UPDATE/UPDATE). */
function idempotencyStore() {
  const rows: any[] = [];
  const manager = {
    query: jest.fn(async (sql: string, p: any[]) => {
      if (sql.includes('INSERT INTO')) {
        if (rows.some((r) => r.account === p[2] && r.key_hash === p[3]))
          return [];
        rows.push({
          id: p[0],
          account: p[2],
          key_hash: p[3],
          binding: p[4],
          state: 'in_progress',
          lease_until: String(p[7]),
          http_status: null,
        });
        return [{ id: p[0] }];
      }
      if (sql.includes('FOR UPDATE')) {
        const r = rows.find((x) => x.account === p[0] && x.key_hash === p[1]);
        return r ? [{ ...r }] : [];
      }
      const r = rows.find((x) => x.id === p[2]);
      r.state = 'in_progress';
      r.lease_until = String(p[0]);
      return [[], 1];
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
    query: jest.fn(async (sql: string, p: any[]) => {
      const r = rows.find((x) => x.id === p[2]);
      if (!r) return [[], 0];
      if (sql.includes(`'completed'`)) r.state = 'completed';
      else if (r.state === 'in_progress') r.state = 'failed';
      else return [[], 0];
      r.http_status = p[0];
      r.lease_until = null;
      return [[], 1];
    }),
  };
  return { rows, service: new CarrierIdempotencyService(dataSource as any) };
}

type Env = {
  orders: Map<string, FakeOrder>;
  items: any[];
  children: any[];
  rawRows: any[];
  list: any[];
  listTotal: number;
  cashbox: any;
  history: any[];
  qbs: any[];
  readHook?: () => void;
  /** `/returns` navbat qulfi tranzaksiyasidagi so'rovlar. */
  lockQueries: Array<[string, unknown[]]>;
  lockHook?: (sql: string) => void;
};

function setup(orders: FakeOrder[] = [order()]) {
  const env: Env = {
    orders: new Map(orders.map((o) => [o.id, o])),
    items: [],
    children: [],
    rawRows: [],
    list: [],
    listTotal: 0,
    cashbox: null,
    history: [],
    qbs: [],
    lockQueries: [],
  };
  // `jest.Mock` (any imzo) — testlar `mockImplementationOnce` bilan har xil
  // natija beradi, chaqiruv argumentlari esa indeks bo'yicha tekshiriladi.
  const fn = (impl: (...args: any[]) => any): jest.Mock => jest.fn(impl);
  const setStatus = (status: string) => async (_actor: unknown, id: string) => {
    env.orders.get(id)!.status = status;
    return { statusCode: 200, message: 'ok', data: {} };
  };
  // PCS `partlySold` kabi: summa yangi narxga, asl summa saqlanadi.
  const partlySell = async (_actor: unknown, id: string, dto: any) => {
    const o = env.orders.get(id)!;
    o.original_total_price = o.original_total_price ?? o.total_price;
    o.total_price = dto.totalPrice;
    o.status = 'sold';
    return { statusCode: 200, message: 'ok', data: {} };
  };
  const orderService = {
    sellOrder: fn(setStatus('sold')),
    partlySold: fn(partlySell),
    cancelOrder: fn(setStatus('cancelled')),
    rollbackOrderToWaiting: fn(setStatus('waiting')),
  };
  const postService = {
    // PostService imzosi: (orderId, user) — OrderService'dan teskari tartib.
    receiveOrderForCourierById: fn(async (id: string) => {
      env.orders.get(id)!.status = 'waiting';
      return { statusCode: 200, message: 'Buyurtma qabul qilindi', data: {} };
    }),
    createCanceledPost: fn(async (_actor: unknown, dto: any) => ({
      statusCode: 200,
      message: 'ok',
      data: { post_id: 'return-post-new', order_ids: dto.order_ids },
    })),
  };
  const lockManager = {
    query: fn(async (sql: string, params: unknown[] = []) => {
      env.lockQueries.push([sql, params]);
      env.lockHook?.(sql);
      return [];
    }),
  };
  const orderRepo = {
    createQueryBuilder: fn(() => makeQb(env)),
    find: fn(async ({ where }: any) =>
      env.children.filter((c) => c.parent_order_id === where.parent_order_id),
    ),
    manager: {
      transaction: fn(async (cb: (m: unknown) => unknown) => cb(lockManager)),
    },
  };
  const orderItemRepo = { find: fn(async () => env.items) };
  const cashRepo = { findOne: fn(async () => env.cashbox) };
  const historyRepo = { find: fn(async () => env.history) };
  const activityLog = { log: fn(async () => undefined) };
  const store = idempotencyStore();

  const service = new CarrierService(
    orderRepo as any,
    orderItemRepo as any,
    cashRepo as any,
    historyRepo as any,
    orderService as any,
    postService as any,
    store.service,
    activityLog as any,
  );
  return {
    service,
    env,
    orderService,
    postService,
    orderRepo,
    orderItemRepo,
    cashRepo,
    historyRepo,
    activityLog,
    keys: store.rows,
  };
}

const statusDto = (body: Partial<CarrierOrderStatusRequestDto>) =>
  Object.assign(new CarrierOrderStatusRequestDto(), body);

const caught = async (p: Promise<unknown>): Promise<HttpException> => {
  const error = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HttpException);
  return error as HttpException;
};

const codeOf = (error: HttpException) =>
  (error.getResponse() as { code?: string }).code;

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterAll(() => jest.restoreAllMocks());

// ─────────────────────────────────────────────────────────────────────

describe('CarrierService — egalik predikati', () => {
  it("so'rovda control_owner sharti, kuryer va qaytarish holatlari bor", async () => {
    const { service, env } = setup();
    await service.updateStatus(
      CARRIER,
      ORDER_ID,
      statusDto({ status: CarrierOrderStatus.SOLD }),
      'k1',
    );
    const qb = env.qbs[0];
    const sql = JSON.stringify(qb.calls);
    // Elchi nazoratidagi (control_owner = 'elchi') buyurtma ko'rinmasin.
    expect(sql).toContain("COALESCE(TRIM(o.control_owner), '') = ''");
    expect(sql).toContain('carrier_post.id = o.post_id');
    expect(sql).toContain('carrier_return_post.id = o.canceled_post_id');
    // Brackets ichidagi shartlar: o'z pochtasi YOKI o'zi qaytargan posilka.
    const brackets = qb.calls
      .flatMap(([, args]: [string, unknown[]]) => args)
      .find((arg: unknown) => arg instanceof Brackets) as Brackets;
    const inner: string[] = [];
    const recorder: any = {
      where: (s: string) => (inner.push(s), recorder),
      orWhere: (s: string) => (inner.push(s), recorder),
    };
    brackets.whereFactory(recorder);
    expect(inner).toEqual([
      'carrier_post.courier_id = :carrierCourierId',
      '(carrier_return_post.courier_id = :carrierCourierId AND o.status IN (:...carrierReturnedStatuses))',
    ]);
    expect(qb.params.carrierCourierId).toBe(COURIER);
    expect(qb.params.carrierReturnedStatuses).toEqual([
      'cancelled (sent)',
      'closed',
    ]);
  });

  it('begona / topilmagan / Elchi nazoratidagi buyurtma → 404, hech qanday amal va kalit yo‘q', async () => {
    const { service, orderService, keys } = setup([order({ owned: false })]);
    const error = await caught(
      service.updateStatus(
        CARRIER,
        ORDER_ID,
        statusDto({ status: CarrierOrderStatus.SOLD }),
        'k1',
      ),
    );
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe(NOT_YOURS_MESSAGE);
    expect(orderService.sellOrder).not.toHaveBeenCalled();
    expect(keys).toHaveLength(0);
  });
});

describe('CarrierService.scan', () => {
  it("yo'ldagi posilka → kuryer nomidan id bo'yicha qabul, received: true", async () => {
    const { service, postService } = setup([order({ status: 'on the road' })]);
    const res: any = await service.scan(CARRIER, 'a1b2c3d4e5f6a7b8c9d0e1f2');
    expect(postService.receiveOrderForCourierById).toHaveBeenCalledWith(
      ORDER_ID,
      ACTOR,
    );
    expect(res.message).toBe('Posilka qabul qilindi');
    expect(res.data).toMatchObject({ received: true, refreshed: true });
    expect(res.data.order).toMatchObject({ id: ORDER_ID, status: 'waiting' });
  });

  it("waiting / yakunlangan posilka → faqat ma'lumot, qayta qabul yo'q", async () => {
    for (const status of ['waiting', 'sold', 'cancelled']) {
      const { service, postService } = setup([order({ status })]);
      const res: any = await service.scan(CARRIER, 'a1b2c3d4e5f6a7b8c9d0e1f2');
      expect(postService.receiveOrderForCourierById).not.toHaveBeenCalled();
      expect(res.message).toBe('Buyurtma topildi');
      expect(res.data).toMatchObject({ received: false, refreshed: true });
      expect(res.data.order.status).toBe(status);
    }
  });

  it('begona yoki topilmagan QR → 404 (borligi bilinmaydi)', async () => {
    const { service } = setup([order({ owned: false })]);
    const error = await caught(
      service.scan(CARRIER, 'a1b2c3d4e5f6a7b8c9d0e1f2'),
    );
    expect(error.getStatus()).toBe(404);
    expect(error.message).toBe(NOT_YOURS_MESSAGE);
    await expect(service.scan(CARRIER, '   ')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('token normalizatsiya qilinadi, xom qiymat ham sinaladi (tashqi yorliq)', async () => {
    const { service, env } = setup([
      order({ status: 'waiting', qr_code_token: 'ABC-1' }),
    ]);
    const res: any = await service.scan(CARRIER, ' ABC-1 ');
    expect(env.qbs[0].params.tokens).toEqual(['abc-1', 'ABC-1']);
    expect(res.data.order.id).toBe(ORDER_ID);
  });

  it('takroriy token: yakunlanmagan holat afzal, keyin eng yangisi', async () => {
    const sold = order({ id: 'o-sold', status: 'sold', created_at: 9_000 });
    const oldWaiting = order({
      id: 'o-old',
      status: 'waiting',
      created_at: 1_000,
    });
    const newWaiting = order({
      id: 'o-new',
      status: 'waiting',
      created_at: 5_000,
    });
    const { service } = setup([sold, oldWaiting, newWaiting]);
    const res: any = await service.scan(CARRIER, 'a1b2c3d4e5f6a7b8c9d0e1f2');
    expect(res.data.order.id).toBe('o-new');
  });

  it('poyga: qabul 400 berdi, lekin posilka allaqachon waiting → 200 received: false', async () => {
    const { service, postService, env } = setup([
      order({ status: 'on the road' }),
    ]);
    postService.receiveOrderForCourierById.mockImplementationOnce(async () => {
      env.orders.get(ORDER_ID)!.status = 'waiting'; // boshqa qurilma qabul qildi
      throw new HttpException(
        'Bu buyurtma allaqachon qabul qilingan (waiting)',
        400,
      );
    });
    const res: any = await service.scan(CARRIER, 'a1b2c3d4e5f6a7b8c9d0e1f2');
    expect(res.data).toMatchObject({ received: false, refreshed: true });
    expect(res.data.order.status).toBe('waiting');
  });

  it('hali yo‘lda va PCS 400 (pochta SENT emas) → 400 o‘z matni bilan', async () => {
    const { service, postService } = setup([order({ status: 'on the road' })]);
    postService.receiveOrderForCourierById.mockRejectedValueOnce(
      new HttpException(
        "Bu pochta allaqachon qabul qilingan yoki yo'lda emas",
        400,
      ),
    );
    const error = await caught(
      service.scan(CARRIER, 'a1b2c3d4e5f6a7b8c9d0e1f2'),
    );
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain("yo'lda emas");
  });

  it('hali yo‘lda va PCS 404/500 → 503 (qayta urinish xavfsiz)', async () => {
    const { service, postService } = setup([order({ status: 'on the road' })]);
    postService.receiveOrderForCourierById.mockRejectedValueOnce(
      new HttpException('Pochta topilmadi yoki sizga biriktirilmagan', 404),
    );
    const error = await caught(
      service.scan(CARRIER, 'a1b2c3d4e5f6a7b8c9d0e1f2'),
    );
    expect(error.getStatus()).toBe(503);
    expect(codeOf(error)).toBe('CARRIER_TEMPORARILY_UNAVAILABLE');
  });

  it('qabul commit bo‘ldi, lekin qayta o‘qish yiqildi → 200 received: true, order: null', async () => {
    const { service, env, postService } = setup([
      order({ status: 'on the road' }),
    ]);
    postService.receiveOrderForCourierById.mockImplementationOnce(async () => {
      env.orders.get(ORDER_ID)!.status = 'waiting';
      env.readHook = () => {
        throw new Error('read failed');
      };
    });
    const res: any = await service.scan(CARRIER, 'a1b2c3d4e5f6a7b8c9d0e1f2');
    expect(res.data).toEqual({ received: true, order: null, refreshed: false });
  });
});

describe('CarrierService.updateStatus — amallar', () => {
  it('sold → sellOrder(carrierActor, id, {comment}), javob yangilangan buyurtma, kalit completed, audit', async () => {
    const { service, orderService, keys, activityLog } = setup();
    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      statusDto({ status: CarrierOrderStatus.SOLD, comment: 'Mijoz oldi' }),
      'key-sold',
    );
    expect(orderService.sellOrder).toHaveBeenCalledWith(ACTOR, ORDER_ID, {
      comment: 'Mijoz oldi',
      old_item_collected: undefined,
    });
    // bypassControlGuard HECH QACHON uzatilmaydi.
    expect(orderService.sellOrder.mock.calls[0]).toHaveLength(3);
    expect(res).toMatchObject({
      statusCode: 200,
      message: 'Holat qabul qilindi',
    });
    expect(res.data).toMatchObject({
      refreshed: true,
      order: { id: ORDER_ID, status: 'sold' },
    });
    expect(keys[0]).toMatchObject({ state: 'completed', http_status: 200 });
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'order',
        entity_id: ORDER_ID,
        action: 'carrier.sold',
        old_value: { status: 'waiting' },
        new_value: { status: 'sold' },
        metadata: expect.objectContaining({
          source: 'carrier_api',
          carrier_account_id: 'acc-1',
          carrier_name: 'BTS Express',
          idempotency_key_hash: expect.stringMatching(/^[0-9a-f]{12}$/),
        }),
      }),
    );
  });

  it("waiting emas (yo'lda) → 400 skan maslahati bilan, PCS chaqirilmaydi, kalit failed", async () => {
    const { service, orderService, keys } = setup([
      order({ status: 'on the road' }),
    ]);
    const error = await caught(
      service.updateStatus(
        CARRIER,
        ORDER_ID,
        statusDto({ status: CarrierOrderStatus.SOLD }),
        'k1',
      ),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toContain('/carrier/scan');
    expect(orderService.sellOrder).not.toHaveBeenCalled();
    expect(keys[0]).toMatchObject({ state: 'failed', http_status: 400 });
  });

  it('almashtirish: eski mahsulot olinmagan va tasdiq yo‘q → 400; tasdiq bilan → true uzatiladi', async () => {
    const replacement = {
      replacement_of_order_id: 'old-1',
      replacement_state: 'awaiting_old_pickup',
    };
    const a = setup([order(replacement)]);
    const error = await caught(
      a.service.updateStatus(
        CARRIER,
        ORDER_ID,
        statusDto({ status: CarrierOrderStatus.SOLD }),
        'k1',
      ),
    );
    expect(error.message).toContain('old_item_collected: true');
    expect(a.orderService.sellOrder).not.toHaveBeenCalled();

    const b = setup([order(replacement)]);
    await b.service.updateStatus(
      CARRIER,
      ORDER_ID,
      statusDto({ status: CarrierOrderStatus.SOLD, old_item_collected: true }),
      'k1',
    );
    expect(b.orderService.sellOrder.mock.calls[0][2]).toMatchObject({
      old_item_collected: true,
    });
  });

  it('almashtirish: eski mahsulot AVVAL olingan (rollback’dan keyin) → bayroq avtomatik true (M2)', async () => {
    for (const state of ['old_collected', 'old_returned']) {
      const { service, orderService } = setup([
        order({ replacement_of_order_id: 'old-1', replacement_state: state }),
      ]);
      await service.updateStatus(
        CARRIER,
        ORDER_ID,
        statusDto({ status: CarrierOrderStatus.SOLD }),
        'k1',
      );
      expect(orderService.sellOrder.mock.calls[0][2]).toMatchObject({
        old_item_collected: true,
      });
    }
  });

  it('cancelled → cancelOrder izohi "[SABAB] izoh", sabab audit metadata’sida', async () => {
    const { service, orderService, activityLog } = setup();
    await service.updateStatus(
      CARRIER,
      ORDER_ID,
      statusDto({
        status: CarrierOrderStatus.CANCELLED,
        reason: CancelReason.CUSTOMER_REFUSED,
        comment: ' Mijoz olmadi ',
      }),
      'k1',
    );
    expect(orderService.cancelOrder).toHaveBeenCalledWith(ACTOR, ORDER_ID, {
      comment: '[CUSTOMER_REFUSED] Mijoz olmadi',
    });
    expect(activityLog.log.mock.calls[0][0]).toMatchObject({
      action: 'carrier.cancelled',
      metadata: { reason: 'CUSTOMER_REFUSED' },
    });
  });

  it('cancelled: izohsiz sabab → "[SABAB]"; OTHER izohsiz → 400', async () => {
    const a = setup();
    await a.service.updateStatus(
      CARRIER,
      ORDER_ID,
      statusDto({
        status: CarrierOrderStatus.CANCELLED,
        reason: 'WRONG_ADDRESS' as any,
      }),
      'k1',
    );
    expect(a.orderService.cancelOrder.mock.calls[0][2]).toEqual({
      comment: '[WRONG_ADDRESS]',
    });

    const b = setup();
    const error = await caught(
      b.service.updateStatus(
        CARRIER,
        ORDER_ID,
        statusDto({
          status: CarrierOrderStatus.CANCELLED,
          reason: 'OTHER' as any,
          comment: '  ',
        }),
        'k1',
      ),
    );
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain('OTHER');
    expect(b.orderService.cancelOrder).not.toHaveBeenCalled();
  });

  it("rollback → rollbackOrderToWaiting(actor, id, {target_status:'waiting'})", async () => {
    const { service, orderService } = setup([order({ status: 'sold' })]);
    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      statusDto({ status: CarrierOrderStatus.ROLLBACK }),
      'k1',
    );
    expect(orderService.rollbackOrderToWaiting).toHaveBeenCalledWith(
      ACTOR,
      ORDER_ID,
      {
        target_status: 'waiting',
      },
    );
    expect(res.data.order.status).toBe('waiting');
  });

  it('rollback: paid / partly_paid / waiting → 400 (BeePost operatori tuzatadi)', async () => {
    for (const status of [
      'paid',
      'partly_paid',
      'waiting',
      'cancelled (sent)',
    ]) {
      const { service, orderService } = setup([order({ status })]);
      const error = await caught(
        service.updateStatus(
          CARRIER,
          ORDER_ID,
          statusDto({ status: CarrierOrderStatus.ROLLBACK }),
          'k1',
        ),
      );
      expect(error.getStatus()).toBe(400);
      expect(orderService.rollbackOrderToWaiting).not.toHaveBeenCalled();
    }
  });

  it('rollback: qisman sotuv BOLASI (parent_order_id) → 400', async () => {
    const { service, orderService } = setup([
      order({ status: 'cancelled', parent_order_id: 'parent-1' }),
    ]);
    const error = await caught(
      service.updateStatus(
        CARRIER,
        ORDER_ID,
        statusDto({ status: CarrierOrderStatus.ROLLBACK }),
        'k1',
      ),
    );
    expect(error.message).toContain('parent_order_id');
    expect(orderService.rollbackOrderToWaiting).not.toHaveBeenCalled();
  });

  it('rollback: bolasi qaytarilgan/holati o‘zgargan ota → 400 (M1); bolalar cancelled bo‘lsa → ruxsat', async () => {
    for (const child of [
      { status: 'cancelled (sent)', canceled_post_id: 'cp-1' },
      { status: 'cancelled', canceled_post_id: 'cp-1' },
      { status: 'waiting', canceled_post_id: null },
    ]) {
      const { service, env, orderService } = setup([order({ status: 'sold' })]);
      env.children = [{ id: 'child-1', parent_order_id: ORDER_ID, ...child }];
      const error = await caught(
        service.updateStatus(
          CARRIER,
          ORDER_ID,
          statusDto({ status: CarrierOrderStatus.ROLLBACK }),
          'k1',
        ),
      );
      expect(error.getStatus()).toBe(400);
      expect(orderService.rollbackOrderToWaiting).not.toHaveBeenCalled();
    }

    const ok = setup([order({ status: 'sold' })]);
    ok.env.children = [
      {
        id: 'child-1',
        parent_order_id: ORDER_ID,
        status: 'cancelled',
        canceled_post_id: null,
      },
    ];
    await ok.service.updateStatus(
      CARRIER,
      ORDER_ID,
      statusDto({ status: CarrierOrderStatus.ROLLBACK }),
      'k1',
    );
    expect(ok.orderService.rollbackOrderToWaiting).toHaveBeenCalled();
  });
});

describe('CarrierService.updateStatus — qisman sotuv', () => {
  const ROWS = [
    { id: 'item-a', productId: 'prod-a', quantity: 2, created_at: 1 },
    { id: 'item-b', productId: 'prod-b', quantity: 1, created_at: 2 },
  ];

  const partly = (body: Partial<CarrierOrderStatusRequestDto>) =>
    statusDto({
      status: CarrierOrderStatus.PARTLY_SOLD,
      total_price: 100000,
      ...body,
    });

  const run = async (
    body: Partial<CarrierOrderStatusRequestDto>,
    over: { rows?: any[]; order?: Partial<FakeOrder> } = {},
  ) => {
    const ctx = setup([order(over.order ?? {})]);
    ctx.env.items = over.rows ?? ROWS;
    const result = await ctx.service
      .updateStatus(CARRIER, ORDER_ID, partly(body), 'k1')
      .then(
        (value) => ({ value, error: null as HttpException | null }),
        (error: HttpException) => ({ value: null, error }),
      );
    return { ...ctx, ...result };
  };

  it('qatorlar order_item_id YOKI product_id bilan → partlySold(product_id, SOTILGAN dona)', async () => {
    const { error, orderService } = await run({
      items: [
        { order_item_id: 'ITEM-A', quantity: 1 } as any,
        { product_id: 'prod-b', quantity: 1 } as any,
      ],
    });
    expect(error).toBeNull();
    expect(orderService.partlySold).toHaveBeenCalledWith(ACTOR, ORDER_ID, {
      order_item_info: [
        { product_id: 'prod-a', quantity: 1 },
        { product_id: 'prod-b', quantity: 1 },
      ],
      totalPrice: 100000,
      comment: undefined,
    });
  });

  const rejects: Array<
    [string, Partial<CarrierOrderStatusRequestDto>, any, string]
  > = [
    [
      "tovar qatorlari yo'q (marketplace) → 400",
      { items: [{ product_id: 'x', quantity: 0 } as any] },
      { rows: [] },
      "tovar qatorlari yo'q",
    ],
    [
      'almashtirish buyurtmasi → 400',
      { items: [] },
      {
        order: {
          replacement_of_order_id: 'old-1',
          replacement_state: 'old_collected',
        },
      },
      'Almashtirish',
    ],
    [
      'bir mahsulot ikki qatorda → 400',
      { items: [] },
      {
        rows: [
          { id: 'i1', productId: 'dup', quantity: 1 },
          { id: 'i2', productId: 'DUP', quantity: 1 },
        ],
      },
      'bir necha qatorda',
    ],
    [
      'summa buyurtmadan katta → 400',
      { total_price: 200001, items: [] },
      {},
      'oshmasligi kerak',
    ],
    [
      'kasr summa → 400 (bigint kassa)',
      { total_price: 1000.5, items: [] },
      {},
      'butun son',
    ],
    [
      "qator so'rovda yo'q → 400",
      { items: [{ order_item_id: 'item-a', quantity: 1 } as any] },
      {},
      'Product not found in request: prod-b',
    ],
    [
      'qatorda sotilgan > asl → 400 (+1/−1 aylanma yo‘li)',
      {
        items: [
          { order_item_id: 'item-a', quantity: 1 } as any,
          { order_item_id: 'item-b', quantity: 2 } as any,
        ],
      },
      {},
      'Quantity cannot exceed original amount for product prod-b',
    ],
    [
      "noma'lum order_item_id → 400",
      {
        items: [
          { order_item_id: 'item-a', quantity: 1 } as any,
          { order_item_id: 'item-b', quantity: 0 } as any,
          { order_item_id: 'item-zzz', quantity: 0 } as any,
        ],
      },
      {},
      'Order item not found in order: item-zzz',
    ],
    [
      "noma'lum product_id → 400",
      {
        items: [
          { order_item_id: 'item-a', quantity: 1 } as any,
          { order_item_id: 'item-b', quantity: 0 } as any,
          { product_id: 'prod-zzz', quantity: 0 } as any,
        ],
      },
      {},
      'Product not found in order: prod-zzz',
    ],
    [
      'bir qator ikki marta berilgan → 400',
      {
        items: [
          { order_item_id: 'item-a', quantity: 1 } as any,
          { product_id: 'prod-a', quantity: 0 } as any,
          { order_item_id: 'item-b', quantity: 0 } as any,
        ],
      },
      {},
      'bir necha marta',
    ],
    [
      'hech qaysi qator kamaytirilmagan → 400',
      {
        items: [
          { order_item_id: 'item-a', quantity: 2 } as any,
          { order_item_id: 'item-b', quantity: 1 } as any,
        ],
      },
      {},
      'kamida bitta mahsulot soni kamaytirilishi',
    ],
    [
      'hech narsa sotilmagan → 400 (bekor qilishdan foydalaning)',
      {
        items: [
          { order_item_id: 'item-a', quantity: 0 } as any,
          { order_item_id: 'item-b', quantity: 0 } as any,
        ],
      },
      {},
      'kamida bitta mahsulot sotilishi',
    ],
    [
      'jami sotilgan dona asl sondan ko‘p → 400',
      {
        items: [
          { order_item_id: 'item-a', quantity: 2 } as any,
          { order_item_id: 'item-b', quantity: 1 } as any,
          { order_item_id: 'item-b', quantity: 1 } as any,
        ],
      },
      {},
      'asl sondan oshmasligi',
    ],
  ];

  it.each(rejects)('%s', async (_title, body, over, message) => {
    const { error, orderService, keys } = await run(body, over);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error!.message).toContain(message);
    expect(orderService.partlySold).not.toHaveBeenCalled();
    // Kalit bo'shaydi — tuzatilgan tana yangi kalit bilan yuboriladi.
    expect(keys[0]).toMatchObject({ state: 'failed', http_status: 400 });
  });
});

describe('CarrierService.updateStatus — isbot fayli', () => {
  const MB = 1024 * 1024;

  it('rollback’da isbot → 400; noto‘g‘ri tur / katta rasm → 400; video 50 MB gacha → ruxsat', () => {
    expect(() =>
      assertCarrierProofFile(CarrierOrderStatus.ROLLBACK, {
        mimetype: 'image/png',
        size: 1,
      }),
    ).toThrow('rollback uchun proof kerak emas');
    expect(() =>
      assertCarrierProofFile(CarrierOrderStatus.SOLD, {
        mimetype: 'image/heic',
        size: 1,
      }),
    ).toThrow('Isbot fayli turi qabul qilinmaydi');
    expect(() =>
      assertCarrierProofFile(CarrierOrderStatus.SOLD, {
        mimetype: 'image/jpeg',
        size: 10 * MB + 1,
      }),
    ).toThrow('10 MB dan oshmasin');
    expect(() =>
      assertCarrierProofFile(CarrierOrderStatus.SOLD, {
        mimetype: 'video/mp4',
        size: 50 * MB + 1,
      }),
    ).toThrow('Video isbot 50 MB dan oshmasin');
    expect(() =>
      assertCarrierProofFile(CarrierOrderStatus.CANCELLED, {
        mimetype: 'VIDEO/MP4',
        size: 40 * MB,
      }),
    ).not.toThrow();
    expect(() =>
      assertCarrierProofFile(CarrierOrderStatus.PARTLY_SOLD, {
        mimetype: 'application/pdf',
        buffer: Buffer.alloc(10),
      }),
    ).not.toThrow();
    expect(() =>
      assertCarrierProofFile(CarrierOrderStatus.ROLLBACK, null),
    ).not.toThrow();
  });

  it('isbot egalikdan KEYIN tekshiriladi (begona buyurtma → 404), amalgacha (kalit ochilmaydi)', async () => {
    const a = setup([order({ owned: false })]);
    const notYours = await caught(
      a.service.updateStatus(
        CARRIER,
        ORDER_ID,
        statusDto({ status: CarrierOrderStatus.SOLD }),
        'k1',
        { mimetype: 'text/plain', size: 1 },
      ),
    );
    expect(notYours.getStatus()).toBe(404);

    const b = setup();
    const bad = await caught(
      b.service.updateStatus(
        CARRIER,
        ORDER_ID,
        statusDto({ status: CarrierOrderStatus.SOLD }),
        'k1',
        { mimetype: 'text/plain', size: 1 },
      ),
    );
    expect(bad.getStatus()).toBe(400);
    expect(b.keys).toHaveLength(0);
    expect(b.orderService.sellOrder).not.toHaveBeenCalled();
  });
});

describe('CarrierService.updateStatus — xato xaritasi (critique I1)', () => {
  const sold = () => statusDto({ status: CarrierOrderStatus.SOLD });

  it('1) PCS xato berdi, lekin buyurtma MAQSAD holatda (commit’dan keyin yiqildi) → 200, kalit completed', async () => {
    const { service, orderService, env, keys } = setup();
    orderService.sellOrder.mockImplementationOnce(async () => {
      env.orders.get(ORDER_ID)!.status = 'paid';
      throw new HttpException('Order not found or not in waiting status', 404);
    });
    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      sold(),
      'k1',
    );
    expect(res.data).toMatchObject({
      refreshed: true,
      order: { status: 'paid' },
    });
    expect(keys[0].state).toBe('completed');
  });

  it('2a) control_owner guardi (409) → 404, yalang‘och 409 chiqmaydi', async () => {
    const { service, orderService, keys } = setup();
    orderService.sellOrder.mockRejectedValueOnce(
      new ConflictException(
        'Bu buyurtma hozir tashqi tizim (elchi) tomonidan boshqariladi',
      ),
    );
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(404);
    expect(error.message).toBe(NOT_YOURS_MESSAGE);
    expect(keys[0]).toMatchObject({ state: 'failed', http_status: 404 });
  });

  it('2b) amal paytida buyurtma begona bo‘lib qoldi → 404', async () => {
    const { service, orderService, env } = setup();
    orderService.sellOrder.mockImplementationOnce(async () => {
      env.orders.get(ORDER_ID)!.owned = false;
      throw new HttpException('Bu buyurtma sizga tegishli emas', 403);
    });
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(404);
  });

  it('3) holat boshqa tomonga o‘zgardi → 400 "Buyurtma holati o‘zgardi"', async () => {
    const { service, orderService, env, keys } = setup();
    orderService.sellOrder.mockImplementationOnce(async () => {
      env.orders.get(ORDER_ID)!.status = 'cancelled';
      throw new HttpException('Order not found or not in waiting status', 404);
    });
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe("Buyurtma holati o'zgardi: cancelled");
    expect(keys[0]).toMatchObject({ state: 'failed', http_status: 400 });
  });

  it('4a) holat o‘zgarmagan + PCS 400 → 400 o‘z matni bilan', async () => {
    const { service, orderService } = setup();
    orderService.sellOrder.mockRejectedValueOnce(
      new HttpException("Qo'shimcha xarajat limiti", 400),
    );
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe("Qo'shimcha xarajat limiti");
  });

  it('4b) holat o‘zgarmagan + ichki 404 / 500 → 503 CARRIER_TEMPORARILY_UNAVAILABLE, kalit qayta ishlatiladi', async () => {
    for (const thrown of [
      new HttpException('Market cashbox not found', 404),
      new Error('deadlock detected'),
    ]) {
      const { service, orderService, keys } = setup();
      orderService.sellOrder.mockRejectedValueOnce(thrown);
      const error = await caught(
        service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
      );
      expect(error.getStatus()).toBe(503);
      expect(codeOf(error)).toBe('CARRIER_TEMPORARILY_UNAVAILABLE');
      // Ichki SQL matni tashqariga chiqmaydi.
      expect(error.message).not.toContain('deadlock');
      expect(keys[0]).toMatchObject({ state: 'failed', http_status: 503 });
    }
  });

  it('4c) xatodan keyin qayta o‘qish ham yiqildi → 503', async () => {
    const { service, orderService, env } = setup();
    orderService.sellOrder.mockImplementationOnce(async () => {
      env.readHook = () => {
        throw new Error('db down');
      };
      throw new Error('boom');
    });
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(503);
  });

  describe('maqsad holat bir xil, lekin natija BOSHQA amalniki', () => {
    const ITEMS = [
      { id: 'item-a', productId: 'prod-a', quantity: 2, created_at: 1 },
    ];
    const partlyDto = () =>
      statusDto({
        status: CarrierOrderStatus.PARTLY_SOLD,
        total_price: 100000,
        items: [{ order_item_id: 'item-a', quantity: 1 } as any],
      });

    it('partly_sold yutqazdi — parallel TO‘LIQ sotuv bo‘ldi → 400 (qisman summa "qabul qilindi" demaydi)', async () => {
      const { service, orderService, env, keys } = setup();
      env.items = ITEMS;
      orderService.partlySold.mockImplementationOnce(async () => {
        env.orders.get(ORDER_ID)!.status = 'sold'; // boshqa kalit bilan `sold`
        throw new HttpException(
          'Order not found or not in Waiting status',
          404,
        );
      });
      const error = await caught(
        service.updateStatus(CARRIER, ORDER_ID, partlyDto(), 'k-partly'),
      );
      expect(error.getStatus()).toBe(400);
      expect(error.message).toBe("Buyurtma holati o'zgardi: sold");
      expect(keys[0]).toMatchObject({ state: 'failed', http_status: 400 });
    });

    it('sold yutqazdi — parallel QISMAN sotuv bo‘ldi → 400', async () => {
      const { service, orderService, env } = setup();
      orderService.sellOrder.mockImplementationOnce(async () => {
        const o = env.orders.get(ORDER_ID)!;
        o.status = 'sold';
        o.original_total_price = 200000;
        o.total_price = 120000;
        throw new HttpException(
          'Order not found or not in waiting status',
          404,
        );
      });
      const error = await caught(
        service.updateStatus(CARRIER, ORDER_ID, sold(), 'k-sold'),
      );
      expect(error.getStatus()).toBe(400);
    });

    it('partly_sold O‘ZI commit bo‘lib keyin yiqildi (ayni summa) → 200', async () => {
      const { service, orderService, env } = setup();
      env.items = ITEMS;
      orderService.partlySold.mockImplementationOnce(
        async (_actor: unknown, id: string, dto: any) => {
          const o = env.orders.get(id)!;
          o.original_total_price = o.total_price;
          o.total_price = dto.totalPrice;
          o.status = 'partly_paid';
          throw new Error('Telegram timeout after commit');
        },
      );
      const res: any = await service.updateStatus(
        CARRIER,
        ORDER_ID,
        partlyDto(),
        'k-partly',
      );
      expect(res.data.order).toMatchObject({
        status: 'partly_paid',
        total_price: 100000,
      });
    });
  });
});

describe('CarrierService.updateStatus — idempotentlik va eski kalit', () => {
  const sold = (comment?: string) =>
    statusDto({
      status: CarrierOrderStatus.SOLD,
      ...(comment ? { comment } : {}),
    });

  it('amaldan keyin holat o‘zgarmagan (maqsadda emas) → 409 CARRIER_IDEMPOTENCY_KEY_STALE', async () => {
    const { service, orderService } = setup();
    orderService.sellOrder.mockResolvedValueOnce({} as any); // holat waiting'da qoldi
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(409);
    expect(codeOf(error)).toBe('CARRIER_IDEMPOTENCY_KEY_STALE');
  });

  it('ayni kalit takrori (bajarilgan) → amal QAYTA yuritilmaydi, 200 joriy buyurtma bilan', async () => {
    const { service, orderService } = setup();
    await service.updateStatus(CARRIER, ORDER_ID, sold(), 'same-key');
    const replay: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      sold(),
      'same-key',
    );
    expect(orderService.sellOrder).toHaveBeenCalledTimes(1);
    expect(replay.data).toMatchObject({
      refreshed: true,
      order: { status: 'sold' },
    });
  });

  it('sold → rollback → ESKI kalit bilan sold → 409 STALE (ikkinchi sotuv bajarilmaydi)', async () => {
    const { service, orderService } = setup();
    await service.updateStatus(CARRIER, ORDER_ID, sold(), 'sell-key');
    await service.updateStatus(
      CARRIER,
      ORDER_ID,
      statusDto({ status: CarrierOrderStatus.ROLLBACK }),
      'rollback-key',
    );
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'sell-key'),
    );
    expect(error.getStatus()).toBe(409);
    expect(codeOf(error)).toBe('CARRIER_IDEMPOTENCY_KEY_STALE');
    expect(orderService.sellOrder).toHaveBeenCalledTimes(1);
  });

  it('ayni kalit boshqa tana bilan → 422 IDEMPOTENCY_KEY_MISMATCH', async () => {
    const { service } = setup();
    await service.updateStatus(CARRIER, ORDER_ID, sold('a'), 'k1');
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold('b'), 'k1'),
    );
    expect(error.getStatus()).toBe(422);
    expect(codeOf(error)).toBe('IDEMPOTENCY_KEY_MISMATCH');
  });

  it('yiqilgan urinishni ayni kalit bilan qayta yuborish → qayta bajariladi', async () => {
    const { service, orderService } = setup();
    orderService.sellOrder.mockRejectedValueOnce(
      new HttpException('Market cashbox not found', 404),
    );
    await caught(service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'));
    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      sold(),
      'k1',
    );
    expect(orderService.sellOrder).toHaveBeenCalledTimes(2);
    expect(res.data.order.status).toBe('sold');
  });

  it('amal bajarildi, lekin javob uchun o‘qish yiqildi → 200 { order: null, refreshed: false }', async () => {
    const { service, orderService, env } = setup();
    orderService.sellOrder.mockImplementationOnce(async () => {
      env.orders.get(ORDER_ID)!.status = 'sold';
      // Amal xatosiz — keyingi (javob uchun) o'qish yiqiladi.
      env.readHook = () => {
        throw new Error('replica lag');
      };
      return {} as any;
    });
    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      sold(),
      'k1',
    );
    expect(res).toMatchObject({
      statusCode: 200,
      data: { order: null, refreshed: false },
    });
  });

  it('maqsad holatlar Elchi bilan bir xil ma’noda (BeePost: returned_to_market o‘rniga closed)', () => {
    expect(CARRIER_STATUS_TARGETS.sold).toEqual([
      'sold',
      'paid',
      'partly_paid',
    ]);
    expect(CARRIER_STATUS_TARGETS.partly_sold).toEqual([
      'sold',
      'paid',
      'partly_paid',
    ]);
    expect(CARRIER_STATUS_TARGETS.cancelled).toEqual([
      'cancelled',
      'cancelled (sent)',
      'closed',
    ]);
    expect(CARRIER_STATUS_TARGETS.rollback).toEqual(['waiting']);
  });
});

/** Kalitni "jarayon commit'dan keyin, `complete()` gacha o'ldi" holatiga keltiradi. */
const crashBeforeComplete = (row: any) => {
  row.state = 'in_progress';
  row.lease_until = String(Date.now() - 1);
  row.http_status = null;
};

describe('CarrierService.updateStatus — crash oynasi (qayta egallangan kalit)', () => {
  const sold = () => statusDto({ status: CarrierOrderStatus.SOLD });

  it('⭐ sotuv commit bo‘ldi, complete() yozilmadi → ayni kalit 90 s dan keyin: 200, sotuv QAYTA yuritilmaydi, kalit completed', async () => {
    const { service, orderService, keys, activityLog } = setup();
    await service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1');
    crashBeforeComplete(keys[0]);
    activityLog.log.mockClear();

    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      sold(),
      'k1',
    );

    expect(res.data).toMatchObject({
      refreshed: true,
      order: { status: 'sold' },
    });
    expect(orderService.sellOrder).toHaveBeenCalledTimes(1);
    expect(keys[0]).toMatchObject({ state: 'completed', http_status: 200 });
    // Avvalgi urinishning audit izi tiklanadi — belgisi bilan, oldingi holat noma'lum.
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'carrier.sold',
        old_value: null,
        new_value: { status: 'sold' },
        metadata: expect.objectContaining({ recovered_after_takeover: true }),
      }),
    );
  });

  it('⭐ commit’dan keyin xato + qayta o‘qish ham yiqildi (failed 503) → ayni kalit: 200, pul bir marta', async () => {
    const { service, orderService, env, keys } = setup();
    orderService.sellOrder.mockImplementationOnce(async () => {
      env.orders.get(ORDER_ID)!.status = 'sold';
      env.readHook = () => {
        throw new Error('db down');
      };
      throw new Error('Telegram timeout after commit');
    });
    const first = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(first.getStatus()).toBe(503);
    expect(keys[0]).toMatchObject({ state: 'failed', http_status: 503 });

    env.readHook = undefined;
    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      sold(),
      'k1',
    );
    expect(res.data.order.status).toBe('sold');
    expect(orderService.sellOrder).toHaveBeenCalledTimes(1);
    expect(keys[0].state).toBe('completed');
  });

  it('rollback commit bo‘ldi (endi waiting) → ayni kalit: 200, "Rollback mumkin emas" EMAS', async () => {
    const { service, orderService, keys } = setup([order({ status: 'sold' })]);
    const rollback = () => statusDto({ status: CarrierOrderStatus.ROLLBACK });
    await service.updateStatus(CARRIER, ORDER_ID, rollback(), 'rb');
    crashBeforeComplete(keys[0]);
    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      rollback(),
      'rb',
    );
    expect(res.data.order.status).toBe('waiting');
    expect(orderService.rollbackOrderToWaiting).toHaveBeenCalledTimes(1);
  });

  it('cancelled commit bo‘ldi → ayni kalit: 200, sabab audit’da', async () => {
    const { service, orderService, keys, activityLog } = setup();
    const cancel = () =>
      statusDto({
        status: CarrierOrderStatus.CANCELLED,
        reason: CancelReason.CUSTOMER_REFUSED,
      });
    await service.updateStatus(CARRIER, ORDER_ID, cancel(), 'c1');
    crashBeforeComplete(keys[0]);
    activityLog.log.mockClear();
    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      cancel(),
      'c1',
    );
    expect(res.data.order.status).toBe('cancelled');
    expect(orderService.cancelOrder).toHaveBeenCalledTimes(1);
    expect(activityLog.log.mock.calls[0][0].metadata).toMatchObject({
      recovered_after_takeover: true,
      reason: 'CUSTOMER_REFUSED',
    });
  });

  describe('qisman sotuv', () => {
    const ITEMS = [
      { id: 'item-a', productId: 'prod-a', quantity: 2, created_at: 1 },
    ];
    const partly = () =>
      statusDto({
        status: CarrierOrderStatus.PARTLY_SOLD,
        total_price: 100000,
        items: [{ order_item_id: 'item-a', quantity: 1 } as any],
      });

    it('o‘zi commit bo‘lgan (ayni summa) → 200, qayta yuritilmaydi', async () => {
      const { service, orderService, env, keys } = setup();
      env.items = ITEMS;
      await service.updateStatus(CARRIER, ORDER_ID, partly(), 'p1');
      crashBeforeComplete(keys[0]);
      const res: any = await service.updateStatus(
        CARRIER,
        ORDER_ID,
        partly(),
        'p1',
      );
      expect(res.data.order).toMatchObject({
        status: 'sold',
        total_price: 100000,
      });
      expect(orderService.partlySold).toHaveBeenCalledTimes(1);
    });

    it('buyurtma boshqa yo‘l bilan TO‘LIQ sotilgan → muvaffaqiyat deb olinmaydi, 400', async () => {
      const { service, env, keys } = setup();
      env.items = ITEMS;
      await service.updateStatus(CARRIER, ORDER_ID, partly(), 'p1');
      crashBeforeComplete(keys[0]);
      // Qisman sotuv aslida yozilmagan; buyurtma to'liq narxda sotilgan.
      Object.assign(env.orders.get(ORDER_ID)!, {
        status: 'sold',
        total_price: 200000,
        original_total_price: null,
      });
      const error = await caught(
        service.updateStatus(CARRIER, ORDER_ID, partly(), 'p1'),
      );
      expect(error.getStatus()).toBe(400);
      expect(keys[0]).toMatchObject({ state: 'failed', http_status: 400 });
    });
  });

  it('sold: buyurtma QISMAN sotilgan holatda → to‘liq sotuv natijasi emas, 400', async () => {
    const { service, env, keys } = setup();
    await service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1');
    crashBeforeComplete(keys[0]);
    Object.assign(env.orders.get(ORDER_ID)!, {
      status: 'sold',
      total_price: 120000,
      original_total_price: 200000,
    });
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(400);
  });

  it('avvalgi urinish aniq YOZMAGAN (failed 4xx) → buyurtma maqsadda bo‘lsa ham muvaffaqiyat emas (boshqa kalitniki)', async () => {
    const { service, orderService, keys } = setup();
    orderService.sellOrder.mockRejectedValueOnce(
      new HttpException("Qo'shimcha xarajat limiti", 400),
    );
    await caught(service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'));
    expect(keys[0]).toMatchObject({ state: 'failed', http_status: 400 });
    await service.updateStatus(CARRIER, ORDER_ID, sold(), 'k2');

    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(400);
    expect(orderService.sellOrder).toHaveBeenCalledTimes(2);
  });

  it('qayta egallashda qayta o‘qish yiqildi → 503, kalit bo‘shatiladi (90 s 409 emas)', async () => {
    const { service, env, keys } = setup();
    await service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1');
    crashBeforeComplete(keys[0]);
    let reads = 0;
    env.readHook = () => {
      reads += 1;
      if (reads === 2) throw new Error('db down');
    };
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(503);
    expect(codeOf(error)).toBe('CARRIER_TEMPORARILY_UNAVAILABLE');
    expect(keys[0]).toMatchObject({ state: 'failed', http_status: 503 });
  });
});

describe('CarrierService.updateStatus — bajarilgan kalit takrori JORIY holatdan', () => {
  const sold = () => statusDto({ status: CarrierOrderStatus.SOLD });

  it('⭐ takror birinchi so‘rov commit’idan OLDIN o‘qigan, acquire esa completed ko‘rgan → 200 (409 STALE emas)', async () => {
    const { service, orderService, env } = setup();
    await service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1');
    // Takrorning birinchi o'qishi `waiting` ni ko'radi (birinchi so'rov
    // hali commit qilmagan), keyin commit + complete() ulguradi.
    env.orders.get(ORDER_ID)!.status = 'waiting';
    let reads = 0;
    env.readHook = () => {
      reads += 1;
      if (reads === 2) env.orders.get(ORDER_ID)!.status = 'sold';
    };
    const res: any = await service.updateStatus(
      CARRIER,
      ORDER_ID,
      sold(),
      'k1',
    );
    expect(res.data).toMatchObject({
      refreshed: true,
      order: { status: 'sold' },
    });
    expect(orderService.sellOrder).toHaveBeenCalledTimes(1);
  });

  it('takrorda qayta o‘qish yiqildi → 503 (qaror qilib bo‘lmaydi), kalit completed qoladi', async () => {
    const { service, env, keys } = setup();
    await service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1');
    let reads = 0;
    env.readHook = () => {
      reads += 1;
      if (reads === 2) throw new Error('db down');
    };
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(503);
    expect(keys[0].state).toBe('completed');
  });

  it('takror paytida buyurtma begona bo‘lib qoldi → 404', async () => {
    const { service, env } = setup();
    await service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1');
    let reads = 0;
    env.readHook = () => {
      reads += 1;
      if (reads === 2) env.orders.get(ORDER_ID)!.owned = false;
    };
    const error = await caught(
      service.updateStatus(CARRIER, ORDER_ID, sold(), 'k1'),
    );
    expect(error.getStatus()).toBe(404);
  });
});

describe('CarrierService.createReturns', () => {
  const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const raw = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    status: 'cancelled',
    canceled_post_id: null,
    control_owner: null,
    post_courier_id: COURIER,
    return_post_courier_id: null,
    ...over,
  });

  it('allaqachon O‘Z qaytarish pochtasida → takror xavfsiz; qolganlari PCS’ga, kuryer nomidan', async () => {
    const { service, env, postService } = setup();
    env.rawRows = [
      raw(A, {
        status: 'cancelled (sent)',
        canceled_post_id: 'return-post-old',
        return_post_courier_id: COURIER,
      }),
      raw(B),
    ];
    const res: any = await service.createReturns(CARRIER, [
      A,
      ` ${B.toUpperCase()} `,
      A,
    ]);
    expect(postService.createCanceledPost).toHaveBeenCalledWith(ACTOR, {
      order_ids: [B],
    });
    expect(res).toEqual({
      statusCode: 200,
      message: 'Qaytarish pochtasi tayyor',
      data: { post_id: 'return-post-new', order_ids: [A, B] },
    });
  });

  it('hammasi allaqachon qaytarilgan (markaz qabul qilgan — closed ham) → o‘sha post_id, yangi pochta yo‘q', async () => {
    const { service, env, postService } = setup();
    env.rawRows = [
      raw(A, {
        status: 'closed',
        canceled_post_id: 'return-post-old',
        return_post_courier_id: COURIER,
      }),
    ];
    const res: any = await service.createReturns(CARRIER, [A]);
    expect(postService.createCanceledPost).not.toHaveBeenCalled();
    expect(res.data).toEqual({ post_id: 'return-post-old', order_ids: [A] });
  });

  it('begona / topilmagan / Elchi nazoratida → BUTUN so‘rov 404 (id’lar bilan), pochta ochilmaydi', async () => {
    const { service, env, postService } = setup();
    env.rawRows = [
      raw(A),
      raw(B, { post_courier_id: 'boshqa-kuryer' }),
      raw(C, { control_owner: 'elchi' }),
    ];
    const missing = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const error = await caught(
      service.createReturns(CARRIER, [A, B, C, missing]),
    );
    expect(error.getStatus()).toBe(404);
    expect(error.message).toBe(`${NOT_YOURS_MESSAGE}: ${B}, ${C}, ${missing}`);
    expect(postService.createCanceledPost).not.toHaveBeenCalled();
  });

  it('boshqa kuryerning qaytarish pochtasidagi posilka → 404', async () => {
    const { service, env } = setup();
    env.rawRows = [
      raw(A, {
        status: 'cancelled (sent)',
        canceled_post_id: 'p-x',
        return_post_courier_id: 'boshqa-kuryer',
        post_courier_id: 'boshqa-kuryer',
      }),
    ];
    await expect(service.createReturns(CARRIER, [A])).rejects.toThrow(
      NotFoundException,
    );
  });

  it('cancelled emas → 400 (holat bilan)', async () => {
    const { service, env, postService } = setup();
    env.rawRows = [raw(A, { status: 'waiting' }), raw(B)];
    const error = await caught(service.createReturns(CARRIER, [A, B]));
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain(`${A} (waiting)`);
    expect(postService.createCanceledPost).not.toHaveBeenCalled();
  });

  it("noto'g'ri id → 400", async () => {
    const { service, env } = setup();
    await expect(service.createReturns(CARRIER, ['901'])).rejects.toThrow(
      BadRequestException,
    );
    // Tekshiruv qulfdan OLDIN — noto'g'ri so'rov navbatni band qilmaydi.
    expect(env.lockQueries).toHaveLength(0);
  });

  it('⭐ kompaniya so‘rovlari navbatda: kuryer kalitli advisory lock (cheklangan kutish) o‘qishdan OLDIN', async () => {
    const { service, env, orderRepo } = setup();
    env.rawRows = [raw(A)];
    const order: string[] = [];
    env.lockHook = (sql) => order.push(sql);
    orderRepo.createQueryBuilder.mockImplementationOnce(() => {
      order.push('pre-read');
      return makeQb(env);
    });
    await service.createReturns(CARRIER, [A]);
    expect(env.lockQueries[0][0]).toMatch(/SET LOCAL lock_timeout = '\d+ms'/);
    expect(env.lockQueries[1]).toEqual([
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`carrier_returns:${COURIER}`],
    ]);
    // PCS `canceled_post:*` qulfidan BOSHQA kalit — o'z-o'zini kutib qolmaydi.
    expect(String(env.lockQueries[1][1][0])).not.toContain('canceled_post');
    expect(order.indexOf('pre-read')).toBeGreaterThan(
      order.findIndex((q) => q.includes('pg_advisory_xact_lock')),
    );
  });

  it('navbat qulfini olib bo‘lmadi (lock_timeout) → 503, pochta ochilmaydi', async () => {
    const { service, env, postService } = setup();
    env.rawRows = [raw(A)];
    env.lockHook = (sql) => {
      if (sql.includes('pg_advisory_xact_lock')) {
        throw new Error('canceling statement due to lock timeout');
      }
    };
    const error = await caught(service.createReturns(CARRIER, [A]));
    expect(error.getStatus()).toBe(503);
    expect(codeOf(error)).toBe('CARRIER_TEMPORARILY_UNAVAILABLE');
    expect(error.message).not.toContain('lock timeout');
    expect(postService.createCanceledPost).not.toHaveBeenCalled();
  });
});

describe('CarrierService.listOrders', () => {
  it("noma'lum holat → 400", async () => {
    const { service } = setup();
    const error = await caught(
      service.listOrders(CARRIER, { status: 'waiting,delivered' }),
    );
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe("Noma'lum holat: delivered");
  });

  it('kalendarda yo‘q kun (2026-02-31) → 400, jimgina 3-martga aylanmaydi', async () => {
    const { service, orderRepo } = setup();
    for (const query of [{ from: '2026-02-31' }, { to: '2026-04-31' }]) {
      const error = await caught(service.listOrders(CARRIER, query));
      expect(error.getStatus()).toBe(400);
      expect(error.message).toBe("Sana noto'g'ri (YYYY-MM-DD)");
    }
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('faqat Elchi’dagi holatlar (waiting_customer) → 400 emas, bo‘sh natija, so‘rov ketmaydi', async () => {
    const { service, orderRepo } = setup();
    const res: any = await service.listOrders(CARRIER, {
      status: 'waiting_customer,returned_to_market',
    });
    expect(res.data).toEqual({ items: [], total: 0, page: 1, limit: 50 });
    expect(orderRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('kuryer doirasi, control_owner, qaytarilganlar chiqarilgan, Toshkent kunlari, sahifalash', async () => {
    const { service, env } = setup();
    env.list = [order({ status: 'sold' })];
    env.listTotal = 31;
    const res: any = await service.listOrders(CARRIER, {
      status: 'sold, waiting_customer ,waiting',
      from: '2026-11-01',
      to: '2026-11-10',
      page: 2,
      limit: 25,
    });
    const qb = env.qbs[0];
    const sql = JSON.stringify(qb.calls);
    expect(qb.params.carrierCourierId).toBe(COURIER);
    expect(sql).toContain("COALESCE(TRIM(o.control_owner), '') = ''");
    expect(sql).toContain(
      'NOT (o.canceled_post_id IS NOT NULL AND o.status IN (:...carrierReturnedStatuses))',
    );
    expect(qb.params.carrierStatuses).toEqual(['sold', 'waiting']);
    // 2026-11-01 00:00 Toshkent = 2026-10-31 19:00 UTC
    expect(qb.params.carrierFrom).toBe(Date.UTC(2026, 9, 31, 19, 0, 0));
    expect(qb.params.carrierTo).toBe(Date.UTC(2026, 10, 10, 18, 59, 59, 999));
    expect(qb.skip).toHaveBeenCalledWith(25);
    expect(qb.take).toHaveBeenCalledWith(25);
    expect(res.message).toBe('orders');
    expect(res.data).toMatchObject({ total: 31, page: 2, limit: 25 });
    expect(res.data.items[0]).toMatchObject({
      id: ORDER_ID,
      status: 'sold',
      paid_online_amount: 0,
    });
  });
});

describe('CarrierService.cashbox', () => {
  afterEach(() => jest.spyOn(Date, 'now').mockRestore());

  it('sukut: oxirgi 30 Toshkent kuni; o‘z FOR_COURIER kassasi; xodim ustunlari so‘ralmaydi', async () => {
    // 2026-11-10 20:00 UTC = Toshkentda 2026-11-11 01:00
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 10, 20, 0, 0));
    const { service, env, cashRepo, historyRepo } = setup();
    env.cashbox = { id: 'cb-1', balance: 75000 };
    env.history = [
      {
        id: 'h-1',
        operation_type: 'income',
        source_type: 'sell',
        source_id: ORDER_ID,
        amount: 125000,
        balance_after: 125000,
        created_at: 1,
      },
      {
        id: 'h-2',
        operation_type: 'expense',
        source_type: 'courier_payment',
        source_id: null,
        amount: 50000,
        balance_after: 75000,
        payment_method: 'cash',
        created_at: 2,
      },
    ];
    const res: any = await service.cashbox(CARRIER, {});
    expect(cashRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: COURIER, cashbox_type: 'couriers' },
      }),
    );
    const findArgs = (historyRepo.find.mock.calls[0] as any[])[0];
    expect(findArgs.where.cashbox_id).toBe('cb-1');
    expect(findArgs.where.created_at.value).toEqual([
      Date.UTC(2026, 9, 12, 19, 0, 0), // 2026-10-13 00:00 Toshkent
      Date.UTC(2026, 10, 11, 18, 59, 59, 999),
    ]);
    expect(findArgs.select).not.toContain('created_by');
    expect(findArgs.relations).toBeUndefined();
    expect(res.message).toBe('cashbox');
    expect(res.data).toMatchObject({
      from: '2026-10-13',
      to: '2026-11-11',
      balance: 75000,
      income: 125000,
      outcome: 50000,
    });
    expect(res.data.history).toHaveLength(2);
  });

  it('oraliq > 92 kun, from > to, mavjud bo‘lmagan sana → 400', async () => {
    const { service } = setup();
    await expect(
      service.cashbox(CARRIER, { from: '2026-01-01', to: '2026-04-30' }),
    ).rejects.toThrow('92 kundan oshmasin');
    await expect(
      service.cashbox(CARRIER, { from: '2026-11-10', to: '2026-11-01' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.cashbox(CARRIER, { from: '2026-02-31', to: '2026-03-01' }),
    ).rejects.toThrow("Sana noto'g'ri");
    // Aynan 92 kun — ruxsat.
    await expect(
      service.cashbox(CARRIER, { from: '2026-01-01', to: '2026-04-02' }),
    ).resolves.toBeDefined();
  });

  it("kassa yo'q → nol balans, bo'sh tarix (tarix so'ralmaydi)", async () => {
    const { service, historyRepo } = setup();
    const res: any = await service.cashbox(CARRIER, {
      from: '2026-11-01',
      to: '2026-11-02',
    });
    expect(res.data).toEqual({
      from: '2026-11-01',
      to: '2026-11-02',
      balance: 0,
      income: 0,
      outcome: 0,
      history: [],
    });
    expect(historyRepo.find).not.toHaveBeenCalled();
  });
});
