import { MarketplaceReconcileService } from './marketplace-reconcile.service';
import { MarketplaceScanState } from './marketplace.enums';

const INTEGRATION = { id: 'int-1', slug: 'uzum', market_id: 'm-1' } as any;

const parcel = (over: any = {}) => ({
  id: 'p-1',
  integration_id: 'int-1',
  external_parcel_id: 'PCL-8842-1',
  scan_state: MarketplaceScanState.ACCEPTED,
  remote_status: 'OUT_FOR_DELIVERY',
  last_sent_seq: 5,
  last_synced_at: null,
  mismatch_at: null,
  mismatch_reason: null,
  ...over,
});

function build(opts: {
  parcels?: any[];
  remoteItems?: any[];
  invariant?: any;
  remoteBalance?: any;
} = {}) {
  const saved: any[] = [];
  const requeued: any[] = [];
  const seqLowered: any[] = [];

  const parcelRepo = {
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        where: () => qb, andWhere: () => qb, orderBy: () => qb,
        take: () => qb, getMany: async () => opts.parcels ?? [parcel()],
      };
      return qb;
    }),
    save: jest.fn(async (p: any) => { saved.push({ ...p }); return p; }),
    find: jest.fn(async () => []),
    // ⚠️ Solishtiruv endi NISHONLI `update` ishlatadi — `save(parcel)`
    // eskirgan entity'ni butunlay qayta yozib, `next_seq`/`last_sent_seq`
    // ni orqaga surardi.
    update: jest.fn(async (where: any, set: any) => {
      saved.push({ id: where?.id, ...set });
      return {};
    }),
    // Qayta navbatga qo'yishda `last_sent_seq` LEAST bilan TUSHIRILADI —
    // aks holda worker qo'riqchisi hodisalarni darhol `superseded` qilardi.
    query: jest.fn(async (sql: string, params: any[]) => {
      seqLowered.push({ sql, params });
      return [];
    }),
  };
  const outboxRepo = {
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        update: () => qb, set: (v: any) => { requeued.push(v); return qb; },
        where: () => qb, andWhere: () => qb,
        execute: async () => ({ affected: 2 }),
      };
      return qb;
    }),
    save: jest.fn(async (v: any) => v),
    create: jest.fn((v: any) => ({ ...v })),
  };
  const integrationRepo = {
    find: jest.fn(async () => [INTEGRATION]),
    findOne: jest.fn(async () => INTEGRATION),
    update: jest.fn(async () => ({})),
    // ⚠️ TUPLE shakli — TypeORM `UPDATE ... RETURNING` shunday qaytaradi.
    query: jest.fn(async () => [[{ next_ledger_seq: '9' }], 1]),
  };
  const api = {
    fetchParcelStatuses: jest.fn(async () => ({
      items: opts.remoteItems ?? [
        { external_parcel_id: 'PCL-8842-1', status: 'OUT_FOR_DELIVERY', last_applied_seq: 5 },
      ],
      next_cursor: null,
    })),
    fetchLedgerBalance: jest.fn(async () =>
      opts.remoteBalance === undefined
        ? { currency: 'UZS', total_receivable: 42_350_000 }
        : opts.remoteBalance,
    ),
  };
  const ledger = {
    verifyInvariant: jest.fn(async () =>
      opts.invariant ?? {
        ok: true, ledger_sum: 42_350_000, cashbox_balance: 42_350_000, diff: 0,
      },
    ),
    balancesBySeller: jest.fn(async () => [
      { seller_id: 'SLR-77', balance: 5_120_000, entries: 40 },
    ]),
  };

  // ⚠️ Sotuvchilar reestri kuniga bir marta ko'zgu qilinadi — usiz
  // hisob-kitob ekranida sotuvchi faqat `SLR-77` bo'lib ko'rinardi.
  const sellerRows: any[] = [];
  const sellerRepo = {
    update: jest.fn(async (where: any, patch: any) => {
      sellerRows.push({ where, patch });
      return { affected: 1 };
    }),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
  };

  const svc = new MarketplaceReconcileService(
    integrationRepo as any, sellerRepo as any, parcelRepo as any,
    outboxRepo as any, api as any, ledger as any,
  );
  return {
    svc, saved, requeued, seqLowered, api, ledger, outboxRepo,
    integrationRepo, sellerRepo, sellerRows,
  };
}

