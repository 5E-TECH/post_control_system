import React, { useState, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { DatePicker } from "antd";
import type { RootState } from "../../app/store";
import RegionMap from "./components/regionMap";
import StatisticsMap from "./components/statistics-map";
import RegionStatisticsModal from "./components/region-statistics-modal";
import { Settings, MapPin, Calendar, HeadphonesIcon } from "lucide-react";

const { RangePicker } = DatePicker;

const Regions = () => {
  const { t } = useTranslation(["regions"]);
  const navigate = useNavigate();
  const { role, region } = useSelector((state: RootState) => state.roleSlice);
  const { pathname } = useLocation();

  const [selectedRegion, setSelectedRegion] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [dateRange, setDateRange] = useState<
    "today" | "week" | "month" | "all" | "custom"
  >("today");

  const today = new Date().toISOString().split("T")[0];
  const [customStartDate, setCustomStartDate] = useState(today);
  const [customEndDate, setCustomEndDate] = useState(today);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case "today":
        return {
          startDate: todayDate.toISOString().split("T")[0],
          endDate: todayDate.toISOString().split("T")[0],
        };
      case "week": {
        const weekAgo = new Date(todayDate);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return {
          startDate: weekAgo.toISOString().split("T")[0],
          endDate: todayDate.toISOString().split("T")[0],
        };
      }
      case "month": {
        const monthAgo = new Date(todayDate);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return {
          startDate: monthAgo.toISOString().split("T")[0],
          endDate: todayDate.toISOString().split("T")[0],
        };
      }
      case "all":
        return { startDate: undefined, endDate: undefined };
      case "custom":
        return {
          startDate: customStartDate,
          endDate: customEndDate,
        };
      default:
        return {
          startDate: todayDate.toISOString().split("T")[0],
          endDate: todayDate.toISOString().split("T")[0],
        };
    }
  }, [dateRange, customStartDate, customEndDate]);

  const isChildRoute =
    pathname.includes("/regions/districts") ||
    pathname.includes("/regions/sato-management") ||
    pathname.includes("/regions/logist-assignment");

  if (isChildRoute) {
    return <Outlet />;
  }

  const handleRegionClick = (regionId: string, regionName: string) => {
    setSelectedRegion({ id: regionId, name: regionName });
  };

  const isAdminOrSuperadmin = role === "admin" || role === "superadmin" || role === "logist";

  return (
    <div className="h-full overflow-auto">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                {t("title")}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-13">
                {t("subtitle")}
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {isAdminOrSuperadmin && (
                <div className="flex items-center gap-1 bg-white dark:bg-[#2A263D] rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-700/50">
                  <Calendar className="w-4 h-4 text-gray-400 ml-2" />
                  {(
                    [
                      { value: "today", label: t("today") },
                      { value: "week", label: t("week") },
                      { value: "month", label: t("month") },
                      { value: "all", label: t("all") },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDateRange(option.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                        dateRange === option.value
                          ? "bg-indigo-500 text-white"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-600" />
                  <RangePicker
                    value={
                      dateRange === "custom"
                        ? [
                            customStartDate ? dayjs(customStartDate) : null,
                            customEndDate ? dayjs(customEndDate) : null,
                          ]
                        : null
                    }
                    onChange={(dates) => {
                      if (dates?.[0] && dates?.[1]) {
                        setDateRange("custom");
                        setCustomStartDate(dates[0].format("YYYY-MM-DD"));
                        setCustomEndDate(dates[1].format("YYYY-MM-DD"));
                      }
                    }}
                    placeholder={[t("dateFrom"), t("dateTo")]}
                    className="border-0! bg-transparent! shadow-none!
                      [&_.ant-picker-input>input]:text-sm!
                      [&_.ant-picker-input>input]:text-gray-600!
                      dark:[&_.ant-picker-input>input]:text-gray-300!
                      [&_.ant-picker-suffix]:text-gray-400!
                      [&_.ant-picker-separator]:text-gray-400!
                      [&_.ant-picker-clear]:text-gray-400!"
                    style={{ width: 220 }}
                  />
                </div>
              )}

              {(role === "admin" || role === "superadmin") && (
                <div className="flex flex-wrap gap-2">
                  {role === "superadmin" && (
                    <>
                      <button
                        onClick={() => navigate("districts")}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        <MapPin size={16} />
                        {t("districts")}
                      </button>
                      <button
                        onClick={() => navigate("sato-management")}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                      >
                        <Settings size={16} />
                        {t("satoCode")}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate("logist-assignment")}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                  >
                    <HeadphonesIcon size={16} />
                    {t("assignLogist")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map Content */}
        {role === "courier" ? (
          <RegionMap regionName={region} />
        ) : isAdminOrSuperadmin ? (
          <StatisticsMap
            onRegionClick={handleRegionClick}
            startDate={startDate}
            endDate={endDate}
          />
        ) : (
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-8 text-center">
            <MapPin className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
              {t("noAccess")}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {t("noAccessDesc")}
            </p>
          </div>
        )}

        {selectedRegion && (
          <RegionStatisticsModal
            isOpen={!!selectedRegion}
            onClose={() => setSelectedRegion(null)}
            regionId={selectedRegion.id}
            regionName={selectedRegion.name}
            startDate={startDate}
            endDate={endDate}
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(Regions);
