import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MarketplaceIntakeService } from './marketplace-intake.service';
import {
  MarketplaceScanSessionStatus,
  MarketplaceScanState,
} from './marketplace.enums';
import { Where_deliver, Order_status, OrderCreatedSource } from 'src/common/enums';
import { JwtPayload } from 'src/common/utils/types/user.type';

const USER = { id: 'op-1', role: 'registrator' } as JwtPayload;
// ⚠️ `is_active` SHART — qabul ham master kalitni tekshiradi (skan kabi).
const INTEGRATION = {
  id: 'int-1', slug: 'uzum', market_id: 'market-1', name: 'Uzum',
  is_active: true,
} as any;
const TARIFF = {
  id: 't-1', integration_id: 'int-1', version: 3,
  tariff_center: 50000, tariff_home: 70000, effective_to: null,
} as any;

const DISTRICT = {
  id: 'd-1', name: 'Yunusobod', sato_code: '1727401',
  region_id: 'r-1', assigned_region: null,
};

function parcel(over: any = {}) {
  return {
    id: over.id ?? 'p-1',
    external_parcel_id: over.external_parcel_id ?? 'PCL-8842-1',
    external_order_id: over.external_order_id ?? 'ORD-8842',
    parcel_index: over.parcel_index ?? 1,
    parcel_count: over.parcel_count ?? 1,
    qr_token_norm: over.qr_token_norm ?? 'uzm-8842-1',
    qr_token_raw: over.qr_token_raw ?? 'UZM-8842-1',
    seller_id: over.seller_id ?? 'SLR-77',
    declared_product_amount: over.declared_product_amount ?? 180000,
    declared_delivery_amount: over.declared_delivery_amount ?? 20000,
    cod_amount: over.cod_amount ?? 200000,
    prepaid: over.prepaid ?? false,
    scan_state: MarketplaceScanState.SCANNED,
    raw_payload: over.raw_payload ?? {
      customer: {
        full_name: 'Aliyev Vali', phone: '+998901234567',
        district_sato: '1727401', address: 'Toshkent',
      },
      items: [{ sku: 'S1', name: 'Futbolka', quantity: 1 }],
      where_deliver: over.where_deliver ?? 'center',
    },
    ...over,
  };
}

function build(opts: {
  parcels?: any[];
  session?: any;
  integration?: any;
  tariff?: any;
  district?: any;
  confirmFails?: boolean;
} = {}) {
  const savedOrders: any[] = [];
  const savedAll: any[] = [];
  const sqlLog: string[] = [];
  let orderNo = 100000;

  const session = opts.session ?? {
    id: 'ses-1', integration_id: 'int-1', operator_id: USER.id,
    status: MarketplaceScanSessionStatus.OPEN, accept_idempotency_key: null,
  };

  const manager = {
    findOne: jest.fn(async (entity: any, q: any) => {
      const name = entity?.name ?? '';
      if (name === 'DistrictEntity') {
        if (opts.district === null) return null;
        return q?.where?.sato_code === '1727401' ? { ...DISTRICT } : null;
      }
      if (name === 'UserEntity') return null;   // mijoz yo'q -> yaratiladi
      if (name === 'PostEntity') return null;   // pochta yo'q -> yaratiladi
      return null;
    }),
    create: jest.fn((_e: any, v: any) => ({ ...v })),
    // Yiqilgan posilkani sessiyadan ajratish uchun ishlatiladi.
    update: jest.fn(async () => ({})),
    /**
     * ⚠️ Pochta hisoblagichlari ATOMIK `UPDATE` bilan oshiriladi —
     * «o'qi-o'zgartir-yoz» ikki operator bir vaqtda qabul qilganda
     * bir-birining qo'shganini jimgina o'chirardi.
     */
    query: jest.fn(async () => []),
    save: jest.fn(async (a: any, b?: any) => {
      const v = b ?? a;
      const row = { ...v };
      if (row.status === Order_status.RECEIVED && row.qr_code_token) {
        row.id = row.id ?? `order-${savedOrders.length + 1}`;
        row.order_number = ++orderNo;
        savedOrders.push(row);
      } else if (!row.id) {
        row.id = `e-${savedAll.length + 1}`;
      }
      savedAll.push(row);
      return row;
    }),
  };

  const qr = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    query: jest.fn(async (sql: string) => { sqlLog.push(sql); }),
    manager,
  };

  const repo = (found: any, list: any[] = []) => ({
    findOne: jest.fn(async () => found ?? null),
    find: jest.fn(async () => list),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
  });

  const enqueued: any[] = [];
  const outbox = {
    enqueueParcelEvent: jest.fn(async (_m: any, input: any) => {
      enqueued.push(input);
      return { id: 'ob-1' };
    }),
  };

  const api = {
    confirmAccept: jest.fn(async () => {
      if (opts.confirmFails) throw new Error('marketplace javob bermadi');
      return { accepted: [], rejected: [], errors: [] };
    }),
  };

  const svc = new MarketplaceIntakeService(
    repo(opts.integration === undefined ? INTEGRATION : opts.integration) as any,
    repo(null, opts.parcels ?? [parcel()]) as any,
    repo(session) as any,
    repo(opts.tariff === undefined ? TARIFF : opts.tariff) as any,
    { createQueryRunner: () => qr } as any,
    api as any,
    outbox as any,
  );

  return { svc, manager, savedOrders, savedAll, sqlLog, api, session, enqueued, outbox };
}

