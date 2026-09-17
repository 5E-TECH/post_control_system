import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MarketplaceScanService } from './marketplace-scan.service';
import {
  MarketplaceScanSessionStatus,
  MarketplaceScanState,
} from './marketplace.enums';
import { JwtPayload } from 'src/common/utils/types/user.type';

const USER = { id: 'op-1', role: 'registrator' } as JwtPayload;
const OTHER = { id: 'op-2', role: 'registrator' } as JwtPayload;

const INTEGRATION = {
  id: 'int-1',
  slug: 'uzum',
  name: 'Uzum',
  is_active: true,
} as any;

const SESSION = {
  id: 'ses-1',
  integration_id: 'int-1',
  operator_id: USER.id,
  status: MarketplaceScanSessionStatus.OPEN,
} as any;

const lookupOk = () => ({
  parcel: {
    external_parcel_id: 'PCL-8842-1',
    external_order_id: 'ORD-8842',
    qr_token: 'UZM-8842-1',
    parcel_index: 1,
    parcel_count: 1,
    status: 'READY_FOR_PICKUP',
  },
  seller: { seller_id: 'SLR-77', seller_name: 'Rustam Savdo' },
  customer: {
    full_name: 'Aliyev Vali',
    phone: '+998901234567',
    district_sato: '1727401',
    address: 'Toshkent',
  },
  money: { product_amount: 180000, delivery_amount: 20000, cod_amount: 200000, prepaid: false },
  items: [{ sku: 'S1', name: 'Futbolka', quantity: 1, unit_price: 180000 }],
  where_deliver: 'center',
});

function build(over: {
  integration?: any;
  existingParcel?: any;
  district?: any;
  seller?: any;
  lookup?: () => Promise<unknown>;
  paused?: boolean;
} = {}) {
  const saved: any[] = [];
  const repo = (find: any) => ({
    findOne: jest.fn(async () => find ?? null),
    find: jest.fn(async () => []),
    create: jest.fn((v: any) => ({ ...(v ?? {}) })),
    save: jest.fn(async (v: any) => {
      const row = { id: v.id ?? 'parcel-1', ...v };
      saved.push(row);
      return row;
    }),
    remove: jest.fn(async () => undefined),
    increment: jest.fn(async () => undefined),
    decrement: jest.fn(async () => undefined),
  });

  const enqueued: any[] = [];
  const outbox = {
    enqueueParcelEvent: jest.fn(async (_m: any, i: any) => {
      enqueued.push(i);
      return { id: 'ob-1' };
    }),
  };
  const qr = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    manager: {
      update: jest.fn(async () => ({})),
      increment: jest.fn(async () => ({})),
    },
  };

  const api = {
    isPaused: jest.fn(() => over.paused ?? false),
    pausedSecondsLeft: jest.fn(() => (over.paused ? 42 : 0)),
    lookupParcel: over.lookup ?? jest.fn(async () => lookupOk()),
  };

  const svc = new MarketplaceScanService(
    repo(over.integration === undefined ? INTEGRATION : over.integration) as any,
    repo(over.existingParcel ?? null) as any,
    repo(SESSION) as any,
    repo(over.seller ?? null) as any,
    repo(over.district === undefined ? { id: 'd-1', name: 'Yunusobod' } : over.district) as any,
    api as any,
    // ⚠️ Rad etish endi marketplace'ga HODISA yuboradi — avval faqat
    // lokal yozuv edi va operator ekrani «xabar beriladi» deb yolg'on
    // aytardi.
    outbox as any,
    { createQueryRunner: () => qr } as any,
  );
  return { svc, api, saved, enqueued, outbox };
}

const scan = (svc: MarketplaceScanService, token = 'UZM-8842-1', user = USER) =>
  svc.scan('uzum', { session_id: 'ses-1', qr_token: token }, user);

