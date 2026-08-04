import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingCart, PackageCheck, XCircle, Percent } from "lucide-react";
import { useInvestor } from "../../../shared/api/hooks/useInvestor";
import StatCard from "../components/StatCard";
import DateRangeFilter from "../components/DateRangeFilter";
import ExportButton from "../components/ExportButton";
import { formatMoney, formatNumber } from "../components/format";

interface LbRow {
  rank: number;
  totalOrders: number;
  successfulOrders: number;
  successRate: number;
}

const AnonLeaderboard = ({ title, rows }: { title: string; rows: LbRow[] }) => {
  const { t } = useTranslation(["investor"]);
  return (
    <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm">
      <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          {t("noData", "Ma'lumot yo'q")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-[#3B3656]">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">{t("orders", "Buyurtma")}</th>
                <th className="py-2 pr-2">{t("successful", "Muvaffaqiyatli")}</th>
                <th className="py-2">{t("rate", "Daraja")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.rank}
                  className="border-b border-gray-50 dark:border-[#332f49] last:border-0"
                >
                  <td className="py-2 pr-2 font-semibold text-gray-700 dark:text-gray-200">
                    #{r.rank}
                  </td>
                  <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">
                    {formatNumber(r.totalOrders)}
                  </td>
                  <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">
                    {formatNumber(r.successfulOrders)}
                  </td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                      {r.successRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const InvestorOperations = () => {
  const { t } = useTranslation(["investor"]);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const range = { startDate: from, endDate: to };

  const { getOrderFlow, getLeaderboards, getRegions } = useInvestor();
  const { data: flowRes, isLoading: flowLoading } = getOrderFlow(range);
  const { data: lbRes } = getLeaderboards();
  const { data: regRes } = getRegions(range);

  const flow = flowRes?.data ?? {};
  const lb = lbRes?.data ?? {};
  const regions = Array.isArray(regRes?.data?.regions) ? regRes.data.regions : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {t("operationsTitle", "Operatsiyalar")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("operationsSubtitle", "Buyurtma oqimi, reyting va regionlar")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt); }} />
          <ExportButton scope="business" from={from} to={to} />
        </div>
      </div>

      {/* Buyurtma oqimi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<ShoppingCart className="w-5 h-5" />}
          label={t("acceptedOrders", "Qabul qilingan")}
          value={flowLoading ? "…" : flow.acceptedCount ?? 0}
          gradient="from-blue-500 to-cyan-500"
        />
        <StatCard
          icon={<PackageCheck className="w-5 h-5" />}
          label={t("soldPaid", "Sotilgan / to'langan")}
          value={flowLoading ? "…" : flow.soldAndPaid ?? 0}
          gradient="from-emerald-500 to-green-600"
        />
        <StatCard
          icon={<XCircle className="w-5 h-5" />}
          label={t("cancelled", "Bekor / qaytgan")}
          value={flowLoading ? "…" : flow.cancelled ?? 0}
          gradient="from-rose-500 to-pink-600"
        />
        <StatCard
          icon={<Percent className="w-5 h-5" />}
          label={t("successRate", "Muvaffaqiyat darajasi")}
          value={`${flow.successRate ?? 0}%`}
          gradient="from-indigo-500 to-violet-600"
        />
      </div>

      {/* Anonim reytinglar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnonLeaderboard
          title={t("topMarkets", "Top marketlar (anonim, 30 kun)")}
          rows={Array.isArray(lb.markets) ? lb.markets : []}
        />
        <AnonLeaderboard
          title={t("topCouriers", "Top kuryerlar (anonim, 30 kun)")}
          rows={Array.isArray(lb.couriers) ? lb.couriers : []}
        />
      </div>

      {/* Regionlar jadvali */}
      <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-3">
          {t("regions", "Regionlar bo'yicha")}
        </h3>
        {regions.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            {t("noData", "Ma'lumot yo'q")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100 dark:border-[#3B3656]">
                  <th className="py-2 pr-2">{t("region", "Region")}</th>
                  <th className="py-2 pr-2">{t("orders", "Buyurtma")}</th>
                  <th className="py-2 pr-2">{t("delivered", "Yetkazilgan")}</th>
                  <th className="py-2 pr-2">{t("profit", "Foyda")}</th>
                  <th className="py-2">{t("rate", "Daraja")}</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r: any) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 dark:border-[#332f49] last:border-0"
                  >
                    <td className="py-2 pr-2 font-medium text-gray-700 dark:text-gray-200">
                      {r.name}
                    </td>
                    <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">
                      {formatNumber(r.totalOrders)}
                    </td>
                    <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">
                      {formatNumber(r.deliveredOrders)}
                    </td>
                    <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">
                      {formatMoney(r.totalRevenue)}
                    </td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                        {r.successRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(InvestorOperations);
