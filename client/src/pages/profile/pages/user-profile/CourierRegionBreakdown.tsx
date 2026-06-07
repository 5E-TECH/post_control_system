import { memo, useMemo, useState, type FC } from "react";
import { useSelector } from "react-redux";
import { MapPin, Loader2, Package, TrendingUp } from "lucide-react";
import type { RootState } from "../../../../app/store";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";

interface RegionRow {
  regionId: string;
  regionName: string;
  satoCode: string | null;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  successRate: number;
}

interface Props {
  courierId: string;
}

// Mahalliy (UZB) kalendar sanasini YYYY-MM-DD ko'rinishida qaytaradi
// (toISOString UTC'ga siljitib, "Bugun"ni kechaga aylantirib yuborardi).
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

const CourierRegionBreakdown: FC<Props> = ({ courierId }) => {
  const role = useSelector((state: RootState) => state.roleSlice.role);
  const isLogist = role === "logist";
  const { getCourierRegionBreakdown } = useRegion();

  const [dateRange, setDateRange] = useState<
    "today" | "week" | "month" | "all"
  >("all");

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

  const { data, isLoading } = getCourierRegionBreakdown(
    courierId,
    startDate,
    endDate,
  );

  const payload = data?.data;
  const summary = payload?.summary;
  const regions: RegionRow[] = payload?.regions || [];

  return (
    <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl shadow-xl overflow-hidden mb-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              Viloyatlar bo'yicha statistika
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Super kuryerning har bir viloyatdagi natijasi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#2A263D] rounded-xl p-1">
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
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                dateRange === o.value
                  ? "bg-indigo-500 text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Yuklanmoqda...
          </p>
        </div>
      ) : regions.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bu davrda biror viloyatda buyurtma topilmadi
          </p>
        </div>
      ) : (
        <div className="p-4 sm:p-6 space-y-4">
          {/* Summary cards */}
          {summary && (
            <div
              className={`grid grid-cols-2 ${isLogist ? "md:grid-cols-3" : "md:grid-cols-4"} gap-3`}
            >
              <div className="rounded-xl bg-gray-50 dark:bg-[#2A263D] p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Jami</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">
                  {summary.totalOrders?.toLocaleString() || 0}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-[#2A263D] p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Yetkazilgan
                </p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {summary.deliveredOrders?.toLocaleString() || 0}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-[#2A263D] p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Muvaffaqiyat
                </p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {summary.successRate || 0}%
                </p>
              </div>
              {!isLogist && (
                <div className="rounded-xl bg-gray-50 dark:bg-[#2A263D] p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Jami tushum
                  </p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {(summary.totalRevenue || 0).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Per-region table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 font-medium">Viloyat</th>
                  <th className="pb-2 font-medium text-center">Jami</th>
                  <th className="pb-2 font-medium text-center">Yetkazilgan</th>
                  <th className="pb-2 font-medium text-center">Bekor</th>
                  <th className="pb-2 font-medium text-center">Kutilmoqda</th>
                  <th className="pb-2 font-medium text-center">Muvaffaqiyat</th>
                  {!isLogist && (
                    <th className="pb-2 font-medium text-right">Tushum</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {regions.map((r) => (
                  <tr
                    key={r.regionId}
                    className="hover:bg-gray-50 dark:hover:bg-[#2A263D] transition-colors"
                  >
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span className="text-sm font-medium text-gray-800 dark:text-white">
                          {r.regionName}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-center text-sm font-medium text-gray-800 dark:text-white">
                      {r.totalOrders}
                    </td>
                    <td className="py-2.5 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {r.deliveredOrders}
                    </td>
                    <td className="py-2.5 text-center text-sm font-medium text-red-600 dark:text-red-400">
                      {r.cancelledOrders}
                    </td>
                    <td className="py-2.5 text-center text-sm font-medium text-amber-600 dark:text-amber-400">
                      {r.pendingOrders}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${successColor(r.successRate)}`}
                      >
                        {r.successRate}%
                      </span>
                    </td>
                    {!isLogist && (
                      <td className="py-2.5 text-right text-sm font-medium text-purple-600 dark:text-purple-400">
                        {r.totalRevenue.toLocaleString()}{" "}
                        <span className="text-xs text-gray-400">so'm</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(CourierRegionBreakdown);
