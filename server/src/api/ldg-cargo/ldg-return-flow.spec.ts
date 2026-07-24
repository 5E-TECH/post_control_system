/// <reference types="jest" />
import { LdgWebhookService } from './ldg-webhook.service';
import { OrderService } from '../order/order.service';
import { Order_status } from 'src/common/enums';
import { In } from 'typeorm';

/**
 * LDG "bekor qilib qaytarish" (RETURNED) oqimining REGRESSIYA testlari.
 *
 * TALAB: LDG hech qachon buyurtmani CLOSED ("Yopilgan") qila olmaydi. CLOSED faqat
 * skaner oqimidan qo'yiladi. LDG eng ko'pi bilan CANCELLED_SENT ("Bekor
 * (yuborilgan)" — qaytish yo'lida) qo'ya oladi.
 */

const ORDER_ID = '00000000-0000-0000-0000-0000000000aa';

// ===========================================================================
// 1) LdgWebhookService.applyStatusFromCode — markaziy guardlar
// ===========================================================================
describe('LdgWebhookService — applyStatusFromCode guardlari', () => {
  function build(overrides: {
    courierUserId?: string | null;
    oldLdgStatus?: string | null;
    updateAffected?: number;
  }) {
    const shipment: any = {
      id: 'ship-1',
      order_id: ORDER_ID,
      ldg_status: overrides.oldLdgStatus ?? 'CREATED',
      ldg_status_changed_at: null,
      last_error: null,
    };

    const orderRepo: any = {
      update: jest
        .fn()
        .mockResolvedValue({ affected: overrides.updateAffected ?? 1 }),
    };
    const configRepo: any = {
      findOne: jest.fn().mockResolvedValue({
        ldg_courier_user_id:
          overrides.courierUserId === undefined
            ? 'courier-1'
            : overrides.courierUserId,
      }),
    };
    const shipmentService: any = {
      updateShipmentStatus: jest.fn().mockResolvedValue(shipment),
      saveShipment: jest.fn().mockResolvedValue(shipment),
    };
    const orderService: any = {
      markDeliveredByLdg: jest.fn().mockResolvedValue({ kind: 'applied' }),
      markCancelledByLdg: jest.fn().mockResolvedValue({ kind: 'applied' }),
      markReturnedByLdg: jest.fn().mockResolvedValue({ kind: 'applied' }),
    };
    const activityLog: any = { log: jest.fn() };
    const logRepo: any = {};
    const dataSource: any = {};

    const service = new LdgWebhookService(
      logRepo,
      configRepo,
      orderRepo,
      shipmentService,
      orderService,
      activityLog,
      dataSource,
    );

    return { service, shipment, orderRepo, shipmentService, orderService, activityLog };
  }

  it("ORALIQ status YAKUNLANGAN buyurtmani ORQAGA qaytara olmaydi (guard: WHERE status NOT IN final)", async () => {
    // Buyurtma allaqachon final (masalan skaner bilan CLOSED) → update 0 qatorga tegadi.
    const { service, orderRepo, activityLog } = build({
      oldLdgStatus: 'CREATED',
      updateAffected: 0,
    });

    const res = await service.applyStatusFromCode(
      buildShipment('CREATED'),
      'IN_TRANSIT',
      new Date(),
    );

    expect(res).toBe('applied');
    expect(orderRepo.update).toHaveBeenCalledTimes(1);
    const [whereArg, valueArg] = orderRepo.update.mock.calls[0];
    // Guard mavjud: WHERE ichida status sharti bor (Not(In(final))).
    expect(whereArg.status).toBeDefined();
    // Hech qachon CLOSED yozilmaydi.
    expect(valueArg.status).not.toBe(Order_status.CLOSED);
    expect(valueArg.status).toBe(Order_status.WAITING);
    // 0 qator o'zgargani uchun "status o'zgardi" logi YOZILMAYDI.
    expect(activityLog.log).not.toHaveBeenCalled();
  });

  it("applyOrderStatus CLOSED yozishga urinsa THROW qiladi (mudofaa)", async () => {
    const { service } = build({});
    await expect(
      (service as any).applyOrderStatus(ORDER_ID, Order_status.CLOSED),
    ).rejects.toThrow(/CLOSED/);
  });

  it("ldg_courier_user_id sozlanmagan bo'lsa terminal status XOM yozilmaydi (error qaytadi)", async () => {
    const { service, orderRepo, orderService, shipmentService } = build({
      courierUserId: null,
      oldLdgStatus: 'IN_TRANSIT',
    });

    const res = await service.applyStatusFromCode(
      buildShipment('IN_TRANSIT'),
      'DELIVERED', // terminal sell — pul aralashadi
      new Date(),
    );

    expect(res).toBe('error');
    // Sotuv oqimi CHAQIRILMAYDI (pulsiz SOLD bo'lmaydi).
    expect(orderService.markDeliveredByLdg).not.toHaveBeenCalled();
    // Xom status yozilmaydi.
    expect(orderRepo.update).not.toHaveBeenCalled();
    // shipment.ldg_status O'ZGARMAYDI (updateShipmentStatus chaqirilmaydi) →
    // faqat last_error yoziladi (saveShipment).
    expect(shipmentService.updateShipmentStatus).not.toHaveBeenCalled();
    expect(shipmentService.saveShipment).toHaveBeenCalled();
  });

  it("RETURNED → markReturnedByLdg ga yo'naltiriladi, webhook qatlamida CLOSED YOZILMAYDI", async () => {
    const { service, orderRepo, orderService, shipmentService } = build({
      oldLdgStatus: 'CANCELLED',
    });

    const res = await service.applyStatusFromCode(
      buildShipment('CANCELLED'),
      'RETURNED',
      new Date(),
    );

    expect(res).toBe('applied');
    expect(orderService.markReturnedByLdg).toHaveBeenCalledWith(
      ORDER_ID,
      'courier-1',
    );
    // Webhook qatlami order statusini XOM yozmaydi (mark*ByLdg boshqaradi).
    expect(orderRepo.update).not.toHaveBeenCalled();
    // LDG statusi shipmentda audit uchun yoziladi.
    expect(shipmentService.updateShipmentStatus).toHaveBeenCalledWith(
      expect.anything(),
      'RETURNED',
      expect.any(Date),
    );
  });

  function buildShipment(ldgStatus: string | null): any {
    return {
      id: 'ship-1',
      order_id: ORDER_ID,
      ldg_status: ldgStatus,
      ldg_status_changed_at: null,
      last_error: null,
    };
  }
});

