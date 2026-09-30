/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { ElchiWebhookService } from './elchi-webhook.service';

/**
 * ROLLBACK PUL SNAPSHOTI TOZALANISHI (E2E integratsiya P1).
 *
 * Elchi sotuvni qaytarganda `sale_collectible_amount`ni null qiladi va
 * `GET`da `collected_from_customer: null` keladi. Ilgari applyStatusUpdate
 * `!= null` guard bilan bu holatni e'tiborsiz qoldirardi -> eski qiymat
 * saqlanib, panel qaytarilgan posilkani "Elchi yig'gan" deb sanardi (soxta
 * qarz). Endi `=== null` ustunni TOZALAYDI.
 */
function buildSvc(shipment: any) {
  const saved: any[] = [];
  const svc: any = Object.create(ElchiWebhookService.prototype);
  svc.shipmentRepo = {
    findOne: jest.fn().mockResolvedValue(shipment),
    save: jest.fn((s: any) => {
      saved.push({ ...s });
      return Promise.resolve(s);
    }),
  };
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  svc.orderService = {
    markRolledBackByElchi: jest.fn().mockResolvedValue({ kind: 'skipped' }),
    markDeliveredByElchi: jest.fn().mockResolvedValue({ kind: 'skipped' }),
    markCancelledByElchi: jest.fn().mockResolvedValue({ kind: 'skipped' }),
    markReturnedByElchi: jest.fn().mockResolvedValue({ kind: 'skipped' }),
  };
  return { svc, saved };
}

const CFG: any = { is_enabled: true, elchi_courier_user_id: 'c-1' };
const UUID = 'f6788cbb-4543-48d0-b56a-a5bd540e18c3';

function shipment() {
  return {
    id: 's-1',
    order_id: UUID,
    elchi_shipment_id: '40',
    elchi_status: 'sold',
    collected_from_customer_reported: '25000.00',
    elchi_fee_reported: '15000.00',
  };
}

describe('applyStatusUpdate — rollback pul snapshoti', () => {
  it('collected_from_customer=null (rollback) -> ustun NULL ga tozalanadi', async () => {
    const { svc, saved } = buildSvc(shipment());
    await svc.applyStatusUpdate(CFG, {
      event: 'shipment.status_changed',
      external_order_id: UUID,
      shipment_id: '40',
      status: 'waiting', // rollback
      collected_from_customer: null,
      elchi_fee: null,
    });
    const last = saved[saved.length - 1];
    expect(last.collected_from_customer_reported).toBeNull();
    expect(last.elchi_fee_reported).toBeNull();
  });

  it('maydon YUBORILMADI (undefined) -> eski qiymat SAQLANADI', async () => {
    const { svc, saved } = buildSvc(shipment());
    await svc.applyStatusUpdate(CFG, {
      event: 'shipment.status_changed',
      external_order_id: UUID,
      shipment_id: '40',
      status: 'waiting',
      // collected_from_customer / elchi_fee berilmagan
    });
    const last = saved[saved.length - 1];
    expect(last.collected_from_customer_reported).toBe('25000.00');
    expect(last.elchi_fee_reported).toBe('15000.00');
  });

  it('collected_from_customer=0 -> 0 yoziladi (haqiqiy qiymat, null emas)', async () => {
    const { svc, saved } = buildSvc(shipment());
    await svc.applyStatusUpdate(CFG, {
      event: 'shipment.status_changed',
      external_order_id: UUID,
      shipment_id: '40',
      status: 'waiting',
      collected_from_customer: 0,
    });
    const last = saved[saved.length - 1];
    expect(last.collected_from_customer_reported).toBe('0.00');
  });
});
