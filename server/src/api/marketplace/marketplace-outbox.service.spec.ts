import { MarketplaceOutboxService } from './marketplace-outbox.service';
import {
  MarketplaceEventType,
  MarketplaceOutboxStatus,
} from './marketplace.enums';

const INTEGRATION = { id: 'int-1', slug: 'uzum' };

const parcel = (over: any = {}) => ({
  id: 'p-1',
  external_parcel_id: 'PCL-8842-1',
  external_order_id: 'ORD-8842',
  seller_id: 'SLR-77',
  order_id: null,
  remote_status: 'READY_FOR_PICKUP',
  ...over,
}) as any;

function makeManager(seqStart = 0) {
  let seq = seqStart;
  const saved: any[] = [];
  return {
    saved,
    query: jest.fn(async (sql: string) => {
      if (/UPDATE "marketplace_parcel"/.test(sql)) {
        seq += 1;
        // ⚠️ TUPLE — `UPDATE ... RETURNING` ning haqiqiy shakli.
        return [[{ next_seq: String(seq) }], 1];
      }
      return [];
    }),
    create: jest.fn((_e: any, v: any) => ({ ...v })),
    save: jest.fn(async (_e: any, v: any) => {
      const row = { id: `ob-${saved.length + 1}`, ...v };
      saved.push(row);
      return row;
    }),
    createQueryBuilder: jest.fn(),
  };
}

describe('MarketplaceOutboxService.enqueueParcelEvent', () => {
  it("hodisani CHAQIRUVCHINING manageriga yozadi (tranzaksiya ichida)", async () => {
    // ⚠️ Bloker B3: bugungi `queueStatusSync` commit'dan KEYIN, `await`siz
    // chaqiriladi. Deploy o'sha lahzada bo'lsa hodisa umuman tug'ilmaydi.
    const m = makeManager();
    const svc = new MarketplaceOutboxService();

    await svc.enqueueParcelEvent(m as any, {
      integration: INTEGRATION,
      parcel: parcel(),
      event_type: MarketplaceEventType.PARCEL_ACCEPTED,
    });

    // O'z tranzaksiyasini OCHMAYDI — faqat berilgan managerga yozadi.
    expect(m.save).toHaveBeenCalledTimes(1);
    expect(m.saved[0].status).toBe(MarketplaceOutboxStatus.PENDING);
    expect(m.saved[0].aggregate_type).toBe('parcel');
    expect(m.saved[0].aggregate_id).toBe('p-1');
  });

  it("`seq` ni ATOMIK ajratadi va har chaqiruvda oshiradi", async () => {
    const m = makeManager();
    const svc = new MarketplaceOutboxService();
    const p = parcel();

    await svc.enqueueParcelEvent(m as any, {
      integration: INTEGRATION, parcel: p,
      event_type: MarketplaceEventType.PARCEL_ACCEPTED,
    });
    await svc.enqueueParcelEvent(m as any, {
      integration: INTEGRATION, parcel: p,
      event_type: MarketplaceEventType.PARCEL_DISPATCHED,
    });

    expect(m.saved.map((r) => r.seq)).toEqual([1, 2]);
    // ⚠️ `UPDATE ... RETURNING` ishlatiladi, `MAX(seq)+1` emas: ikkinchisi
    // parallel enqueue'da bir xil raqam berib, unique buzilishi bilan BUTUN
    // tranzaksiyani (pul yozuvi bilan birga) yiqitardi.
    const sql = m.query.mock.calls[0][0] as string;
    expect(sql).toMatch(/UPDATE "marketplace_parcel"/);
    expect(sql).toMatch(/"next_seq" \+ 1/);
    expect(sql).toMatch(/RETURNING/);
  });

  it('har hodisada BARQAROR `event_id` yaratadi', async () => {
    const m = makeManager();
    const svc = new MarketplaceOutboxService();
    await svc.enqueueParcelEvent(m as any, {
      integration: INTEGRATION, parcel: parcel(),
      event_type: MarketplaceEventType.PARCEL_DELIVERED,
    });
    const row = m.saved[0];
    expect(row.event_id).toMatch(/^[0-9a-f-]{36}$/);
    // Payload ichidagi `event_id` qator bilan BIR XIL — ular shu bo'yicha
    // dublikatni tashlaydi (kontrakt §4.4 MUST #1).
    expect(row.payload.event_id).toBe(row.event_id);
    expect(row.payload.seq).toBe(row.seq);
  });

  it('pul va holat bloklarini payloadga soladi', async () => {
    const m = makeManager();
    const svc = new MarketplaceOutboxService();
    await svc.enqueueParcelEvent(m as any, {
      integration: INTEGRATION,
      parcel: parcel(),
      event_type: MarketplaceEventType.PARCEL_DELIVERED,
      status: { from: 'OUT_FOR_DELIVERY', to: 'DELIVERED' },
      money: {
        currency: 'UZS', collected_from_customer: 200000,
        beepost_fee: 50000, beepost_fee_basis: 'center',
        tariff_version: 3, extra_cost: 5000, net_to_marketplace: 145000,
      },
      order: { id: 'order-1', order_number: 100042 },
    });

    const p = m.saved[0].payload;
    expect(p.status).toEqual({ from: 'OUT_FOR_DELIVERY', to: 'DELIVERED' });
    expect(p.money.net_to_marketplace).toBe(145000);
    expect(p.money.tariff_version).toBe(3);
    expect(p.parcel.beepost_order_number).toBe(100042);
  });

  it('PREPAID: manfiy net payloadga tushadi', async () => {
    const m = makeManager();
    const svc = new MarketplaceOutboxService();
    await svc.enqueueParcelEvent(m as any, {
      integration: INTEGRATION, parcel: parcel({ prepaid: true }),
      event_type: MarketplaceEventType.PARCEL_DELIVERED,
      money: {
        currency: 'UZS', collected_from_customer: 0, prepaid: true,
        beepost_fee: 50000, net_to_marketplace: -50000,
      },
    });
    expect(m.saved[0].payload.money.net_to_marketplace).toBe(-50000);
  });

  it("posilka topilmasa aniq xato beradi", async () => {
    const m = makeManager();
    m.query = jest.fn(async () => []) as any;
    const svc = new MarketplaceOutboxService();
    await expect(
      svc.enqueueParcelEvent(m as any, {
        integration: INTEGRATION, parcel: parcel(),
        event_type: MarketplaceEventType.PARCEL_ACCEPTED,
      }),
    ).rejects.toThrow(/seq ajratish/);
  });
});