// ===========================================================================
// 2) OrderService.markReturnedByLdg — CANCELLED_SENT, hech qachon CLOSED
// ===========================================================================
describe('OrderService.markReturnedByLdg', () => {
  function buildSvc(order: any, updateAffected = 1) {
    const svc: any = Object.create(OrderService.prototype);
    svc.logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
    svc.orderRepo = {
      findOne: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue({ affected: updateAffected }),
    };
    svc.activityLog = { log: jest.fn() };
    svc.cancelOrder = jest.fn().mockResolvedValue(undefined);
    return svc;
  }

  const baseOrder = { id: ORDER_ID, order_number: 100042 };

  it("CANCELLED → CANCELLED_SENT (cancelOrder qayta chaqirilmaydi, CLOSED YOZILMAYDI)", async () => {
    const svc = buildSvc({ ...baseOrder, status: Order_status.CANCELLED });

    const res = await svc.markReturnedByLdg(ORDER_ID, 'courier-1');

    expect(res.kind).toBe('applied');
    expect(svc.cancelOrder).not.toHaveBeenCalled();
    expect(svc.orderRepo.update).toHaveBeenCalledTimes(1);
    const [whereArg, valueArg] = svc.orderRepo.update.mock.calls[0];
    // Atomik + guard: faqat CANCELLED bo'lsa o'tkazadi.
    expect(whereArg.id).toBe(ORDER_ID);
    expect(whereArg.status).toEqual(In([Order_status.CANCELLED]));
    expect(valueArg.status).toBe(Order_status.CANCELLED_SENT);
    expect(valueArg.status).not.toBe(Order_status.CLOSED);
    // Audit izi: action 'ldg_returned'.
    expect(svc.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ldg_returned',
        new_value: expect.objectContaining({
          status: Order_status.CANCELLED_SENT,
        }),
      }),
    );
  });

  it("faol (WAITING) → avval cancelOrder, keyin CANCELLED_SENT", async () => {
    const svc = buildSvc({ ...baseOrder, status: Order_status.WAITING });

    const res = await svc.markReturnedByLdg(ORDER_ID, 'courier-1');

    expect(res.kind).toBe('applied');
    expect(svc.cancelOrder).toHaveBeenCalledTimes(1);
    const [, valueArg] = svc.orderRepo.update.mock.calls[0];
    expect(valueArg.status).toBe(Order_status.CANCELLED_SENT);
  });

  it("allaqachon CLOSED → skip (LDG teskari qaytara olmaydi)", async () => {
    const svc = buildSvc({ ...baseOrder, status: Order_status.CLOSED });
    const res = await svc.markReturnedByLdg(ORDER_ID, 'courier-1');
    expect(res.kind).toBe('skipped');
    expect(svc.orderRepo.update).not.toHaveBeenCalled();
  });

  it("allaqachon CANCELLED_SENT → skip (idempotent)", async () => {
    const svc = buildSvc({ ...baseOrder, status: Order_status.CANCELLED_SENT });
    const res = await svc.markReturnedByLdg(ORDER_ID, 'courier-1');
    expect(res.kind).toBe('skipped');
    expect(svc.orderRepo.update).not.toHaveBeenCalled();
  });

  it("SOLD → mismatch (pul to'langan, qo'lda tekshiriladi)", async () => {
    const svc = buildSvc({ ...baseOrder, status: Order_status.SOLD });
    const res = await svc.markReturnedByLdg(ORDER_ID, 'courier-1');
    expect(res.kind).toBe('mismatch');
    expect(svc.orderRepo.update).not.toHaveBeenCalled();
  });

  it("poyga: cancelOrder o'tdi-yu, update 0 qator → skip (CLOSED yozilmaydi)", async () => {
    const svc = buildSvc({ ...baseOrder, status: Order_status.CANCELLED }, 0);
    const res = await svc.markReturnedByLdg(ORDER_ID, 'courier-1');
    expect(res.kind).toBe('skipped');
    // Log yozilmaydi (0 qator).
    expect(svc.activityLog.log).not.toHaveBeenCalled();
  });
});
