import {
  Eraser,
  Search,
  X,
  Store,
  Building2,
  Truck,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Calendar,
  User,
  CreditCard,
  Banknote,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import React, { useCallback, useState, useRef, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";
import { useCourier } from "../../shared/api/hooks/useCourier";
import { useCashBox } from "../../shared/api/hooks/useCashbox";
import { useUser } from "../../shared/api/hooks/useRegister";
import CountUp from "react-countup";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { Pagination, type PaginationProps } from "antd";
import { useParamsHook } from "../../shared/hooks/useParams";
import HistoryPopup from "./components/historyPopup";
import { debounce } from "../../shared/helpers/DebounceFunc";
import { useTranslation } from "react-i18next";
import PaymentPopup from "../../shared/ui/paymentPopup";

export interface IPaymentFilter {
  operationType?: string | null;
  sourceType?: string | null;
  createdBy?: string | null;
  cashboxType?: string | null;
}

const initialState: IPaymentFilter = {
  operationType: null,
  sourceType: null,
  createdBy: null,
  cashboxType: null,
};

const Payments = () => {
  const { t } = useTranslation("payment");
  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Dropdown states
  const [operationDropdownOpen, setOperationDropdownOpen] = useState(false);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [creatorDropdownOpen, setCreatorDropdownOpen] = useState(false);
  const [cashboxDropdownOpen, setCashboxDropdownOpen] = useState(false);

  const operationDropdownRef = useRef<HTMLDivElement>(null);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);
  const creatorDropdownRef = useRef<HTMLDivElement>(null);
  const cashboxDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (role === "courier" || role === "market") {
      navigate(`cash-box`);
    }
  }, [user, role, pathname]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        operationDropdownRef.current &&
        !operationDropdownRef.current.contains(event.target as Node)
      ) {
        setOperationDropdownOpen(false);
      }
      if (
        sourceDropdownRef.current &&
        !sourceDropdownRef.current.contains(event.target as Node)
      ) {
        setSourceDropdownOpen(false);
      }
      if (
        creatorDropdownRef.current &&
        !creatorDropdownRef.current.contains(event.target as Node)
      ) {
        setCreatorDropdownOpen(false);
      }
      if (
        cashboxDropdownRef.current &&
        !cashboxDropdownRef.current.contains(event.target as Node)
      ) {
        setCashboxDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [showMarket, setShowMarket] = useState(false);
  const [showCurier, setShowCurier] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [select, setSelect] = useState<null | string>(null);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] =
    useState<IPaymentFilter>(initialState);

  const { getMarkets } = useMarket();
  const { getCourier } = useCourier();
  const { getCashBoxInfo } = useCashBox();
  const searchParam = search ? { search: search } : {};

  // Get all users with cashbox access (superadmin, admin, registrator, courier)
  const { getUsersExceptMarket } = useUser();
  const { data: cashboxUsersData } = getUsersExceptMarket({
    limit: 100,
  });

  // Pagination start
  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);
  const { data: cashBoxData, refetch } = getCashBoxInfo(
    role === "superadmin" || role === "admin",
    {
      operationType: paymentFilter.operationType,
      sourceType: paymentFilter.sourceType,
      createdBy: paymentFilter.createdBy,
      cashboxType: paymentFilter.cashboxType,
      page,
      limit,
    }
  );

  const { data, refetch: marketRefetch } = getMarkets(showMarket, {
    ...searchParam,
    limit: 0,
  });
  const { data: courierData } = getCourier(showCurier, { ...searchParam, limit: 0 });
  const total = cashBoxData?.data?.pagination?.total || 0;
  const onChange: PaginationProps["onChange"] = (newPage, limit) => {
    if (newPage === 1) {
      removeParam("page");
    } else {
      setParam("page", newPage);
    }

    if (limit === 10) {
      removeParam("limit");
    } else {
      setParam("limit", limit);
    }
  };

  useEffect(() => {
    if (role === "superadmin" || "admin") {
      marketRefetch();
    }
  }, [showMarket]);

  const handleNavigate = () => {
    navigate(`cash-detail/${select}`);
    setSelect(null);
    setShowMarket(false);
    setShowCurier(false);
  };

  const hendlerClose = () => {
    setShowCurier(false);
    setShowMarket(false);
    setSelect(null);
    setSearch("");
  };

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const operationType = ["income", "expense"];
  const operationOptions = operationType.map((role: string) => ({
    value: role,
    label: t(`${role}`),
  }));

  const sourceType = [
    "courier_payment",
    "market_payment",
    "manual_expense",
    "manual_income",
    "correction",
    "salary",
    "sell",
    "cancel",
    "extra_cost",
    "bills",
  ];
  const sourceOptions = sourceType.map((status: string) => ({
    value: status,
    label: t(`sourceTypes.${status}`),
  }));

  // Get all users with cashbox access (admins + registrators)
  const createdByOptions = cashboxUsersData?.data?.data?.map((user: any) => ({
    value: user?.id,
    label: user?.name,
    role: user?.role,
  }));

  const cashboxType = ["market", "courier", "main"];
  const cashboxOptions = cashboxType.map((status: string) => ({
    value: status,
    label: t(`${status}`),
  }));

  useEffect(() => {
    if (role === "admin" || role === "superadmin") {
      refetch();
    }
  }, [pathname, paymentFilter]);

  if (pathname.startsWith("/payments/")) {
    return <Outlet />;
  }

  const handleHistoryPopup = (id: string) => {
    setSelect(id);
    setShowHistory(true);
  };

  const handleChange = (name: keyof IPaymentFilter, value: string | null) => {
    setPaymentFilter((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const formatDate = (timestamp: string) => {
    return new Date(Number(timestamp)).toLocaleString("uz-UZ");
  };

  const getPaymentMethodBadge = (method: string) => {
    if (method === "click_to_market") {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center gap-1">
          <CreditCard className="w-3 h-3" />
          Click
        </span>
      );
    }
    if (method === "cash") {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1">
          <Banknote className="w-3 h-3" />
          Naqd
        </span>
      );
    }
    if (method === "click") {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <CreditCard className="w-3 h-3" />
          Click
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300">
        {t("sotuv")}
      </span>
    );
  };

  const hasActiveFilters =
    paymentFilter.operationType ||
    paymentFilter.sourceType ||
    paymentFilter.createdBy ||
    paymentFilter.cashboxType;

  return (
    <div className="bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
              {t("payments") || "To'lovlar"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Kassa va to'lovlarni boshqarish
            </p>
          </div>
        </div>

        {/* 3 Main Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {/* Card 1 - Market Debt (To be paid) */}
          <div
            onClick={() => setShowMarket(true)}
            className="relative overflow-hidden bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700/50 p-5 sm:p-6 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Store className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {t("berilishiKerak")}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
                <CountUp
                  end={cashBoxData?.data?.marketCashboxTotal || 0}
                  duration={1.5}
                  separator=" "
                  suffix=""
                />
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                UZS
              </p>
            </div>
          </div>

          {/* Card 2 - Main Cashbox */}
          <div
            onClick={() =>
              navigate("main-cashbox", {
                state: {
                  role: "pochta",
                },
              })
            }
            className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-1 text-white/80 text-xs">
                  <TrendingUp className="w-4 h-4" />
                  Asosiy kassa
                </div>
              </div>
              <p className="text-sm text-white/70 mb-1">
                {t("kassadagiMiqdor")}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-white">
                <CountUp
                  end={cashBoxData?.data?.mainCashboxTotal || 0}
                  duration={1.5}
                  separator=" "
                  suffix=""
                />
              </p>
              <p className="text-xs text-white/60 mt-1">UZS</p>
            </div>
          </div>

          {/* Card 3 - Courier Debt (To be received) */}
          <div
            onClick={() => setShowCurier(true)}
            className="relative overflow-hidden bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700/50 p-5 sm:p-6 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Truck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <ArrowDownLeft className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {t("olinishiKerak")}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
                <CountUp
                  end={cashBoxData?.data?.courierCashboxTotal || 0}
                  duration={1.5}
                  separator=" "
                  suffix=""
                />
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                UZS
              </p>
            </div>
          </div>
        </div>

        {/* Market Popup */}
        <PaymentPopup isShow={showMarket} onClose={hendlerClose}>
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-full sm:w-[95%] sm:min-w-[700px] max-h-[85vh] sm:max-h-[90vh] px-3 sm:px-6 py-4 sm:py-6 relative flex flex-col">
            <button
              onClick={hendlerClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer z-10"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4 pr-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="font-semibold text-base sm:text-lg text-gray-800 dark:text-white truncate">
                {t("berilishiKerak")}
              </h1>
            </div>

            <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-white dark:bg-[#312D4B] focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 transition-all">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                defaultValue={search}
                onChange={handleSearchChange}
                type="text"
                placeholder={`${t("search")}...`}
                className="w-full bg-transparent text-sm outline-none text-gray-800 dark:text-white placeholder-gray-400"
              />
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-3 sm:px-4 py-3">
                <div className="flex items-center text-white text-xs sm:text-sm font-medium">
                  <div className="w-8 sm:w-10">#</div>
                  <div className="flex-1 min-w-0">{t("marketName")}</div>
                  <div className="text-right flex-shrink-0">
                    {t("berilishiKerakSumma")}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {data?.data?.data?.map((item: any, inx: number) => (
                  <div
                    key={item?.id}
                    onClick={() => setSelect(item?.id)}
                    className={`flex items-center px-3 sm:px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 transition-all ${
                      item.id === select
                        ? "bg-purple-100 dark:bg-purple-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="w-8 sm:w-10 text-purple-600 dark:text-purple-400 font-medium text-sm">
                      {inx + 1}
                    </div>
                    <div className="flex-1 min-w-0 text-sm text-gray-800 dark:text-white font-medium truncate">
                      {item?.name}
                    </div>
                    <div className="text-right text-sm text-gray-600 dark:text-gray-300 flex-shrink-0 ml-2">
                      {item?.cashbox?.balance?.toLocaleString()} UZS
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                disabled={!select}
                onClick={handleNavigate}
                className={`px-5 sm:px-6 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  select
                    ? "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                {t("tanlash")}
              </button>
            </div>
          </div>
        </PaymentPopup>

        {/* Courier Popup */}
        <PaymentPopup isShow={showCurier} onClose={hendlerClose}>
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-full sm:w-[95%] sm:min-w-[700px] max-h-[85vh] sm:max-h-[90vh] px-3 sm:px-6 py-4 sm:py-6 relative flex flex-col">
            <button
              onClick={() => hendlerClose()}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer z-10"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4 pr-10">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="font-semibold text-base sm:text-lg text-gray-800 dark:text-white truncate">
                {t("olinishiKerak")}
              </h1>
            </div>

            <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-white dark:bg-[#312D4B] focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 transition-all">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                defaultValue={search}
                onChange={handleSearchChange}
                type="text"
                placeholder={`${t("search")}...`}
                className="w-full bg-transparent text-sm outline-none text-gray-800 dark:text-white placeholder-gray-400"
              />
            </div>

            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-3 sm:px-4 py-3">
                <div className="flex items-center text-white text-xs sm:text-sm font-medium">
                  <div className="w-8 sm:w-10">#</div>
                  <div className="flex-1 min-w-0">{t("courierName")}</div>
                  <div className="hidden sm:block w-[120px] text-center">{t("region")}</div>
                  <div className="text-right flex-shrink-0">
                    {t("olinishiKerakSumma")}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {courierData?.data?.map((item: any, inx: number) => (
                  <div
                    key={item?.id}
                    onClick={() => setSelect(item?.id)}
                    className={`flex items-center px-3 sm:px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 transition-all ${
                      item.id === select
                        ? "bg-amber-100 dark:bg-amber-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="w-8 sm:w-10 text-amber-600 dark:text-amber-400 font-medium text-sm">
                      {inx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-white font-medium truncate">
                        {item?.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate sm:hidden">
                        {item?.region?.name}
                      </p>
                    </div>
                    <div className="hidden sm:block w-[120px] text-center text-sm text-gray-500 dark:text-gray-400 truncate">
                      {item?.region?.name}
                    </div>
                    <div className="text-right text-sm text-gray-600 dark:text-gray-300 flex-shrink-0 ml-2">
                      {item?.cashbox?.balance?.toLocaleString()} UZS
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                disabled={!select}
                onClick={handleNavigate}
                className={`px-5 sm:px-6 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  select
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                {t("tanlash")}
              </button>
            </div>
          </div>
        </PaymentPopup>

        {/* Filters Section */}
        <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-200">
              {t("filter")}
            </h2>
            {hasActiveFilters && (
              <button
                onClick={() => setPaymentFilter(initialState)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                {t("tozalash")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Operation Type Dropdown */}
            <div className="relative" ref={operationDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {t("operationType")}
              </label>
              <button
                type="button"
                onClick={() => setOperationDropdownOpen(!operationDropdownOpen)}
                className="w-full h-10 sm:h-11 px-3 text-sm rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-left flex items-center justify-between cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
              >
                <span
                  className={
                    paymentFilter.operationType
                      ? "text-gray-800 dark:text-white"
                      : "text-gray-400"
                  }
                >
                  {paymentFilter.operationType
                    ? operationOptions.find(
                        (o) => o.value === paymentFilter.operationType
                      )?.label
                    : "Tanlang"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${operationDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {operationDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#312D4B] rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                  <div
                    onClick={() => {
                      handleChange("operationType", null);
                      setOperationDropdownOpen(false);
                    }}
                    className="px-4 py-2.5 text-sm cursor-pointer text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    Barchasi
                  </div>
                  {operationOptions.map((option) => (
                    <div
                      key={option.value}
                      onClick={() => {
                        handleChange("operationType", option.value);
                        setOperationDropdownOpen(false);
                      }}
                      className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 ${
                        paymentFilter.operationType === option.value
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {option.value === "income" ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      {option.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Source Type Dropdown */}
            <div className="relative" ref={sourceDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {t("sourceType")}
              </label>
              <button
                type="button"
                onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
                className="w-full h-10 sm:h-11 px-3 text-sm rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-left flex items-center justify-between cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
              >
                <span
                  className={
                    paymentFilter.sourceType
                      ? "text-gray-800 dark:text-white truncate"
                      : "text-gray-400"
                  }
                >
                  {paymentFilter.sourceType
                    ? sourceOptions.find(
                        (o) => o.value === paymentFilter.sourceType
                      )?.label
                    : "Tanlang"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${sourceDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {sourceDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#312D4B] rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg max-h-48 overflow-y-auto">
                  <div
                    onClick={() => {
                      handleChange("sourceType", null);
                      setSourceDropdownOpen(false);
                    }}
                    className="px-4 py-2.5 text-sm cursor-pointer text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    Barchasi
                  </div>
                  {sourceOptions.map((option) => (
                    <div
                      key={option.value}
                      onClick={() => {
                        handleChange("sourceType", option.value);
                        setSourceDropdownOpen(false);
                      }}
                      className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                        paymentFilter.sourceType === option.value
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {option.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Creator Dropdown */}
            <div className="relative" ref={creatorDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {t("createdBy")}
              </label>
              <button
                type="button"
                onClick={() => setCreatorDropdownOpen(!creatorDropdownOpen)}
                className="w-full h-10 sm:h-11 px-3 text-sm rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-left flex items-center justify-between cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
              >
                <span
                  className={
                    paymentFilter.createdBy
                      ? "text-gray-800 dark:text-white truncate"
                      : "text-gray-400"
                  }
                >
                  {paymentFilter.createdBy
                    ? createdByOptions?.find(
                        (o: any) => o.value === paymentFilter.createdBy
                      )?.label
                    : "Tanlang"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${creatorDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {creatorDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#312D4B] rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg max-h-48 overflow-y-auto">
                  <div
                    onClick={() => {
                      handleChange("createdBy", null);
                      setCreatorDropdownOpen(false);
                    }}
                    className="px-4 py-2.5 text-sm cursor-pointer text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    Barchasi
                  </div>
                  {createdByOptions?.map((option: any) => (
                    <div
                      key={option.value}
                      onClick={() => {
                        handleChange("createdBy", option.value);
                        setCreatorDropdownOpen(false);
                      }}
                      className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                        paymentFilter.createdBy === option.value
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{option.label}</p>
                          <p className="text-xs text-gray-400">{option.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cashbox Type Dropdown */}
            <div className="relative" ref={cashboxDropdownRef}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {t("cashboxtype")}
              </label>
              <button
                type="button"
                onClick={() => setCashboxDropdownOpen(!cashboxDropdownOpen)}
                className="w-full h-10 sm:h-11 px-3 text-sm rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-left flex items-center justify-between cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
              >
                <span
                  className={
                    paymentFilter.cashboxType
                      ? "text-gray-800 dark:text-white"
                      : "text-gray-400"
                  }
                >
                  {paymentFilter.cashboxType
                    ? cashboxOptions.find(
                        (o) => o.value === paymentFilter.cashboxType
                      )?.label
                    : "Tanlang"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${cashboxDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {cashboxDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#312D4B] rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                  <div
                    onClick={() => {
                      handleChange("cashboxType", null);
                      setCashboxDropdownOpen(false);
                    }}
                    className="px-4 py-2.5 text-sm cursor-pointer text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    Barchasi
                  </div>
                  {cashboxOptions.map((option) => (
                    <div
                      key={option.value}
                      onClick={() => {
                        handleChange("cashboxType", option.value);
                        setCashboxDropdownOpen(false);
                      }}
                      className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 ${
                        paymentFilter.cashboxType === option.value
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {option.value === "market" ? (
                        <Store className="w-4 h-4 text-emerald-500" />
                      ) : option.value === "courier" ? (
                        <Truck className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Building2 className="w-4 h-4 text-purple-500" />
                      )}
                      {option.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
            <h2 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {t("history") || "Tarix"}
            </h2>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gradient-to-r from-purple-500 to-indigo-600">
                  <th className="px-4 py-3 text-left text-sm font-medium text-white w-14">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-white">
                    {t("createdBy")}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-white">
                    {t("cashboxtype")}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-white">
                    {t("operationType")}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-white">
                    {t("amount")}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-white">
                    {t("paymentDate")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {cashBoxData?.data?.allCashboxHistories?.map(
                  (item: any, inx: number) => (
                    <tr
                      key={item.id}
                      onClick={() => handleHistoryPopup(item.id)}
                      className="hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                          {(page - 1) * limit + inx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-white">
                            {item?.createdByUser?.name}
                          </p>
                          <p
                            className={`text-xs ${
                              item?.createdByUser?.role === "superadmin"
                                ? "text-red-500"
                                : item?.createdByUser?.role === "admin"
                                  ? "text-purple-500"
                                  : "text-blue-500"
                            }`}
                          >
                            {item?.createdByUser?.role}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getPaymentMethodBadge(item?.payment_method)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            item?.operation_type === "income"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          }`}
                        >
                          {t(item?.operation_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-semibold ${
                            item?.operation_type === "income"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {item?.operation_type === "income" ? "+" : "-"}
                          {Number(item?.amount || 0).toLocaleString("uz-UZ")} UZS
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {formatDate(item?.created_at)}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {cashBoxData?.data?.allCashboxHistories?.map(
              (item: any, _inx: number) => (
                <div
                  key={item.id}
                  onClick={() => handleHistoryPopup(item.id)}
                  className="p-3 sm:p-4 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          item?.operation_type === "income"
                            ? "bg-green-100 dark:bg-green-900/30"
                            : "bg-red-100 dark:bg-red-900/30"
                        }`}
                      >
                        {item?.operation_type === "income" ? (
                          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                          {item?.createdByUser?.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item?.createdByUser?.role}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getPaymentMethodBadge(item?.payment_method)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-sm font-bold ${
                          item?.operation_type === "income"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {item?.operation_type === "income" ? "+" : "-"}
                        {Number(item?.amount || 0).toLocaleString("uz-UZ")}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">UZS</p>
                      <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {formatDate(item?.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row items-center justify-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                Jami: {total} ta
              </span>
              <Pagination
                showSizeChanger
                current={page}
                total={total}
                pageSize={limit}
                onChange={onChange}
                size="small"
                responsive
                showTotal={(total) => (
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                    Jami: {total} ta
                  </span>
                )}
              />
            </div>
          )}
        </div>
      </div>

      {showHistory && (
        <HistoryPopup id={select} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
};

export default React.memo(Payments);
