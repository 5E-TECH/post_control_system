import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  Store,
  Truck,
  ChevronDown,
  ChevronUp,
  Target,
  Award,
  Zap,
} from "lucide-react";

interface ChartItem {
  nomi: string;
  buyurtmalar: number;
  sotilgan: number;
  rate?: number;
}

interface SalesChartProps {
  title: string;
  data: ChartItem[];
  type: "markets" | "couriers";
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}

// Gradient ranglar
const GRADIENT_COLORS = {
  markets: {
    primary: "#8B5CF6", // Purple
    secondary: "#A78BFA",
    success: "#10B981", // Green
    bg: "from-purple-500/10 to-violet-500/10",
    border: "border-purple-500/30",
    icon: Store,
  },
  couriers: {
    primary: "#3B82F6", // Blue
    secondary: "#60A5FA",
    success: "#10B981", // Green
    bg: "from-blue-500/10 to-cyan-500/10",
    border: "border-blue-500/30",
    icon: Truck,
  },
};

// Custom Tooltip
const CustomTooltip = ({ active, payload, type }: any) => {
  const { t } = useTranslation(["dashboard"]);

  if (!active || !payload || !payload.length) return null;

  const item = payload[0].payload;
  const rate =
    item.buyurtmalar > 0
      ? ((item.sotilgan / item.buyurtmalar) * 100).toFixed(1)
      : 0;
  const colors = GRADIENT_COLORS[type as keyof typeof GRADIENT_COLORS];

  return (
    <div className="bg-white dark:bg-[#2A263D] p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: colors.primary + "20" }}
        >
          {type === "markets" ? (
            <Store className="w-4 h-4" style={{ color: colors.primary }} />
          ) : (
            <Truck className="w-4 h-4" style={{ color: colors.primary }} />
          )}
        </div>
        <span className="font-semibold text-sm truncate max-w-[150px]">
          {item.nomi?.split(" (")[0]}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            {t("orders")}:
          </span>
          <span className="font-bold text-gray-800 dark:text-white">
            {item.buyurtmalar}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            {t("solded")}:
          </span>
          <span className="font-bold text-green-600">{item.sotilgan}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            {t("rate")}:
          </span>
          <div className="flex items-center gap-1">
            <TrendingUp
              className={`w-4 h-4 ${
                Number(rate) >= 70
                  ? "text-green-500"
                  : Number(rate) >= 50
                  ? "text-yellow-500"
                  : "text-red-500"
              }`}
            />
            <span
              className={`font-bold ${
                Number(rate) >= 70
                  ? "text-green-600"
                  : Number(rate) >= 50
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {rate}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom Bar Shape with gradient
const GradientBar = (props: any) => {
  const { x, y, width, height, payload, type } = props;
  const colors = GRADIENT_COLORS[type as keyof typeof GRADIENT_COLORS];

  const soldWidth =
    payload.buyurtmalar > 0
      ? (payload.sotilgan / payload.buyurtmalar) * width
      : 0;
  const rate =
    payload.buyurtmalar > 0
      ? ((payload.sotilgan / payload.buyurtmalar) * 100).toFixed(0)
      : 0;

  return (
    <g>
      {/* Background bar (total orders) */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={colors.secondary}
        opacity={0.3}
        rx={4}
        ry={4}
      />
      {/* Foreground bar (sold orders) */}
      <rect
        x={x}
        y={y}
        width={soldWidth}
        height={height}
        fill={`url(#gradient-${type})`}
        rx={4}
        ry={4}
      />
      {/* Rate badge */}
      {width > 50 && (
        <g>
          <rect
            x={x + width - 45}
            y={y + height / 2 - 10}
            width={40}
            height={20}
            fill={
              Number(rate) >= 70
                ? "#10B981"
                : Number(rate) >= 50
                ? "#F59E0B"
                : "#EF4444"
            }
            rx={10}
            ry={10}
          />
          <text
            x={x + width - 25}
            y={y + height / 2 + 4}
            textAnchor="middle"
            fill="white"
            fontSize={11}
            fontWeight="bold"
          >
            {rate}%
          </text>
        </g>
      )}
    </g>
  );
};

// Stats Summary Component
const StatsSummary = ({
  data,
  type,
}: {
  data: ChartItem[];
  type: "markets" | "couriers";
}) => {
  const { t } = useTranslation(["dashboard"]);
  const colors = GRADIENT_COLORS[type];

  const totalOrders = data.reduce((sum, item) => sum + item.buyurtmalar, 0);
  const totalSold = data.reduce((sum, item) => sum + item.sotilgan, 0);
  const avgRate = totalOrders > 0 ? ((totalSold / totalOrders) * 100).toFixed(1) : 0;
  const topPerformer = data[0];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
      {/* Total Orders */}
      <div
        className={`p-3 rounded-xl bg-gradient-to-br ${colors.bg} ${colors.border} border`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("totalOrders")}
          </span>
        </div>
        <p className="text-lg sm:text-xl font-bold">{totalOrders}</p>
      </div>

      {/* Total Sold */}
      <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-green-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("solded")}
          </span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-green-600">
          {totalSold}
        </p>
      </div>

      {/* Average Rate */}
      <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/30">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-amber-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("rate")}
          </span>
        </div>
        <p className="text-lg sm:text-xl font-bold text-amber-600">{avgRate}%</p>
      </div>

      {/* Top Performer */}
      <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/30">
        <div className="flex items-center gap-2 mb-1">
          <Award className="w-4 h-4 text-rose-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Top 1</span>
        </div>
        <p
          className="text-sm font-bold text-rose-600 truncate"
          title={topPerformer?.nomi?.split(" (")[0]}
        >
          {topPerformer?.nomi?.split(" (")[0]?.slice(0, 12) || "-"}
        </p>
      </div>
    </div>
  );
};

