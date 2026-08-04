import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Banknote, Wallet, TrendingUp, Layers, HandCoins } from "lucide-react";
import { useInvestor } from "../../../shared/api/hooks/useInvestor";
import StatCard from "../components/StatCard";
import DateRangeFilter from "../components/DateRangeFilter";
import { formatMoney } from "../components/format";

const fmtDate = (ms?: number) => {
  if (!ms) return "—";
  const d = new Date(Number(ms));
  return d.toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const InvestorMyInvestment = () => {
  const { t } = useTranslation(["investor"]);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const { getMyInvestment, getMyLedger } = useInvestor();
  const { data: miRes, isLoading } = getMyInvestment({ startDate: from, endDate: to });
  const { data: ledRes } = getMyLedger({ page, limit: 20 });

  const mi = miRes?.data ?? {};
  const led = ledRes?.data ?? {};
  const items = Array.isArray(led.items) ? led.items : [];
  const totalPages = Math.max(1, Math.ceil((led.total ?? 0) / (led.limit ?? 20)));

  const typeLabel: Record<string, string> = {
    capital: t("typeCapital", "Kapital"),
    distribution: t("typeDistribution", "Taqsimot"),
    stake: t("typeStake", "Ulush o'zgarishi"),
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {t("myInvestmentTitle", "Mening investitsiyam")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("myInvestmentSubtitle", "Kapital, ulush va qaytim (ROI)")}
          </p>
        </div>
        <DateRangeFilter from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />
      </div>

      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#8247ff] to-[#5b21b6] text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 opacity-90">
            <PieChart className="w-5 h-5" />
            <span className="text-sm">{t("ownership", "Egalik ulushi")}</span>
          </div>
          <p className="text-4xl font-bold mt-2">
            {isLoading ? "…" : `${mi.ownershipPct ?? 0}%`}
          </p>
          <p className="text-sm opacity-80 mt-1">
            {t("capitalInvested", "Kiritilgan kapital")}: {formatMoney(mi.capitalInvested)}
          </p>
        </div>
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label={t("accruedRoi", "Hisoblangan ROI")}
          value={mi.accruedRoiPct != null ? `${mi.accruedRoiPct}%` : "—"}
          gradient="from-emerald-500 to-green-600"
          badge={t("accrued", "hisoblangan")}
        />
        <StatCard
          icon={<HandCoins className="w-5 h-5" />}
          label={t("realizedRoi", "Real ROI (to'langan)")}
          value={mi.realizedRoiPct != null ? `${mi.realizedRoiPct}%` : "—"}
          gradient="from-amber-500 to-orange-600"
          badge={t("realized", "real")}
        />
      </div>

      {/* Sub-kartalar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<Banknote className="w-5 h-5" />}
          label={t("totalCapitalIn", "Jami kiritilgan kapital")}
          value={formatMoney(mi.capitalInvested)}
          gradient="from-blue-500 to-cyan-500"
        />
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          label={t("totalDistributions", "Jami to'langan taqsimot")}
          value={formatMoney(mi.distributionsPaid)}
          gradient="from-teal-500 to-cyan-600"
        />
        <StatCard
          icon={<Layers className="w-5 h-5" />}
          label={t("accruedShare", "Hisoblangan ulush (foyda)")}
          value={formatMoney(mi.accruedProfitShare)}
          gradient="from-indigo-500 to-violet-600"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label={t("undistributed", "Taqsimlanmagan qoldiq")}
          value={formatMoney(mi.undistributed)}
          gradient="from-purple-500 to-fuchsia-600"
        />
      </div>

      {/* Ledger tarixi */}
      <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3">
          {t("ledgerHistory", "Ledger tarixi")}
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            {t("noData", "Ma'lumot yo'q")}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-[#3B3656]">
                    <th className="py-2 pr-2">{t("date", "Sana")}</th>
                    <th className="py-2 pr-2">{t("type", "Tur")}</th>
                    <th className="py-2 pr-2">{t("amount", "Miqdor")}</th>
                    <th className="py-2">{t("note", "Izoh")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e: any, i: number) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 dark:border-[#332f49] last:border-0"
                    >
                      <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">
                        {fmtDate(e.occurred_at)}
                      </td>
                      <td className="py-2 pr-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#3B3656] text-gray-600 dark:text-gray-300">
                          {typeLabel[e.type] ?? e.type}
                        </span>
                      </td>
                      <td className="py-2 pr-2 font-medium text-gray-700 dark:text-gray-200">
                        {e.type === "stake"
                          ? `${(e.ownershipBps ?? 0) / 100}%`
                          : formatMoney(e.amount)}
                      </td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">
                        {e.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 mt-3 text-sm">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-[#3B3656] disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="text-gray-500 dark:text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-[#3B3656] disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default memo(InvestorMyInvestment);
