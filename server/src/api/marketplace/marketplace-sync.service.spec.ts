import { MarketplaceSyncService } from './marketplace-sync.service';
import {
  MarketplaceEventType,
  MarketplaceLedgerEntryType,
} from './marketplace.enums';

const INTEGRATION = { id: 'int-1', slug: 'uzum' };
const PARCEL = {
  id: 'p-1',
  external_parcel_id: 'PCL-8842-1',
  external_order_id: 'ORD-8842',
  seller_id: 'SLR-77',
};

const order = (over: any = {}) =>
  ({
    id: 'order-1',
    order_number: 100042,
    integration_id: 'int-1',
    external_seller_id: 'SLR-77',
    ...over,
  }) as any;

function build(opts: { integration?: any; parcel?: any; originalEntry?: any; tariff?: any } = {}) {
  const manager = {
    query: jest.fn(async (_sql: string, _p: any[]) =>
      opts.originalEntry === undefined
        ? [{ id: 'le-asl', tariff_version: 3 }]
        : opts.originalEntry,
    ),
    findOne: jest.fn(async (entity: any) => {
      const n = entity?.name ?? '';
      if (n === 'MarketplaceIntegrationEntity') {
        return opts.integration === undefined ? INTEGRATION : opts.integration;
      }
      if (n === 'MarketplaceParcelEntity') {
        return opts.parcel === undefined ? PARCEL : opts.parcel;
      }
      if (n === 'MarketplaceTariffEntity') {
        return opts.tariff === undefined
          ? { id: 't-1', version: 3, tariff_center: 50000, tariff_home: 70000 }
          : opts.tariff;
      }
      return null;
    }),
  };
  const ledger = {
    appendEntry: jest.fn(async (_m: any, i: any) => ({
      // `seq` — hodisadagi `ledger.seq` shundan olinadi (global tartib).
      seq: 7,
      id: 'le-1',
      balance_after: 42_350_000,
      ...i,
    })),
  };
  const outbox = {
    enqueueParcelEvent: jest.fn(async (_m: any, _i: any) => ({ id: 'ob-1' })),
  };
  const svc = new MarketplaceSyncService({} as any, {} as any, ledger as any, outbox as any);
  return { svc, manager, ledger, outbox };
}

const money = {
  currency: 'UZS' as const,
  collected_from_customer: 200000,
  beepost_fee: 50000,
  extra_cost: 5000,
  net_to_marketplace: 145000,
  tariff_version: 3,
};

