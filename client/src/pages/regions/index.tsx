import React, { useState, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import { DatePicker } from "antd";
import type { RootState } from "../../app/store";
import RegionMap from "./components/regionMap";
import StatisticsMap from "./components/statistics-map";
import RegionStatisticsModal from "./components/region-statistics-modal";
import { Settings, MapPin, Calendar } from "lucide-react";

const { RangePicker } = DatePicker;

const Regions = () => {
  const navigate = useNavigate();
  const { role, region } = useSelector((state: RootState) => state.roleSlice);
  const { pathname } = useLocation();

  // Modal state
  const [selectedRegion, setSelectedRegion] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Date filter state
  const [dateRange, setDateRange] = useState<
    "today" | "week" | "month" | "all" | "custom"
  >("today");

  // Custom date range state
  const today = new Date().toISOString().split("T")[0];
  const [customStartDate, setCustomStartDate] = useState(today);
  const [customEndDate, setCustomEndDate] = useState(today);

  // Calculate date range
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

  // Check if we're on a child route (districts or sato-management)
  const isChildRoute =
    pathname.includes("/regions/districts") ||
    pathname.includes("/regions/sato-management");

  if (isChildRoute) {
    return <Outlet />;
  }

  const handleRegionClick = (regionId: string, regionName: string) => {
    setSelectedRegion({ id: regionId, name: regionName });
  };

  const isAdminOrSuperadmin = role === "admin" || role === "superadmin";

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
                Viloyatlar statistikasi
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-13">
                Viloyat ustiga bosib batafsil ma'lumotlarni ko'ring
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Range Selector */}
              {isAdminOrSuperadmin && (
                <div className="flex items-center gap-1 bg-white dark:bg-[#2A263D] rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-700/50">
                  <Calendar className="w-4 h-4 text-gray-400 ml-2" />
                  {[
                    { value: "today", label: "Bugun" },
                    { value: "week", label: "Hafta" },
                    { value: "month", label: "Oy" },
                    { value: "all", label: "Barchasi" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDateRange(option.value as typeof dateRange)}
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
                    placeholder={["Boshlanish", "Tugash"]}
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

              {/* Superadmin buttons */}
              {role === "superadmin" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate("districts")}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <MapPin size={16} />
                    Tumanlar
                  </button>
                  <button
                    onClick={() => navigate("sato-management")}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                  >
                    <Settings size={16} />
                    SATO kodlari
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
              Ruxsat yo'q
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Viloyatlar statistikasini ko'rish uchun admin yoki superadmin
              huquqi kerak
            </p>
          </div>
        )}

        {/* Region Statistics Modal */}
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
