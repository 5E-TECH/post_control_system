import { checkMarketplaceToken } from './marketplace-token.util';

/**
 * `/parcels/lookup` JAVOBINI TEKSHIRISH VA NORMALIZATSIYA QILISH.
 *
 * ⚠️ NEGA SOF FUNKSIYA. Bu mantiq eng ko'p xato keltiradigan joy va uni
 * DB'siz sinash mumkin bo'lishi kerak. Bugungi `receiveExternalOrders` da u
 * 300 qatorlik metod ichiga sochilib ketgan va sinab bo'lmaydi.
 *
 * Bugungi oqimdan UCH KRITIK FARQ:
 *
 *   1. TIP MAJBURLASH. Bugun `phone` JSON'da SON bo'lib kelsa,
 *      `phoneNumber.startsWith(...)` `TypeError` beradi va butun
 *      30 posilkali partiya rollback bo'ladi (§15 #4). Bu yerda hamma
 *      qiymat `String(x ?? '')` bilan majburlanadi.
 *
 *   2. SOXTA MA'LUMOT YO'Q. Bugun telefon yo'q bo'lsa
 *      `unknown_<ts>_<rand>` yasaladi va YANGI mijoz yozuvi ochiladi.
 *      Bu yerda — bloker.
 *
 *   3. JIMGINA ZAXIRA YO'Q. Bugun tuman topilmasa `allDistricts[0]` ga
 *      tushiriladi va posilka boshqa viloyatga ketadi (§15 #7). Bu yerda
 *      tuman qo'ng'irog'i CHAQIRUVCHIDA hal qilinadi, bu yerda faqat
 *      SOATO kodi tekshiriladi.
 */

export interface ParsedParcel {
  external_parcel_id: string;
  external_order_id: string;
  qr_token_raw: string;
  qr_token_norm: string;
  parcel_index: number;
  parcel_count: number;
  remote_status: string | null;
  seller_id: string | null;
  seller_name: string | null;
  customer_name: string;
  phone: string;
  extra_phone: string | null;
  district_sato: string;
  address: string | null;
  comment: string | null;
  product_amount: number;
  delivery_amount: number;
  cod_amount: number;
  prepaid: boolean;
  where_deliver: 'center' | 'address';
  items: Array<{ sku: string | null; name: string; quantity: number; unit_price: number }>;
}

export interface ParseResult {
  parcel: ParsedParcel | null;
  /** Qabul qilishni TO'SADIGAN muammolar. */
  blockers: string[];
  /** Qabul qilinadi, lekin operatorga ko'rsatiladi. */
  warnings: string[];
}

const s = (v: unknown): string => String(v ?? '').trim();
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : NaN;
};

/**
 * `+998XXXXXXXXX` ga keltiradi. Keltirib bo'lmasa `null`.
 *
 * ⚠️ Bugungi kod istalgan axlatdan raqam «yasaydi» (oxirgi 9 raqamni olib
 * `+998` qo'shadi). Natijada `+998000000000` kabi yaroqsiz raqamlar bilan
 * mijoz yozuvlari to'planib qoladi. Bu yerda — qat'iy.
 */
export function normalizeUzPhone(raw: unknown): string | null {
  const digits = s(raw).replace(/\D/g, '');
  if (!digits) return null;
  let local: string;
  if (digits.length === 9) local = digits;
  else if (digits.length === 12 && digits.startsWith('998')) local = digits.slice(3);
  else if (digits.length === 13 && digits.startsWith('9980')) local = digits.slice(4);
  else return null;
  // O'zbekiston mobil kodi 9 dan boshlanadigan 2 xonali operator kodi.
  if (!/^\d{9}$/.test(local)) return null;
  return `+998${local}`;
}

