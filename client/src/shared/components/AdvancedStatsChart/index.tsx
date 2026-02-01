import { memo, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  BarChart3,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ShoppingCart,
  Info,
} from "lucide-react";
import { useRevenue } from "../../api/hooks/useRevenue";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

type PeriodType = "daily" | "weekly" | "monthly" | "yearly";
type ChartViewType = "area" | "bar" | "composed";

interface AdvancedStatsChartProps {
  className?: string;
  startDate?: string;
  endDate?: string;
}

// Pul formatlash
const formatMoney = (value: number) => {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toLocaleString();
};

// Foiz o'zgarishini hisoblash
const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  const { t } = useTranslation("dashboard");

  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-[#2A263D] p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 min-w-[220px]">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
        <Calendar className="w-4 h-4 text-purple-500" />
        <span className="font-semibold text-sm text-gray-800 dark:text-white">
          {data.label}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            {t("revenue")}:
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
        {data.avgOrderValue !== undefined && (
          <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              {t("average")}:
            </span>
            <span className="font-semibold text-purple-600">
              {Number(data.avgOrderValue).toLocaleString()} UZS
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Comparison Card - soddalashtirilgan
const ComparisonCard = ({
  title,
  description,
  currentValue,
  previousValue,
  currentLabel,
  previousLabel,
  icon,
  gradient,
  suffix = "",
  isLoading,
  infoText,
}: {
  title: string;
  description: string;
  currentValue: number;
  previousValue: number;
  currentLabel: string;
  previousLabel: string;
  icon: React.ReactNode;
  gradient: string;
  suffix?: string;
  isLoading?: boolean;
  infoText?: string;
}) => {
  const percentChange = calculatePercentChange(currentValue, previousValue);
  const isPositive = percentChange > 0;
  const isNeutral = percentChange === 0;
  const difference = currentValue - previousValue;

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-3" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all overflow-hidden relative">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-sm`}>
            {icon}
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {title}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </div>
        {infoText && (
          <div className="relative group/info">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute right-0 top-6 z-50 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all">
              {infoText}
            </div>
          </div>
        )}
      </div>

      {/* Current Value */}
      <div className="flex items-center justify-between mt-3">
        <div>
          <div className="text-2xl font-bold text-gray-800 dark:text-white">
            {formatMoney(currentValue)}
            <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>
          </div>
          <div className="text-xs text-gray-500">{currentLabel}</div>
        </div>

        <div className="text-right">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
            isNeutral
              ? "bg-gray-100 dark:bg-gray-700 text-gray-500"
              : isPositive
              ? "bg-green-100 dark:bg-green-900/30 text-green-600"
              : "bg-red-100 dark:bg-red-900/30 text-red-600"
          }`}>
            {isNeutral ? <Minus className="w-3 h-3" /> : isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(percentChange)}%
          </div>
          <div className={`text-xs mt-1 ${isNeutral ? "text-gray-500" : isPositive ? "text-green-600" : "text-red-600"}`}>
            {isPositive ? "+" : ""}{formatMoney(difference)}
          </div>
        </div>
      </div>

      {/* Previous */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm">
        <span className="text-gray-500 flex items-center gap-1">
          {isPositive ? <TrendingUp className="w-3 h-3 text-green-500" /> : isNeutral ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
          {previousLabel}:
        </span>
        <span className="font-medium text-gray-600 dark:text-gray-300">
          {formatMoney(previousValue)} {suffix}
        </span>
      </div>
    </div>
  );
};

// Period button
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
      px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer
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

// Main Component
const AdvancedStatsChart = memo(
  ({ className = "", startDate, endDate }: AdvancedStatsChartProps) => {
    const { t } = useTranslation("dashboard");
    const [period, setPeriod] = useState<PeriodType>("daily");
    const [chartView, setChartView] = useState<ChartViewType>("area");

    // Tanlangan kun oralig'i bor-yo'qligini tekshirish
    const hasCustomDateRange = !!(startDate && endDate);

    // Tanlangan kun oralig'i uchun comparison
    const customRangeComparison = useMemo(() => {
      if (!startDate || !endDate) return null;

      const start = dayjs(startDate);
      const end = dayjs(endDate);
      const daysDiff = end.diff(start, "day") + 1;

      const prevEnd = start.subtract(1, "day");
      const prevStart = prevEnd.subtract(daysDiff - 1, "day");

      return {
        current: { start: startDate, end: endDate, label: `${start.format("DD.MM")} - ${end.format("DD.MM")}`, days: daysDiff },
        previous: { start: prevStart.format("YYYY-MM-DD"), end: prevEnd.format("YYYY-MM-DD"), label: `${prevStart.format("DD.MM")} - ${prevEnd.format("DD.MM")}`, days: daysDiff },
      };
    }, [startDate, endDate]);

    // Standart date ranges (bugun, kecha, bu hafta, o'tgan hafta)
    const dateRanges = useMemo(() => {
      const today = dayjs();
      const yesterday = today.subtract(1, "day");
      const weekStart = today.startOf("isoWeek");
      const lastWeekStart = weekStart.subtract(1, "week");

      return {
        today: { start: today.format("YYYY-MM-DD"), end: today.format("YYYY-MM-DD") },
        yesterday: { start: yesterday.format("YYYY-MM-DD"), end: yesterday.format("YYYY-MM-DD") },
        thisWeek: { start: weekStart.format("YYYY-MM-DD"), end: today.format("YYYY-MM-DD") },
        lastWeek: { start: lastWeekStart.format("YYYY-MM-DD"), end: lastWeekStart.endOf("isoWeek").format("YYYY-MM-DD") },
      };
    }, []);

    // Fetch main chart data
    const { data: mainData, isLoading: mainLoading } = useRevenue().getRevenue({
      period,
      startDate,
      endDate,
    });

    // Tanlangan oraliq uchun data
    const { data: customCurrentData, isLoading: customCurrentLoading } = useRevenue().getRevenue({
      period: "daily",
      startDate: customRangeComparison?.current.start,
      endDate: customRangeComparison?.current.end,
    });

    const { data: customPreviousData, isLoading: customPreviousLoading } = useRevenue().getRevenue({
      period: "daily",
      startDate: customRangeComparison?.previous.start,
      endDate: customRangeComparison?.previous.end,
    });

    // Standart comparison data
    const { data: todayData, isLoading: todayLoading } = useRevenue().getRevenue({
      period: "daily",
      startDate: dateRanges.today.start,
      endDate: dateRanges.today.end,
    });

    const { data: yesterdayData, isLoading: yesterdayLoading } = useRevenue().getRevenue({
      period: "daily",
      startDate: dateRanges.yesterday.start,
      endDate: dateRanges.yesterday.end,
    });

    const { data: thisWeekData, isLoading: thisWeekLoading } = useRevenue().getRevenue({
      period: "daily",
      startDate: dateRanges.thisWeek.start,
      endDate: dateRanges.thisWeek.end,
    });

    const { data: lastWeekData, isLoading: lastWeekLoading } = useRevenue().getRevenue({
      period: "daily",
      startDate: dateRanges.lastWeek.start,
      endDate: dateRanges.lastWeek.end,
    });

    // Summary ma'lumotlari
    const chartData = mainData?.data?.data || [];
    const summary = mainData?.data?.summary || { totalRevenue: 0, totalOrders: 0, avgRevenue: 0 };

    const customCurrentSummary = customCurrentData?.data?.summary || { totalRevenue: 0, totalOrders: 0 };
    const customPreviousSummary = customPreviousData?.data?.summary || { totalRevenue: 0, totalOrders: 0 };

    const todaySummary = todayData?.data?.summary || { totalRevenue: 0, totalOrders: 0 };
    const yesterdaySummary = yesterdayData?.data?.summary || { totalRevenue: 0, totalOrders: 0 };
    const thisWeekSummary = thisWeekData?.data?.summary || { totalRevenue: 0, totalOrders: 0 };
    const lastWeekSummary = lastWeekData?.data?.summary || { totalRevenue: 0, totalOrders: 0 };

    // Hafta raqamini sana oralig'iga aylantirish
    const getWeekDateRange = (weekNum: number, year: number) => {
      const months = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
      // Hafta boshini topish (ISO week)
      const weekStart = dayjs().year(year).isoWeek(weekNum).startOf("isoWeek");
      const weekEnd = weekStart.endOf("isoWeek");
      return `${weekStart.date()}-${weekEnd.date()} ${months[weekStart.month()]}`;
    };

    const enrichedChartData = useMemo(() => {
      // Hafta raqamlari uchun to'g'ri yilni aniqlash
      const baseYear = startDate ? dayjs(startDate).year() : dayjs().year();
      let prevWeekNum = 0;
      let currentYear = baseYear;

      return chartData.map((item: any, index: number) => {
        let label = item.label;

        // Haftalik formatni aniqlash va o'zgartirish
        if (period === "weekly" && item.label) {
          // Label "W01", "W47", "01", "47" ko'rinishida bo'lishi mumkin
          const weekMatch = item.label.toString().match(/^W?(\d+)$/);
          if (weekMatch) {
            const weekNum = parseInt(weekMatch[1]);

            // Agar hafta raqami oldingi haftadan kichik bo'lsa, yangi yilga o'tgan
            // Masalan: 47 -> 48 -> 49 -> 50 -> 51 -> 52 -> 1 -> 2 -> 3
            if (index > 0 && weekNum < prevWeekNum && prevWeekNum > 40 && weekNum < 10) {
              currentYear++;
            }
            prevWeekNum = weekNum;

            label = getWeekDateRange(weekNum, currentYear);
          }
        }

        return {
          ...item,
          label,
          avgOrderValue: item.ordersCount > 0 ? Math.round(item.revenue / item.ordersCount) : 0,
        };
      });
    }, [chartData, period, startDate]);

    const periodLabels: Record<PeriodType, string> = {
      daily: t("daily"),
      weekly: t("weekly"),
      monthly: t("monthly"),
      yearly: t("yearly"),
    };

    const isComparisonLoading = todayLoading || yesterdayLoading || thisWeekLoading || lastWeekLoading || customCurrentLoading || customPreviousLoading;

    return (
      <div className={`bg-white dark:bg-[#2A263D] rounded-2xl shadow-lg overflow-hidden ${className}`}>
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                  {t("financialAnalysis")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {hasCustomDateRange
                    ? `${dayjs(startDate).format("DD.MM.YYYY")} - ${dayjs(endDate).format("DD.MM.YYYY")}`
                    : t("periodAnalysis")
                  }
                </p>
              </div>
            </div>

            {/* Period Selector - faqat grafik uchun */}
            <div className="flex gap-2 flex-wrap">
              {(["daily", "weekly", "monthly", "yearly"] as PeriodType[]).map((p) => (
                <PeriodButton
                  key={p}
                  period={p}
                  currentPeriod={period}
                  onClick={setPeriod}
                  label={periodLabels[p]}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Comparison Cards - soddalashtirilgan 4 ta card */}
        <div className="p-4 sm:p-6 bg-gray-50 dark:bg-[#252139]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Agar tanlangan oraliq bo'lsa - daromad va buyurtmalar */}
            {hasCustomDateRange && customRangeComparison ? (
              <>
                <ComparisonCard
                  title={t("selectedPeriod")}
                  description={`${customRangeComparison.current.days} ${t("dayRevenue")}`}
                  currentValue={customCurrentSummary.totalRevenue}
                  previousValue={customPreviousSummary.totalRevenue}
                  currentLabel={customRangeComparison.current.label}
                  previousLabel={customRangeComparison.previous.label}
                  icon={<DollarSign className="w-4 h-4" />}
                  gradient="from-purple-500 to-indigo-600"
                  suffix="UZS"
                  isLoading={isComparisonLoading}
                  infoText={t("selectedPeriodRevenueInfo")}
                />
                <ComparisonCard
                  title={t("selectedPeriod")}
                  description={`${customRangeComparison.current.days} ${t("dayOrders")}`}
                  currentValue={customCurrentSummary.totalOrders}
                  previousValue={customPreviousSummary.totalOrders}
                  currentLabel={customRangeComparison.current.label}
                  previousLabel={customRangeComparison.previous.label}
                  icon={<ShoppingCart className="w-4 h-4" />}
                  gradient="from-blue-500 to-cyan-600"
                  isLoading={isComparisonLoading}
                  infoText={t("selectedPeriodOrdersInfo")}
                />
              </>
            ) : (
              <>
                {/* Bugungi daromad */}
                <ComparisonCard
                  title={t("todayRevenue")}
                  description={t("compareWithYesterday")}
                  currentValue={todaySummary.totalRevenue}
                  previousValue={yesterdaySummary.totalRevenue}
                  currentLabel={t("today")}
                  previousLabel={t("yesterday")}
                  icon={<DollarSign className="w-4 h-4" />}
                  gradient="from-green-500 to-emerald-600"
                  suffix="UZS"
                  isLoading={isComparisonLoading}
                  infoText={t("todayRevenueInfo")}
                />
                {/* Bugungi buyurtmalar */}
                <ComparisonCard
                  title={t("todayOrders")}
                  description={t("compareWithYesterday")}
                  currentValue={todaySummary.totalOrders}
                  previousValue={yesterdaySummary.totalOrders}
                  currentLabel={t("today")}
                  previousLabel={t("yesterday")}
                  icon={<ShoppingCart className="w-4 h-4" />}
                  gradient="from-blue-500 to-cyan-600"
                  isLoading={isComparisonLoading}
                  infoText={t("todayOrdersInfo")}
                />
              </>
            )}

            {/* Haftalik daromad */}
            <ComparisonCard
              title={t("thisWeekRevenue")}
              description={t("compareWithLastWeek")}
              currentValue={thisWeekSummary.totalRevenue}
              previousValue={lastWeekSummary.totalRevenue}
              currentLabel={t("thisWeek")}
              previousLabel={t("lastWeek")}
              icon={<DollarSign className="w-4 h-4" />}
              gradient="from-amber-500 to-orange-600"
              suffix="UZS"
              isLoading={isComparisonLoading}
              infoText={t("weekRevenueInfo")}
            />

            {/* Umumiy (grafik davri) */}
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-600" />
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t("chartPeriod")}</span>
                  <p className="text-xs text-gray-500">{periodLabels[period]} {t("periodStats")}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">{t("totalRevenue")}:</span>
                  <span className="text-sm font-bold text-green-600">{formatMoney(summary.totalRevenue)} UZS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">{t("orders")}:</span>
                  <span className="text-sm font-bold text-blue-600">{summary.totalOrders}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500">{t("average")}:</span>
                  <span className="text-sm font-bold text-purple-600">{formatMoney(summary.avgRevenue)} UZS</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {periodLabels[period]} {t("revenueTrend")}
            </h4>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              {(["area", "bar", "composed"] as ChartViewType[]).map((view) => (
                <button
                  key={view}
                  onClick={() => setChartView(view)}
                  className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer ${
                    chartView === view
                      ? "bg-white dark:bg-[#2A263D] shadow-sm text-purple-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {view === "composed" ? "Combo" : view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {mainLoading ? (
            <div className="h-[350px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : enrichedChartData.length === 0 ? (
            <div className="h-[350px] flex flex-col items-center justify-center text-gray-500">
              <BarChart3 className="w-12 h-12 mb-2 opacity-30" />
              <p>{t("noData")}</p>
            </div>
          ) : (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === "area" ? (
                  <AreaChart data={enrichedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradientAdv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={formatMoney} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={3} fill="url(#revenueGradientAdv)" dot={false} activeDot={{ r: 6, fill: "#8B5CF6", stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                ) : chartView === "bar" ? (
                  <BarChart data={enrichedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={formatMoney} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                ) : (
                  <ComposedChart data={enrichedChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradientComp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={formatMoney} width={60} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} width={40} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2} fill="url(#revenueGradientComp)" />
                    <Bar yAxisId="right" dataKey="ordersCount" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={30} opacity={0.8} />
                    <Line yAxisId="left" type="monotone" dataKey="avgOrderValue" stroke="#F59E0B" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* Legend */}
          {chartView === "composed" && enrichedChartData.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-xs text-gray-500">{t("revenue")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-xs text-gray-500">{t("orders")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-amber-500" />
                <span className="text-xs text-gray-500">{t("average")}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50 dark:bg-[#252139] border-t border-gray-100 dark:border-gray-700/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {t("revenueInfo")}
          </p>
        </div>
      </div>
    );
  }
);

AdvancedStatsChart.displayName = "AdvancedStatsChart";

export default AdvancedStatsChart;
