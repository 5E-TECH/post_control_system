import { parseLookupPayload, normalizeUzPhone } from './marketplace-payload.util';

const base = () => ({
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
  items: [{ sku: 'SKU-1', name: 'Futbolka', quantity: 2, unit_price: 65000 }],
  where_deliver: 'center',
});

describe('normalizeUzPhone', () => {
  it('turli formatlarni bir shaklga keltiradi', () => {
    for (const v of ['901234567', '+998901234567', '998901234567', '+998 90 123 45 67', '(90) 123-45-67']) {
      expect(normalizeUzPhone(v)).toBe('+998901234567');
    }
  });

  it('SON bo\'lib kelgan raqamni ham qabul qiladi', () => {
    // ⚠️ §15 #4: bugungi kodda JSON'dagi son `phoneNumber.startsWith` da
    // TypeError beradi va BUTUN 30 posilkali partiyani yiqitadi.
    expect(normalizeUzPhone(998901234567)).toBe('+998901234567');
    expect(normalizeUzPhone(901234567)).toBe('+998901234567');
  });

  it('yaroqsiz raqamni RAD ETADI (soxta yasamaydi)', () => {
    // Bugungi kod oxirgi 9 raqamni olib `+998` qo'shadi — natijada
    // `+998000000000` kabi yaroqsiz mijozlar to'planadi.
    for (const v of ['', null, undefined, '123', 'salom', {}, '12345678901234']) {
      expect(normalizeUzPhone(v)).toBeNull();
    }
  });
});

describe('parseLookupPayload', () => {
  it("to'g'ri javobni muvaffaqiyatli o'qiydi", () => {
    const r = parseLookupPayload(base());
    expect(r.blockers).toEqual([]);
    expect(r.parcel).toMatchObject({
      external_parcel_id: 'PCL-8842-1',
      seller_id: 'SLR-77',
      phone: '+998901234567',
      cod_amount: 200000,
      where_deliver: 'center',
    });
    expect(r.parcel!.qr_token_norm).toBe('uzm-8842-1');
    expect(r.parcel!.qr_token_raw).toBe('UZM-8842-1');
  });

  it('telefon yaroqsiz bo\'lsa BLOKER beradi (soxta mijoz yaratmaydi)', () => {
    const p = base();
    (p.customer as any).phone = '';
    const r = parseLookupPayload(p);
    expect(r.parcel).toBeNull();
    expect(r.blockers.join(' ')).toMatch(/telefon/i);
  });

  it("tuman SOATO kodi yo'q bo'lsa BLOKER beradi", () => {
    const p = base();
    (p.customer as any).district_sato = '';
    const r = parseLookupPayload(p);
    expect(r.parcel).toBeNull();
    expect(r.blockers.join(' ')).toMatch(/SOATO/);
  });

  it('COD 0 + prepaid emas → BLOKER', () => {
    // ⚠️ §15 #8: bugun bunday buyurtma YARATILADI va sotuvda market hamda
    // kuryer kassasidan tarif yechiladi.
    const p = base();
    p.money.cod_amount = 0;
    const r = parseLookupPayload(p);
    expect(r.parcel).toBeNull();
    expect(r.blockers.join(' ')).toMatch(/prepaid deb belgilanmagan/);
  });

  it('COD 0 + prepaid = true → RUXSAT (manfiy net yo\'li)', () => {
    const p = base();
    p.money.cod_amount = 0;
    p.money.prepaid = true;
    const r = parseLookupPayload(p);
    expect(r.blockers).toEqual([]);
    expect(r.parcel!.prepaid).toBe(true);
    expect(r.parcel!.cod_amount).toBe(0);
  });

  it("sotuvchi yo'q bo'lsa OGOHLANTIRADI, to'smaydi", () => {
    const p = base();
    (p.seller as any).seller_id = '';
    const r = parseLookupPayload(p);
    expect(r.parcel).not.toBeNull();
    expect(r.warnings.join(' ')).toMatch(/Sotuvchi ID/);
  });

  it("ko'p qutili: 2-qutida pul bo'lsa ogohlantiradi", () => {
    const p = base();
    p.parcel.parcel_index = 2;
    p.parcel.parcel_count = 3;
    const r = parseLookupPayload(p);
    expect(r.warnings.join(' ')).toMatch(/2-qutisida COD bor/);
  });

  it("quti raqami noto'g'ri bo'lsa BLOKER", () => {
    const p = base();
    p.parcel.parcel_index = 5;
    p.parcel.parcel_count = 3;
    expect(parseLookupPayload(p).blockers.join(' ')).toMatch(/Quti raqami/);
  });

  it('`home` ni `address` ga moslaydi', () => {
    const p = base();
    (p as any).where_deliver = 'home';
    expect(parseLookupPayload(p).parcel!.where_deliver).toBe('address');
  });

  it('BO\'SH javobda yiqilmaydi, blokerlar ro\'yxatini qaytaradi', () => {
    for (const v of [null, undefined, {}, [], 'axlat', 42]) {
      const r = parseLookupPayload(v);
      expect(r.parcel).toBeNull();
      expect(r.blockers.length).toBeGreaterThan(0);
    }
  });

  it('mahsulot ro\'yxati yo\'q bo\'lsa ogohlantiradi', () => {
    const p = base();
    (p as any).items = [];
    expect(parseLookupPayload(p).warnings.join(' ')).toMatch(/Mahsulotlar/);
  });
});
