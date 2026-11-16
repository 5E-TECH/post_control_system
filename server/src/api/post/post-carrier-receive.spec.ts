/// <reference types="jest" />
import { HttpException } from '@nestjs/common';
import { In } from 'typeorm';
import { PostService } from './post.service';
import { PostEntity } from 'src/core/entity/post.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { CourierRegionEntity } from 'src/core/entity/courier-region.entity';
import {
  Order_status,
  Post_status,
  Roles,
  Status,
  Where_deliver,
} from 'src/common/enums';
import { MarketplaceEventType } from '../marketplace/marketplace.enums';
import { CARRIER_EXTERNAL_PROVIDER } from '../carrier/carrier-account.service';
import { carrierActor } from '../carrier/carrier-error-codes';

/**
 * PostService — Carrier API uchun o'zgarishlar:
 *   1. `receiveOrderForCourierById` — token varianti bilan AYNAN bir xil
 *      qoidalar, faqat id bo'yicha (token NOYOB EMAS).
 *   2. Token varianti xulqi va qaytaradigan qiymati O'ZGARMAGAN.
 *   3. `reassignCourier` — faqat carrier ishtirok etganda: holat qulfi va
 *      `courier_tariff` qayta muzlatish; oddiy kuryerlar uchun xulq o'zgarmagan.
 *   4. `sendPost` dagi super kuryer tarif muzlatishi refaktordan keyin ham bir xil.
 */

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const COURIER = carrierActor(id(50));
const POST_ID = id(80);
const REGION_ID = id(90);

async function httpStatusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return (e as HttpException).getStatus();
  }
  throw new Error('HttpException kutilgan edi');
}

function createQueryRunnerMock() {
  const manager: any = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    save: jest.fn(async (entity: any) => entity),
    create: jest.fn((_e: unknown, data: any) => ({ ...data })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };
  return { qr, manager };
}

function setup() {
  const { qr, manager } = createQueryRunnerMock();
  const dataSource: any = { createQueryRunner: jest.fn(() => qr) };
  const orderRepo: any = { find: jest.fn().mockResolvedValue([]) };
  const activityLog: any = { log: jest.fn() };
  const marketplaceSync: any = { recordStatusEvent: jest.fn() };
  const elchi: any = {
    createShipmentForOrder: jest.fn(),
    assertDistrictsAllowedForPost: jest.fn(),
  };
  const ldg: any = { createShipmentForOrder: jest.fn() };
  const service = new PostService(
    {} as any, // postRepo
    orderRepo,
    {} as any, // userRepo
    {} as any, // courierRegionRepo
    {} as any, // regionRepo
    dataSource,
    activityLog,
    ldg,
    elchi,
    { sendMessageToGroup: jest.fn() } as any,
    marketplaceSync,
  );
  return { service, qr, manager, activityLog, marketplaceSync, orderRepo };
}

/** Bittalab qabul — `findOne` ketma-ketligi: havola → post (lock) → buyurtma. */
function mockReceiveFlow(
  manager: any,
  opts: {
    ref?: any;
    post?: any;
    order?: any;
    remaining?: number;
  } = {},
) {
  manager.findOne
    .mockResolvedValueOnce(
      opts.ref === undefined ? { id: id(1), post_id: POST_ID } : opts.ref,
    )
    .mockResolvedValueOnce(
      opts.post === undefined
        ? {
            id: POST_ID,
            courier_id: COURIER.id,
            status: Post_status.SENT,
            qr_code_token: 'post-token',
          }
        : opts.post,
    )
    .mockResolvedValueOnce(
      opts.order === undefined
        ? {
            id: id(1),
            status: Order_status.ON_THE_ROAD,
            customer: { name: 'Mijoz' },
          }
        : opts.order,
    );
  manager.count.mockResolvedValueOnce(opts.remaining ?? 0);
}

