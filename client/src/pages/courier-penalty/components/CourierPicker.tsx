import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Search, ShieldOff, X } from "lucide-react";
import type { PenaltyCourier } from "../../../shared/api/hooks/useCourierPenalty";

/**
 * KURYER TANLASH — BIR QOIDAGA KO'P KURYER.
 *
 * ⚠️ NEGA `<select>` EMAS. Ilgari qamrov faqat «hammaga» yoki BITTA
 * kuryer bo'lardi va tanlov oddiy `<select>` edi. Bir nechta kuryerga
 * bir xil qoida kerak bo'lsa, admin AYNI qoidani har kuryer uchun
 * qaytadan yaratishga majbur edi — o'nta kuryer = o'nta qator, va
 * birini o'zgartirish kerak bo'lganda qolgan to'qqiztasi unutilardi.
 *
 * ⚠️ «HAMMASINI TANLASH» QIDIRUV NATIJASIGA QO'LLANADI. Shunchaki
 * «hammasi» tugmasi bo'lsa u global qoidaning takroriga aylanardi;
 * qidiruv bilan birga esa u haqiqiy ish quroli bo'ladi («Ali» deb
 * qidirib, topilganlarni bir bosishda belgilash).
 */
const CourierPicker = ({
  couriers,
  value,
  onChange,
}: {
  couriers: PenaltyCourier[];
  value: string[];
  onChange: (next: string[]) => void;
}) => {
  const { t } = useTranslation("penalty");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return couriers;
    return couriers.filter((c) =>
      `${c.name ?? ""} ${c.phone_number ?? ""}`.toLowerCase().includes(needle),
    );
  }, [couriers, q]);

  const selected = useMemo(() => new Set(value), [value]);
  const filteredIds = filtered.map((c) => c.id);
  const allFilteredPicked =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const toggleFiltered = () => {
    const next = new Set(selected);
    if (allFilteredPicked) filteredIds.forEach((id) => next.delete(id));
    else filteredIds.forEach((id) => next.add(id));
    onChange([...next]);
  };

  const picked = couriers.filter((c) => selected.has(c.id));

  return (
    <div className="rounded-xl border border-gray-300 dark:border-gray-600">
      {/* Qidiruv + ommaviy tanlash */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <div className="relative min-w-[11rem] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("rules.searchCourier")}
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-7 pr-2 text-sm dark:border-gray-700 dark:bg-[#231F35] dark:text-white"
          />
        </div>
        <button
          type="button"
          onClick={toggleFiltered}
          disabled={!filteredIds.length}
          className="h-9 shrink-0 rounded-lg border border-gray-300 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {allFilteredPicked ? t("rules.unpickAll") : t("rules.pickAll")}
        </button>
      </div>

      {/* Tanlanganlar — chiplar bilan, chunki ro'yxat uzun bo'lsa
          belgilanganlar ko'rinmay qoladi. */}
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          {picked.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-lg bg-purple-100 py-0.5 pl-2 pr-1 text-xs font-medium text-purple-700 dark:bg-purple-500/20 dark:text-purple-200"
            >
              {c.name}
              <button
                type="button"
                onClick={() => toggle(c.id)}
                aria-label={`${c.name} — ${t("rules.remove")}`}
                className="rounded p-0.5 hover:bg-purple-200 dark:hover:bg-purple-500/30"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400"
          >
            {t("rules.clear")}
          </button>
        </div>
      )}

      {/* Ro'yxat */}
      <div className="max-h-56 overflow-y-auto">
        {!filtered.length && (
          <p className="px-3 py-6 text-center text-sm text-gray-400">
            {t("rules.noCourierFound")}
          </p>
        )}
        {filtered.map((c) => {
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              aria-pressed={on}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                on ? "bg-purple-50/60 dark:bg-purple-500/10" : ""
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  on
                    ? "border-purple-500 bg-purple-500 text-white"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {on && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-gray-800 dark:text-gray-100">
                  {c.name || "—"}
                </span>
                <span className="block text-xs text-gray-500 tabular-nums dark:text-gray-400">
                  {c.phone_number}
                </span>
              </span>
              {/*
                ⚠️ Istisno qilingan kuryer BELGILANADI. Uni qoidaga
                qo'shish mumkin, lekin shtraf baribir yozilmaydi — buni
                ko'rsatmasak admin «nega bu kuryerga tegmadi» deb
                qoidadan xato izlardi.
              */}
              {c.penalty_exempt && (
                <span
                  title={t("rules.exemptHint")}
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                >
                  <ShieldOff className="h-3 w-3" />
                  {t("rules.exempt")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-gray-200 px-3 py-1.5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {t("rules.pickedCount", { count: picked.length })}
      </div>
    </div>
  );
};

export default memo(CourierPicker);
