import React, { useEffect, useState, useMemo } from "react";
import Highcharts from "highcharts/highmaps";
import HighchartsReact from "highcharts-react-official";
import uzTopology from "@highcharts/map-collection/countries/uz/uz-all.topo.json";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useRegion } from "../../../shared/api/hooks/useRegion/useRegion";
import { Package, TrendingUp, Loader2, MapPin } from "lucide-react";
import type { RootState } from "../../../app/store";

// SATO kodi -> Highcharts hc-key mapping
// Bu mapping SATO kodlari asosida ishlaydi - nomlardan ko'ra ishonchli
const SATO_TO_HC_KEY: Record<string, string> = {
  "1703": "uz-an", // Andijon viloyati
  "1706": "uz-bu", // Buxoro viloyati
  "1708": "uz-ji", // Jizzax viloyati
  "1710": "uz-qa", // Qashqadaryo viloyati
  "1712": "uz-nw", // Navoiy viloyati
  "1714": "uz-ng", // Namangan viloyati
  "1718": "uz-sa", // Samarqand viloyati
  "1722": "uz-su", // Surxondaryo viloyati
  "1724": "uz-si", // Sirdaryo viloyati
  "1726": "uz-tk", // Toshkent shahri
  "1727": "uz-ta", // Toshkent viloyati
  "1730": "uz-fa", // Farg'ona viloyati
  "1733": "uz-kh", // Xorazm viloyati
  "1735": "uz-qr", // Qoraqalpog'iston Respublikasi
};

// SATO kodi yoki ID asosida hc-key olish
const getRegionHcKey = (satoCode: string | null): string | undefined => {
  if (!satoCode) return undefined;
  // SATO kodi 4 raqamli bo'lishi kerak
  const code = satoCode.trim();
  return SATO_TO_HC_KEY[code];
};

interface RegionStats {
  id: string;
  name: string;
  satoCode: string | null;
  districtsCount: number;
  couriersCount: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  successRate: number;
}

interface StatisticsMapProps {
  onRegionClick?: (regionId: string, regionName: string) => void;
  startDate?: string;
  endDate?: string;
}

