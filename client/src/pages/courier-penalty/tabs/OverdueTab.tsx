import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useCourierPenaltyAdmin } from "../../../shared/api/hooks/useCourierPenalty";
import { formatSum } from "../../../shared/lib/deadlineTone";

/**
 * KECHIKKANLAR — MODULNING ENG MUHIM EKRANI.
 *
 * ⚠️ Shtraf faqat kuryer tugmani BOSGANDA yoziladi, asosiy muammo esa
 * UMUMAN BOSMASLIK: hech qachon bosmagan kuryer hech narsa to'lamaydi.
 * Ya'ni bu ro'yxat qulaylik emas — usiz modul eng intizomli kuryerni
 * jazolab, eng beparvosini tegmay qo'yardi.
 *
 * Tartib «kimga birinchi qo'ng'iroq qilish kerak» degan savolga javob
 * beradi: eng uzoq kechikkan yuqorida.
 */
const OverdueTab = () => {
  const { t } = useTranslation("penalty");
  const [minDays, setMinDays] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const { getOverdue } = useCourierPenaltyAdmin();
  const { data, isLoading } = getOverdue({ minDays });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">…</div>;
  if (!data?.couriers?.length)
    return (
      /*
        ⚠️ Bo'sh ro'yxat bu yerda YAXSHI XABAR — umumiy «No data found»
        rasmini ko'rsatish adminni «ma'lumot yuklanmadimi?» deb
        o'ylatardi. Shuning uchun alohida, ijobiy matn.
      */
      <div className="flex flex-col items-center gap-2 rounded-xl border border-green-200 bg-green-50 py-10 dark:border-green-800 dark:bg-green-900/20">
        <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
        <p className="text-sm font-medium text-green-800 dark:text-green-300">
          {t("overdue.empty")}
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Xulosa + filtr */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-gray-600 dark:text-gray-300">
            {t("overdue.couriers")}:{" "}
            <b className="tabular-nums">{data.summary.couriers}</b>
          </span>
          <span className="text-gray-600 dark:text-gray-300">
            {t("overdue.orders")}:{" "}
            <b className="tabular-nums">{data.summary.orders}</b>
          </span>
          <span className="text-red-600 dark:text-red-400">
            {t("overdue.penaltyNow")}:{" "}
            <b className="tabular-nums">{formatSum(data.summary.penalty_now)}</b>{" "}
            {t("currency")}
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          {t("overdue.minDays")}
          <select
            value={minDays}
            onChange={(e) => setMinDays(Number(e.target.value))}
            className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-gray-700 dark:bg-[#2A263D]"
          >
            {[0, 1, 3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      {data.couriers.map((c) => {
        const expanded = open === c.courier_id;
        return (
          <div
            key={c.courier_id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#2A263D]"
          >
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : c.courier_id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#332D4A]"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              )}

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-800 dark:text-white">
                  {c.courier_name || "—"}
                </div>
                {c.courier_phone && (
                  <a
                    href={`tel:${c.courier_phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 dark:text-gray-400"
                  >
                    <Phone className="h-3 w-3" />
                    {c.courier_phone}
                  </a>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                  {c.overdue_count} {t("overdue.pcs")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 tabular-nums dark:bg-red-900/30 dark:text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  {c.oldest_late_days} {t("overdue.days")}
                </span>
                {c.penalty_now > 0 && (
                  <span className="rounded-lg bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600 tabular-nums dark:text-red-400">
                    {formatSum(c.penalty_now)}
                  </span>
                )}
              </div>
            </button>

            {expanded && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-[#231F35] dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2 text-left">{t("order")}</th>
                      <th className="px-4 py-2 text-left">{t("market")}</th>
                      <th className="px-4 py-2 text-right">{t("overdue.lateDays")}</th>
                      <th className="px-4 py-2 text-right">{t("overdue.penalty")}</th>
                      <th className="px-4 py-2 text-right">{t("overdue.cap")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {c.orders.map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-white">
                          #{o.order_number ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                          {o.market_name || "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                          {o.late_days}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">
                          {o.immune ? (
                            /*
                              ⚠️ Modul yoqilishidan OLDIN jo'natilgan —
                              shtrafga tushmaydi. Buni ko'rsatmasak admin
                              «nega bunga shtraf yo'q» deb hayron bo'lardi.
                            */
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-400"
                              title={t("overdue.immuneHint")}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {t("overdue.immune")}
                            </span>
                          ) : (
                            `${formatSum(o.penalty_now)} ${t("currency")}`
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                          {formatSum(o.base_tariff)}
                          {o.capped && (
                            <span className="ml-1 text-amber-600 dark:text-amber-400">
                              ●
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default memo(OverdueTab);