describe('MarketplaceScanService.scan', () => {
  it("to'g'ri posilkani skanerlaydi va SERVERGA yozadi", async () => {
    const { svc, saved } = build();
    const r = await scan(svc);

    expect(r.external_parcel_id).toBe('PCL-8842-1');
    expect(r.seller_id).toBe('SLR-77');
    expect(r.blockers).toEqual([]);
    // ⚠️ Eng muhimi: skan natijasi BAZAGA yozildi. Bugungi oqimda u faqat
    // brauzer state'ida turadi va sahifa yangilansa yo'qoladi (§15 #12).
    const parcel = saved.find((x) => x.qr_token_norm === 'uzm-8842-1');
    expect(parcel).toBeDefined();
    expect(parcel.scan_state).toBe(MarketplaceScanState.SCANNED);
    expect(parcel.raw_payload).toBeDefined(); // audit uchun asl javob
  });

  it("MARKETPLACE O'LGANDA «topilmadi» DEMAYDI", async () => {
    // ⚠️ §15 #1 — rejadagi eng kritik xato. Bugungi UI har qanday xatoni
    // «topilmadi» deb ko'rsatib, «baribir qo'shilsinmi?» deb so'raydi va
    // operator butun qopni bo'sh buyurtma qilib yuboradi.
    const err: any = { response: { status: 503 } };
    err.marketplaceError = {
      kind: 'remote_down',
      message: "Marketplace serverida xato. Posilka ularda BOR bo'lishi mumkin.",
      allowManualAdd: false,
      countsTowardBreaker: true,
      retryable: true,
      httpStatus: 503,
    };
    const { svc } = build({ lookup: jest.fn(async () => { throw err; }) });

    await expect(scan(svc)).rejects.toThrow(ServiceUnavailableException);
    await expect(scan(svc)).rejects.toThrow(/BOR bo'lishi mumkin/);
  });

  it('haqiqiy 404 da aniq «topilmadi» xabarini beradi', async () => {
    const err: any = { response: { status: 404 } };
    err.marketplaceError = {
      kind: 'not_found', message: 'yo\'q', allowManualAdd: true,
      countsTowardBreaker: false, retryable: false, httpStatus: 404,
    };
    const { svc } = build({ lookup: jest.fn(async () => { throw err; }) });
    await expect(scan(svc)).rejects.toThrow(NotFoundException);
  });

  it("navbat to'xtatilgan bo'lsa TASHQI SO'ROV YUBORMAYDI", async () => {
    const { svc, api } = build({ paused: true });
    // Xabarda ANIQ soniya bo'lishi shart — «bir daqiqadan keyin» emas.
    await expect(scan(svc)).rejects.toThrow(/TO'XTATILDI.*42 soniya/s);
    expect(api.lookupParcel).not.toHaveBeenCalled();
  });

  it("yaroqsiz tokenda tashqi so'rov yubormaydi", async () => {
    const { svc, api } = build();
    await expect(scan(svc, 'ab')).rejects.toThrow(BadRequestException);
    expect(api.lookupParcel).not.toHaveBeenCalled();
  });

  it('allaqachon QABUL QILINGAN posilkani rad etadi', async () => {
    const { svc, api } = build({
      existingParcel: {
        id: 'p-1', scan_state: MarketplaceScanState.ACCEPTED,
        external_parcel_id: 'PCL-8842-1',
      },
    });
    await expect(scan(svc)).rejects.toThrow(/allaqachon qabul qilingan/i);
    // Lokal tekshiruv tashqi so'rovdan OLDIN — behuda chaqiruv yo'q.
    expect(api.lookupParcel).not.toHaveBeenCalled();
  });

  it("BOSHQA operator skanerlagan posilkani rad etadi", async () => {
    // ⚠️ §15 #11: bugun ikkalasi ham muvaffaqiyatli bo'lardi.
    const { svc } = build({
      existingParcel: {
        id: 'p-1', scan_state: MarketplaceScanState.SCANNED,
        scan_session_id: 'ses-BOSHQA', external_parcel_id: 'PCL-8842-1',
      },
    });
    await expect(scan(svc)).rejects.toThrow(/boshqa operator/i);
  });

  it('AYNI sessiyada takroriy skan — xato emas', async () => {
    const { svc, api } = build({
      existingParcel: {
        id: 'p-1', scan_state: MarketplaceScanState.SCANNED,
        scan_session_id: 'ses-1', external_parcel_id: 'PCL-8842-1',
        qr_token_raw: 'UZM-8842-1', raw_payload: {}, cod_amount: 200000,
        parcel_index: 1, parcel_count: 1, prepaid: false, seller_id: 'SLR-77',
      },
    });
    const r = await scan(svc);
    expect(r.duplicate_in_session).toBe(true);
    expect(api.lookupParcel).not.toHaveBeenCalled();
  });

  it('ular BEKOR QILGAN posilkani qabul qilmaydi', async () => {
    // §15 #9: bugun jimgina qabul qilinardi.
    const payload = lookupOk();
    payload.parcel.status = 'VOIDED';
    const { svc } = build({ lookup: jest.fn(async () => payload) });
    await expect(scan(svc)).rejects.toThrow(/VOIDED/);
  });

  it('TUMAN topilmasa BLOKER qo\'yadi (jimgina birinchisiga tushirmaydi)', async () => {
    // ⚠️ §15 #7: bugun `allDistricts[0]` ga tushiriladi va posilka
    // butunlay boshqa viloyatga ketadi.
    const { svc, saved } = build({ district: null });
    const r = await scan(svc);

    expect(r.blockers.join(' ')).toMatch(/Tuman topilmadi/);
    // Posilka baribir YOZILADI — nima kelganini bilib turishimiz kerak.
    expect(saved.some((x) => x.qr_token_norm === 'uzm-8842-1')).toBe(true);
  });

  it("noma'lum sotuvchini belgilaydi va reestrga qo'shadi", async () => {
    const { svc, saved } = build({ seller: null });
    const r = await scan(svc);
    expect(r.warnings.join(' ')).toMatch(/reestrda yo'q/);
    expect(saved.some((x) => x.is_unknown === true)).toBe(true);
  });

  it('PREPAID posilkani qabul qiladi (COD = 0)', async () => {
    const payload = lookupOk();
    payload.money.cod_amount = 0;
    payload.money.prepaid = true;
    const { svc, saved } = build({ lookup: jest.fn(async () => payload) });

    const r = await scan(svc);
    expect(r.blockers).toEqual([]);
    expect(r.prepaid).toBe(true);
    expect(saved.find((x) => x.qr_token_norm === 'uzm-8842-1').cod_amount).toBe(0);
  });

  it("o'chirilgan ulanishda skanerlamaydi", async () => {
    const { svc } = build({ integration: { ...INTEGRATION, is_active: false } });
    await expect(scan(svc)).rejects.toThrow(/o'chirilgan/);
  });

  it('boshqa operatorning sessiyasiga skanerlab bo\'lmaydi', async () => {
    const { svc } = build();
    await expect(scan(svc, 'UZM-8842-1', OTHER)).rejects.toThrow(ConflictException);
  });
});

describe('MarketplaceScanService.rejectParcel', () => {
  it('rad etishda MARKETPLACE\'GA hodisa yuboriladi', async () => {
    // ⚠️ Avval bu faqat lokal yozuv edi: operator ekranida
    // «marketplace'ga sabab bilan xabar beriladi» deb turardi-yu, hamkor
    // posilkani abadiy «bizda» deb bilardi.
    const { svc, enqueued } = build({
      existingParcel: {
        id: 'p-1',
        integration_id: 'int-1',
        external_parcel_id: 'PCL-1',
        scan_state: 'scanned',
        scan_session_id: 'ses-1',
        remote_status: 'READY_FOR_PICKUP',
      },
    });

    const r = await svc.rejectParcel(
      'ses-1',
      'p-1',
      'DAMAGED' as never,
      'quti ezilgan',
      USER,
    );

    expect(r.external_parcel_id).toBe('PCL-1');
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].event_type).toBe('parcel.rejected');
    expect(enqueued[0].status.to).toBe('REJECTED_BY_BEEPOST');
    expect(enqueued[0].note).toMatch(/quti ezilgan/);
  });
});
