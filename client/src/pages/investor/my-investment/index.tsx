import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { message } from "antd";
import { PieChart, Banknote, Wallet, TrendingUp, Layers, HandCoins } from "lucide-react";
import { useInvestor } from "../../../shared/api/hooks/useInvestor";
import StatCard from "../components/StatCard";
import DateRangeFilter from "../components/DateRangeFilter";
import ExportButton from "../components/ExportButton";
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

  const { getMyInvestment, getMyLedger, getMyDaily, getMyBasisRequest, approveBasis, rejectBasis } = useInvestor();
  const { data: basisReqRes } = getMyBasisRequest();
  const basisReq = basisReqRes?.data;
  const { data: miRes, isLoading } = getMyInvestment({ startDate: from, endDate: to });
  const { data: ledRes } = getMyLedger({ page, limit: 20 });
  const { data: dailyRes } = getMyDaily({ startDate: from, endDate: to });
  const daily = dailyRes?.data ?? {};
  const dailyDays: any[] = Array.isArray(daily.days) ? daily.days : [];
  const dailyTotals = daily.totals ?? { postProfit: 0, investorShare: 0 };

  const mi = miRes?.data ?? {};
  const led = ledRes?.data ?? {};
  const items = Array.isArray(led.items) ? led.items : [];
  const totalPages = Math.max(1, Math.ceil((led.total ?? 0) / (led.limit ?? 20)));

  const typeLabel: Record<string, string> = {
    capital: t("typeCapital", "Kapital"),
    capital_withdrawal: t("typeCapitalWithdrawal", "Kapital qaytarish"),
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
        <div className="flex items-center gap-2">
          <DateRangeFilter from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />
          <ExportButton scope="personal" from={from} to={to} />
        </div>
      </div>

      {/* Foyda asosi o'zgarishi taklifi — tasdiqlash */}
      {basisReq && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              {t("basisRequestTitle", "Foyda asosini o'zgartirish taklifi")}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-300/80">
              {t("basisRequestBody", "Yangi asos")}:{" "}
              <b>{basisReq.requested_basis === "net" ? t("basisNet", "Sof foyda") : t("basisGross", "Yalpi marja")}</b>
              {" — "}
              {t("basisRequestConfirm", "tasdiqlaysizmi?")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                approveBasis.mutate(undefined, {
                  onSuccess: () => message.success(t("basisApproved", "Tasdiqlandi")),
                })
              }
              className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              {t("approve", "Tasdiqlash")}
            </button>
            <button
              onClick={() =>
                rejectBasis.mutate(undefined, {
                  onSuccess: () => message.success(t("basisRejected", "Rad etildi")),
                })
              }
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-colors"
            >
              {t("reject", "Rad etish")}
            </button>
          </div>
        </div>
      )}

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

      {/* Kunlik foyda */}
      <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3">
          {t("dailyTitle", "Kunlik foyda")}
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 dark:bg-[#3B3656] rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("postProfit", "Pochta foydasi")} ({t("total", "jami")})
            </p>
            <p className="font-bold text-gray-800 dark:text-white">
              {formatMoney(dailyTotals.postProfit)}
            </p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("investorShare", "Sizning foydangiz")} ({t("total", "jami")})
            </p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(dailyTotals.investorShare)}
            </p>
          </div>
        </div>
        {dailyDays.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            {t("noData", "Ma'lumot yo'q")}
          </p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-[#2A263D]">
                <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-[#3B3656]">
                  <th className="py-2 pr-2">{t("date", "Sana")}</th>
                  <th className="py-2 pr-2">{t("postProfit", "Pochta foydasi")}</th>
                  <th className="py-2 pr-2">{t("ownership", "Ulush")}</th>
                  <th className="py-2 text-right">{t("investorShare", "Sizning foydangiz")}</th>
                </tr>
              </thead>
              <tbody>
                {dailyDays.map((d: any) => (
                  <tr key={d.date} className="border-b border-gray-50 dark:border-[#332f49] last:border-0">
                    <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">{d.date}</td>
                    <td className="py-2 pr-2 text-gray-700 dark:text-gray-200">{formatMoney(d.postProfit)}</td>
                    <td className="py-2 pr-2 text-gray-500">{d.ownershipPct}%</td>
                    <td className="py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(d.investorShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                      key={`${i}-${e.type}-${e.occurred_at}`}
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
                        {e.type === "stake" && e.ownershipBps != null
                          ? `${(e.ownershipBps / 100).toFixed(2)}%`
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