describe('MarketplaceSyncService.recordOrderMoneyEvent', () => {
  it('ODDIY market buyurtmasida HECH NARSA qilmaydi (tez yo\'l)', async () => {
    // ⚠️ Bu metod HAR SOTUVDA chaqiriladi. Marketplace bo'lmagan buyurtma
    // uchun narxi NOLGA teng bo'lishi shart — bitta ham so'rov yo'q.
    const { svc, manager, ledger, outbox } = build();
    await svc.recordOrderMoneyEvent(manager as any, {
      order: order({ integration_id: null }),
      event_type: MarketplaceEventType.PARCEL_DELIVERED,
      entry_type: MarketplaceLedgerEntryType.SALE,
      ledger_amount: 150000,
    });

    expect(manager.findOne).not.toHaveBeenCalled();
    expect(ledger.appendEntry).not.toHaveBeenCalled();
    expect(outbox.enqueueParcelEvent).not.toHaveBeenCalled();
  });

  it('daftar yozuvi va hodisani BIR MARTA yozadi va bog\'laydi', async () => {
    const { svc, manager, ledger, outbox } = build();
    await svc.recordOrderMoneyEvent(manager as any, {
      order: order(),
      event_type: MarketplaceEventType.PARCEL_DELIVERED,
      entry_type: MarketplaceLedgerEntryType.SALE,
      ledger_amount: 150000,
      cashbox_history_id: 'ch-1',
      money,
      status: { from: 'waiting', to: 'DELIVERED' },
    });

    const entry = ledger.appendEntry.mock.calls[0][1] as any;
    expect(entry.amount).toBe(150000);
    expect(entry.seller_id).toBe('SLR-77');
    // ⚠️ Idempotentlik langari — ayni kassa yozuvi ikkinchi daftar qatori
    // yaratmasin.
    expect(entry.cashbox_history_id).toBe('ch-1');
    expect(entry.tariff_version).toBe(3);

    const ev = outbox.enqueueParcelEvent.mock.calls[0][1] as any;
    expect(ev.event_type).toBe('parcel.delivered');
    /**
     * Hodisa daftar yozuvi bilan BOG'LANADI.
     *
     * ⚠️ `seq` — INTEGRATSIYA bo'yicha GLOBAL raqam. Usiz marketplace
     * `balance_after` ni kelish TARTIBIDA solishtirib, SOXTA «daftar
     * ajraldi» xatosi berardi: hodisalar posilka bo'yicha serializatsiya
     * qilinadi, lekin turli posilkalar orasida tartib kafolatlanmaydi.
     */
    expect(ev.ledger).toEqual({
      entry_id: 'le-1',
      seq: 7,
      balance_after: 42_350_000,
    });
    expect(ev.money.net_to_marketplace).toBe(145000);
    expect(ev.order).toEqual({ id: 'order-1', order_number: 100042 });
  });

  it('MANFIY summani (prepaid) daftar va hodisaga o\'tkazadi', async () => {
    const { svc, manager, ledger, outbox } = build();
    await svc.recordOrderMoneyEvent(manager as any, {
      order: order(),
      event_type: MarketplaceEventType.PARCEL_DELIVERED,
      entry_type: MarketplaceLedgerEntryType.SALE,
      ledger_amount: -50000,
      money: { currency: 'UZS', collected_from_customer: 0, beepost_fee: 50000, net_to_marketplace: -50000 },
    });
    expect((ledger.appendEntry.mock.calls[0][1] as any).amount).toBe(-50000);
    const ev2 = outbox.enqueueParcelEvent.mock.calls[0][1] as any;
    expect(ev2.money.net_to_marketplace).toBe(-50000);
  });

  it("ulanish topilmasa XATO tashlaydi (jimgina o'tmaydi)", async () => {
    // Buyurtmada `integration_id` bor, lekin ulanish yo'q — sozlash xatosi.
    // Jimgina o'tib ketsa, pul harakat qiladi-yu daftar yozilmaydi.
    const { svc, manager } = build({ integration: null });
    await expect(
      svc.recordOrderMoneyEvent(manager as any, {
        order: order(),
        event_type: MarketplaceEventType.PARCEL_DELIVERED,
        entry_type: MarketplaceLedgerEntryType.SALE,
        ledger_amount: 1,
      }),
    ).rejects.toThrow(/ulanishi topilmadi/);
  });

  it("posilka yo'q bo'lsa DAFTAR yoziladi, hodisa yuborilmaydi", async () => {
    // Pul haqiqatda harakat qilgan — daftarsiz qoldirish invariantni buzardi.
    const { svc, manager, ledger, outbox } = build({ parcel: null });
    await svc.recordOrderMoneyEvent(manager as any, {
      order: order(),
      event_type: MarketplaceEventType.PARCEL_DELIVERED,
      entry_type: MarketplaceLedgerEntryType.SALE,
      ledger_amount: 150000,
    });
    expect(ledger.appendEntry).toHaveBeenCalledTimes(1);
    expect(outbox.enqueueParcelEvent).not.toHaveBeenCalled();
  });

  it("sotuvchini buyurtmadan oladi, bo'lmasa posilkadan", async () => {
    const { svc, manager, ledger } = build();
    await svc.recordOrderMoneyEvent(manager as any, {
      order: order({ external_seller_id: null }),
      event_type: MarketplaceEventType.PARCEL_DELIVERED,
      entry_type: MarketplaceLedgerEntryType.SALE,
      ledger_amount: 1,
    });
    // Zaxira: posilkadagi `seller_id`. Qisman sotuv bolasida buyurtma
    // ustuni bo'sh qolishi mumkin.
    expect((ledger.appendEntry.mock.calls[0][1] as any).seller_id).toBe('SLR-77');
  });
});

describe('MarketplaceSyncService.recordStatusEvent', () => {
  it("pulsiz hodisada DAFTARGA TEGMAYDI (qaror P7)", async () => {
    // Qaytarish bepul — `parcel.returning`/`returned` pul harakatisiz.
    const { svc, manager, ledger, outbox } = build();
    await svc.recordStatusEvent(manager as any, {
      order: order(),
      event_type: MarketplaceEventType.PARCEL_RETURNING,
      status: { from: 'cancelled', to: 'RETURNING' },
    });
    expect(ledger.appendEntry).not.toHaveBeenCalled();
    expect(outbox.enqueueParcelEvent).toHaveBeenCalledTimes(1);
  });

  it('oddiy market buyurtmasida hech narsa qilmaydi', async () => {
    const { svc, manager, outbox } = build();
    await svc.recordStatusEvent(manager as any, {
      order: order({ integration_id: null }),
      event_type: MarketplaceEventType.PARCEL_DISPATCHED,
    });
    expect(manager.findOne).not.toHaveBeenCalled();
    expect(outbox.enqueueParcelEvent).not.toHaveBeenCalled();
  });
});


