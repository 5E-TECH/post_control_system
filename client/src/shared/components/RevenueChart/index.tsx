import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  BarChart3,
  Loader2,
} from "lucide-react";
import { useRevenue } from "../../api/hooks/useRevenue";

type PeriodType = "daily" | "weekly" | "monthly" | "yearly";

interface RevenueChartProps {
  className?: string;
  startDate?: string;
  endDate?: string;
}

// Pul formatlash
const formatMoney = (value: number) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
};

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  const { t } = useTranslation("dashboard");

  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-[#2A263D] p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 min-w-[180px]">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
        <Calendar className="w-4 h-4 text-purple-500" />
        <span className="font-semibold text-sm">{data.label}</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            {t("profit")}:
          </span>
          <span className="font-bold text-green-600">
            {Number(data.revenue).toLocaleString()} UZS
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            {t("orders")}:
          </span>
          <span className="font-bold text-gray-800 dark:text-white">
            {data.ordersCount}
          </span>
        </div>
      </div>
    </div>
  );
};

// Period tugmalari
const PeriodButton = ({
  period,
  currentPeriod,
  onClick,
  label,
}: {
  period: PeriodType;
  currentPeriod: PeriodType;
  onClick: (p: PeriodType) => void;
  label: string;
}) => (
  <button
    onClick={() => onClick(period)}
    className={`
      px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all
      ${
        currentPeriod === period
          ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg"
          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
      }
    `}
  >
    {label}
  </button>
);

// Summary Card
const SummaryCard = ({
  icon,
  label,
  value,
  trend,
  trendValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}) => (
  <div className="bg-gray-50 dark:bg-[#3B3656] p-3 sm:p-4 rounded-xl">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-lg sm:text-xl font-bold">{value}</span>
      {trend && trendValue && (
        <span
          className={`text-xs flex items-center gap-0.5 ${
            trend === "up"
              ? "text-green-500"
              : trend === "down"
              ? "text-red-500"
              : "text-gray-500"
          }`}
        >
          {trend === "up" ? (
            <TrendingUp className="w-3 h-3" />
          ) : trend === "down" ? (
            <TrendingDown className="w-3 h-3" />
          ) : null}
          {trendValue}
        </span>
      )}
    </div>
  </div>
);

const RevenueChart = memo(({ className = "", startDate, endDate }: RevenueChartProps) => {
  const { t } = useTranslation("dashboard");
  const [period, setPeriod] = useState<PeriodType>("daily");

  // Agar sana oralig'i berilgan bo'lsa, uni ishlatamiz
  const { data, isLoading } = useRevenue().getRevenue({
    period,
    startDate,
    endDate,
  });

  const chartData = data?.data?.data || [];
  const summary = data?.data?.summary || {
    totalRevenue: 0,
    totalOrders: 0,
    avgRevenue: 0,
  };

  // Period labels
  const periodLabels: Record<PeriodType, string> = {
    daily: t("daily") || "Kunlik",
    weekly: t("weekly") || "Haftalik",
    monthly: t("monthly") || "Oylik",
    yearly: t("yearly") || "Yillik",
  };

  return (
    <div
      className={`bg-white dark:bg-[#2A263D] p-4 sm:p-6 rounded-2xl shadow-lg ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold">
              {t("revenueChart") || "Daromad statistikasi"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {periodLabels[period]}
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 flex-wrap">
          <PeriodButton
            period="daily"
            currentPeriod={period}
            onClick={setPeriod}
            label={t("daily") || "Kunlik"}
          />
          <PeriodButton
            period="weekly"
            currentPeriod={period}
            onClick={setPeriod}
            label={t("weekly") || "Haftalik"}
          />
          <PeriodButton
            period="monthly"
            currentPeriod={period}
            onClick={setPeriod}
            label={t("monthly") || "Oylik"}
          />
          <PeriodButton
            period="yearly"
            currentPeriod={period}
            onClick={setPeriod}
            label={t("yearly") || "Yillik"}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <SummaryCard
          icon={<DollarSign className="w-4 h-4 text-green-500" />}
          label={t("totalRevenue") || "Jami daromad"}
          value={`${formatMoney(summary.totalRevenue)} UZS`}
        />
        <SummaryCard
          icon={<BarChart3 className="w-4 h-4 text-blue-500" />}
          label={t("totalOrders") || "Jami buyurtmalar"}
          value={summary.totalOrders.toLocaleString()}
        />
        <SummaryCard
          icon={<TrendingUp className="w-4 h-4 text-purple-500" />}
          label={t("avgRevenue") || "O'rtacha"}
          value={`${formatMoney(summary.avgRevenue)} UZS`}
        />
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="h-[300px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-[300px] flex flex-col items-center justify-center text-gray-500">
          <BarChart3 className="w-12 h-12 mb-2 opacity-30" />
          <p>{t("noData") || "Ma'lumot topilmadi"}</p>
        </div>
      ) : (
        <div className="h-[300px] sm:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E5E7EB"
                opacity={0.5}
              />

              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                dy={10}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickFormatter={(value) => formatMoney(value)}
                width={60}
              />

              <Tooltip content={<CustomTooltip />} />

              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#8B5CF6"
                strokeWidth={3}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "#8B5CF6",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer info */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {t("revenueInfo") ||
            "Daromad = Market tarifi - Kuryer tarifi (har bir sotilgan buyurtma uchun)"}
        </p>
      </div>
    </div>
  );
});

export default RevenueChart;