const accept = (svc: MarketplaceIntakeService, key = 'idem-1') =>
  svc.accept('uzum', { session_id: 'ses-1', idempotency_key: key }, USER);

describe('MarketplaceIntakeService.accept', () => {
  it('buyurtma yaratadi — TARIF MUZLATILGAN, token NORMALIZATSIYALANGAN', async () => {
    const { svc, savedOrders } = build();
    const r = await accept(svc);

    expect(r.accepted).toHaveLength(1);
    const o = savedOrders[0];
    // ⚠️ Bloker B7/B8: tarif qabulda muzlatiladi. `sellOrder` `order.market_tariff`
    // ni ustun ko'radi, ya'ni yo'ldagi posilka tarif o'zgarishidan ta'sirlanmaydi.
    expect(o.market_tariff).toBe(50000);
    // ⚠️ §15 #5: normalizatsiyalangan token — barcha PCS skanerlari shuni qidiradi.
    expect(o.qr_code_token).toBe('uzm-8842-1');
    expect(o.integration_id).toBe('int-1');
    expect(o.external_seller_id).toBe('SLR-77');
    expect(o.created_source).toBe(OrderCreatedSource.MARKETPLACE);
    expect(o.user_id).toBe('market-1');
    expect(o.status).toBe(Order_status.RECEIVED);
  });

  it("yetkazish turini ULARNING payload'idan oladi (bloker B9)", async () => {
    // ⚠️ `receiveExternalOrders` buni `market.default_tariff` dan oladi va
    // ularning so'zini O'QIMAYDI — har «uyga» posilkada 20 000 farq.
    const p = parcel();
    p.raw_payload.where_deliver = 'address';
    const { svc, savedOrders } = build({ parcels: [p] });
    await accept(svc);

    expect(savedOrders[0].where_deliver).toBe(Where_deliver.ADDRESS);
    expect(savedOrders[0].market_tariff).toBe(70000); // uy tarifi
  });

  it('IDEMPOTENT — ayni kalit bilan ikkinchi marta buyurtma YARATMAYDI', async () => {
    // ⚠️ §15 #3: bugungi kodda qabul timeout bo'lib qayta bosilsa BUTUN QOP
    // ikki marta yaratiladi va sotuvda pul ikki marta yoziladi.
    const acceptedSession = {
      id: 'ses-1', integration_id: 'int-1', operator_id: USER.id,
      status: MarketplaceScanSessionStatus.ACCEPTED,
      accept_idempotency_key: 'idem-1',
    };
    const done = parcel({
      scan_state: MarketplaceScanState.ACCEPTED,
      order_id: 'order-1', accept_batch_id: 'b-1',
      order: { order_number: 100001 },
    });
    const { svc, savedOrders } = build({ session: acceptedSession, parcels: [done] });

    const r = await accept(svc, 'idem-1');
    expect(r.accepted).toHaveLength(1);
    expect(savedOrders).toHaveLength(0); // yangi buyurtma YO'Q
  });

  it('qabul qilingan sessiyaga BOSHQA kalit bilan murojaat — 409', async () => {
    const { svc } = build({
      session: {
        id: 'ses-1', integration_id: 'int-1', operator_id: USER.id,
        status: MarketplaceScanSessionStatus.ACCEPTED,
        accept_idempotency_key: 'idem-1',
      },
    });
    await expect(accept(svc, 'boshqa-kalit')).rejects.toThrow(ConflictException);
  });

  it("KO'P QUTILI buyurtma chala bo'lsa qabul qilmaydi", async () => {
    // 3 qutidan faqat 2 tasi skanerlangan — mijozga chala posilka ketmasin.
    const { svc, savedOrders } = build({
      parcels: [
        parcel({ id: 'p1', external_parcel_id: 'PCL-9100-1', external_order_id: 'ORD-9100', parcel_index: 1, parcel_count: 3, qr_token_norm: 'uzm-9100-1' }),
        parcel({ id: 'p2', external_parcel_id: 'PCL-9100-2', external_order_id: 'ORD-9100', parcel_index: 2, parcel_count: 3, qr_token_norm: 'uzm-9100-2' }),
      ],
    });
    const r = await accept(svc);

    expect(r.accepted).toHaveLength(0);
    expect(r.failed).toHaveLength(2);
    expect(r.failed[0].reason).toMatch(/to'liq emas: 2\/3/);
    expect(savedOrders).toHaveLength(0);
  });

  it("ko'p qutili TO'LIQ bo'lsa — pul faqat 1-qutida", async () => {
    const { svc, savedOrders } = build({
      parcels: [1, 2, 3].map((i) =>
        parcel({
          id: `p${i}`, external_parcel_id: `PCL-9100-${i}`,
          external_order_id: 'ORD-9100', parcel_index: i, parcel_count: 3,
          qr_token_norm: `uzm-9100-${i}`,
          declared_product_amount: i === 1 ? 900000 : 0,
          declared_delivery_amount: 0,
          cod_amount: i === 1 ? 900000 : 0,
          prepaid: i !== 1, // pulsiz qutilar prepaid deb belgilanadi
        }),
      ),
    });
    const r = await accept(svc);

    expect(r.accepted).toHaveLength(3);
    expect(savedOrders.map((o) => o.total_price)).toEqual([900000, 0, 0]);
  });

  it('BITTA buzuq posilka qolganini YIQITMAYDI (savepoint)', async () => {
    // ⚠️ §15 #4: bugungi kodda bitta buzuq qator BUTUN 30 posilkali
    // partiyani rollback qiladi.
    const bad = parcel({
      id: 'p-bad', external_parcel_id: 'PCL-BAD', external_order_id: 'ORD-BAD',
      qr_token_norm: 'uzm-bad',
      raw_payload: {
        customer: { full_name: 'X', phone: 'axlat', district_sato: '1727401' },
        where_deliver: 'center',
      },
    });
    const { svc, savedOrders, sqlLog } = build({
      parcels: [bad, parcel({ id: 'p-ok', external_parcel_id: 'PCL-OK', external_order_id: 'ORD-OK', qr_token_norm: 'uzm-ok' })],
    });
    const r = await accept(svc);

    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].reason).toMatch(/telefoni yaroqsiz/);
    expect(r.accepted).toHaveLength(1); // yaxshisi o'tdi
    expect(savedOrders).toHaveLength(1);
    expect(sqlLog.some((s) => s.startsWith('ROLLBACK TO SAVEPOINT'))).toBe(true);
    expect(sqlLog.some((s) => s.startsWith('RELEASE SAVEPOINT'))).toBe(true);
  });

  it('TUMAN topilmasa o\'sha posilka o\'tmaydi', async () => {
    const { svc, savedOrders } = build({ district: null });
    const r = await accept(svc);
    expect(r.accepted).toHaveLength(0);
    expect(r.failed[0].reason).toMatch(/Tuman topilmadi/);
    expect(savedOrders).toHaveLength(0);
  });

  it('TARIF sozlanmagan bo\'lsa umuman boshlanmaydi', async () => {
    // Tarifsiz qabul = keyin kassaga noto'g'ri summa yozish.
    const { svc } = build({ tariff: null });
    await expect(accept(svc)).rejects.toThrow(BadRequestException);
  });

  it('marketplace tasdiqni qabul qilmasa ham LOKAL qabul saqlanadi', async () => {
    // Posilka jismonan bizda — tasdiq yuborilmagani uni qaytarib bermaydi.
    // `batch_id` saqlangani uchun qayta yuborish mumkin (ular idempotent).
    const { svc, savedOrders } = build({ confirmFails: true });
    const r = await accept(svc);

    expect(r.accepted).toHaveLength(1);
    expect(r.confirmed_remotely).toBe(false);
    expect(savedOrders).toHaveLength(1);
  });

  it("bo'sh sessiyada xato beradi", async () => {
    const { svc } = build({ parcels: [] });
    await expect(accept(svc)).rejects.toThrow(/posilka yo'q/);
  });

  it('boshqa operatorning sessiyasini qabul qila olmaydi', async () => {
    const { svc } = build();
    await expect(
      svc.accept('uzum', { session_id: 'ses-1', idempotency_key: 'k' }, { id: 'op-2' } as JwtPayload),
    ).rejects.toThrow(ConflictException);
  });
});

