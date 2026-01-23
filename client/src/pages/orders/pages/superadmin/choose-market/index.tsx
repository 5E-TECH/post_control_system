import { Pagination, type PaginationProps, Empty } from "antd";
import {
  Store,
  Search,
  ArrowRight,
  Phone,
  CheckCircle2,
  Loader2,
  User,
  ShoppingCart,
} from "lucide-react";
import { memo, useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMarket } from "../../../../../shared/api/hooks/useMarket/useMarket";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { debounce } from "../../../../../shared/helpers/DebounceFunc";
import { useTranslation } from "react-i18next";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import { buildAdminPath } from "../../../../../shared/const";

const ChooseMarket = () => {
  const { t } = useTranslation("createOrder");
  const { getMarkets } = useMarket();
  const [searchMarket, setSearchMarket] = useState<string>("");
  const [selectedMarket, setSelectedMarket] = useState<any>(null);

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);

  const { data, isLoading } = getMarkets(true, {
    search: searchMarket || undefined,
    page,
    limit,
  });
  const markets = Array.isArray(data?.data?.data) ? data?.data?.data : [];
  const total = data?.data?.total || 0;

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    if (newPage === 1) {
      removeParam("page");
    } else {
      setParam("page", newPage);
    }
    if (newLimit === 10) {
      removeParam("limit");
    } else {
      setParam("limit", newLimit);
    }
  };

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchMarket(value);
      }, 500),
    []
  );

  const navigate = useNavigate();
  const { handleWarning } = useApiNotification();
  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;

  useEffect(() => {
    if (role === "market" && user.id) {
      localStorage.setItem("marketId", user.id);
      navigate(buildAdminPath("orders/customer-info"));
    }
  }, [role, user, navigate]);

  const onClick = () => {
    if (!selectedMarket) {
      handleWarning(
        "Market tanlanmagan!",
        "Iltimos, davom etishdan oldin marketni tanlang"
      );
      return;
    }
    localStorage.setItem("market", JSON.stringify(selectedMarket));
    navigate(buildAdminPath("orders/customer-info"));
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            {t("process")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Buyurtma yaratish uchun qadamlarni bajaring
          </p>
        </div>

        <div className="flex gap-6 max-[1100px]:flex-col">
          {/* Steps Sidebar */}
          <div className="w-full max-w-xs max-[1100px]:max-w-full flex-shrink-0">
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-5 sticky top-6">
              {/* Step 1 - Current */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg ring-4 ring-purple-100 dark:ring-purple-900/30">
                    <Store className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-0.5 h-12 bg-gray-200 dark:bg-gray-700 mt-2"></div>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                      1-qadam
                    </span>
                    <span className="text-xs text-purple-500 dark:text-purple-400">
                      Hozirgi
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                    {t("step.one.title")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t("step.one.description")}
                  </p>

                  {/* Selected Market Preview */}
                  {selectedMarket && (
                    <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                          <Store className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 dark:text-white text-sm truncate capitalize">
                            {selectedMarket.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {selectedMarket.phone_number}
                          </p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 - Pending */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                    <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="w-0.5 h-12 bg-gray-200 dark:bg-gray-700 mt-2"></div>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      2-qadam
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-400 dark:text-gray-500 text-sm">
                    {t("step.two.title")}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                    {t("step.two.description")}
                  </p>
                </div>
              </div>

              {/* Step 3 - Pending */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                    <ShoppingCart className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                      3-qadam
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-400 dark:text-gray-500 text-sm">
                    {t("step.three.title")}
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                    {t("step.three.description")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-5">
            {/* Market Selection Card */}
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                        {t("chooseMarket")}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Jami: {total} ta market
                      </p>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      onChange={(e) => debouncedSearch(e.target.value)}
                      placeholder="Market qidirish..."
                      className="w-full h-10 pl-10 pr-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Markets Grid */}
              <div className="p-5">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  </div>
                ) : markets.length === 0 ? (
                  <Empty
                    description={
                      <span className="text-gray-500 dark:text-gray-400">
                        Market topilmadi
                      </span>
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {markets.map((market: any) => {
                      const isSelected = selectedMarket?.id === market.id;
                      return (
                        <button
                          key={market.id}
                          onClick={() =>
                            isSelected
                              ? setSelectedMarket(null)
                              : setSelectedMarket(market)
                          }
                          className={`relative p-4 rounded-xl border-2 transition-all text-left cursor-pointer group ${
                            isSelected
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                              : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3">
                              <CheckCircle2 className="w-5 h-5 text-purple-500" />
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? "bg-purple-500"
                                  : "bg-gray-200 dark:bg-gray-700 group-hover:bg-purple-400"
                              } transition-colors`}
                            >
                              <Store
                                className={`w-5 h-5 ${
                                  isSelected
                                    ? "text-white"
                                    : "text-gray-500 dark:text-gray-400 group-hover:text-white"
                                } transition-colors`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3
                                className={`font-semibold text-sm truncate capitalize ${
                                  isSelected
                                    ? "text-purple-700 dark:text-purple-300"
                                    : "text-gray-800 dark:text-white"
                                }`}
                              >
                                {market.name}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {market.phone_number}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {total > limit && (
                  <div className="flex justify-center mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/50">
                    <Pagination
                      showSizeChanger
                      current={page}
                      total={total}
                      pageSize={limit}
                      onChange={onChange}
                      className="[&_.ant-pagination-item-active]:bg-purple-500! [&_.ant-pagination-item-active]:border-purple-500! [&_.ant-pagination-item-active_a]:text-white!"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Next Button */}
            <div className="flex justify-end">
              <button
                onClick={onClick}
                disabled={!selectedMarket}
                className={`h-11 px-6 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
                  selectedMarket
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-purple-500/25 cursor-pointer"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
              >
                {t("next")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ChooseMarket);