export function parseLookupPayload(raw: unknown): ParseResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const root = (raw ?? {}) as Record<string, any>;

  const p = (root.parcel ?? {}) as Record<string, any>;
  const seller = (root.seller ?? {}) as Record<string, any>;
  const cust = (root.customer ?? {}) as Record<string, any>;
  const money = (root.money ?? {}) as Record<string, any>;

  // ── Posilka identifikatorlari ──
  const parcelId = s(p.external_parcel_id);
  const orderId = s(p.external_order_id);
  if (!parcelId) blockers.push("Javobda `parcel.external_parcel_id` yo'q");
  if (!orderId) blockers.push("Javobda `parcel.external_order_id` yo'q");

  const tokenCheck = checkMarketplaceToken(p.qr_token);
  if (!tokenCheck.valid) blockers.push(`QR token yaroqsiz: ${tokenCheck.reason}`);

  // ── Ko'p qutili posilka (qaror O1) ──
  let idx = n(p.parcel_index);
  let cnt = n(p.parcel_count);
  if (!Number.isFinite(idx) || idx < 1) idx = 1;
  if (!Number.isFinite(cnt) || cnt < 1) cnt = 1;
  if (idx > cnt) {
    blockers.push(`Quti raqami noto'g'ri: ${idx}/${cnt}`);
  }

  // ── Sotuvchi ──
  const sellerId = s(seller.seller_id) || null;
  if (!sellerId) {
    // ⚠️ Bloker EMAS, ogohlantirish: pulni keyin taqsimlab bo'lmaydi, lekin
    // ombordagi operatorni to'xtatib qo'yish noto'g'ri. Panelda ko'rinadi.
    warnings.push("Sotuvchi ID si yo'q — pul attributsiyasi bo'lmaydi");
  }

  // ── Mijoz ──
  const phone = normalizeUzPhone(cust.phone);
  if (!phone) {
    blockers.push(
      `Mijoz telefoni yaroqsiz yoki yo'q (kelgani: "${s(cust.phone) || '—'}")`,
    );
  }
  const districtSato = s(cust.district_sato);
  if (!districtSato) blockers.push("Tuman SOATO kodi yo'q");

  const customerName = s(cust.full_name) || 'Marketplace mijozi';
  if (!s(cust.full_name)) warnings.push("Mijoz ismi yo'q");

  const address = s(cust.address) || null;
  if (!address) warnings.push("Manzil yo'q");

  // ── Pul ──
  const productAmount = n(money.product_amount);
  const deliveryAmount = n(money.delivery_amount);
  const codAmount = n(money.cod_amount);
  const prepaid = money.prepaid === true;

  if (!Number.isFinite(productAmount) || productAmount < 0) {
    blockers.push("Mahsulot summasi noto'g'ri");
  }
  if (!Number.isFinite(codAmount) || codAmount < 0) {
    blockers.push("COD summasi noto'g'ri");
  }
  // ⚠️ Prepaid BO'LMAGAN posilkada COD 0 bo'lishi — xato belgisi.
  // Bugungi kodda bunday buyurtma yaratiladi va sotuvda market hamda
  // kuryer kassasidan tarif YECHILADI (§15 #8).
  if (!prepaid && Number.isFinite(codAmount) && codAmount === 0) {
    blockers.push(
      "COD summasi 0, lekin posilka prepaid deb belgilanmagan — noaniq holat",
    );
  }
  // Faqat BIRINCHI qutida pul bo'lishi kerak (qaror O1).
  if (cnt > 1 && idx > 1 && Number.isFinite(codAmount) && codAmount > 0) {
    warnings.push(
      `Ko'p qutili buyurtmaning ${idx}-qutisida COD bor (${codAmount}) — pul faqat 1-qutida bo'lishi kerak`,
    );
  }

  // ── Yetkazish turi ──
  const wdRaw = s(p.where_deliver || root.where_deliver).toLowerCase();
  const whereDeliver: 'center' | 'address' =
    wdRaw === 'address' || wdRaw === 'home' ? 'address' : 'center';
  if (wdRaw && !['center', 'address', 'home'].includes(wdRaw)) {
    warnings.push(`Noma'lum yetkazish turi "${wdRaw}" — «markaz» deb olindi`);
  }

  // ── Mahsulotlar ──
  const rawItems = Array.isArray(root.items) ? root.items : [];
  const items = rawItems.map((it: Record<string, any>) => ({
    sku: s(it?.sku) || null,
    name: s(it?.name) || 'Noma\'lum mahsulot',
    quantity: Math.max(1, n(it?.quantity) || 1),
    unit_price: Math.max(0, n(it?.unit_price) || 0),
  }));
  if (items.length === 0 && codAmount > 0) {
    // Kontraktda `items[]` MUST — qisman sotuv uchun kerak (qaror O2).
    warnings.push("Mahsulotlar ro'yxati yo'q — qisman sotuv ishlamaydi");
  }

  if (blockers.length > 0) {
    return { parcel: null, blockers, warnings };
  }

  return {
    parcel: {
      external_parcel_id: parcelId,
      external_order_id: orderId,
      qr_token_raw: tokenCheck.raw,
      qr_token_norm: tokenCheck.norm,
      parcel_index: idx,
      parcel_count: cnt,
      remote_status: s(p.status) || null,
      seller_id: sellerId,
      seller_name: s(seller.seller_name) || null,
      customer_name: customerName,
      phone: phone as string,
      extra_phone: normalizeUzPhone(cust.additional_phone),
      district_sato: districtSato,
      address,
      comment: s(cust.comment) || null,
      product_amount: productAmount,
      delivery_amount: Number.isFinite(deliveryAmount) ? Math.max(0, deliveryAmount) : 0,
      cod_amount: codAmount,
      prepaid,
      where_deliver: whereDeliver,
      items,
    },
    blockers,
    warnings,
  };
}
