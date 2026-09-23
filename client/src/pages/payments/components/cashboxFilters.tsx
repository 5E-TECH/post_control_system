import { memo, useMemo } from "react";
import { Select } from "antd";
import { FilterX } from "lucide-react";
import { sourceTypeLabel } from "../../../shared/const/source-type-labels";

/**
 * KASSA TARIXI FILTRLARI.
 *
 * ── ASOSIY QOIDA: VARIANTLAR MA'LUMOTDAN QURILADI ───────────────────────
 *
 * Ro'yxatlar qattiq yozilgan enum yoki global ro'yxatdan EMAS, ekranda
 * turgan qatorlarning O'ZIDAN yig'iladi.
 *
 * ⚠️ NEGA BU MUHIM. `payments/index.tsx` dagi global ro'yxatda `sell`,
 * `cancel`, `extra_cost` bor — lekin ular ASOSIY kassaga hech qachon
 * tushmaydi (sotuv market/kuryer kassasida bo'ladi). O'sha ro'yxat
 * ko'chirilsa, admin «Sotuv» ni tanlab bo'sh natija olardi va filtr
 * buzuq deb o'ylardi.
 *
 * Teskari xavf ham yopiladi: bazada TS enumida yo'q qiymatlar bor
 * (`investor_allocate` — 5 qator). Ma'lumotdan qurilgani uchun ular
 * ro'yxatga O'ZI tushadi.
 */

/** `null` qiymatli maydonlar uchun maxsus kalit. */
export const UNSET = "__unset__";

export interface CashboxFilterState {
  types: string[];
  directions: string[];
  methods: string[];
  cardIds: string[];
}

export const EMPTY_FILTERS: CashboxFilterState = {
  types: [],
  directions: [],
  methods: [],
  cardIds: [],
};

export const hasActiveFilters = (f: CashboxFilterState): boolean =>
  f.types.length > 0 ||
  f.directions.length > 0 ||
  f.methods.length > 0 ||
  f.cardIds.length > 0;

const METHOD_LABELS: Record<string, string> = {
  cash: "Naqd",
  click: "Click",
  click_to_market: "Marketga Click",
  [UNSET]: "Belgilanmagan",
};

const DIRECTION_LABELS: Record<string, string> = {
  income: "Kirim",
  expense: "Chiqim",
};

/** Ekrandagi qatorlarda HAQIQATAN uchraydigan qiymatlar + har birining soni. */
function optionsFrom(
  rows: any[],
  key: string,
  label: (v: string) => string,
  allowUnset = false,
) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const raw = r?.[key];
    const v = raw === null || raw === undefined || raw === "" ? UNSET : String(raw);
    if (v === UNSET && !allowUnset) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, n]) => ({ value, label: `${label(value)} (${n})` }));
}

interface Props {
  /** Filtrlanmagan to'liq ro'yxat — variantlar shundan quriladi. */
  rows: any[];
  /** Kassa kartalari (nom ko'rsatish uchun). */
  cards?: any[];
  value: CashboxFilterState;
  onChange: (next: CashboxFilterState) => void;
}

const CashboxFilters: React.FC<Props> = ({ rows, cards = [], value, onChange }) => {
  const cardName = useMemo(() => {
    const m = new Map<string, string>(
      (cards || []).map((c: any) => [String(c.id), c.name || "Karta"]),
    );
    return (id: string) => (id === UNSET ? "Belgilanmagan" : m.get(id) || "Karta");
  }, [cards]);

  const typeOpts = useMemo(
    () => optionsFrom(rows, "source_type", sourceTypeLabel),
    [rows],
  );
  const dirOpts = useMemo(
    () => optionsFrom(rows, "operation_type", (v) => DIRECTION_LABELS[v] || v),
    [rows],
  );
  /**
   * ⚠️ `allowUnset` — to'lov usuli va karta uchun MAJBURIY.
   * Asosiy kassada `payment_method` 4 qatorda, `card_id` esa 68 qatorda
   * bo'sh. «Belgilanmagan» varianti bo'lmasa ular filtr orqali
   * umuman yetib bo'lmaydigan bo'lib qolardi.
   */
  const methodOpts = useMemo(
    () => optionsFrom(rows, "payment_method", (v) => METHOD_LABELS[v] || v, true),
    [rows],
  );
  const cardOpts = useMemo(
    () => optionsFrom(rows, "card_id", cardName, true),
    [rows, cardName],
  );

  const active = hasActiveFilters(value);

  const common = {
    mode: "multiple" as const,
    allowClear: true,
    maxTagCount: "responsive" as const,
    className: "min-w-[150px] flex-1 sm:flex-none sm:w-[190px]",
    size: "middle" as const,
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        {...common}
        placeholder="Amal turi"
        options={typeOpts}
        value={value.types}
        onChange={(v) => onChange({ ...value, types: v })}
      />
      <Select
        {...common}
        className="min-w-[130px] flex-1 sm:flex-none sm:w-[150px]"
        placeholder="Yo'nalish"
        options={dirOpts}
        value={value.directions}
        onChange={(v) => onChange({ ...value, directions: v })}
      />
      <Select
        {...common}
        placeholder="To'lov usuli"
        options={methodOpts}
        value={value.methods}
        onChange={(v) => onChange({ ...value, methods: v })}
      />
      <Select
        {...common}
        placeholder="Karta"
        options={cardOpts}
        value={value.cardIds}
        onChange={(v) => onChange({ ...value, cardIds: v })}
      />

      {active && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <FilterX className="w-4 h-4" />
          Tozalash
        </button>
      )}
    </div>
  );
};

/**
 * Filtrni qatorlarga qo'llash.
 *
 * ⚠️ Bo'sh massiv = «hammasi», FILTR YO'Q degani. Aks holda sahifa
 * ochilganda hech narsa ko'rinmasdi.
 */
export function applyCashboxFilters(
  rows: any[],
  f: CashboxFilterState,
): any[] {
  if (!hasActiveFilters(f)) return rows;
  const norm = (v: any) =>
    v === null || v === undefined || v === "" ? UNSET : String(v);

  return (rows || []).filter((r) => {
    if (f.types.length && !f.types.includes(norm(r?.source_type))) return false;
    if (f.directions.length && !f.directions.includes(norm(r?.operation_type)))
      return false;
    if (f.methods.length && !f.methods.includes(norm(r?.payment_method)))
      return false;
    if (f.cardIds.length && !f.cardIds.includes(norm(r?.card_id))) return false;
    return true;
  });
}

export default memo(CashboxFilters);
