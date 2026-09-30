/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { ElchiShipmentService } from './elchi-shipment.service';

/**
 * AUTO-RETRY — jo'natilmagan (elchi_shipment_id IS NULL) posilkalar qayta
 * jo'natiladi (E2E integratsiya P0). LDG'da bor edi, Elchida yo'q edi:
 * 502/tarmoq uzilishi -> posilka abadiy yuborilmasdi, hech kim yetkazmasdi.
 */
function buildSvc(over: {
  config?: any;
  shipments?: any[];
  createImpl?: jest.Mock;
}) {
  const svc: any = Object.create(ElchiShipmentService.prototype);
  svc.configRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        over.config === undefined
          ? { id: 'cfg', is_active: true }
          : over.config,
      ),
  };
  const qb: any = {
    leftJoin: () => qb,
    where: () => qb,
    andWhere: () => qb,
    orderBy: () => qb,
    addOrderBy: () => qb,
    take: () => qb,
    getMany: () => Promise.resolve(over.shipments ?? []),
  };
  svc.shipmentRepo = { createQueryBuilder: () => qb };
  svc.createShipmentForOrder =
    over.createImpl ?? jest.fn().mockResolvedValue({ id: 's' });
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return svc;
}

describe('ElchiShipmentService — autoRetryUnsentShipments', () => {
  it("master kalit o'chirilgan -> hech narsa qilinmaydi", async () => {
    const svc = buildSvc({ config: { is_active: false } });
    const res = await svc.autoRetryUnsentShipments();
    expect(res.retried).toBe(0);
    expect(svc.createShipmentForOrder).not.toHaveBeenCalled();
  });

  it('jo`natilmagan posilkalar qayta jo`natiladi (har biriga createShipmentForOrder)', async () => {
    const create = jest.fn().mockResolvedValue({ id: 's' });
    const svc = buildSvc({
      shipments: [{ order_id: 'o-1' }, { order_id: 'o-2' }],
      createImpl: create,
    });
    const res = await svc.autoRetryUnsentShipments();
    expect(res).toMatchObject({ retried: 2, success: 2, failed: 0 });
    expect(create).toHaveBeenCalledWith('o-1');
    expect(create).toHaveBeenCalledWith('o-2');
  });

  it('bittasi yiqilsa navbat BLOKLANMAYDI (failed sanaladi)', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce({ id: 's' })
      .mockRejectedValueOnce(new Error('Elchi 502'));
    const svc = buildSvc({
      shipments: [{ order_id: 'o-1' }, { order_id: 'o-2' }],
      createImpl: create,
    });
    const res = await svc.autoRetryUnsentShipments();
    expect(res).toMatchObject({ retried: 2, success: 1, failed: 1 });
    expect(create).toHaveBeenCalledTimes(2); // ikkinchisi ham urinildi
  });
});
