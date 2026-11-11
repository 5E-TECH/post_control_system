import { Replacement_state } from 'src/common/enums';

/**
 * Carrier API'da tashqi kompaniyaga qaytadigan buyurtma ko'rinishi.
 *
 * ⚠️ NEGA `OrderEntity` QAYTARILMAYDI. Buyurtma qatorida o'nlab ichki maydon
 * bor: tariflar (`market_tariff`, `courier_tariff`), market hisob-kitobi
 * (`market_net`, `to_be_paid`), operator, `control_owner`, Telegram xabar
 * id'lari va h.k. Ular (a) tashqi kompaniyaga tegishli emas — masalan
 * market tarifi BeePost marjasini ochib beradi — va (b) ichki refaktorda
 * o'zgaradi, tashqi integratsiya esa barqaror kontraktga muhtoj. Shu sababli
 * bu yerda ANIQ ro'yxat (allowlist): yangi ichki maydon o'z-o'zidan
 * tashqariga chiqmaydi.
 *
 * Maydonlar Elchi `apps/api-gateway/src/carrier-order-view.ts`
 * (`CarrierOrderView`) bilan AYNAN bir xil — kompaniya ikkala tizimga bitta
 * kod yozadi. BeePost farqlari (`CARRIER_API.md`, "BeePost profili"):
 *   - id'lar UUID;
 *   - oldindan onlayn to'lov yo'q → `paid_online_amount` doim 0,
 *     `cod_amount = total_price`;
 *   - viloyat buyurtmada saqlanmaydi — tumanning MA'MURIY viloyatidan
 *     (`district.region_id`, `assigned_region` EMAS) olinadi;
 *   - bitta bazali monolit: Elchi'dagi "boyitish to'liq emas → 503" holati
 *     yo'q, yetishmagan bog'lanish shunchaki `null` bo'ladi.
 */
export type CarrierOrderView = {
  id: string;
  order_number: string | null;
  qr_token: string | null;
  parent_order_id: string | null;
  status: string;
  /** Buyurtma summasi (so'm). */
  total_price: number;
  /** Oldindan onlayn to'langan qism — BeePost'da doim 0. */
  paid_online_amount: number;
  /** Mijozdan naqd olinadigan summa = total_price − paid_online_amount. */
  cod_amount: number;
  where_deliver: string | null;
  address: string | null;
  comment: string | null;
  customer: {
    name: string | null;
    phone_number: string | null;
    extra_number: string | null;
  } | null;
  /** Viloyat va tuman — NOM EMAS, rasmiy SOATO kodi bilan (Elchi qarori). */
  region: CarrierGeoRef | null;
  district: CarrierGeoRef | null;
  market: { id: string; name: string | null } | null;
  /**
   * Almashtirish buyurtmasi yoki `null`. `old_item_required: true` bo'lsa
   * sotuvda `old_item_collected: true` SHART (aks holda 400).
   */
  replacement: CarrierReplacement | null;
  items: Array<{
    id: string;
    product_id: string | null;
    name: string | null;
    quantity: number;
  }>;
  created_at: string | null;
};

/** Viloyat/tuman: BeePost id va rasmiy SOATO kodi (`sato_code` ustuni). */
export type CarrierGeoRef = { id: string; soato_code: string | null };

export type CarrierReplacement = {
  /** Qaysi buyurtma o'rniga (eski buyurtma id). */
  of_order_id: string;
  /** Eski mahsulot hali olinmagan — sotishda `old_item_collected: true` shart. */
  old_item_required: boolean;
};

/**
 * Ko'rinish quriladigan manba — `OrderEntity` (kerakli bog'lanishlar bilan)
 * strukturaviy mos keladi. Hamma maydon ixtiyoriy: so'rovda bog'lanish
 * yuklanmagan bo'lsa ham ko'rinish yiqilmaydi (maydon `null` bo'ladi).
 */
export type CarrierGeoSource = {
  id?: string | null;
  sato_code?: string | null;
  region?: CarrierGeoSource | null;
};

export type CarrierOrderSource = {
  id: string;
  order_number?: number | string | null;
  qr_code_token?: string | null;
  parent_order_id?: string | null;
  status?: string | null;
  total_price?: number | string | null;
  where_deliver?: string | null;
  address?: string | null;
  comment?: string | null;
  district_id?: string | null;
  replacement_of_order_id?: string | null;
  replacement_state?: string | null;
  created_at?: number | string | Date | null;
  customer?: {
    name?: string | null;
    phone_number?: string | null;
    extra_number?: string | null;
    address?: string | null;
    district?: CarrierGeoSource | null;
  } | null;
  district?: CarrierGeoSource | null;
  market?: { id?: string | null; name?: string | null } | null;
  items?: Array<{
    id?: string | null;
    productId?: string | null;
    quantity?: number | string | null;
    created_at?: number | string | null;
    product?: { name?: string | null } | null;
  }> | null;
};

/**
 * Eski mahsulot olingan yoki marketga qaytarilgan — sotishda tasdiq endi
 * kerak EMAS (Elchi `REPLACEMENT_DONE_STATES` bilan bir xil qoida).
 */