describe('MarketplaceReconcileService.reconcileParcels', () => {
  it("hammasi mos bo'lsa nomuvofiqlik YOZMAYDI", async () => {
    const { svc, saved } = build();
    const r = await svc.reconcileParcels(INTEGRATION);

    expect(r.mismatches).toBe(0);
    expect(saved[0].mismatch_at).toBeNull();
    // Solishtirilgan vaqt yoziladi — keyingi siklda oxiriga tushsin.
    expect(saved[0].last_synced_at).toBeGreaterThan(0);
  });

  it('ULAR ORQADA qolgan bo\'lsa hodisalarni QAYTA NAVBATGA qo\'yadi', async () => {
    // ⚠️ Eng muhim tekshiruv: outbox 8 urinishdan keyin taslim bo'ladi.
    // Marketplace undan uzoq o'chsa, hodisa `failed` bo'lib qolardi va
    // uni HECH NARSA tiklamasdi.
    const { svc, saved, requeued, seqLowered } = build({
      remoteItems: [
        { external_parcel_id: 'PCL-8842-1', status: 'OUT_FOR_DELIVERY', last_applied_seq: 2 },
      ],
    });
    const r = await svc.reconcileParcels(INTEGRATION);

    expect(r.requeued).toBe(2);
    expect(saved[0].mismatch_reason).toMatch(/seq orqada: ularda 2, bizda 5/);
    expect(requeued[0].status).toBe('pending');
    expect(requeued[0].attempts).toBe(0);

    /**
     * ⚠️ `last_sent_seq` TUSHIRILISHI SHART.
     *
     * Worker qo'riqchisi `job.seq <= parcel.last_sent_seq` bo'lsa hodisani
     * `superseded` qiladi. Qayta navbatga qo'yilgan hodisalarning seq'i
     * aynan shu chegaradan past — chegara tushirilmasa, butun tiklash
     * yo'li O'LIK bo'lardi (hodisalar navbatga qaytib, darhol tashlanardi).
     */
    const lowered = seqLowered[0];
    expect(lowered.sql).toMatch(/LEAST\("last_sent_seq"/);
    expect(lowered.params[1]).toBe(2); // ularning `last_applied_seq` i
  });

  it('STATUS farq qilsa nomuvofiqlik yozadi', async () => {
    const { svc, saved } = build({
      remoteItems: [
        { external_parcel_id: 'PCL-8842-1', status: 'CANCELLED', last_applied_seq: 5 },
      ],
    });
    const r = await svc.reconcileParcels(INTEGRATION);
    expect(r.mismatches).toBe(1);
    expect(saved[0].mismatch_reason).toMatch(/status farq/);
  });

  it("ULARDA UMUMAN YO'Q posilkani ushlaydi", async () => {
    // Biz qabul qilganmiz, ular bilmaydi — qabul hodisasi yetib bormagan.
    const { svc, saved, requeued } = build({ remoteItems: [] });
    const r = await svc.reconcileParcels(INTEGRATION);

    expect(r.mismatches).toBe(1);
    expect(saved[0].mismatch_reason).toMatch(/posilka YO'Q/);
    // Barcha hodisalar qayta yuboriladi (seq 0 dan).
    expect(requeued).toHaveLength(1);
  });

  it("o'z-o'zidan tuzalgan nomuvofiqlik belgisini OLIB TASHLAYDI", async () => {
    const { svc, saved } = build({
      parcels: [parcel({ mismatch_at: 111, mismatch_reason: 'eski muammo' })],
    });
    await svc.reconcileParcels(INTEGRATION);
    expect(saved[0].mismatch_at).toBeNull();
    expect(saved[0].mismatch_reason).toBeNull();
  });

  it("posilka yo'q bo'lsa tashqi so'rov yubormaydi", async () => {
    const { svc, api } = build({ parcels: [] });
    const r = await svc.reconcileParcels(INTEGRATION);
    expect(r.checked).toBe(0);
    expect(api.fetchParcelStatuses).not.toHaveBeenCalled();
  });
});

describe('MarketplaceReconcileService.reconcileLedger', () => {
  it('invariant buzilganini ushlaydi', async () => {
    // ⚠️ `SUM(daftar) != kassa balansi` — daftar yozuvi tushib qolgan yoki
    // kassa daftarsiz o'zgartirilgan. Avtomatik tuzatilmaydi.
    const { svc } = build({
      invariant: { ok: false, ledger_sum: 42_000_000, cashbox_balance: 42_350_000, diff: 350_000 },
    });
    const r = await svc.reconcileLedger(INTEGRATION);
    expect(r.invariant.ok).toBe(false);
    expect(r.invariant.diff).toBe(350_000);
  });

  it('ularning balansi farq qilsa aniqlaydi', async () => {
    const { svc } = build({
      remoteBalance: { currency: 'UZS', total_receivable: 42_300_000 },
    });
    const r = await svc.reconcileLedger(INTEGRATION);
    expect(r.remote_balance).toBe(42_300_000);
    expect(r.diff).toBe(50_000);
  });

  it("ularning balansi olinmasa ham SNAPSHOT yuboriladi", async () => {
    const { svc, outboxRepo, api } = build();
    (api.fetchLedgerBalance as jest.Mock).mockRejectedValueOnce(new Error('timeout'));
    const r = await svc.reconcileLedger(INTEGRATION);

    expect(r.remote_balance).toBeNull();
    // Snapshot — uchinchi himoya qatlami, u baribir ketishi kerak.
    expect(outboxRepo.save).toHaveBeenCalledTimes(1);
    const ev = (outboxRepo.save as jest.Mock).mock.calls[0][0];
    expect(ev.event_type).toBe('ledger.snapshot');
    expect(ev.payload.snapshot.balance).toBe(42_350_000);
    expect(ev.payload.parcel).toBeUndefined();
  });
});

describe('MarketplaceReconcileService.syncSellers', () => {
  it('sotuvchilarni KO\'ZGU qiladi va `is_unknown` ni tozalaydi', async () => {
    /**
     * ⚠️ Reestr avval FAQAT skan paytida to'ldirilardi va o'shanda ham
     * posilkadagi nom bilan — hisob-kitob ekranida sotuvchi `SLR-77`
     * bo'lib ko'rinar, admin kimga to'layotganini bilmasdi.
     */
    const { svc, api, sellerRows } = build();
    (api as any).fetchSellers = jest
      .fn()
      .mockResolvedValueOnce({
        items: [
          { seller_id: 'SLR-77', name: 'Rustam Savdo', phone: '+998901112233' },
          { seller_id: 'SLR-99', name: "Yopilgan Do'kon", is_active: false },
        ],
        next_cursor: 'c2',
      })
      .mockResolvedValueOnce({ items: [], next_cursor: null });

    const r = await svc.syncSellers(INTEGRATION as any);

    expect(r.synced).toBe(2);
    expect(r.pages).toBe(2); // `next_cursor` bo'yicha sahifalandi
    expect(sellerRows[0].patch).toMatchObject({
      name: 'Rustam Savdo',
      is_active: true,
      // Skan yaratgan «noma'lum» belgisi TASDIQLANADI.
      is_unknown: false,
    });
    expect(sellerRows[1].patch.is_active).toBe(false);
  });

  it('`seller_id` siz yozuvni O\'TKAZIB yuboradi', async () => {
    const { svc, api, sellerRows } = build();
    (api as any).fetchSellers = jest.fn().mockResolvedValue({
      items: [{ name: 'ID siz' }, { seller_id: '  ' }],
      next_cursor: null,
    });
    const r = await svc.syncSellers(INTEGRATION as any);
    expect(r.synced).toBe(0);
    expect(sellerRows).toHaveLength(0);
  });
});