describe('PostService.receiveOrderForCourierById', () => {
  it('⭐ id bo‘yicha topadi, post shu kuryerniki (lock), ON_THE_ROAD → WAITING, oxirgisida post RECEIVED', async () => {
    const { service, manager, qr, marketplaceSync } = setup();
    mockReceiveFlow(manager, { remaining: 0 });

    const res: any = await service.receiveOrderForCourierById(id(1), COURIER);

    expect(manager.findOne).toHaveBeenNthCalledWith(1, OrderEntity, {
      where: { id: id(1) },
      select: ['id', 'post_id'],
    });
    expect(manager.findOne).toHaveBeenNthCalledWith(2, PostEntity, {
      where: { id: POST_ID, courier_id: COURIER.id },
      lock: { mode: 'pessimistic_write' },
    });
    expect(marketplaceSync.recordStatusEvent).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        event_type: MarketplaceEventType.PARCEL_OUT_FOR_DELIVERY,
        status: { from: Order_status.ON_THE_ROAD, to: 'OUT_FOR_DELIVERY' },
      }),
    );
    expect(
      manager.save.mock.calls.some(
        (c: any[]) =>
          c[0]?.id === id(1) && c[0]?.status === Order_status.WAITING,
      ),
    ).toBe(true);
    expect(
      manager.save.mock.calls.some(
        (c: any[]) => c[0]?.status === Post_status.RECEIVED,
      ),
    ).toBe(true);
    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(res).toEqual({
      statusCode: 200,
      message: 'Oxirgi buyurtma qabul qilindi — pochta RECEIVED',
      data: {
        order_id: id(1),
        customer_name: 'Mijoz',
        remaining: 0,
        postReceived: true,
      },
    });
  });

  it('qoldiq bor — post SENT da qoladi', async () => {
    const { service, manager } = setup();
    mockReceiveFlow(manager, { remaining: 2 });
    const res: any = await service.receiveOrderForCourierById(id(1), COURIER);
    expect(res.data).toEqual(
      expect.objectContaining({ remaining: 2, postReceived: false }),
    );
    expect(
      manager.save.mock.calls.some(
        (c: any[]) => c[0]?.status === Post_status.RECEIVED,
      ),
    ).toBe(false);
  });

  it("audit: id varianti ekani ko'rinadi (token yo'q)", async () => {
    const { service, manager, activityLog } = setup();
    mockReceiveFlow(manager);
    await service.receiveOrderForCourierById(id(1), COURIER);
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'order',
        entity_id: id(1),
        action: 'status_change',
        user: COURIER,
        metadata: {
          source: 'scanner',
          scan_target: 'order',
          lookup: 'order_id',
        },
      }),
    );
  });

  it.each([
    ['buyurtma topilmadi', 404, { ref: null }],
    ['pochtaga biriktirilmagan', 400, { ref: { id: id(1), post_id: null } }],
    ['post boshqa kuryerniki', 404, { post: null }],
    [
      'post SENT emas',
      400,
      {
        post: {
          id: POST_ID,
          courier_id: COURIER.id,
          status: Post_status.RECEIVED,
        },
      },
    ],
    [
      'takroriy skan (buyurtma allaqachon WAITING)',
      400,
      { order: { id: id(1), status: Order_status.WAITING } },
    ],
  ])('%s — %d', async (_t, expected, opts) => {
    const { service, manager, qr } = setup();
    mockReceiveFlow(manager, opts as any);
    expect(
      await httpStatusOf(service.receiveOrderForCourierById(id(1), COURIER)),
    ).toBe(expected);
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });
});

