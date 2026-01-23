import React, { type FC } from "react";
import AddProduct from "./components";
import { useNavigate, useParams } from "react-router-dom";
import ProductView from "../../shared/components/product-view";
import { useProduct } from "../../shared/api/hooks/useProduct";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Package, Store, ShoppingBag } from "lucide-react";

const ProductsCreate: FC = () => {
  const { t } = useTranslation("product");
  const { id } = useParams();
  const navigate = useNavigate();

  const { role } = useSelector((state: RootState) => state.roleSlice);
  const { page, limit } = useSelector(
    (state: RootState) => state.paginationSlice
  );

  const { getMyProducts, getProductsByMarket } = useProduct();
  const { data } =
    role === "market"
      ? getMyProducts()
      : getProductsByMarket(id, true, { page, limit });

  // Data strukturasini aniqlash - API {data: {products: [...]}} formatida qaytaradi
  const products = Array.isArray(data?.data?.products)
    ? data.data.products
    : Array.isArray(data?.data?.data)
      ? data.data.data
      : Array.isArray(data?.data)
        ? data.data
        : [];

  const marketName = products?.[0]?.user?.name || "";
  const productsCount = products?.length || 0;
  const totalProducts = data?.data?.total || productsCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => navigate("/products")}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-all cursor-pointer flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <Package className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-white truncate">
                {t("add")}
              </h1>
              {marketName && (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 sm:gap-1.5 truncate">
                  <Store className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{marketName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center flex-shrink-0">
            <div className="bg-white dark:bg-[#2A263D] rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-2 sm:py-2.5 shadow-sm border border-gray-100 dark:border-gray-700/50 flex items-center gap-1.5 sm:gap-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Mahsulotlar</p>
                <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white">{productsCount} ta</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Product Form */}
        <div className="mb-4 sm:mb-6">
          <AddProduct />
        </div>

        {/* Existing Products */}
        <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/50">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700/50">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
              Mavjud mahsulotlar
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
              Bu marketga tegishli barcha mahsulotlar
            </p>
          </div>
          <ProductView
            data={products}
            total={totalProducts}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProductsCreate);
