'use strict';

/**
 * SINOV MA'LUMOTLARI — har bir posilka rejadagi aniq bir chekka holatni qoplaydi.
 *
 * Bu ro'yxat tasodifiy emas: `docs/integrations/14-marketplace-beepost.md` §15
 * dagi ehtimoliy holatlar katalogidan olingan. Har posilkaning `_why` maydoni
 * nima sinalayotganini aytadi (u kontrakt maydoni EMAS — faqat mock uchun).
 */

const SELLERS = [
  { seller_id: 'SLR-77', name: 'Rustam Savdo MChJ', phone: '+998901112233', is_active: true },
  { seller_id: 'SLR-81', name: 'Nodira Butik', phone: '+998901112244', is_active: true },
  { seller_id: 'SLR-93', name: 'Texno Plus', phone: '+998901112255', is_active: true },
  { seller_id: 'SLR-99', name: "Yopilgan Do'kon", phone: '+998901112266', is_active: false },
];

/** Standart mijoz — har posilkada qayta yozilishi mumkin. */
const CUSTOMER = {
  full_name: 'Aliyev Vali',
  phone: '+998901234567',
  additional_phone: null,
  region_sato: '1727',
  district_sato: '1727401',
  address: "Toshkent sh., Yunusobod t., 4-mavze, 15-uy",
  comment: null,
};

