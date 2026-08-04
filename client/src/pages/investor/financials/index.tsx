import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Banknote, CreditCard, Wallet, Landmark, Truck, Store } from "lucide-react";
import { useInvestor } from "../../../shared/api/hooks/useInvestor";
import StatCard from "../components/StatCard";
import InvestorRevenueChart from "../components/InvestorRevenueChart";
import DateRangeFilter from "../components/DateRangeFilter";
import { formatMoney } from "../components/format";

type Period = "daily" | "weekly" | "monthly" | "yearly";
const PERIODS: Period[] = ["daily", "weekly", "monthly", "yearly"];

const InvestorFinancials = () => {
  const { t } = useTranslation(["investor"]);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [period, setPeriod] = useState<Period>("daily");

  const { getRevenue, getCashPosition } = useInvestor();
  const { data: revRes, isLoading: revLoading } = getRevenue({
    startDate: from,
    endDate: to,
    period,
  });
  const { data: cashRes } = getCashPosition();

  const rev = revRes?.data ?? {};
  const cash = cashRes?.data ?? {};
  const series = Array.isArray(rev.data) ? rev.data : [];
  const summary = rev.summary ?? {};

  const periodLabel: Record<Period, string> = {
    daily: t("daily", "Kunlik"),
    weekly: t("weekly", "Haftalik"),
    monthly: t("monthly", "Oylik"),
    yearly: t("yearly", "Yillik"),
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {t("financialsTitle", "Moliya")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("financialsSubtitle", "Daromad, foyda va naqd pozitsiya")}
          </p>
        </div>
        <DateRangeFilter from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />
      </div>

      {/* Daromad xulosasi */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={<Banknote className="w-5 h-5" />}
          label={t("totalProfit", "Jami foyda (davr)")}
          value={formatMoney(summary.totalRevenue)}
          gradient="from-emerald-500 to-green-600"
        />
        <StatCard
          icon={<Store className="w-5 h-5" />}
          label={t("totalOrders", "Jami buyurtmalar")}
          value={summary.totalOrders ?? 0}
          gradient="from-blue-500 to-cyan-500"
        />
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          label={t("avgProfit", "O'rtacha (davr birligi)")}
          value={formatMoney(summary.avgRevenue)}
          gradient="from-indigo-500 to-violet-600"
        />
      </div>

      {/* Period tanlash */}
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] text-white"
                : "bg-gray-100 dark:bg-[#3B3656] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#4b3b6a]"
            }`}
          >
            {periodLabel[p]}
          </button>
        ))}
      </div>

      <InvestorRevenueChart
        data={series}
        loading={revLoading}
        title={t("profitTrend", "Foyda dinamikasi")}
      />

      {/* Naqd pozitsiya taqsimoti */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-3">
          {t("cashPosition", "Naqd pozitsiya")} ({t("current", "joriy")})
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            icon={<Wallet className="w-5 h-5" />}
            label={t("netCash", "Sof naqd pozitsiya")}
            value={formatMoney(cash.netCashPosition)}
            gradient="from-purple-500 to-fuchsia-600"
          />
          <StatCard
            icon={<Banknote className="w-5 h-5" />}
            label={t("cash", "Naqd")}
            value={formatMoney(cash.cash)}
            gradient="from-green-500 to-emerald-600"
          />
          <StatCard
            icon={<CreditCard className="w-5 h-5" />}
            label={t("card", "Karta")}
            value={formatMoney(cash.card)}
            gradient="from-sky-500 to-blue-600"
          />
          <StatCard
            icon={<Landmark className="w-5 h-5" />}
            label={t("mainBalance", "Asosiy kassa")}
            value={formatMoney(cash.mainBalance)}
            gradient="from-amber-500 to-orange-600"
          />
          <StatCard
            icon={<Truck className="w-5 h-5" />}
            label={t("couriersTotal", "Kuryerlar (jami)")}
            value={formatMoney(cash.couriersTotal)}
            gradient="from-teal-500 to-cyan-600"
          />
          <StatCard
            icon={<Store className="w-5 h-5" />}
            label={t("marketsTotal", "Marketlar (jami)")}
            value={formatMoney(cash.marketsTotal)}
            gradient="from-rose-500 to-pink-600"
          />
        </div>
      </div>
    </div>
  );
};

export default memo(InvestorFinancials);