const StatisticsMap: React.FC<StatisticsMapProps> = ({
  onRegionClick,
  startDate,
  endDate,
}) => {
  const { t } = useTranslation(["regions"]);
  const [mapOptions, setMapOptions] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { role } = useSelector((state: RootState) => state.roleSlice);
  const isLogist = role === "logist";
  const { getAllRegionsStats } = useRegion();
  const { data: statsData, isLoading, isError } = getAllRegionsStats(startDate, endDate);

  // Dark mode detection
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const regions: RegionStats[] = statsData?.data?.regions || [];
  const summary = statsData?.data?.summary;

  // Tooltip translation strings (captured as closure vars in useEffect)
  const tTotalOrders = t("totalOrders");
  const tDelivered = t("delivered");
  const tCancelled = t("cancelled");
  const tSuccessRate = t("successRate");
  const tRevenue = t("revenue");
  const tSum = t("sum");
  const tCouriers = t("couriers");
  const tClickForDetails = t("clickForDetails");

  // Xarita ma'lumotlarini yangilash
  useEffect(() => {
    if (!regions.length) return;

    const mapData = regions.map((region) => {
      const hcKey = getRegionHcKey(region.satoCode);
      return {
        "hc-key": hcKey,
        value: region.totalOrders,
        regionId: region.id,
        regionName: region.name,
        deliveredOrders: region.deliveredOrders,
        cancelledOrders: region.cancelledOrders,
        pendingOrders: region.pendingOrders,
        totalRevenue: region.totalRevenue,
        successRate: region.successRate,
        couriersCount: region.couriersCount,
        districtsCount: region.districtsCount,
      };
    });

    setMapOptions({
      chart: {
        map: uzTopology,
        backgroundColor: "transparent",
        style: {
          fontFamily: "inherit",
        },
      },
      title: {
        text: undefined,
      },
      credits: {
        enabled: false,
      },
      legend: {
        enabled: false,
      },
      colorAxis: {
        min: 0,
        minColor: isDarkMode ? "#1e1b4b" : "#E8F5E9",
        maxColor: isDarkMode ? "#818cf8" : "#1B5E20",
        stops: isDarkMode
          ? [
              [0, "#1e1b4b"],
              [0.3, "#3730a3"],
              [0.6, "#6366f1"],
              [1, "#818cf8"],
            ]
          : [
              [0, "#E8F5E9"],
              [0.3, "#81C784"],
              [0.6, "#4CAF50"],
              [1, "#1B5E20"],
            ],
      },
      tooltip: {
        useHTML: true,
        backgroundColor: isDarkMode ? "rgba(30, 27, 75, 0.95)" : "rgba(255,255,255,0.95)",
        borderColor: isDarkMode ? "#4338ca" : "#e5e7eb",
        borderRadius: 12,
        shadow: true,
        style: {
          fontSize: "13px",
        },
        formatter: function (this: any) {
          const point = this.point;
          const dark = document.documentElement.classList.contains("dark");
          const textColor = dark ? "#e5e7eb" : "#1f2937";
          const labelColor = dark ? "#a5b4fc" : "#6b7280";
          const borderColor = dark ? "#4338ca" : "#e5e7eb";
          return `
            <div style="padding: 8px 4px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: ${textColor};">
                ${point.regionName || point.name}
              </div>
              <div style="display: grid; gap: 4px;">
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: ${labelColor};">${tTotalOrders}:</span>
                  <span style="font-weight: 600; color: #60a5fa;">${point.value?.toLocaleString() || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: ${labelColor};">${tDelivered}:</span>
                  <span style="font-weight: 600; color: #34d399;">${point.deliveredOrders?.toLocaleString() || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: ${labelColor};">${tCancelled}:</span>
                  <span style="font-weight: 600; color: #f87171;">${point.cancelledOrders?.toLocaleString() || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: ${labelColor};">${tSuccessRate}:</span>
                  <span style="font-weight: 600; color: ${point.successRate >= 70 ? '#34d399' : point.successRate >= 50 ? '#fbbf24' : '#f87171'};">${point.successRate || 0}%</span>
                </div>
                ${!isLogist ? `<div style="display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid ${borderColor}; padding-top: 4px; margin-top: 4px;">
                  <span style="color: ${labelColor};">${tRevenue}:</span>
                  <span style="font-weight: 600; color: #a78bfa;">${(point.totalRevenue || 0).toLocaleString()} ${tSum}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: ${labelColor};">${tCouriers}:</span>
                  <span style="font-weight: 600; color: ${textColor};">${point.couriersCount || 0}</span>
                </div>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed ${borderColor}; text-align: center; color: ${dark ? '#818cf8' : '#9ca3af'}; font-size: 11px;">
                ${tClickForDetails}
              </div>
            </div>
          `;
        },
      },
      plotOptions: {
        series: {
          cursor: "pointer",
          point: {
            events: {
              click: function (this: any) {
                if (onRegionClick && this.regionId) {
                  onRegionClick(this.regionId, this.regionName);
                }
              },
            },
          },
          states: {
            hover: {
              brightness: 0.1,
              borderColor: "#3b82f6",
              borderWidth: 2,
            },
            select: {
              color: "#3b82f6",
            },
          },
        },
      },
      series: [
        {
          name: "Buyurtmalar",
          data: mapData,
          joinBy: "hc-key",
          borderColor: "#ffffff",
          borderWidth: 1,
          dataLabels: {
            enabled: true,
            format: "{point.name}",
            style: {
              color: "#374151",
              textOutline: "2px white",
              fontWeight: "500",
              fontSize: "11px",
            },
          },
        },
      ],
    });
  }, [regions, onRegionClick, isDarkMode, isLogist, tTotalOrders, tDelivered, tCancelled, tSuccessRate, tRevenue, tSum, tCouriers, tClickForDetails]);

  // Summary kartalar
  const summaryCards = useMemo(() => {
    if (!summary) return null;
    return [
      {
        label: t("totalOrders"),
        value: summary.totalOrders?.toLocaleString() || "0",
        icon: Package,
        color: "bg-blue-500",
        textColor: "text-blue-600",
      },
      {
        label: t("delivered"),
        value: summary.totalDelivered?.toLocaleString() || "0",
        icon: TrendingUp,
        color: "bg-emerald-500",
        textColor: "text-emerald-600",
      },
      {
        label: t("cancelled"),
        value: summary.totalCancelled?.toLocaleString() || "0",
        icon: Package,
        color: "bg-red-500",
        textColor: "text-red-600",
      },
      ...(!isLogist ? [{
        label: t("totalRevenue"),
        value: `${(summary.totalRevenue || 0).toLocaleString()} ${t("sum")}`,
        icon: TrendingUp,
        color: "bg-purple-500",
        textColor: "text-purple-600",
      }] : []),
    ];
  }, [summary, isLogist, t]);

  // Error holati
  if (isError) {
    return (
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-8 text-center">
        <MapPin className="w-16 h-16 text-red-300 dark:text-red-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
          API xatolik: Ma'lumotlarni yuklab bo'lmadi
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Server javob bermadi yoki ruxsat yo'q. Sahifani yangilang.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition-colors cursor-pointer"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  // Skeleton loading
  if (!mapOptions || isLoading) {
    return (
      <div className="space-y-4">
        {/* Summary skeleton */}
        <div className={`grid grid-cols-2 ${isLogist ? "md:grid-cols-3" : "md:grid-cols-4"} gap-3`}>
          {(isLogist ? [1, 2, 3] : [1, 2, 3, 4]).map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#2A263D] rounded-xl p-4 animate-pulse"
            >
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16" />
            </div>
          ))}
        </div>
        {/* Map skeleton */}
        <div className="relative w-full h-[500px] flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#e5e7eb] via-[#d1d5db] to-[#e5e7eb] dark:from-[#374151] dark:via-[#4b5563] dark:to-[#374151] animate-pulse">
          <div className="absolute inset-0 opacity-30 bg-[url('https://code.highcharts.com/mapdata/countries/uz/uz-all.svg')] bg-contain bg-center bg-no-repeat" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shine_1.6s_infinite]" />
          <div className="flex flex-col items-center gap-2 z-10">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            <span className="text-gray-500 dark:text-gray-400">{t("loading")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summaryCards && (
        <div className={`grid grid-cols-2 ${isLogist ? "md:grid-cols-3" : "md:grid-cols-4"} gap-3`}>
          {summaryCards.map((card, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${card.color} bg-opacity-10 flex items-center justify-center`}
                >
                  <card.icon className={`w-5 h-5 ${card.textColor}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {card.label}
                  </p>
                  <p className={`text-lg font-bold ${card.textColor}`}>
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
        <HighchartsReact
          highcharts={Highcharts}
          constructorType="mapChart"
          options={{
            ...mapOptions,
            chart: {
              ...mapOptions.chart,
              height: 500,
            },
          }}
        />

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#E8F5E9] dark:bg-[#1e1b4b]" />
            <span className="text-gray-600 dark:text-gray-400">Kam</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#81C784] dark:bg-[#3730a3]" />
            <span className="text-gray-600 dark:text-gray-400">O'rtacha</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#4CAF50] dark:bg-[#6366f1]" />
            <span className="text-gray-600 dark:text-gray-400">Ko'p</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#1B5E20] dark:bg-[#818cf8]" />
            <span className="text-gray-600 dark:text-gray-400">Juda ko'p</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsMap;