describe('MarketplaceSyncService.recordReversal', () => {
  it('asl yozuvni topib TESKARI yozuvga bog\'laydi', async () => {
    // ⚠️ Faqat `entry_type` bo'yicha hisoblash yetarli emas: `CORRECTION`
    // juftligi ham sotuv reversali, ham ortiqcha xarajat reversali uchun
    // ishlatiladi va sodda so'rov ularni ikki marta sanardi.
    const { svc, manager, ledger } = build();
    await svc.recordReversal(manager as any, {
      order: order(),
      event_type: MarketplaceEventType.PARCEL_ROLLED_BACK,
      ledger_amount: -145000,
      cashbox_history_id: 'ch-r1',
    });

    const entry = ledger.appendEntry.mock.calls[0][1] as any;
    expect(entry.entry_type).toBe(MarketplaceLedgerEntryType.CORRECTION);
    expect(entry.reverses_entry_id).toBe('le-asl');
    expect(entry.amount).toBe(-145000);
    // Tarif versiyasi ASL yozuvdan ko'chiriladi — nizoda «qaysi tarif»
    // savoli chiqmasin.
    expect(entry.tariff_version).toBe(3);
  });

  it("summani QAYTA HISOBLAMAYDI — berilganini ishlatadi", async () => {
    // ⚠️ Bloker B5: `rollbackOrderToWaiting` tariflarni JORIY qatordan
    // o'qiydi. Tarif o'zgargandan keyin qayta hisoblash asl sotuvdan
    // BOSHQA summani qaytarardi va daftar abadiy siljirdi.
    const { svc, manager, outbox } = build();
    await svc.recordReversal(manager as any, {
      order: order(),
      event_type: MarketplaceEventType.PARCEL_ROLLED_BACK,
      ledger_amount: -99999,
    });
    const ev = outbox.enqueueParcelEvent.mock.calls[0][1] as any;
    expect(ev.money.net_to_marketplace).toBe(-99999);
  });

  it("asl yozuv topilmasa ham daftar yoziladi (bog'lanishsiz)", async () => {
    const { svc, manager, ledger } = build({ originalEntry: [] });
    await svc.recordReversal(manager as any, {
      order: order(),
      event_type: MarketplaceEventType.PARCEL_ROLLED_BACK,
      ledger_amount: -145000,
    });
    const entry = ledger.appendEntry.mock.calls[0][1] as any;
    // Pul kassadan olingan — daftarsiz qoldirish invariantni buzardi.
    expect(entry.amount).toBe(-145000);
    expect(entry.reverses_entry_id).toBeNull();
  });

  it('oddiy market buyurtmasida hech narsa qilmaydi', async () => {
    const { svc, manager, ledger } = build();
    await svc.recordReversal(manager as any, {
      order: order({ integration_id: null }),
      event_type: MarketplaceEventType.PARCEL_ROLLED_BACK,
      ledger_amount: -1,
    });
    expect(manager.query).not.toHaveBeenCalled();
    expect(ledger.appendEntry).not.toHaveBeenCalled();
  });
});


describe('MarketplaceSyncService.applyFeeBasisChange', () => {
  const { Where_deliver } = require('src/common/enums');

  it('markaz → uy: tarifni QAYTA MUZLATADI va hodisa yuboradi', async () => {
    const { svc, manager, outbox } = build();
    const o = order({ market_tariff: 50000, where_deliver: Where_deliver.CENTER });

    const r = await svc.applyFeeBasisChange(manager as any, {
      order: o,
      new_where_deliver: Where_deliver.ADDRESS,
    });

    expect(r).toMatchObject({ applied: true, fee_before: 50000, fee_after: 70000 });
    // ⚠️ Tarif AMALDAGI shartnomadan olinadi — qo'lda kiritilgan raqamdan
    // emas (bloker B8). `sellOrder` shu qiymatni ustun ko'radi.
    expect(o.market_tariff).toBe(70000);

    const ev = outbox.enqueueParcelEvent.mock.calls[0][1] as any;
    expect(ev.event_type).toBe('parcel.fee_changed');
    expect(ev.money.beepost_fee).toBe(70000);
    expect(ev.money.beepost_fee_basis).toBe('home');
    expect(ev.money.tariff_version).toBe(3);
  });

  it('oddiy market buyurtmasida hech narsa qilmaydi', async () => {
    const { svc, manager, outbox } = build();
    const r = await svc.applyFeeBasisChange(manager as any, {
      order: order({ integration_id: null, market_tariff: 40000 }),
      new_where_deliver: Where_deliver.ADDRESS,
    });
    expect(r.applied).toBe(false);
    expect(outbox.enqueueParcelEvent).not.toHaveBeenCalled();
  });

  it("tarif sozlanmagan bo'lsa XATO tashlaydi", async () => {
    // Jimgina o'tib ketsa, buyurtma tarifsiz qolib sotuvda noto'g'ri
    // summa yozilardi.
    const { svc, manager } = build({ tariff: null });
    await expect(
      svc.applyFeeBasisChange(manager as any, {
        order: order(),
        new_where_deliver: Where_deliver.ADDRESS,
      }),
    ).rejects.toThrow(/tarifi sozlanmagan/);
  });
});
