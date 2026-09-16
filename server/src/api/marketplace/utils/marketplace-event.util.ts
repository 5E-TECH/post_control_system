import { MarketplaceEventType } from '../marketplace.enums';

/**
 * CHIQUVCHI HODISA KONVERTI (kontrakt §4.4).
 *
 * ⚠️ NEGA SOF FUNKSIYA. Konvert shakli — kontraktning o'zi. U servis ichida
 * qurilsa, har hodisa turida biroz boshqacha bo'lib ketadi va marketplace
 * tomonda «ba'zan `money` bor, ba'zan yo'q» degan holat tug'iladi. Bu yerda
 * shakl BITTA joyda va sinaladi.
 *
 * `sent_at` ATAYLAB yo'q — uni WORKER yuborish paytida qo'yadi. Navbatda
 * 2 soat turgan hodisaning `sent_at` i enqueue vaqti bo'lishi noto'g'ri
 * bo'lardi.
 */

export interface EventMoney {
  currency: 'UZS';
  product_amount?: number;
  delivery_amount?: number;
  collected_from_customer?: number;
  /** Kelishilgan TO'LIQ tarif (qaror P12 — komissiya tizimda yo'q). */
  beepost_fee?: number;
  beepost_fee_basis?: 'center' | 'home';
  tariff_version?: number;
  extra_cost?: number;
  prepaid?: boolean;
  /** `COD − beepost_fee − extra_cost`. MANFIY bo'lishi MUMKIN (prepaid). */
  net_to_marketplace?: number;
  /** Qisman sotuv uchun. */
  delivered_amount?: number;
  returned_amount?: number;
}

export interface BuildEventInput {
  event_id: string;
  seq: number;
  event_type: MarketplaceEventType;
  occurred_at: number;
  integration_slug: string;
  parcel: {
    external_parcel_id: string;
    external_order_id: string;
    seller_id: string | null;
    beepost_order_id?: string | null;
    beepost_order_number?: number | null;
  };
  status?: { from: string | null; to: string };
  money?: EventMoney;
  ledger?: { entry_id: string; balance_after: number };
  actor?: { type: string; name?: string | null };
  items_delivered?: Array<{ sku: string | null; quantity: number }>;
  items_returned?: Array<{ sku: string | null; quantity: number }>;
  note?: string | null;
  reason?: string | null;
}

/**
 * ⚠️ `undefined` maydonlar TASHLANADI — `JSON.stringify` ularni baribir
 * olib tashlaydi, lekin biz imzoni AYNI SATRDAN quramiz. Shakl oldindan
 * tozalansa, «imzoda bor, tanada yo'q» holati umuman yuzaga kelmaydi.
 */
export function buildEventEnvelope(
  input: BuildEventInput,
): Record<string, unknown> {
  const env: Record<string, unknown> = {
    event_id: input.event_id,
    seq: input.seq,
    event_type: input.event_type,
    occurred_at: input.occurred_at,
    integration: input.integration_slug,
    parcel: prune({
      external_parcel_id: input.parcel.external_parcel_id,
      external_order_id: input.parcel.external_order_id,
      seller_id: input.parcel.seller_id ?? undefined,
      beepost_order_id: input.parcel.beepost_order_id ?? undefined,
      beepost_order_number: input.parcel.beepost_order_number ?? undefined,
    }),
  };

  if (input.status) {
    env.status = prune({ from: input.status.from ?? undefined, to: input.status.to });
  }
  if (input.money) env.money = prune({ ...input.money });
  if (input.ledger) env.ledger = input.ledger;
  if (input.actor) env.actor = prune({ ...input.actor });
  if (input.items_delivered) env.items_delivered = input.items_delivered;
  if (input.items_returned) env.items_returned = input.items_returned;
  if (input.note) env.note = input.note;
  if (input.reason) env.reason = input.reason;

  return env;
}

function prune(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/**
 * PUL HISOBI — kontrakt §7.3 formulasi.
 *
 *   net_to_marketplace = collected_from_customer − beepost_fee − extra_cost
 *
 * ⚠️ MANFIY natija NORMAL: prepaid posilkada (`COD = 0`) tarif baribir
 * olinadi va marketplace BIZGA qarzdor bo'ladi (reja §7.10). Shu sabab bu
 * yerda `Math.max(0, ...)` YO'Q — u bo'lsa prepaid yo'li jimgina buzilardi.
 */
export function computeNetToMarketplace(params: {
  collected_from_customer: number;
  beepost_fee: number;
  extra_cost?: number;
}): number {
  return (
    Math.trunc(params.collected_from_customer) -
    Math.trunc(params.beepost_fee) -
    Math.trunc(params.extra_cost ?? 0)
  );
}

/**
 * QAYTA URINISH JADVALI (kontrakt §9).
 *
 * ⚠️ Mavjud `integration_sync_queue` 3 urinish × (1m/5m/15m) = jami ~6 daqiqa
 * beradi. Marketplace deployi shundan uzoq bo'lsa BUTUN OYNA yo'qolardi.
 * Bu yerda 8 urinish, ~4 soatgacha.
 */
const BACKOFF_MS = [
  0,
  60_000,      // 1 daqiqa
  5 * 60_000,  // 5 daqiqa
  15 * 60_000, // 15 daqiqa
  30 * 60_000, // 30 daqiqa
  60 * 60_000, // 1 soat
  2 * 60 * 60_000,
  4 * 60 * 60_000,
];

export function nextRetryDelayMs(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}
