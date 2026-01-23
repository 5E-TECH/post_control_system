import {
  Package,
  Search,
  X,
  Plus,
  Store,
  Loader2,
  ShoppingBag,
  Check,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Popup from "../../shared/ui/Popup";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";
import ProductView from "../../shared/components/product-view";
import { useProduct } from "../../shared/api/hooks/useProduct";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { debounce } from "../../shared/helpers/DebounceFunc";
import { useProfile } from "../../shared/api/hooks/useProfile";
import { togglePermission } from "../../shared/lib/features/add-order-permission";
import { useTranslation } from "react-i18next";
import { setPage } from "../../shared/lib/features/paginationProductSlice";

const Products = () => {
  const { t } = useTranslation("product");
  const [showMarket, setShowMarket] = useState(false);
  const [select, setSelect] = useState<string | null>("");
  const [searchProduct, setSearchProduct] = useState<any>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchPopup, setSearchPopup] = useState<any>(null);
  const [searchPopupValue, setSearchPopupValue] = useState("");
  const [searchByMarket, setSearchByMarket] = useState<any>(undefined);
  const dispatch = useDispatch();

  const { page, limit } = useSelector(
    (state: RootState) => state.paginationSlice
  );

  useEffect(() => {
    return () => {
      dispatch(togglePermission(false));
      dispatch(setPage(1));
    };
  }, [dispatch]);

  const { id, role } = useSelector((state: RootState) => state.roleSlice);

  const permission = useSelector(
    (state: RootState) => state.togglePermission.value
  );
  const { refetch } = useProfile().getUser(role === "market");

  const handleCheck = async () => {
    const res = await refetch();
    const addOrder = res.data.data.add_order;
    if (!addOrder && res.data.data.role === "market") {
      dispatch(togglePermission(true));
      return;
    }
    navigate(`create/${select}`);
  };

  useEffect(() => {
    if (role === "market") {
      setSelect(id);
    }
  }, [role, id]);

  const navigate = useNavigate();

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchProduct(value);
      }, 500),
    []
  );

  const popupDebouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchPopup(value);
      }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  const handlePopupSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchPopupValue(value);
    popupDebouncedSearch(value);
  };

  const handleNavigate = () => {
    navigate(`create/${select}`);
    setSelect("");
    setShowMarket(false);
  };

  const { getProducts, getMyProducts } = useProduct();
  const { data: productData, isLoading } =
    role === "market"
      ? getMyProducts({ search: searchProduct, page, limit })
      : getProducts({
          search: searchProduct,
          marketId: searchByMarket,
          page,
          limit,
        });

  const { getMarkets } = useMarket();

  const { data: marketsData, isLoading: marketsLoading } = getMarkets(
    role !== "market",
    {
      search: searchPopup,
      limit: 0,
    }
  );

  const { pathname } = useLocation();

  const markets = marketsData?.data?.data || [];

  // Stats
  const totalProducts =
    productData?.data?.total || productData?.data?.products?.length || 0;

  if (pathname.startsWith("/products/create")) return <Outlet />;

  return !permission ? (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
                  {t("title")}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                  Mahsulotlarni boshqarish
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (role === "market") {
                  handleCheck();
                } else {
                  setShowMarket(true);
                }
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm sm:text-base font-medium shadow-lg shadow-purple-500/25 hover:shadow-xl transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xs:inline">{t("addProduct")}</span>
              <span className="xs:hidden">Qo'shish</span>
            </button>
          </div>
        </div>

        {/* Stats Card - inline with filters on mobile */}
        <div className="mb-4 sm:mb-6">
          <div className="bg-white dark:bg-[#2A263D] rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 inline-flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                Jami
              </p>
              <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white">
                {totalProducts} ta
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-100 dark:border-gray-700/50">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            {/* Market Filter */}
            {role !== "market" && (
              <div className="relative flex-1 sm:flex-initial sm:w-48 md:w-56 lg:w-64">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={searchByMarket || ""}
                  onChange={(e) => setSearchByMarket(e.target.value || undefined)}
                  className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-3 sm:pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">{t("placeholder.selectMarket")}</option>
                  {markets.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search */}
            <div className="relative flex-1 sm:flex-initial sm:w-48 md:w-56 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={searchValue}
                onChange={handleSearchChange}
                className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-3 sm:pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                type="text"
                placeholder={`${t("placeholder.search")}...`}
              />
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/50">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 sm:py-20">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-purple-500" />
            </div>
          ) : (
            <ProductView
              data={productData?.data?.products || productData?.data?.items}
              total={productData?.data?.total}
            />
          )}
        </div>

        {/* Market Selection Modal */}
        <Popup isShow={showMarket} onClose={() => setShowMarket(false)}>
          <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl w-[95vw] sm:w-[90vw] max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <Store className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
                  {t("placeholder.selectMarket")}
                </h2>
              </div>
              <button
                onClick={() => setShowMarket(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchPopupValue}
                  onChange={handlePopupSearchChange}
                  placeholder={`${t("placeholder.search")}...`}
                  className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            {/* Markets List */}
            <div className="max-h-[50vh] sm:max-h-[400px] overflow-y-auto">
              {marketsLoading ? (
                <div className="flex items-center justify-center py-10 sm:py-12">
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-purple-500" />
                </div>
              ) : markets.length === 0 ? (
                <div className="py-10 sm:py-12 text-center px-4">
                  <Store className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                    Market topilmadi
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {markets.map((item: any, index: number) => {
                    const isSelected = item.id === select;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelect(isSelected ? null : item.id)}
                        className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? "bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-2 border-transparent"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm font-medium flex-shrink-0 ${
                            isSelected
                              ? "bg-purple-500 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm sm:text-base font-medium truncate ${
                              isSelected
                                ? "text-purple-700 dark:text-purple-300"
                                : "text-gray-800 dark:text-white"
                            }`}
                          >
                            {item.name}
                          </p>
                          {item.phone_number && (
                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                              {item.phone_number}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-end gap-2 sm:gap-3">
              <button
                onClick={() => setShowMarket(false)}
                className="px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleNavigate}
                disabled={!select}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base rounded-lg sm:rounded-xl font-medium transition-all ${
                  select
                    ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl cursor-pointer"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                {t("popup.tanlash")}
              </button>
            </div>
          </div>
        </Popup>
      </div>
    </div>
  ) : (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-lg text-center max-w-md w-full">
        <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3 sm:mb-4">
          <X className="w-6 h-6 sm:w-8 sm:h-8 text-red-500" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-1.5 sm:mb-2">
          Ruxsat yo'q
        </h2>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
          Sizda mahsulot qo'shish huquqi yo'q
        </p>
      </div>
    </div>
  );
};

export default memo(Products);
