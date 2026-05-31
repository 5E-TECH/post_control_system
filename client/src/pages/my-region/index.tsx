import { memo, useMemo, useState } from "react";
import {
  MapPin,
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { useRegion } from "../../shared/api/hooks/useRegion/useRegion";

interface DistrictRow {
  id: string;
  name: string;
  satoCode: string | null;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  successRate: number;
}

// Mahalliy (UZB) kalendar sanasi YYYY-MM-DD (toISOString UTC siljishidan saqlanish)
const fmtLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const successColor = (rate: number) =>
  rate >= 70
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    : rate >= 50
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

// Buyurtma soniga qarab issiqlik-rangi (indigo). 0..1 intensivlik.
const heatStyle = (intensity: number): React.CSSProperties => ({
  backgroundColor: `rgba(99, 102, 241, ${0.06 + 0.5 * intensity})`,
});

const MyRegion = () => {
  const { getMyRegionDistrictStats } = useRegion();
  const [dateRange, setDateRange] = useState<
    "today" | "week" | "month" | "all"
  >("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (dateRange) {
      case "today":
        return { startDate: fmtLocalDate(today), endDate: fmtLocalDate(today) };
      case "week": {
        const from = new Date(today);
        from.setDate(from.getDate() - 7);
        return { startDate: fmtLocalDate(from), endDate: fmtLocalDate(today) };
      }
      case "month": {
        const from = new Date(today);
        from.setMonth(from.getMonth() - 1);
        return { startDate: fmtLocalDate(from), endDate: fmtLocalDate(today) };
      }
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [dateRange]);

  const { data, isLoading } = getMyRegionDistrictStats(startDate, endDate);

  const payload = data?.data;
  const region = payload?.region;
  const summary = payload?.summary;
  const districts: DistrictRow[] = payload?.districts || [];

  const maxOrders = useMemo(
    () => Math.max(1, ...districts.map((d) => d.totalOrders)),
    [districts],
  );

  const active = useMemo(
    () => districts.find((d) => d.id === activeId) || null,
    [districts, activeId],
  );

  return (
    <div className="h-full overflow-auto">
      <div className="w-full max-w-screen-xl mx-auto px-4 sm:px-6 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                {region?.name
                  ? `${region.name} — tumanlar statistikasi`
                  : "Mening viloyatim"}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Tuman ustiga bosib yoki olib borib batafsil ma'lumotni ko'ring
              </p>
            </div>
          </div>

          {/* Period toggle */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#2A263D] rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-700/50 self-start">
            <Calendar className="w-4 h-4 text-gray-400 ml-2" />
            {(
              [
                { value: "today", label: "Bugun" },
                { value: "week", label: "Hafta" },
                { value: "month", label: "Oy" },
                { value: "all", label: "Barchasi" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                onClick={() => setDateRange(o.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                  dateRange === o.value
                    ? "bg-indigo-500 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Yuklanmoqda...
            </p>
          </div>
        ) : !region ? (
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-10 text-center">
            <MapPin className="w-14 h-14 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
              Sizga viloyat biriktirilmagan
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Administrator sizni viloyatga biriktirgach, bu yerda tumanlar
              statistikasi ko'rinadi.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary cards */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <SummaryCard
                  label="Jami"
                  value={summary.totalOrders}
                  icon={Package}
                  color="text-blue-600 dark:text-blue-400"
                />
                <SummaryCard
                  label="Yetkazilgan"
                  value={summary.deliveredOrders}
                  icon={CheckCircle2}
                  color="text-emerald-600 dark:text-emerald-400"
                />
                <SummaryCard
                  label="Bekor"
                  value={summary.cancelledOrders}
                  icon={XCircle}
                  color="text-red-600 dark:text-red-400"
                />
                <SummaryCard
                  label="Kutilmoqda"
                  value={summary.pendingOrders}
                  icon={Clock}
                  color="text-amber-600 dark:text-amber-400"
                />
                <SummaryCard
                  label="Muvaffaqiyat"
                  value={`${summary.successRate || 0}%`}
                  icon={TrendingUp}
                  color="text-indigo-600 dark:text-indigo-400"
                />
                <SummaryCard
                  label="Tushum"
                  value={(summary.totalRevenue || 0).toLocaleString()}
                  icon={TrendingUp}
                  color="text-purple-600 dark:text-purple-400"
                  small
                />
              </div>
            )}

            {/* Active district detail */}
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50">
              {active ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {active.name}
                    </span>
                    {active.satoCode && (
                      <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {active.satoCode}
                      </span>
                    )}
                  </div>
                  <DetailStat label="Jami" value={active.totalOrders} />
                  <DetailStat
                    label="Yetkazilgan"
                    value={active.deliveredOrders}
                    color="text-emerald-600 dark:text-emerald-400"
                  />
                  <DetailStat
                    label="Bekor"
                    value={active.cancelledOrders}
                    color="text-red-600 dark:text-red-400"
                  />
                  <DetailStat
                    label="Kutilmoqda"
                    value={active.pendingOrders}
                    color="text-amber-600 dark:text-amber-400"
                  />
                  <DetailStat
                    label="Muvaffaqiyat"
                    value={`${active.successRate}%`}
                    color="text-indigo-600 dark:text-indigo-400"
                  />
                  <DetailStat
                    label="Tushum"
                    value={`${active.totalRevenue.toLocaleString()} so'm`}
                    color="text-purple-600 dark:text-purple-400"
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-1">
                  Tuman tanlang — yoki katakcha ustiga sichqonchani olib boring
                </p>
              )}
            </div>

            {/* District heat grid */}
            {districts.length === 0 ? (
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-10 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Bu davrda tumanlarda buyurtma topilmadi
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {districts.map((d) => {
                  const intensity = d.totalOrders / maxOrders;
                  const isActive = d.id === activeId;
                  return (
                    <button
                      key={d.id}
                      style={heatStyle(intensity)}
                      onMouseEnter={() => setActiveId(d.id)}
                      onClick={() => setActiveId(d.id)}
                      className={`text-left rounded-xl p-3 border transition-all ${
                        isActive
                          ? "border-indigo-500 ring-2 ring-indigo-500/30"
                          : "border-gray-100 dark:border-gray-700/50 hover:border-indigo-300 dark:hover:border-indigo-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm font-medium text-gray-800 dark:text-white line-clamp-2">
                          {d.name}
                        </span>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${successColor(d.successRate)}`}
                        >
                          {d.successRate}%
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {d.totalOrders}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          {d.deliveredOrders}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
                          <XCircle className="w-3 h-3" />
                          {d.cancelledOrders}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                          <Clock className="w-3 h-3" />
                          {d.pendingOrders}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-1">
              <span>Kam</span>
              <div className="flex items-center gap-1">
                {[0.1, 0.35, 0.6, 0.9].map((i) => (
                  <span
                    key={i}
                    className="w-5 h-3 rounded"
                    style={heatStyle(i)}
                  />
                ))}
              </div>
              <span>Ko'p (buyurtma soni bo'yicha)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
  icon: Icon,
  color,
  small,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  small?: boolean;
}) => (
  <div className="bg-white dark:bg-[#2A263D] rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-700/50">
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`w-4 h-4 ${color}`} />
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
    <p className={`${small ? "text-sm" : "text-lg"} font-bold ${color}`}>
      {typeof value === "number" ? value.toLocaleString() : value}
    </p>
  </div>
);

const DetailStat = ({
  label,
  value,
  color = "text-gray-800 dark:text-white",
}: {
  label: string;
  value: number | string;
  color?: string;
}) => (
  <div>
    <p className="text-[11px] text-gray-400 dark:text-gray-500">{label}</p>
    <p className={`text-sm font-semibold ${color}`}>
      {typeof value === "number" ? value.toLocaleString() : value}
    </p>
  </div>
);

export default memo(MyRegion);