const REPLACEMENT_DONE_STATES: ReadonlySet<string> = new Set([
  Replacement_state.OLD_COLLECTED,
  Replacement_state.OLD_RETURNED,
]);

const str = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? t : null;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return null;
};

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Viloyat/tuman → `{ id, soato_code }`. Nom ATAYLAB chiqmaydi.
 *
 * Faqat haqiqiy SOATO (viloyat 4 xona, tuman 7 xona). Bazada `sato_code`
 * ixtiyoriy va qo'lda kiritilgan, eski backfill'dan qolgan noto'g'ri
 * qiymatlar bo'lishi mumkin — ular tashqariga "SOATO" bo'lib chiqmasin:
 * `soato_code: null` (kod noma'lum, kompaniya `id` dan foydalanadi).
 */
const geoRef = (
  value: CarrierGeoSource | null | undefined,
  digits: 4 | 7,
): CarrierGeoRef | null => {
  if (!value || typeof value !== 'object') return null;
  const id = str(value.id);
  if (!id) return null;
  const code = str(value.sato_code);
  const pattern = digits === 4 ? /^\d{4}$/ : /^\d{7}$/;
  return { id, soato_code: code !== null && pattern.test(code) ? code : null };
};

/** Epoch ms (bigint transformer → number, xom so'rovda satr) yoki Date → ISO. */
export const isoFromEpoch = (value: unknown): string | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const ms =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Almashtirish buyurtmasini sotishda eski mahsulot tasdig'i hali kerakmi.
 * `CarrierService` ham shu funksiyadan foydalanadi — ko'rinishdagi
 * `old_item_required` va sotuvdagi tekshiruv BITTA qoidadan chiqsin.
 */
export function isOldItemRequired(order: {
  replacement_of_order_id?: string | null;
  replacement_state?: string | null;
}): boolean {
  if (!str(order.replacement_of_order_id)) return false;
  const state = (str(order.replacement_state) ?? '').toLowerCase();
  return !REPLACEMENT_DONE_STATES.has(state);
}

const replacementOf = (
  order: CarrierOrderSource,
): CarrierReplacement | null => {
  const ofOrderId = str(order.replacement_of_order_id);
  if (!ofOrderId) return null;
  return {
    of_order_id: ofOrderId,
    old_item_required: isOldItemRequired(order),
  };
};

export function toCarrierOrderView(
  order: CarrierOrderSource,
): CarrierOrderView {
  // ⚠️ BeePost'da oldindan onlayn to'lov tushunchasi yo'q: kuryer yig'adigan
  // naqd = buyurtma summasi (marketplace intake ham shu ma'noda yozadi).
  const total = num(order.total_price);
  const customer =
    order.customer && typeof order.customer === 'object'
      ? order.customer
      : null;

  /**
   * Tuman: buyurtmaning o'zidagi tuman, bo'lmasa mijoz tumani.
   *
   * Qisman sotuvdan ajralgan bola buyurtmada `district_id` va `address`
   * YO'Q (`partlySold` ularni ko'chirmaydi) — shuning uchun mijozga qaytamiz,
   * aks holda bola posilkada viloyat/tuman jimgina `null` bo'lardi.
   * `district_id` bor-u bog'lanish yuklanmagan bo'lsa — mijozga O'TMAYMIZ
   * (boshqa tuman ko'rsatilib qolmasin), `null` qaytadi.
   */
  const districtSource =
    order.district ??
    (str(order.district_id) ? null : (customer?.district ?? null));

  const items = Array.isArray(order.items)
    ? order.items
        .filter((item) => !!item && typeof item === 'object')
        // Barqaror tartib: qator yaratilgan vaqt, keyin id.
        .slice()
        .sort(
          (a, b) =>
            num(a.created_at) - num(b.created_at) ||
            String(a.id ?? '').localeCompare(String(b.id ?? '')),
        )
    : [];

  return {
    id: str(order.id) ?? '',
    order_number: str(order.order_number),
    qr_token: str(order.qr_code_token),
    parent_order_id: str(order.parent_order_id),
    status: str(order.status) ?? '',
    total_price: total,
    paid_online_amount: 0,
    cod_amount: total,
    where_deliver: str(order.where_deliver),
    address: str(order.address) ?? str(customer?.address),
    comment: str(order.comment),
    customer: customer
      ? {
          name: str(customer.name),
          phone_number: str(customer.phone_number),
          extra_number: str(customer.extra_number),
        }
      : null,
    region: geoRef(districtSource?.region, 4),
    district: geoRef(districtSource, 7),
    market:
      order.market && str(order.market.id)
        ? { id: str(order.market.id) as string, name: str(order.market.name) }
        : null,
    replacement: replacementOf(order),
    items: items.map((item) => ({
      id: str(item.id) ?? '',
      product_id: str(item.productId),
      name: str(item.product?.name),
      quantity: num(item.quantity),
    })),
    created_at: isoFromEpoch(order.created_at),
  };
}
