import { memo, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  Clock,
  XCircle,
  Search,
  Calendar,
  ChevronDown,
} from "lucide-react";
import dayjs from "dayjs";
import { DatePicker } from "antd";
import { useDispatch } from "react-redux";
import { setDateRange } from "../../../../shared/lib/features/datafilterSlice";
import { setUserFilter } from "../../../../shared/lib/features/user-filters";
import { buildAdminPath } from "../../../../shared/const";

const { RangePicker } = DatePicker;

const CourierOrders = () => {
  const { t } = useTranslation("orderList");
  const dispatch = useDispatch();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [form, setForm] = useState({
    from: "",
    to: "",
  });

  useEffect(() => {
    setForm({ from: "", to: "" });
  }, [location.pathname]);

  useEffect(() => {
    dispatch(setDateRange({ from: form.from, to: form.to }));
  }, [form, dispatch]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(setUserFilter({ name: "search", value: searchQuery }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, dispatch]);

  const tabs = [
    {
      to: buildAdminPath("courier-orders/orders"),
      label: t("kutilayotganBuyurtmalar"),
      shortLabel: "Kutilayotgan",
      icon: Clock,
      color: "amber",
      end: true,
    },
    {
      to: buildAdminPath("courier-orders/orders/all"),
      label: t("hammaBuyurtmalar"),
      shortLabel: "Hammasi",
      icon: ClipboardList,
      color: "blue",
    },
    {
      to: buildAdminPath("courier-orders/orders/cancelled"),
      label: t("bekorBuyurtmalar"),
      shortLabel: "Bekor",
      icon: XCircle,
      color: "red",
    },
  ];

  const getTabColors = (color: string, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string }> = {
      amber: {
        active:
          "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25",
        inactive:
          "bg-white dark:bg-[#2A263D] text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-gray-200 dark:border-gray-700",
      },
      blue: {
        active:
          "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25",
        inactive:
          "bg-white dark:bg-[#2A263D] text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700",
      },
      red: {
        active:
          "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25",
        inactive:
          "bg-white dark:bg-[#2A263D] text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700",
      },
    };
    return isActive ? colors[color].active : colors[color].inactive;
  };

  const getIconBgColors = (color: string, isActive: boolean) => {
    if (isActive) return "bg-white/20";
    const colors: Record<string, string> = {
      amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
      blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
      red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    };
    return colors[color];
  };

  const formatDateRange = () => {
    if (form.from && form.to) {
      return `${dayjs(form.from).format("DD.MM")} - ${dayjs(form.to).format("DD.MM")}`;
    }
    if (form.from) {
      return dayjs(form.from).format("DD.MM.YYYY");
    }
    return t("start") + " - " + t("end");
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Buyurtmalarni boshqarish va sotish
          </p>
        </div>

        {/* Search & Date Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t("placeholder.searchOrder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Date Picker - Mobile */}
          <div className="sm:hidden relative z-10">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="w-full h-11 px-4 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="truncate">{formatDateRange()}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform flex-shrink-0 ${showDatePicker ? "rotate-180" : ""}`}
              />
            </button>
            {showDatePicker && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-30 bg-black/10"
                  onClick={() => setShowDatePicker(false)}
                />
                {/* Dropdown */}
                <div className="absolute left-0 right-0 mt-2 p-4 bg-white dark:bg-[#2A263D] rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl z-30">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                        {t("start")}
                      </label>
                      <input
                        type="date"
                        value={form.from}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, from: e.target.value }))
                        }
                        className="w-full h-11 px-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                        {t("end")}
                      </label>
                      <input
                        type="date"
                        value={form.to}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, to: e.target.value }))
                        }
                        className="w-full h-11 px-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                  {(form.from || form.to) && (
                    <button
                      onClick={() => {
                        setForm({ from: "", to: "" });
                        setShowDatePicker(false);
                      }}
                      className="mt-3 w-full h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium"
                    >
                      Tozalash
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Date Picker - Desktop */}
          <div className="hidden sm:block">
            <RangePicker
              value={[
                form.from ? dayjs(form.from) : null,
                form.to ? dayjs(form.to) : null,
              ]}
              onChange={(dates: any) => {
                setForm({
                  from: dates?.[0] ? dates[0].format("YYYY-MM-DD") : "",
                  to: dates?.[1] ? dates[1].format("YYYY-MM-DD") : "",
                });
              }}
              placeholder={[`${t("start")}`, `${t("end")}`]}
              format="YYYY-MM-DD"
              className="h-11 rounded-xl border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex items-center justify-center gap-2 py-2.5 lg:py-3 rounded-xl font-medium transition-all cursor-pointer ${getTabColors(
                    tab.color,
                    isActive
                  )}`
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getIconBgColors(
                        tab.color,
                        isActive
                      )}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm hidden lg:inline">
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Content */}
        <Outlet />
      </div>
    </div>
  );
};

export default memo(CourierOrders);
