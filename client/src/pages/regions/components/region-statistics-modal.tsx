import React, { useMemo } from "react";
import { X, Package, TrendingUp, Users, MapPin, Phone, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { useRegion } from "../../../shared/api/hooks/useRegion/useRegion";

interface CourierStat {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  successRate: number;
}

interface DistrictStat {
  id: string;
  name: string;
  satoCode: string | null;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  successRate: number;
}

interface RegionStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  regionId: string;
  regionName: string;
  startDate?: string;
  endDate?: string;
}

const RegionStatisticsModal: React.FC<RegionStatisticsModalProps> = ({
  isOpen,
  onClose,
  regionId,
  regionName,
  startDate,
  endDate,
}) => {
  const { getRegionDetailedStats } = useRegion();
  const { data, isLoading } = getRegionDetailedStats(
    regionId,
    startDate,
    endDate,
    isOpen && !!regionId
  );

  const stats = data?.data;
  const summary = stats?.summary;
  const couriers: CourierStat[] = stats?.couriers || [];
  const districts: DistrictStat[] = stats?.districts || [];

  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "Jami buyurtmalar",
        value: summary.totalOrders?.toLocaleString() || "0",
        icon: Package,
        color: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600 dark:text-blue-400",
      },
      {
        label: "Yetkazilgan",
        value: summary.deliveredOrders?.toLocaleString() || "0",
        icon: CheckCircle,
        color: "bg-emerald-100 dark:bg-emerald-900/30",
        iconColor: "text-emerald-600 dark:text-emerald-400",
      },
      {
        label: "Bekor qilingan",
        value: summary.cancelledOrders?.toLocaleString() || "0",
        icon: XCircle,
        color: "bg-red-100 dark:bg-red-900/30",
        iconColor: "text-red-600 dark:text-red-400",
      },
      {
        label: "Kutilmoqda",
        value: summary.pendingOrders?.toLocaleString() || "0",
        icon: Clock,
        color: "bg-amber-100 dark:bg-amber-900/30",
        iconColor: "text-amber-600 dark:text-amber-400",
      },
      {
        label: "Jami tushum",
        value: `${(summary.totalRevenue || 0).toLocaleString()}`,
        suffix: "so'm",
        icon: TrendingUp,
        color: "bg-purple-100 dark:bg-purple-900/30",
        iconColor: "text-purple-600 dark:text-purple-400",
      },
      {
        label: "Muvaffaqiyat",
        value: `${summary.successRate || 0}%`,
        icon: TrendingUp,
        color:
          summary.successRate >= 70
            ? "bg-emerald-100 dark:bg-emerald-900/30"
            : summary.successRate >= 50
            ? "bg-amber-100 dark:bg-amber-900/30"
            : "bg-red-100 dark:bg-red-900/30",
        iconColor:
          summary.successRate >= 70
            ? "text-emerald-600 dark:text-emerald-400"
            : summary.successRate >= 50
            ? "text-amber-600 dark:text-amber-400"
            : "text-red-600 dark:text-red-400",
      },
    ];
  }, [summary]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-[#1E1A2E] rounded-2xl shadow-2xl m-4">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{regionName}</h2>
              <p className="text-sm text-white/80">Batafsil statistika</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Yuklanmoqda...</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {summaryCards.map((card, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 dark:bg-[#2A263D] rounded-xl p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg ${card.color} flex items-center justify-center`}
                      >
                        <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {card.label}
                    </p>
                    <p className="text-lg font-bold text-gray-800 dark:text-white">
                      {card.value}
                      {card.suffix && (
                        <span className="text-xs font-normal ml-1">
                          {card.suffix}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {/* Couriers Section */}
              <div className="bg-gray-50 dark:bg-[#2A263D] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Kuryerlar ({couriers.length})
                  </h3>
                </div>

                {couriers.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    Bu viloyatda kuryer topilmadi
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <th className="pb-3 font-medium">Kuryer</th>
                          <th className="pb-3 font-medium text-center">Jami</th>
                          <th className="pb-3 font-medium text-center">Yetkazilgan</th>
                          <th className="pb-3 font-medium text-center">Bekor</th>
                          <th className="pb-3 font-medium text-center">Muvaffaqiyat</th>
                          <th className="pb-3 font-medium text-right">Tushum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {couriers.map((courier, idx) => (
                          <tr
                            key={courier.id}
                            className="hover:bg-white dark:hover:bg-[#3A3650] transition-colors"
                          >
                            <td className="py-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${
                                    idx === 0
                                      ? "bg-amber-500"
                                      : idx === 1
                                      ? "bg-gray-400"
                                      : idx === 2
                                      ? "bg-amber-700"
                                      : "bg-indigo-500"
                                  }`}
                                >
                                  {idx + 1}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800 dark:text-white text-sm">
                                    {courier.name}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {courier.phoneNumber}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              <span className="font-medium text-gray-800 dark:text-white">
                                {courier.totalOrders}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                {courier.deliveredOrders}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                {courier.cancelledOrders}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  courier.successRate >= 70
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : courier.successRate >= 50
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {courier.successRate}%
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <span className="font-medium text-purple-600 dark:text-purple-400">
                                {courier.totalRevenue.toLocaleString()}
                              </span>
                              <span className="text-xs text-gray-500 ml-1">so'm</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Districts Section */}
              <div className="bg-gray-50 dark:bg-[#2A263D] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Tumanlar ({districts.length})
                  </h3>
                </div>

                {districts.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    Bu viloyatda tuman topilmadi
                  </p>
                ) : (
                  <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                    {districts.map((district) => (
                      <div
                        key={district.id}
                        className="flex items-center justify-between bg-white dark:bg-[#3A3650] rounded-lg px-4 py-3 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="font-medium text-gray-800 dark:text-white">
                            {district.name}
                          </span>
                          {district.satoCode && (
                            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                              {district.satoCode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <span className="font-medium text-gray-800 dark:text-white">
                              {district.totalOrders}
                            </span>
                            <span className="text-gray-400 ml-1">buyurtma</span>
                          </div>
                          <div
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              district.successRate >= 70
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : district.successRate >= 50
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {district.successRate}%
                          </div>
                          <div className="text-purple-600 dark:text-purple-400 font-medium min-w-[100px] text-right">
                            {district.totalRevenue.toLocaleString()} so'm
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegionStatisticsModal;