describe('MarketplaceIntakeService.accept — darvozalar', () => {
  it("MASTER KALIT o'chiq bo'lsa QABUL QILMAYDI", async () => {
    // ⚠️ Skan `resolveIntegration` orqali o'tadi va `is_active` ni
    // tekshiradi; qabul esa ulanishni TO'G'RIDAN-TO'G'RI o'qirdi. Ya'ni
    // kalit o'chirilgach ham butun qop qabul qilinib, buyurtmalar
    // yaratilaverardi — kill-switch yarim ishlardi.
    const { svc } = build({ integration: { ...INTEGRATION, is_active: false } });
    await expect(
      svc.accept('uzum', { session_id: 'ses-1', idempotency_key: 'k-1' }, USER),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('BOSHQA ulanishning sessiyasini QABUL QILMAYDI', async () => {
    // Busiz A marketplace sessiyasini `POST /marketplace/B/accept` ga
    // berish mumkin edi: posilkalar A dan, tarif va daftar B dan —
    // pul boshqa hamkorning hisobiga tushardi.
    const { svc } = build({
      session: {
        id: 'ses-1', integration_id: 'BOSHQA-int', operator_id: USER.id,
        status: MarketplaceScanSessionStatus.OPEN, accept_idempotency_key: null,
      },
    });
    await expect(
      svc.accept('uzum', { session_id: 'ses-1', idempotency_key: 'k-1' }, USER),
    ).rejects.toThrow(/boshqa marketplace/i);
  });
});

describe('MarketplaceIntakeService.accept — yiqilgan posilka', () => {
  it('QABUL QILINMAGAN posilka sessiyadan AJRATILADI (qayta skanerlash mumkin)', async () => {
    // Tuman topilmasa `createOrderForParcel` xato tashlaydi → `failed`.
    const { svc, manager } = build({ district: null });
    const res = await svc.accept(
      'uzum',
      { session_id: 'ses-1', idempotency_key: 'k-1' },
      USER,
    );
    expect(res.accepted).toHaveLength(0);
    expect(res.failed).toHaveLength(1);

    /**
     * ⚠️ Sessiya `accepted` bo'lib yopiladi. Yiqilgan posilka unga
     * bog'langan holda qolsa, skandagi dublikat qo'riqchisi («boshqa
     * sessiyada skanerlangan») uni ABADIY qulflab qo'yardi — posilka
     * omborda, tizimda esa o'lik.
     */
    const calls = manager.update.mock.calls as any[][];
    const detach = calls.find(
      (c) => c[2] && 'scan_session_id' in c[2] && c[2].scan_session_id === null,
    );
    expect(detach).toBeDefined();
    expect((detach as any[])[1]).toMatchObject({ scan_session_id: 'ses-1' });
  });
});