// Main Component
const SalesChart = memo(
  ({ title, data, type, showAll, setShowAll }: SalesChartProps) => {
    const { t } = useTranslation(["dashboard"]);
    const colors = GRADIENT_COLORS[type];
    const IconComponent = colors.icon;

    // Format data with rate
    const formattedData = data.map((item) => ({
      ...item,
      rate:
        item.buyurtmalar > 0
          ? Number(((item.sotilgan / item.buyurtmalar) * 100).toFixed(1))
          : 0,
      shortName:
        item.nomi.split(" (")[0].length > 15
          ? item.nomi.split(" (")[0].slice(0, 12) + "..."
          : item.nomi.split(" (")[0],
    }));

    // Dynamic height based on data length
    const chartHeight = Math.max(data.length * 50, 300);

    if (data.length === 0) {
      return (
        <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-6 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: colors.primary + "20" }}
            >
              <IconComponent
                className="w-5 h-5"
                style={{ color: colors.primary }}
              />
            </div>
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <div className="text-center py-12 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t("noData")}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-6 rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: colors.primary + "20" }}
            >
              <IconComponent
                className="w-5 h-5"
                style={{ color: colors.primary }}
              />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {data.length}{" "}
                {type === "markets" ? t("topMarkets").split(" ")[1] : t("topCouriers").split(" ")[1]}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <StatsSummary data={data} type={type} />

        {/* Chart */}
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={formattedData}
              layout="vertical"
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              barCategoryGap="15%"
            >
              {/* Gradient definitions */}
              <defs>
                <linearGradient
                  id={`gradient-${type}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor={colors.primary} />
                  <stop offset="100%" stopColor={colors.success} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={true}
                vertical={false}
                stroke="#E5E7EB"
                opacity={0.5}
              />

              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
              />

              <YAxis
                type="category"
                dataKey="shortName"
                width={100}
                axisLine={false}
                tickLine={false}
                tick={({ x, y, payload }) => (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={-5}
                      y={0}
                      dy={4}
                      textAnchor="end"
                      className="fill-gray-700 dark:fill-gray-300"
                      fontSize={12}
                      fontWeight={500}
                    >
                      {payload.value}
                    </text>
                  </g>
                )}
              />

              <Tooltip
                content={<CustomTooltip type={type} />}
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
              />

              <Bar
                dataKey="buyurtmalar"
                shape={(props: any) => <GradientBar {...props} type={type} />}
                radius={[4, 4, 4, 4]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: colors.secondary, opacity: 0.3 }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t("orders")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{
                background: `linear-gradient(90deg, ${colors.primary}, ${colors.success})`,
              }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t("solded")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 bg-green-500 rounded-full">
              <span className="text-[10px] text-white font-bold">%</span>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t("rate")}
            </span>
          </div>
        </div>

        {/* Show More/Less Button */}
        {data.length > 0 && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowAll(!showAll)}
              className={`
                flex items-center gap-2 px-6 py-2.5
                bg-gradient-to-r ${
                  type === "markets"
                    ? "from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
                    : "from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
                }
                text-white font-medium rounded-xl
                shadow-lg hover:shadow-xl
                transition-all duration-300
                transform hover:scale-[1.02]
              `}
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {t("showLess")}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  {t("showMore")}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }
);

export default SalesChart;
