import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { CarrierOrderDto } from './dto/carrier-public.dto';
import {
  CarrierOrderSource,
  isOldItemRequired,
  isoFromEpoch,
  toCarrierOrderView,
} from './carrier-order-view';

/**
 * `toCarrierOrderView` — tashqi kompaniyaga chiqadigan YAGONA buyurtma
 * shakli. Bu testlar ikki narsani qulflaydi:
 *   1) maydonlar ro'yxati Elchi kontrakti bilan aynan bir xil (allowlist —
 *      ichki maydon, masalan tarif yoki `control_owner`, sizib chiqmaydi);
 *   2) BeePost moslashuvlari (UUID, paid_online_amount = 0, SOATO viloyati
 *      tumandan, mijoz tumaniga qaytish).
 */

const CONTRACT_KEYS = [
  'id',
  'order_number',
  'qr_token',
  'parent_order_id',
  'status',
  'total_price',
  'paid_online_amount',
  'cod_amount',
  'where_deliver',
  'address',
  'comment',
  'customer',
  'region',
  'district',
  'market',
  'replacement',
  'items',
  'created_at',
].sort();

const order = (over: Partial<CarrierOrderSource> = {}): CarrierOrderSource =>
  ({
    id: '3f6c2a9e-8b1d-4c7e-9a2f-1d5b8e7c4a90',
    order_number: 100042,
    qr_code_token: 'a1b2c3d4e5f6a7b8c9d0e1f2',
    parent_order_id: null,
    status: 'waiting',
    total_price: 250000,
    where_deliver: 'address',
    address: 'Chilonzor 5, 12-uy',
    comment: 'Qo‘ng‘iroq qiling',
    district_id: 'd-1',
    replacement_of_order_id: null,
    replacement_state: null,
    created_at: Date.UTC(2026, 10, 9, 10, 0, 0),
    customer: {
      name: 'Ali Valiyev',
      phone_number: '+998901112233',
      extra_number: null,
      address: 'Mijoz manzili',
      district: {
        id: 'cd-1',
        sato_code: '1726269',
        region: { id: 'cr-1', sato_code: '1726' },
      },
    },
    district: {
      id: 'd-1',
      sato_code: '1726294',
      region: { id: 'r-1', sato_code: '1726' },
    },
    market: { id: 'm-1', name: 'Kurtka do‘koni' },
    items: [
      {
        id: 'it-2',
        productId: 'p-2',
        quantity: 1,
        created_at: 2000,
        product: { name: 'Shim' },
      },
      {
        id: 'it-1',
        productId: 'p-1',
        quantity: 2,
        created_at: 1000,
        product: { name: 'Kurtka' },
      },
    ],
    // Ichki maydonlar — ko'rinishga CHIQMASLIGI kerak.
    ...({
      market_tariff: 30000,
      courier_tariff: 20000,
      control_owner: null,
      to_be_paid: 220000,
      operator: 'secret operator',
    } as object),
    ...over,
  }) as CarrierOrderSource;