describe('PostService.receiveOrderByQrTokenForCourier — xulq O‘ZGARMAGAN', () => {
  it('token normallashtiriladi va havola token bo‘yicha qidiriladi', async () => {
    const { service, manager } = setup();
    mockReceiveFlow(manager);
    await service.receiveOrderByQrTokenForCourier('ABCDEF0123', COURIER);
    expect(manager.findOne).toHaveBeenNthCalledWith(1, OrderEntity, {
      where: { qr_code_token: 'abcdef0123' },
      select: ['id', 'post_id'],
    });
  });

  it('404 matni va audit metadata (token bilan) avvalgidek', async () => {
    const { service, manager, activityLog } = setup();
    manager.findOne.mockResolvedValueOnce(null);
    await expect(
      service.receiveOrderByQrTokenForCourier('yoq', COURIER),
    ).rejects.toThrow('QR koddagi buyurtma topilmadi');

    mockReceiveFlow(manager);
    await service.receiveOrderByQrTokenForCourier('the-token', COURIER);
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Kuryer QR skaner orqali bittalab qabul qildi',
        metadata: {
          source: 'scanner',
          scan_target: 'order',
          token: 'the-token',
        },
      }),
    );
  });

  it('⭐ token va id variantlari AYNI natija qaytaradi', async () => {
    const a = setup();
    mockReceiveFlow(a.manager, { remaining: 3 });
    const byToken = await a.service.receiveOrderByQrTokenForCourier(
      'tok',
      COURIER,
    );
    const b = setup();
    mockReceiveFlow(b.manager, { remaining: 3 });
    const byId = await b.service.receiveOrderForCourierById(id(1), COURIER);
    expect(byId).toEqual(byToken);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// reassignCourier
// ═══════════════════════════════════════════════════════════════════════

const user = (over: Record<string, unknown> = {}): any => ({
  id: id(60),
  name: 'Kuryer',
  role: Roles.COURIER,
  status: Status.ACTIVE,
  external_provider: null,
  is_super_courier: false,
  tariff_home: 30_000,
  tariff_center: 20_000,
  ...over,
});

const OLD = (over: Record<string, unknown> = {}) =>
  user({ id: id(61), name: 'Eski kuryer', ...over });
const NEW = (over: Record<string, unknown> = {}) =>
  user({ id: id(62), name: 'Yangi kuryer', ...over });

const order = (n: number, over: Record<string, unknown> = {}): any => ({
  id: id(n),
  order_number: 100000 + n,
  status: Order_status.WAITING,
  where_deliver: Where_deliver.ADDRESS,
  courier_tariff: null,
  ...over,
});

function mockReassign(
  manager: any,
  opts: {
    oldCourier: any;
    newCourier: any;
    orders?: any[];
    courierRegion?: any;
    /** Qulf ostidagi qayta o'qish (`FOR UPDATE`) natijasi — poyga uchun. */
    lockedPost?: any;
  },
) {
  manager.findOne.mockImplementation(async (entity: unknown, o: any) => {
    if (entity === PostEntity) {
      if (o?.lock && opts.lockedPost !== undefined) return opts.lockedPost;
      return {
        id: POST_ID,
        status: Post_status.SENT,
        region_id: REGION_ID,
        courier_id: opts.oldCourier.id,
        courier: opts.oldCourier,
      };
    }
    if (entity === UserEntity) return opts.newCourier;
    if (entity === CourierRegionEntity) return opts.courierRegion ?? null;
    return null;
  });
  manager.find.mockResolvedValue(opts.orders ?? []);
}

/** `manager.update` dan faqat buyurtma tarif yozuvlari. */
const tariffUpdates = (manager: any) =>
  manager.update.mock.calls.filter((c: any[]) => c[0] === OrderEntity);

describe('PostService.reassignCourier — carrier qoidasi', () => {
  it('⭐ oddiy → oddiy kuryer: xulq O‘ZGARMAGAN (qulf yo‘q, tarif tegilmaydi, SOLD bo‘lsa ham o‘tadi)', async () => {
    const { service, manager, qr, activityLog } = setup();
    mockReassign(manager, {
      oldCourier: OLD({ is_super_courier: true }),
      newCourier: NEW({ is_super_courier: true }),
      orders: [order(1, { status: Order_status.SOLD })],
    });

    const res: any = await service.reassignCourier(POST_ID, id(62), {
      id: id(1),
    } as any);

    expect(res.statusCode).toBe(200);
    expect(manager.find).not.toHaveBeenCalled();
    expect(tariffUpdates(manager)).toHaveLength(0);
    expect(manager.update).toHaveBeenCalledWith(
      PostEntity,
      { id: POST_ID },
      {
        courier_id: id(62),
        // Shtraf soati yangi kuryer uchun qayta boshlanadi (2026-10-15,
        // `4c5d2d17`). Carrier qoidasiga aloqasi yo'q — oddiy qayta
        // biriktirishning bir qismi.
        courier_assigned_at: expect.any(Number),
      },
    );
    expect(qr.commitTransaction).toHaveBeenCalled();
    // Log ham avvalgidek — carrier metadata'siz.
    const postLog = activityLog.log.mock.calls.find(
      (c: any[]) => c[0].action === 'reassigned',
    )[0];
    expect(postLog).not.toHaveProperty('metadata');
  });

  it("⭐ carrier'ga: buyurtmalar qulflanadi va tarif carrier hududi bo'yicha qayta muzlatiladi", async () => {
    const { service, manager, qr, activityLog } = setup();
    mockReassign(manager, {
      oldCourier: OLD({ is_super_courier: true }),
      newCourier: NEW({
        external_provider: CARRIER_EXTERNAL_PROVIDER,
        is_super_courier: true,
      }),
      courierRegion: { tariff_home: 45_000, tariff_center: 35_000 },
      orders: [
        order(1, { courier_tariff: 25_000 }),
        order(2, {
          where_deliver: Where_deliver.CENTER,
          status: Order_status.ON_THE_ROAD,
          courier_tariff: 15_000,
        }),
        order(3),
      ],
    });

    const res: any = await service.reassignCourier(POST_ID, id(62), {
      id: id(1),
    } as any);
    expect(res.statusCode).toBe(200);

    expect(manager.find).toHaveBeenCalledWith(OrderEntity, {
      where: { post_id: POST_ID },
      select: [
        'id',
        'order_number',
        'status',
        'where_deliver',
        'courier_tariff',
      ],
      lock: { mode: 'pessimistic_write' },
    });
    // sendPost bilan bir xil manba: courier_regions(new courier, post hududi).
    expect(manager.findOne).toHaveBeenCalledWith(CourierRegionEntity, {
      where: { courier_id: id(62), region_id: REGION_ID },
    });
    const updates = tariffUpdates(manager);
    expect(updates).toHaveLength(2);
    expect(updates).toEqual(
      expect.arrayContaining([
        [
          OrderEntity,
          { id: In([id(1), id(3)]) },
          expect.objectContaining({ courier_tariff: 45_000 }),
        ],
        [
          OrderEntity,
          { id: In([id(2)]) },
          expect.objectContaining({ courier_tariff: 35_000 }),
        ],
      ]),
    );
    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reassigned',
        metadata: { carrier_reassign: true, courier_tariff_refrozen: 3 },
      }),
    );
  });

  it("carrier hudud tarifi yo'q — kuryerning flat tarifiga fallback (sendPost bilan bir xil)", async () => {
    const { service, manager } = setup();
    mockReassign(manager, {
      oldCourier: OLD(),
      newCourier: NEW({
        external_provider: CARRIER_EXTERNAL_PROVIDER,
        is_super_courier: true,
        tariff_home: 41_000,
        tariff_center: 31_000,
      }),
      courierRegion: null,
      orders: [order(1), order(2, { where_deliver: Where_deliver.CENTER })],
    });
    await service.reassignCourier(POST_ID, id(62), { id: id(1) } as any);
    expect(tariffUpdates(manager)).toEqual(
      expect.arrayContaining([
        [
          OrderEntity,
          { id: In([id(1)]) },
          expect.objectContaining({ courier_tariff: 41_000 }),
        ],
        [
          OrderEntity,
          { id: In([id(2)]) },
          expect.objectContaining({ courier_tariff: 31_000 }),
        ],
      ]),
    );
  });

  it.each([
    ['sotilgan', Order_status.SOLD],
    ['bekor qilingan', Order_status.CANCELLED],
    ["to'langan", Order_status.PAID],
    ['qaytarishga yuborilgan', Order_status.CANCELLED_SENT],
  ])(
    "⭐ carrier'ga: %s buyurtmali pochta — 400, hech narsa yozilmaydi",
    async (_t, status) => {
      const { service, manager, qr } = setup();
      mockReassign(manager, {
        oldCourier: OLD(),
        newCourier: NEW({
          external_provider: CARRIER_EXTERNAL_PROVIDER,
          is_super_courier: true,
        }),
        orders: [order(1), order(2, { status })],
      });
      expect(
        await httpStatusOf(
          service.reassignCourier(POST_ID, id(62), { id: id(1) } as any),
        ),
      ).toBe(400);
      expect(manager.update).not.toHaveBeenCalled();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    },
  );

  it("⭐ carrier'DAN oddiy kuryerga: sotilgan buyurtma bor — 400 (qaytarish puli boshqa kassaga tushardi)", async () => {
    const { service, manager } = setup();
    mockReassign(manager, {
      oldCourier: OLD({ external_provider: CARRIER_EXTERNAL_PROVIDER }),
      newCourier: NEW(),
      orders: [order(1, { status: Order_status.SOLD })],
    });
    expect(
      await httpStatusOf(
        service.reassignCourier(POST_ID, id(62), { id: id(1) } as any),
      ),
    ).toBe(400);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it("carrier'DAN oddiy kuryerga: hammasi kutilmoqda — o'tadi, tarif tegilmaydi", async () => {
    const { service, manager, qr } = setup();
    mockReassign(manager, {
      oldCourier: OLD({ external_provider: CARRIER_EXTERNAL_PROVIDER }),
      newCourier: NEW({ is_super_courier: true }),
      orders: [order(1), order(2, { status: Order_status.ON_THE_ROAD })],
    });
    const res: any = await service.reassignCourier(POST_ID, id(62), {
      id: id(1),
    } as any);
    expect(res.statusCode).toBe(200);
    expect(manager.find).toHaveBeenCalled(); // qulf
    expect(tariffUpdates(manager)).toHaveLength(0);
    expect(qr.commitTransaction).toHaveBeenCalled();
  });

  it("⭐ super EMAS carrier'ga, eski super kuryer tarifi muzlatilgan — 400 (begona stavka to'lanmasin)", async () => {
    const { service, manager } = setup();
    mockReassign(manager, {
      oldCourier: OLD({ is_super_courier: true }),
      newCourier: NEW({ external_provider: CARRIER_EXTERNAL_PROVIDER }),
      orders: [order(1, { courier_tariff: 25_000 })],
    });
    expect(
      await httpStatusOf(
        service.reassignCourier(POST_ID, id(62), { id: id(1) } as any),
      ),
    ).toBe(400);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it("super EMAS carrier'ga oddiy kuryerdan — o'tadi, tarif tegilmaydi (sendPost ham muzlatmaydi)", async () => {
    const { service, manager } = setup();
    mockReassign(manager, {
      oldCourier: OLD(),
      newCourier: NEW({ external_provider: CARRIER_EXTERNAL_PROVIDER }),
      orders: [
        // Muzlatish yo'q — sotuv carrier'ning o'z tarifini oladi.
        order(1),
        // Marketplace ko'p qutili buyurtmaning to'lovsiz qutisi.
        order(2, { courier_tariff: 0 }),
        // Carrier'ning o'z stavkasiga teng (ADDRESS → 30 000).
        order(3, { courier_tariff: 30_000 }),
        order(4, {
          where_deliver: Where_deliver.CENTER,
          courier_tariff: '20000',
        }),
      ],
    });
    const res: any = await service.reassignCourier(POST_ID, id(62), {
      id: id(1),
    } as any);
    expect(res.statusCode).toBe(200);
    expect(tariffUpdates(manager)).toHaveLength(0);
  });

  it("⭐ super EMAS carrier'ga: sotilib ROLLBACK qilingan buyurtma oddiy kuryer tarifini saqlagan — 400 (eski kuryer super bo'lmasa ham)", async () => {
    // rollbackOrderToWaiting `courier_tariff` ni tozalamaydi: A ning 20 000 i qoladi.
    const { service, manager, qr } = setup();
    mockReassign(manager, {
      oldCourier: OLD(),
      newCourier: NEW({
        external_provider: CARRIER_EXTERNAL_PROVIDER,
        tariff_home: 35_000,
      }),
      orders: [order(1), order(2, { courier_tariff: 20_000 })],
    });
    const error = await service
      .reassignCourier(POST_ID, id(62), { id: id(1) } as any)
      .then(
        () => null,
        (e: unknown) => e as HttpException,
      );
    expect(error?.getStatus()).toBe(400);
    expect(error?.message).toContain('#100002');
    expect(manager.update).not.toHaveBeenCalled();
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });

  it('⭐ S → A → C aylanma yo‘l: eski kuryer (A) super emas, lekin buyurtmada S ning hudud tarifi — 400', async () => {
    const { service, manager } = setup();
    mockReassign(manager, {
      oldCourier: OLD({ is_super_courier: false }),
      newCourier: NEW({ external_provider: CARRIER_EXTERNAL_PROVIDER }),
      orders: [order(1, { courier_tariff: 12_000 })],
    });
    expect(
      await httpStatusOf(
        service.reassignCourier(POST_ID, id(62), { id: id(1) } as any),
      ),
    ).toBe(400);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it("super carrier'ning shu yetkazish turi uchun tarifi yo'q — begona muzlatilgan qiymat qolmaydi (400); bo'sh qiymat — o'tadi", async () => {
    const carrier = NEW({
      external_provider: CARRIER_EXTERNAL_PROVIDER,
      is_super_courier: true,
      tariff_home: 40_000,
      tariff_center: null,
    });
    const blocked = setup();
    mockReassign(blocked.manager, {
      oldCourier: OLD(),
      newCourier: carrier,
      courierRegion: null,
      orders: [
        order(1),
        order(2, {
          where_deliver: Where_deliver.CENTER,
          courier_tariff: 15_000,
        }),
      ],
    });
    expect(
      await httpStatusOf(
        blocked.service.reassignCourier(POST_ID, id(62), { id: id(1) } as any),
      ),
    ).toBe(400);
    expect(blocked.manager.update).not.toHaveBeenCalled();

    const ok = setup();
    mockReassign(ok.manager, {
      oldCourier: OLD(),
      newCourier: carrier,
      courierRegion: null,
      orders: [order(1), order(2, { where_deliver: Where_deliver.CENTER })],
    });
    const res: any = await ok.service.reassignCourier(POST_ID, id(62), {
      id: id(1),
    } as any);
    expect(res.statusCode).toBe(200);
    expect(tariffUpdates(ok.manager)).toEqual([
      [
        OrderEntity,
        { id: In([id(1)]) },
        expect.objectContaining({ courier_tariff: 40_000 }),
      ],
    ]);
  });

  it('⭐ qulf tartibi: avval POCHTA (FOR UPDATE), keyin buyurtmalar — qabul yo‘llari bilan bir xil (deadlock yo‘q)', async () => {
    const { service, manager } = setup();
    mockReassign(manager, {
      oldCourier: OLD(),
      newCourier: NEW({
        external_provider: CARRIER_EXTERNAL_PROVIDER,
        is_super_courier: true,
      }),
      courierRegion: { tariff_home: 45_000, tariff_center: 35_000 },
      orders: [order(1)],
    });
    await service.reassignCourier(POST_ID, id(62), { id: id(1) } as any);

    const postLockIdx = manager.findOne.mock.calls.findIndex(
      (c: any[]) => c[0] === PostEntity && c[1]?.lock,
    );
    expect(postLockIdx).toBeGreaterThanOrEqual(0);
    expect(manager.findOne.mock.calls[postLockIdx][1]).toEqual({
      where: { id: POST_ID },
      select: ['id', 'status', 'courier_id'],
      lock: { mode: 'pessimistic_write' },
    });
    const postLockOrder = manager.findOne.mock.invocationCallOrder[postLockIdx];
    const ordersLockOrder = manager.find.mock.invocationCallOrder[0];
    const postUpdateOrder =
      manager.update.mock.invocationCallOrder[
        manager.update.mock.calls.findIndex((c: any[]) => c[0] === PostEntity)
      ];
    expect(postLockOrder).toBeLessThan(ordersLockOrder);
    expect(ordersLockOrder).toBeLessThan(postUpdateOrder);
  });

  it('qulf ostida pochta endi SENT emas — 400; kuryeri o‘zgargan — 409; buyurtmalar qulflanmaydi', async () => {
    for (const [lockedPost, status] of [
      [{ id: POST_ID, status: Post_status.RECEIVED, courier_id: id(61) }, 400],
      [{ id: POST_ID, status: Post_status.SENT, courier_id: id(63) }, 409],
      [null, 400],
    ] as const) {
      const { service, manager, qr } = setup();
      mockReassign(manager, {
        oldCourier: OLD(),
        newCourier: NEW({ external_provider: CARRIER_EXTERNAL_PROVIDER }),
        orders: [order(1)],
        lockedPost,
      });
      expect(
        await httpStatusOf(
          service.reassignCourier(POST_ID, id(62), { id: id(1) } as any),
        ),
      ).toBe(status);
      expect(manager.find).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// sendPost — refaktordan keyin super kuryer muzlatishi bir xil
// ═══════════════════════════════════════════════════════════════════════

function mockSendPost(manager: any, courier: any, orders: any[]) {
  manager.findOne.mockImplementation(async (entity: unknown, opts: any) => {
    if (entity === PostEntity && opts?.lock) {
      return { id: POST_ID, status: Post_status.NEW, region_id: REGION_ID };
    }
    if (entity === PostEntity) return { id: id(81), courier };
    if (entity === UserEntity) return courier;
    if (entity === CourierRegionEntity) {
      return { tariff_home: 47_000, tariff_center: null };
    }
    return null;
  });
  manager.find.mockImplementation(async (_entity: unknown, opts: any) =>
    opts?.relations ? orders : [],
  );
  manager.save.mockImplementation(async (entity: any) => ({
    id: entity.id ?? id(81),
    ...entity,
  }));
}

describe('PostService.sendPost — super kuryer tarif muzlatishi (refaktor qulfi)', () => {
  it('super kuryer: hudud tarifi, yo‘q bo‘lsa flat tarif muzlatiladi', async () => {
    const { service, manager } = setup();
    const courier = user({
      id: id(70),
      is_super_courier: true,
      tariff_center: 21_000,
    });
    const orders = [
      order(1, { status: Order_status.RECEIVED, post_id: POST_ID }),
      order(2, {
        status: Order_status.RECEIVED,
        post_id: POST_ID,
        where_deliver: Where_deliver.CENTER,
      }),
    ];
    mockSendPost(manager, courier, orders);

    const res: any = await service.sendPost(POST_ID, {
      orderIds: [id(1), id(2)],
      courierId: id(70),
    } as any);
    expect(res.statusCode).toBe(200);
    expect(manager.findOne).toHaveBeenCalledWith(CourierRegionEntity, {
      where: { courier_id: id(70), region_id: REGION_ID },
    });
    expect(orders[0].courier_tariff).toBe(47_000); // hudud (uy)
    expect(orders[1].courier_tariff).toBe(21_000); // hudud yo'q → flat (markaz)
    expect(orders.every((o) => o.status === Order_status.ON_THE_ROAD)).toBe(
      true,
    );
  });

  it("oddiy kuryer: courier_tariff tegilmaydi, courier_regions so'ralmaydi", async () => {
    const { service, manager } = setup();
    const courier = user({ id: id(71) });
    const orders = [
      order(1, {
        status: Order_status.RECEIVED,
        post_id: POST_ID,
        courier_tariff: 9_000,
      }),
    ];
    mockSendPost(manager, courier, orders);
    await service.sendPost(POST_ID, {
      orderIds: [id(1)],
      courierId: id(71),
    } as any);
    expect(orders[0].courier_tariff).toBe(9_000);
    expect(
      manager.findOne.mock.calls.some(
        (c: any[]) => c[0] === CourierRegionEntity,
      ),
    ).toBe(false);
  });
});