const PARCELS = [
  // ── 1. ODDIY COD ────────────────────────────────────────────────────────
  {
    _why: 'Oddiy sotuv — asosiy yo\'l',
    external_parcel_id: 'PCL-8842-1',
    external_order_id: 'ORD-8842',
    qr_token: 'UZM-8842-1',
    parcel_index: 1,
    parcel_count: 1,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-77',
    customer: { ...CUSTOMER },
    money: { currency: 'UZS', product_amount: 180000, delivery_amount: 20000, cod_amount: 200000, prepaid: false },
    items: [
      { sku: 'SKU-1', name: 'Futbolka', quantity: 2, unit_price: 65000 },
      { sku: 'SKU-2', name: 'Shapka', quantity: 1, unit_price: 50000 },
    ],
    where_deliver: 'center',
  },

  // ── 2-4. KO'P QUTILI BUYURTMA (O1 qarori) ───────────────────────────────
  // Pul FAQAT birinchi posilkada. Uchalasi ham skanerlanmaguncha qabul
  // tugallanmasligi kerak.
  {
    _why: "Ko'p qutili: 1/3 — pul shu yerda",
    external_parcel_id: 'PCL-9100-1',
    external_order_id: 'ORD-9100',
    qr_token: 'UZM-9100-1',
    parcel_index: 1,
    parcel_count: 3,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-81',
    customer: { ...CUSTOMER, full_name: 'Karimova Dilnoza', phone: '+998907654321' },
    money: { currency: 'UZS', product_amount: 900000, delivery_amount: 0, cod_amount: 900000, prepaid: false },
    items: [{ sku: 'SKU-9', name: 'Divan (3 qism)', quantity: 1, unit_price: 900000 }],
    where_deliver: 'address',
  },
  {
    _why: "Ko'p qutili: 2/3 — pul 0",
    external_parcel_id: 'PCL-9100-2',
    external_order_id: 'ORD-9100',
    qr_token: 'UZM-9100-2',
    parcel_index: 2,
    parcel_count: 3,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-81',
    customer: { ...CUSTOMER, full_name: 'Karimova Dilnoza', phone: '+998907654321' },
    money: { currency: 'UZS', product_amount: 0, delivery_amount: 0, cod_amount: 0, prepaid: false },
    items: [],
    where_deliver: 'address',
  },
  {
    _why: "Ko'p qutili: 3/3 — pul 0",
    external_parcel_id: 'PCL-9100-3',
    external_order_id: 'ORD-9100',
    qr_token: 'UZM-9100-3',
    parcel_index: 3,
    parcel_count: 3,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-81',
    customer: { ...CUSTOMER, full_name: 'Karimova Dilnoza', phone: '+998907654321' },
    money: { currency: 'UZS', product_amount: 0, delivery_amount: 0, cod_amount: 0, prepaid: false },
    items: [],
    where_deliver: 'address',
  },

  // ── 5. PREPAID (P8) — net MANFIY bo'ladi ────────────────────────────────
  {
    _why: 'Prepaid: cod_amount=0 → net_to_marketplace MANFIY (−50 000)',
    external_parcel_id: 'PCL-9200-1',
    external_order_id: 'ORD-9200',
    qr_token: 'UZM-9200-1',
    parcel_index: 1,
    parcel_count: 1,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-81',
    customer: { ...CUSTOMER, full_name: 'Toshpo\'latov Sardor', phone: '+998933334455' },
    money: { currency: 'UZS', product_amount: 250000, delivery_amount: 0, cod_amount: 0, prepaid: true },
    items: [{ sku: 'SKU-3', name: 'Quloqchin', quantity: 1, unit_price: 250000 }],
    where_deliver: 'center',
  },

  // ── 6. COD TARIFDAN KAM — net manfiy (−20 000) ──────────────────────────
  {
    _why: 'COD (30 000) tarifdan (50 000) kam → net −20 000',
    external_parcel_id: 'PCL-9300-1',
    external_order_id: 'ORD-9300',
    qr_token: 'UZM-9300-1',
    parcel_index: 1,
    parcel_count: 1,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-93',
    customer: { ...CUSTOMER, full_name: 'Yusupov Bekzod', phone: '+998944445566' },
    money: { currency: 'UZS', product_amount: 30000, delivery_amount: 0, cod_amount: 30000, prepaid: false },
    items: [{ sku: 'SKU-4', name: 'Sim', quantity: 1, unit_price: 30000 }],
    where_deliver: 'center',
  },

  // ── 7. QISMAN SOTUV UCHUN (O2) — items[] majburiy ───────────────────────
  {
    _why: "Qisman sotuv: 3 mahsulotdan 2 tasi olinadi",
    external_parcel_id: 'PCL-9400-1',
    external_order_id: 'ORD-9400',
    qr_token: 'UZM-9400-1',
    parcel_index: 1,
    parcel_count: 1,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-77',
    customer: { ...CUSTOMER, full_name: 'Rahimova Malika', phone: '+998955556677' },
    money: { currency: 'UZS', product_amount: 200000, delivery_amount: 0, cod_amount: 200000, prepaid: false },
    items: [
      { sku: 'SKU-5', name: 'Ko\'ylak', quantity: 2, unit_price: 60000 },
      { sku: 'SKU-6', name: 'Kamar', quantity: 1, unit_price: 80000 },
    ],
    where_deliver: 'center',
  },

  // ── 8. ULARDA ALLAQACHON BEKOR QILINGAN (§15 #9) ────────────────────────
  // Skan qilinganda `VOIDED` qaytadi → PCS qabul qilmasligi SHART.
  {
    _why: 'VOIDED — ular bekor qilgan. PCS qabul QILMASLIGI shart',
    external_parcel_id: 'PCL-9500-1',
    external_order_id: 'ORD-9500',
    qr_token: 'UZM-9500-1',
    parcel_index: 1,
    parcel_count: 1,
    status: 'VOIDED',
    seller_id: 'SLR-77',
    customer: { ...CUSTOMER },
    money: { currency: 'UZS', product_amount: 100000, delivery_amount: 0, cod_amount: 100000, prepaid: false },
    items: [],
    where_deliver: 'center',
  },

  // ── 9. ARALASH REGISTRLI QR (§15 #5) ────────────────────────────────────
  // PCS token normalizatsiyasi ishlashini tekshiradi: yorliqda katta harf,
  // lekin keyingi skanerlar lowercase qidiradi.
  {
    _why: 'Aralash registrli QR — normalizatsiya sinovi',
    external_parcel_id: 'PCL-9600-1',
    external_order_id: 'ORD-9600',
    qr_token: 'UZM-9600-AbCdEf',
    parcel_index: 1,
    parcel_count: 1,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-93',
    customer: { ...CUSTOMER, full_name: 'Sobirov Jasur', phone: '+998966667788' },
    money: { currency: 'UZS', product_amount: 150000, delivery_amount: 15000, cod_amount: 165000, prepaid: false },
    items: [{ sku: 'SKU-7', name: 'Sumka', quantity: 1, unit_price: 150000 }],
    where_deliver: 'center',
  },

  // ── 10. NOMA'LUM SOTUVCHI (§15 — "noma'lum sotuvchi" bayrog'i) ──────────
  {
    _why: "Reestrda yo'q sotuvchi — PCS uni belgilashi kerak",
    external_parcel_id: 'PCL-9700-1',
    external_order_id: 'ORD-9700',
    qr_token: 'UZM-9700-1',
    parcel_index: 1,
    parcel_count: 1,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-UNKNOWN-404',
    customer: { ...CUSTOMER, full_name: 'Nomalum Sotuvchi Mijozi', phone: '+998977778899' },
    money: { currency: 'UZS', product_amount: 90000, delivery_amount: 0, cod_amount: 90000, prepaid: false },
    items: [],
    where_deliver: 'center',
  },

  // ── 11. UYGA YETKAZISH — 70 000 tarif (beepost_fee_basis='home') ────────
  {
    _why: "Uyga yetkazish — tarif 70 000, ortiqcha xarajat TAQIQLANGAN",
    external_parcel_id: 'PCL-9800-1',
    external_order_id: 'ORD-9800',
    qr_token: 'UZM-9800-1',
    parcel_index: 1,
    parcel_count: 1,
    status: 'READY_FOR_PICKUP',
    seller_id: 'SLR-81',
    customer: { ...CUSTOMER, full_name: 'Ergashev Oybek', phone: '+998988889900' },
    money: { currency: 'UZS', product_amount: 400000, delivery_amount: 70000, cod_amount: 470000, prepaid: false },
    items: [{ sku: 'SKU-8', name: 'Muzlatgich', quantity: 1, unit_price: 400000 }],
    where_deliver: 'address',
  },
];

module.exports = { SELLERS, PARCELS };
