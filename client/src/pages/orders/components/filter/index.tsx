import { memo, useCallback, useEffect, useState, useRef } from "react";
import { statusOptions } from "../../../../shared/static/order";
import {
  Search,
  SlidersHorizontal,
  Download,
  Plus,
  X,
  Calendar,
  Store,
  MapPin,
  Tag,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { DatePicker, Select } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { useProfile } from "../../../../shared/api/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { togglePermission } from "../../../../shared/lib/features/add-order-permission";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../../app/store";
import {
  resetFilter,
  setFilter,
} from "../../../../shared/lib/features/order-filters";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import { requestDownload } from "../../../../shared/lib/features/excel-download-func/excelDownloadFunc";
import CustomCalendar from "../../../../shared/components/customDate";
import dayjs from "dayjs";
import { buildAdminPath } from "../../../../shared/const";

const Filter = () => {
  const { t } = useTranslation("orderList");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const { role } = useSelector((state: RootState) => state.roleSlice);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { getMarkets } = useMarket();
  const { data } = getMarkets(role !== "market", { limit: 0 });
  const { getRegions } = useRegion();
  const { data: regionData } = getRegions();

  const form = useSelector((state: RootState) => state.setFilter);

  const { refetch } = useProfile().getUser(role === "market");

  // umumiy Select uchun handler
  const handleSelectChange = (name: string) => (value: string) => {
    dispatch(setFilter({ name, value }));
  };

  // search uchun debounce qilingan handler
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      dispatch(setFilter({ name: "search", value }));
    }, 500),
    [dispatch]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  // RangePicker uchun
  const handleDateChange = (_: any, dateStrings: [string, string]) => {
    dispatch(setFilter({ name: "startDate", value: dateStrings[0] }));
    dispatch(setFilter({ name: "endDate", value: dateStrings[1] }));
  };

  // Permission check
  const handleCheck = async () => {
    const res = await refetch();
    const addOrder = res.data.data.add_order;
    if (!addOrder && res.data.data.role === "market") {
      dispatch(togglePermission(true));
      return;
    }
    navigate(buildAdminPath("orders/choose-market"));
  };

  // excel download
  const handleDownload = () => {
    setLoading(true);
    setDisabled(true);
    dispatch(requestDownload());
    setTimeout(() => {
      setLoading(false);
      setDisabled(false);
    }, 5000);
  };

  // options
  const marketOptions =
    data?.data?.data?.map((item: any) => ({
      value: item.id,
      label: item.name,
    })) || [];

  const regionOptions =
    regionData?.data?.map((item: any) => ({
      value: item.id,
      label: item.name,
    })) || [];

  const statusOpts =
    statusOptions.map((item) => ({
      value: item.value,
      label: t(`Status.${item.value}`),
    })) || [];

  const handleClear = () => {
    dispatch(resetFilter());
  };

  // Check if any filter is active
  const hasActiveFilters =
    form.marketId ||
    form.regionId ||
    (form.status && form.status.length > 0) ||
    form.startDate ||
    form.endDate ||
    form.search;

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden mb-4">
      {/* Header Section */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Title and Toggle */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <SlidersHorizontal className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {t("filters")}
              </h2>
              {hasActiveFilters && (
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Filters active
                </p>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              {showFilters ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Search and Action Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="search"
                defaultValue={form.search}
                onChange={handleSearchChange}
                placeholder={t("placeholder.searchOrder")}
                className="w-full sm:w-64 h-10 pl-10 pr-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Add Order Button */}
            <button
              onClick={handleCheck}
              className="h-10 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t("button.addOrder")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          showFilters
            ? "max-h-[500px] opacity-100"
            : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <div className="p-4 sm:p-5 space-y-4">
          {/* Filter Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Market Select */}
            {role !== "market" && (
              <div className="relative">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  <Store className="w-3.5 h-3.5" />
                  {t("market")}
                </label>
                <Select
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    String(option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  value={form.marketId}
                  onChange={handleSelectChange("marketId")}
                  placeholder={t("placeholder.selectMarket")}
                  className="w-full [&_.ant-select-selector]:h-10! [&_.ant-select-selector]:rounded-xl! [&_.ant-select-selector]:border-gray-200! dark:[&_.ant-select-selector]:border-gray-600! dark:[&_.ant-select-selector]:bg-gray-800! [&_.ant-select-selection-item]:leading-[38px]! dark:[&_.ant-select-selection-item]:text-gray-200! dark:[&_.ant-select-selection-placeholder]:text-gray-500!"
                  options={marketOptions}
                  allowClear
                />
              </div>
            )}

            {/* Region Select */}
            <div className="relative">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {t("region")}
              </label>
              <Select
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                value={form.regionId}
                onChange={handleSelectChange("regionId")}
                placeholder={t("placeholder.selectRegion")}
                className="w-full [&_.ant-select-selector]:h-10! [&_.ant-select-selector]:rounded-xl! [&_.ant-select-selector]:border-gray-200! dark:[&_.ant-select-selector]:border-gray-600! dark:[&_.ant-select-selector]:bg-gray-800! [&_.ant-select-selection-item]:leading-[38px]! dark:[&_.ant-select-selection-item]:text-gray-200! dark:[&_.ant-select-selection-placeholder]:text-gray-500!"
                options={regionOptions}
                allowClear
              />
            </div>

            {/* Status Multi-Select */}
            <div className="relative">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                <Tag className="w-3.5 h-3.5" />
                {t("status")}
              </label>
              <Select
                mode="multiple"
                value={form.status || []}
                onChange={(value: string[]) => {
                  dispatch(
                    setFilter({
                      name: "status",
                      value: value.length > 0 ? value : null,
                    })
                  );
                }}
                placeholder={t("placeholder.selectStatuses")}
                className="w-full [&_.ant-select-selector]:min-h-10! [&_.ant-select-selector]:rounded-xl! [&_.ant-select-selector]:border-gray-200! dark:[&_.ant-select-selector]:border-gray-600! dark:[&_.ant-select-selector]:bg-gray-800! [&_.ant-select-selection-item]:bg-purple-100! [&_.ant-select-selection-item]:text-purple-700! [&_.ant-select-selection-item]:border-purple-200! dark:[&_.ant-select-selection-item]:bg-purple-900/30! dark:[&_.ant-select-selection-item]:text-purple-300! dark:[&_.ant-select-selection-item]:border-purple-800! dark:[&_.ant-select-selection-placeholder]:text-gray-500!"
                options={statusOpts}
                maxTagCount="responsive"
                allowClear
              />
            </div>

            {/* Date Range Picker */}
            <div className="relative">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {t("sana")}
              </label>
              {!isMobile ? (
                <DatePicker.RangePicker
                  format="YYYY-MM-DD"
                  value={[
                    form.startDate ? dayjs(form.startDate) : null,
                    form.endDate ? dayjs(form.endDate) : null,
                  ]}
                  className="w-full h-10 [&]:rounded-xl! [&]:border-gray-200! dark:[&]:border-gray-600! dark:[&]:bg-gray-800! dark:[&_.ant-picker-input>input]:text-gray-200! dark:[&_.ant-picker-input>input]:placeholder-gray-500! [&_.ant-picker-suffix]:text-gray-400!"
                  onChange={handleDateChange}
                  placeholder={[
                    t("placeholder.startDate"),
                    t("placeholder.endDate"),
                  ]}
                />
              ) : (
                <CustomCalendar
                  from={form.startDate ? dayjs(form.startDate) : null}
                  to={form.endDate ? dayjs(form.endDate) : null}
                  setFrom={(date: any) =>
                    dispatch(
                      setFilter({
                        name: "startDate",
                        value: date ? date.format("YYYY-MM-DD") : "",
                      })
                    )
                  }
                  setTo={(date: any) =>
                    dispatch(
                      setFilter({
                        name: "endDate",
                        value: date ? date.format("YYYY-MM-DD") : "",
                      })
                    )
                  }
                />
              )}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/50">
            {/* Left: Clear Button */}
            <button
              onClick={handleClear}
              disabled={!hasActiveFilters}
              className={`h-10 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                hasActiveFilters
                  ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
            >
              <X className="w-4 h-4" />
              {t("button.tozalash")}
            </button>

            {/* Right: Export Button */}
            <button
              onClick={handleDownload}
              disabled={disabled}
              className={`h-10 px-5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                disabled
                  ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg hover:shadow-emerald-500/25"
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {t("button.export")} Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Filter);
