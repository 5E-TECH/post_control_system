import { Source_type } from 'src/common/enums';
import { isoFromEpoch } from './carrier-order-view';

/**
 * Carrier API kassa ko'rinishi (`GET /api/v1/carrier/cashbox`).
 *
 * ⚠️ NEGA `cashbox_history` QATORI QAYTARILMAYDI. Ichki `my-cashbox`
 * javobida `createdByUser` / `sourceUser` (BeePost xodimining ismi va
 * TELEFONI), `created_by`, `source_user_id`, `card_id`, `payment_date`,
 * MAIN kassa naqd/karta ajratmasi bor. Ular tashqi kompaniyaga tegishli
 * emas. Bu yerda aniq ro'yxat (allowlist) — yangi ichki ustun tashqariga
 * o'z-o'zidan chiqmaydi.
 *
 * Maydonlar Elchi `apps/api-gateway/src/carrier-cashbox-view.ts` bilan AYNAN
 * bir xil. BeePost moslashuvi:
 *   - `rollback_correction` → `correction`: kontraktda rollback tuzatishi
 *     `correction` deb nomlangan (BeePost'da ichki sabab bilan ikki turga
 *     ajratilgan — `Source_type` izohiga qarang, tashqi kompaniya uchun bu
 *     farq ahamiyatsiz);
 *   - qolgan turlar (`sell`, `correction`, `extra_cost`, `courier_payment`,
 *     `courier_penalty`, `manual_*` ...) o'zgarishsiz — kontraktda ro'yxat
 *     OCHIQ;
 *   - `order_id` — UUID (Elchi'da `^\d+$`).
 */
export type CarrierCashboxEntry = {
  id: string;
  /** `income` — kassaga kirim, `expense` — chiqim. */
  type: string;
  /** Harakat manbai: `sell`, `correction`, `courier_payment`, … */
  source_type: string;
  amount: number;
  balance_after: number;
  /** Buyurtma bilan bog'liq qatorda — buyurtma id, aks holda null. */
  order_id: string | null;
  payment_method: string | null;
  comment: string | null;
  created_at: string | null;
};

export type CarrierCashboxView = {
  /** Joriy balans — kompaniya BeePost'ga topshirishi kerak bo'lgan summa. */
  balance: number;
  /** Tanlangan davrdagi jami kirim. */
  income: number;
  /** Tanlangan davrdagi jami chiqim. */
  outcome: number;
  history: CarrierCashboxEntry[];
};

/** `cashbox_history` qatori (kerakli ustunlar) — `CashboxHistoryEntity` mos keladi. */
export type CarrierCashboxHistorySource = {
  id?: string | null;
  operation_type?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  amount?: number | string | null;
  balance_after?: number | string | null;
  payment_method?: string | null;
  comment?: string | null;
  created_at?: number | string | Date | null;
};

/**
 * Bu manbalarda `source_id` — BUYURTMA id (sotuv, rollback tuzatishi,
 * qo'shimcha xarajat va uning qaytarilishi, kechikish shtrafi — hammasi
 * `source_id: order.id` yozadi). Boshqa manbalarda (`courier_payment`,
 * `manual_*` va h.k.) `source_id` bo'sh yoki boshqa ma'noda — tashqariga
 * chiqmaydi.
 */
const ORDER_SOURCE_TYPES: ReadonlySet<string> = new Set([
  Source_type.SELL,
  Source_type.CANCEL,
  Source_type.EXTRA_COST,
  Source_type.CORRECTION,
  Source_type.ROLLBACK_CORRECTION,
  Source_type.COURIER_PENALTY,
]);

/** Ichki tur → kontrakt turi. Ro'yxatda yo'q tur o'zgarishsiz o'tadi. */
const SOURCE_TYPE_ALIASES: Readonly<Record<string, string>> = {
  [Source_type.ROLLBACK_CORRECTION]: Source_type.CORRECTION,
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function toCarrierCashboxEntry(
  row: CarrierCashboxHistorySource,
): CarrierCashboxEntry {
  const rawSourceType = str(row.source_type) ?? '';
  const sourceId = str(row.source_id);
  return {
    id: str(row.id) ?? '',
    type: str(row.operation_type) ?? '',
    source_type: SOURCE_TYPE_ALIASES[rawSourceType] ?? rawSourceType,
    amount: num(row.amount),
    balance_after: num(row.balance_after),
    order_id:
      ORDER_SOURCE_TYPES.has(rawSourceType) &&
      sourceId &&
      UUID_RE.test(sourceId)
        ? sourceId.toLowerCase()
        : null,
    payment_method: str(row.payment_method),
    comment: str(row.comment),
    created_at: isoFromEpoch(row.created_at),
  };
}

/**
 * `balance` — kassaning JORIY balansi (oynaga bog'liq emas); `income` /
 * `outcome` — berilgan oynadagi qatorlar yig'indisi (Elchi `calcIncomeOutcome`
 * bilan bir xil: `income` bo'lmagan hamma narsa chiqim).
 */
export function toCarrierCashboxView(input: {
  balance: number | string | null | undefined;
  history: CarrierCashboxHistorySource[];
}): CarrierCashboxView {
  const rows = Array.isArray(input.history)
    ? input.history.filter((row) => !!row && typeof row === 'object')
    : [];
  let income = 0;
  let outcome = 0;
  for (const row of rows) {
    if (str(row.operation_type) === 'income') income += num(row.amount);
    else outcome += num(row.amount);
  }
  return {
    balance: num(input.balance),
    income,
    outcome,
    history: rows.map(toCarrierCashboxEntry),
  };
}