describe('toCarrierOrderView', () => {
  it('faqat kontrakt maydonlari — ichki maydon (tarif, operator) chiqmaydi', () => {
    const view = toCarrierOrderView(order());
    expect(Object.keys(view).sort()).toEqual(CONTRACT_KEYS);
    const json = JSON.stringify(view);
    expect(json).not.toContain('30000');
    expect(json).not.toContain('secret operator');
    expect(json).not.toContain('to_be_paid');
  });

  it("Swagger sxemasi (CarrierOrderDto) bilan ko'rinish maydonlari bir xil", () => {
    // DTO faqat hujjat uchun; maydon nomi ajralib ketsa generatsiya
    // qilingan klient javobni o'qiy olmasdi.
    const dtoKeys = (
      Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES_ARRAY,
        CarrierOrderDto.prototype,
      ) as string[]
    )
      .map((key) => key.replace(/^:/, ''))
      .sort();
    expect(dtoKeys).toEqual(CONTRACT_KEYS);
    expect(Object.keys(toCarrierOrderView(order())).sort()).toEqual(dtoKeys);
  });

  it("asosiy maydonlar: UUID id, raqam satr, onlayn to'lov 0, naqd = summa", () => {
    const view = toCarrierOrderView(order());
    expect(view.id).toBe('3f6c2a9e-8b1d-4c7e-9a2f-1d5b8e7c4a90');
    expect(view.order_number).toBe('100042');
    expect(view.qr_token).toBe('a1b2c3d4e5f6a7b8c9d0e1f2');
    expect(view.status).toBe('waiting');
    expect(view.total_price).toBe(250000);
    expect(view.paid_online_amount).toBe(0);
    expect(view.cod_amount).toBe(250000);
    expect(view.where_deliver).toBe('address');
    expect(view.address).toBe('Chilonzor 5, 12-uy');
    expect(view.comment).toBe('Qo‘ng‘iroq qiling');
    expect(view.customer).toEqual({
      name: 'Ali Valiyev',
      phone_number: '+998901112233',
      extra_number: null,
    });
    expect(view.market).toEqual({ id: 'm-1', name: 'Kurtka do‘koni' });
    expect(view.created_at).toBe('2026-11-09T10:00:00.000Z');
  });

  it("viloyat — tumanning MA'MURIY viloyatidan, nom emas SOATO bilan", () => {
    const view = toCarrierOrderView(order());
    expect(view.district).toEqual({ id: 'd-1', soato_code: '1726294' });
    expect(view.region).toEqual({ id: 'r-1', soato_code: '1726' });
    expect(JSON.stringify(view)).not.toContain('name":"Chilonzor');
  });

  it("noto'g'ri SOATO (eski/soxta qiymat) → soato_code: null, id qoladi", () => {
    const view = toCarrierOrderView(
      order({
        district: {
          id: 'd-1',
          sato_code: 'REG-01-DIS-02',
          region: { id: 'r-1', sato_code: '17260' },
        },
      }),
    );
    expect(view.district).toEqual({ id: 'd-1', soato_code: null });
    expect(view.region).toEqual({ id: 'r-1', soato_code: null });
  });

  it("buyurtmada tuman yo'q (qisman sotuv bolasi) → mijoz tumani va manziliga qaytadi", () => {
    const view = toCarrierOrderView(
      order({
        district_id: null,
        district: null,
        address: null,
        parent_order_id: 'parent-1',
        status: 'cancelled',
      }),
    );
    expect(view.parent_order_id).toBe('parent-1');
    expect(view.district).toEqual({ id: 'cd-1', soato_code: '1726269' });
    expect(view.region).toEqual({ id: 'cr-1', soato_code: '1726' });
    expect(view.address).toBe('Mijoz manzili');
  });

  it("district_id bor-u bog'lanish yuklanmagan → mijoz tumaniga O'TMAYDI (null)", () => {
    const view = toCarrierOrderView(order({ district: null }));
    expect(view.district).toBeNull();
    expect(view.region).toBeNull();
  });

  it("bog'lanishlar yo'q bo'lsa yiqilmaydi — maydonlar null", () => {
    const view = toCarrierOrderView({
      id: 'o-1',
      status: 'on the road',
      total_price: '120000',
    });
    expect(view).toMatchObject({
      id: 'o-1',
      order_number: null,
      total_price: 120000,
      cod_amount: 120000,
      customer: null,
      region: null,
      district: null,
      market: null,
      replacement: null,
      items: [],
      created_at: null,
    });
  });

  it('qatorlar barqaror tartibda (yaratilgan vaqt) va kontrakt shaklida', () => {
    const view = toCarrierOrderView(order());
    expect(view.items).toEqual([
      { id: 'it-1', product_id: 'p-1', name: 'Kurtka', quantity: 2 },
      { id: 'it-2', product_id: 'p-2', name: 'Shim', quantity: 1 },
    ]);
  });

  it('almashtirish: eski mahsulot hali olinmagan → old_item_required: true', () => {
    const view = toCarrierOrderView(
      order({
        replacement_of_order_id: 'old-1',
        replacement_state: 'awaiting_old_pickup',
      }),
    );
    expect(view.replacement).toEqual({
      of_order_id: 'old-1',
      old_item_required: true,
    });
  });

  it('almashtirish: eski mahsulot olingan/qaytarilgan → old_item_required: false', () => {
    for (const state of ['old_collected', 'old_returned']) {
      const view = toCarrierOrderView(
        order({ replacement_of_order_id: 'old-1', replacement_state: state }),
      );
      expect(view.replacement).toEqual({
        of_order_id: 'old-1',
        old_item_required: false,
      });
    }
    expect(toCarrierOrderView(order()).replacement).toBeNull();
  });

  it('isOldItemRequired — oddiy buyurtmada false, holatsiz almashtirishda true', () => {
    expect(isOldItemRequired({ replacement_of_order_id: null })).toBe(false);
    expect(
      isOldItemRequired({
        replacement_of_order_id: 'old-1',
        replacement_state: null,
      }),
    ).toBe(true);
  });

  it('isoFromEpoch — epoch ms (son yoki satr), Date; yaroqsiz → null', () => {
    expect(isoFromEpoch(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(isoFromEpoch('1762682400000')).toBe('2025-11-09T10:00:00.000Z');
    expect(isoFromEpoch(new Date('2026-01-01T00:00:00Z'))).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(isoFromEpoch('abc')).toBeNull();
    expect(isoFromEpoch(null)).toBeNull();
  });
});
