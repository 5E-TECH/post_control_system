/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { ElchiWebhookService } from './elchi-webhook.service';

/**
 * UUID DARVOZASI — non-UUID `external_order_id` HTTP 500 BERMASLIGI kerak
 * (E2E integratsiya P0).
 *
 * `order_id` ustuni `uuid`. Elchi yorliq/smoke id kabi ixtiyoriy satr
 * yuborsa, order_id bo'yicha findOne Postgres 22P02 -> 500 berardi; Elchi
 * outboxi 4 urinishdan keyin hodisani ABADIY tashlardi. Endi UUID bo'lmasa
 * order_id qidiruvi O'TKAZIB yuboriladi -> elchi_shipment_id -> skipped (200).
 */
function buildSvc(findOneImpl: jest.Mock) {
  const svc: any = Object.create(ElchiWebhookService.prototype);
  svc.shipmentRepo = { findOne: findOneImpl };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return svc;
}

const CFG: any = { is_enabled: true, elchi_courier_user_id: 'c-1' };

describe('ElchiWebhookService.applyStatusUpdate — UUID darvozasi', () => {
  it('non-UUID external_order_id -> order_id qidiruvi QILINMAYDI, skipped (500 EMAS)', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const svc = buildSvc(findOne);

    const res = await svc.applyStatusUpdate(CFG, {
      event: 'shipment.status_changed',
      external_order_id: 'labeltest-XYZ-123',
      status: 'cancelled',
      shipment_id: '1251130',
    });

    expect(res.status).toBe('skipped'); // throw EMAS
    // order_id (non-UUID) bo'yicha HECH QACHON qidirilmadi:
    const orderIdCalls = findOne.mock.calls.filter(
      (c) => c[0]?.where?.order_id !== undefined,
    );
    expect(orderIdCalls.length).toBe(0);
    // faqat elchi_shipment_id bo'yicha qidirildi:
    expect(findOne).toHaveBeenCalledWith({
      where: { elchi_shipment_id: '1251130' },
    });
  });

  it('to`g`ri UUID -> order_id qidiruvi QILINADI', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const svc = buildSvc(findOne);

    await svc.applyStatusUpdate(CFG, {
      event: 'shipment.status_changed',
      external_order_id: 'f6788cbb-4543-48d0-b56a-a5bd540e18c3',
      status: 'cancelled',
      shipment_id: '999',
    });

    const orderIdCalls = findOne.mock.calls.filter(
      (c) => c[0]?.where?.order_id !== undefined,
    );
    expect(orderIdCalls.length).toBe(1);
  });
});
