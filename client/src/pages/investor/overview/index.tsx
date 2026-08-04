import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TrendingUp,
  ShoppingCart,
  PackageCheck,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useInvestor } from "../../../shared/api/hooks/useInvestor";
import StatCard from "../components/StatCard";
import InvestorRevenueChart from "../components/InvestorRevenueChart";
import DateRangeFilter from "../components/DateRangeFilter";
import { formatMoney } from "../components/format";

const InvestorOverview = () => {
  const { t } = useTranslation(["investor"]);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const range = { startDate: from, endDate: to };

  const { getOverview, getRevenue, getCashPosition, getOrderFlow } = useInvestor();
  const { data: ovRes, isLoading: ovLoading } = getOverview(range);
  const { data: revRes, isLoading: revLoading } = getRevenue({ ...range, period: "daily" });
  const { data: cashRes } = getCashPosition();
  const { data: flowRes } = getOrderFlow(range);

  const ov = ovRes?.data ?? {};
  const rev = revRes?.data ?? {};
  const cash = cashRes?.data ?? {};
  const flow = flowRes?.data ?? {};
  const series = Array.isArray(rev.data) ? rev.data : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Sarlavha + sana filtri */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {t("overviewTitle", "Umumiy ko'rinish")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("overviewSubtitle", "Biznes salomatligi — ulushdor ko'rinishi")}
          </p>
        </div>
        <DateRangeFilter
          from={from}
          to={to}
          onChange={(f, tt) => {
            setFrom(f);
            setTo(tt);
          }}
        />
      </div>

      {/* KPI kartalari */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label={t("netProfit", "Sof foyda (davr)")}
          value={ovLoading ? "…" : formatMoney(ov.profit)}
          gradient="from-emerald-500 to-green-600"
        />
        <StatCard
          icon={<ShoppingCart className="w-5 h-5" />}
          label={t("acceptedOrders", "Qabul qilingan buyurtmalar")}
          value={ovLoading ? "…" : ov.acceptedCount ?? 0}
          gradient="from-blue-500 to-cyan-500"
        />
        <StatCard
          icon={<PackageCheck className="w-5 h-5" />}
          label={t("soldPaid", "Sotilgan / to'langan")}
          value={ovLoading ? "…" : ov.soldAndPaid ?? 0}
          gradient="from-indigo-500 to-violet-600"
        />
        <StatCard
          icon={<Wallet className="w-5 h-5" />}
          label={t("netCash", "Sof naqd pozitsiya")}
          value={formatMoney(cash.netCashPosition)}
          gradient="from-purple-500 to-fuchsia-600"
          badge={t("current", "joriy")}
        />
      </div>

      {/* Foyda dinamikasi grafigi */}
      <InvestorRevenueChart
        data={series}
        loading={revLoading}
        title={t("profitTrend", "Foyda dinamikasi")}
      />

      {/* Buyurtma oqimi qisqacha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#2A263D] p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("successRate", "Muvaffaqiyat darajasi")}
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {flow.successRate ?? 0}%
            </p>
          </div>
          <ArrowUpRight className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="bg-white dark:bg-[#2A263D] p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("returnRate", "Qaytish / bekor darajasi")}
            </p>
            <p className="text-2xl font-bold text-rose-500">
              {flow.returnRate ?? 0}%
            </p>
          </div>
          <ArrowDownRight className="w-8 h-8 text-rose-400" />
        </div>
      </div>
    </div>
  );
};

export default memo(InvestorOverview);
