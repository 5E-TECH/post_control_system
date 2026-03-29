import React, { useMemo, useState } from "react";
import {
  X, Package, TrendingUp, Users, MapPin, Phone, CheckCircle, XCircle,
  Clock, Loader2, Check, Plus, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/store";
import { useRegion } from "../../../shared/api/hooks/useRegion/useRegion";
import { useDistrict } from "../../../shared/api/hooks/useDistrict";

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

interface DistrictCourier {
  id: string;
  name: string;
  phone_number: string;
}

interface DistrictStat {
  id: string;
  name: string;
  satoCode: string | null;
  couriers: DistrictCourier[];
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
  const { t } = useTranslation(["regions"]);
  const { role } = useSelector((state: RootState) => state.roleSlice);
  const isLogist = role === "logist";
  const { getRegionDetailedStats } = useRegion();
  const { addDistrictCourier, removeDistrictCourier } = useDistrict();

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

  // District couriers - expanded and add form state
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set());
  const [addingForDistrict, setAddingForDistrict] = useState<string | null>(null);
  const [newCourierName, setNewCourierName] = useState("");
  const [newCourierPhone, setNewCourierPhone] = useState("");

  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: t("totalOrders"),
        value: summary.totalOrders?.toLocaleString() || "0",
        icon: Package,
        color: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600 dark:text-blue-400",
      },
      {
        label: t("delivered"),
        value: summary.deliveredOrders?.toLocaleString() || "0",
        icon: CheckCircle,
        color: "bg-emerald-100 dark:bg-emerald-900/30",
        iconColor: "text-emerald-600 dark:text-emerald-400",
      },
      {
        label: t("cancelled"),
        value: summary.cancelledOrders?.toLocaleString() || "0",
        icon: XCircle,
        color: "bg-red-100 dark:bg-red-900/30",
        iconColor: "text-red-600 dark:text-red-400",
      },
      {
        label: t("pending"),
        value: summary.pendingOrders?.toLocaleString() || "0",
        icon: Clock,
        color: "bg-amber-100 dark:bg-amber-900/30",
        iconColor: "text-amber-600 dark:text-amber-400",
      },
      ...(!isLogist ? [{
        label: t("totalRevenue"),
        value: `${(summary.totalRevenue || 0).toLocaleString()}`,
        suffix: t("currency"),
        icon: TrendingUp,
        color: "bg-purple-100 dark:bg-purple-900/30",
        iconColor: "text-purple-600 dark:text-purple-400",
      }] : []),
      {
        label: t("successRate"),
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
  }, [summary, isLogist]);

  const toggleDistrict = (districtId: string) => {
    setExpandedDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(districtId)) next.delete(districtId);
      else next.add(districtId);
      return next;
    });
  };

  const handleAddCourier = (districtId: string) => {
    if (!newCourierName.trim() || !newCourierPhone.trim()) return;
    addDistrictCourier.mutate(
      { districtId, name: newCourierName.trim(), phone_number: newCourierPhone.trim() },
      {
        onSuccess: () => {
          setAddingForDistrict(null);
          setNewCourierName("");
          setNewCourierPhone("");
        },
      }
    );
  };

  const handleStartAdd = (districtId: string) => {
    setAddingForDistrict(districtId);
    setNewCourierName("");
    setNewCourierPhone("");
    // Auto-expand district
    setExpandedDistricts((prev) => new Set([...prev, districtId]));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-[#1E1A2E] rounded-2xl shadow-2xl m-4">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{regionName}</h2>
              <p className="text-sm text-white/80">{t("detailedStats")}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">{t("loading")}</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {summaryCards.map((card, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-[#2A263D] rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-lg ${card.color} flex items-center justify-center`}>
                        <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
                    <p className="text-lg font-bold text-gray-800 dark:text-white">
                      {card.value}
                      {card.suffix && <span className="text-xs font-normal ml-1">{card.suffix}</span>}
                    </p>
                  </div>
                ))}
              </div>

              {/* Couriers Section */}
              <div className="bg-gray-50 dark:bg-[#2A263D] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{t("mainCourier")} ({couriers.length})</h3>
                </div>

                {couriers.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t("noCouriers")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <th className="pb-3 font-medium">{t("couriersHeader")}</th>
                          <th className="pb-3 font-medium text-center">{t("totalOrders")}</th>
                          <th className="pb-3 font-medium text-center">{t("delivered")}</th>
                          <th className="pb-3 font-medium text-center">{t("cancelled")}</th>
                          <th className="pb-3 font-medium text-center">{t("successRate")}</th>
                          {!isLogist && <th className="pb-3 font-medium text-right">{t("revenue")}</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {couriers.map((courier, idx) => (
                          <tr key={courier.id} className="hover:bg-white dark:hover:bg-[#3A3650] transition-colors">
                            <td className="py-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-700" : "bg-indigo-500"}`}>
                                  {idx + 1}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-medium text-gray-800 dark:text-white text-sm">{courier.name}</p>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium leading-none">{t("mainCourier")}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />{courier.phoneNumber}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-center"><span className="font-medium text-gray-800 dark:text-white">{courier.totalOrders}</span></td>
                            <td className="py-3 text-center"><span className="text-emerald-600 dark:text-emerald-400 font-medium">{courier.deliveredOrders}</span></td>
                            <td className="py-3 text-center"><span className="text-red-600 dark:text-red-400 font-medium">{courier.cancelledOrders}</span></td>
                            <td className="py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${courier.successRate >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : courier.successRate >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                                {courier.successRate}%
                              </span>
                            </td>
                            {!isLogist && (
                              <td className="py-3 text-right">
                                <span className="font-medium text-purple-600 dark:text-purple-400">{courier.totalRevenue.toLocaleString()}</span>
                                <span className="text-xs text-gray-500 ml-1">{t("sum")}</span>
                              </td>
                            )}
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
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{t("districtsHeader")} ({districts.length})</h3>
                </div>

                {districts.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t("noDistricts")}</p>
                ) : (
                  <div className="grid gap-2 max-h-[500px] overflow-y-auto">
                    {districts.map((district) => {
                      const isExpanded = expandedDistricts.has(district.id);
                      const isAdding = addingForDistrict === district.id;

                      return (
                        <div key={district.id} className="bg-white dark:bg-[#3A3650] rounded-lg overflow-hidden">
                          {/* District header row */}
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                              <span className="font-medium text-gray-800 dark:text-white truncate">{district.name}</span>
                              {district.satoCode && (
                                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded flex-shrink-0">
                                  {district.satoCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-gray-800 dark:text-white">{district.totalOrders}</span>
                                <span className="text-gray-400 text-xs">{t("orders")}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${district.successRate >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : district.successRate >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                                  {district.successRate}%
                                </span>
                                {!isLogist && (
                                  <span className="text-purple-600 dark:text-purple-400 font-medium text-xs min-w-[90px] text-right">
                                    {district.totalRevenue.toLocaleString()} {t("sum")}
                                  </span>
                                )}
                              </div>
                              {/* Courier toggle button */}
                              <button
                                onClick={() => toggleDistrict(district.id)}
                                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 ml-1"
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>{district.couriers.length}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Expanded courier list */}
                          {isExpanded && (
                            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-2">
                              {district.couriers.length > 0 ? (
                                district.couriers.map((c) => (
                                  <div key={c.id} className="flex items-center justify-between bg-gray-50 dark:bg-[#2A263D] rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                        <Users className="w-3 h-3 text-indigo-500" />
                                      </div>
                                      <span className="text-sm font-medium text-gray-800 dark:text-white">{c.name}</span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                                        <Phone className="w-3 h-3" />{c.phone_number}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => removeDistrictCourier.mutate(c.id)}
                                      disabled={removeDistrictCourier.isPending}
                                      className="text-red-400 hover:text-red-600 disabled:opacity-40 p-1 rounded"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-gray-400 italic text-center py-1">{t("noCourierAdded")}</p>
                              )}

                              {/* Add courier form */}
                              {isAdding ? (
                                <div className="flex items-center gap-2 pt-1">
                                  <input
                                    type="text"
                                    placeholder={t("namePlaceholder")}
                                    value={newCourierName}
                                    onChange={(e) => setNewCourierName(e.target.value)}
                                    className="flex-1 bg-white dark:bg-[#1E1A2E] border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs text-gray-800 dark:text-white placeholder-gray-400"
                                  />
                                  <input
                                    type="text"
                                    placeholder={t("phonePlaceholder")}
                                    value={newCourierPhone}
                                    onChange={(e) => setNewCourierPhone(e.target.value)}
                                    className="flex-1 bg-white dark:bg-[#1E1A2E] border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs text-gray-800 dark:text-white placeholder-gray-400"
                                  />
                                  <button
                                    onClick={() => handleAddCourier(district.id)}
                                    disabled={addDistrictCourier.isPending || !newCourierName.trim() || !newCourierPhone.trim()}
                                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2 py-1.5 rounded-lg disabled:opacity-50 flex-shrink-0"
                                  >
                                    {addDistrictCourier.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    {t("save")}
                                  </button>
                                  <button
                                    onClick={() => setAddingForDistrict(null)}
                                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0"
                                  >
                                    {t("cancel")}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartAdd(district.id)}
                                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                                >
                                  <Plus className="w-3 h-3" /> {t("addCourier")}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
