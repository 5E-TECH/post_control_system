import {
  Check,
  Store,
  User,
  ShoppingCart,
  ArrowLeft,
  Loader2,
  Phone,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { memo } from "react";
import type { RootState } from "../../../../../app/store";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import OrderItems from "../../../components/order-items";
import ProductInfo from "../../../components/product-info";
import {
  resetOrderItems,
  setCustomerData,
  setProductInfo,
} from "../../../../../shared/lib/features/customer_and_market-id";
import { useTranslation } from "react-i18next";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { buildAdminPath } from "../../../../../shared/const";

const CreateOrder = () => {
  const { t } = useTranslation("createOrder");
  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const customer = JSON.parse(localStorage.getItem("customer") ?? "null");

  const market_id = market?.id;
  const customer_id = customer?.id;

  const orderItems = useSelector(
    (state: RootState) => state.setOrderItems.orderItems
  );
  const productInfo = useSelector(
    (state: RootState) => state.setProductInfo.productInfo
  );
  const { createOrder } = useOrder();

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const user = useSelector((state: RootState) => state.roleSlice);

  const marketdata = useSelector(
    (state: RootState) => state.authSlice.marketData
  );

  const { handleApiError, handleWarning } = useApiNotification();

  const handleClick = () => {
    if (
      !orderItems ||
      orderItems.length === 0 ||
      orderItems.some((item: any) => !item.quantity || item.quantity === 0)
    ) {
      handleWarning(
        t("orderForm.incompleteOrderData"),
        t("orderForm.fillAllFields")
      );
      return;
    }
    if (
      productInfo?.total_price === null ||
      productInfo?.total_price === undefined ||
      !productInfo?.where_deliver
    ) {
      handleWarning(
        t("productForm.incompleteProductData"),
        t("productForm.fillAllFields")
      );
      return;
    }

    const newOrder = {
      market_id,
      customer_id,
      order_item_info: orderItems,
      total_price: productInfo?.total_price,
      where_deliver: productInfo?.where_deliver,
      comment: productInfo?.comment,
      operator: productInfo?.operator,
      // Buyurtma uchun yetkazib berish manzili
      district_id: customer?.district_id,
      address: customer?.address,
    };
    createOrder.mutate(newOrder, {
      onSuccess: () => {
        dispatch(setCustomerData(null));
        dispatch(resetOrderItems());
        dispatch(setProductInfo(null));
        navigate(buildAdminPath("orders/customer-info"));
      },
      onError: (err: any) =>
        handleApiError(err, "Buyurtma yaratishda xatolik yuz berdi"),
    });
  };

  const handleBack = () => {
    navigate(buildAdminPath("orders/customer-info"));
  };

  const marketName = user.role === "market" ? marketdata?.name : market?.name;
  const marketPhone =
    user.role === "market" ? marketdata?.phone_number : market?.phone_number;

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
          <div className="w-full max-w-xs max-[1100px]:max-w-full flex-shrink-0 overflow-hidden">
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-5 sticky top-6 overflow-hidden">
              {/* Step 1 - Completed */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-0.5 h-12 bg-green-500 mt-2"></div>
                </div>
                <div className="flex-1 pt-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                      1-qadam
                    </span>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                    Market tanlandi
                  </h3>
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                        <Store className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-medium text-gray-800 dark:text-white text-sm capitalize truncate" title={marketName}>
                          {marketName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {marketPhone}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 - Completed */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-0.5 h-12 bg-gradient-to-b from-green-500 to-purple-500 mt-2"></div>
                </div>
                <div className="flex-1 pt-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                      2-qadam
                    </span>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                    Mijoz tanlandi
                  </h3>
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-medium text-gray-800 dark:text-white text-sm truncate capitalize" title={customer?.name}>
                          {customer?.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{customer?.phone_number}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 - Current */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg ring-4 ring-purple-100 dark:ring-purple-900/30">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex-1 pt-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                      3-qadam
                    </span>
                    <span className="text-xs text-purple-500 dark:text-purple-400">
                      Hozirgi
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                    {t("step.three.title")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t("step.three.description")}
                  </p>

                  {/* Order Summary Preview */}
                  {orderItems && orderItems.length > 0 && (
                    <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Mahsulotlar:
                        </span>
                        <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                          {orderItems.length} ta
                        </span>
                      </div>
                      {productInfo?.total_price && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Jami:
                          </span>
                          <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                            {productInfo.total_price.toLocaleString()} so'm
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-5">
            {/* Order Items */}
            <OrderItems />

            {/* Product Info */}
            <ProductInfo />

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                onClick={handleBack}
                className="h-11 px-5 rounded-xl flex items-center gap-2 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Orqaga
              </button>
              <button
                onClick={handleClick}
                disabled={createOrder.isPending}
                className={`h-11 px-6 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
                  createOrder.isPending
                    ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-purple-500/25 cursor-pointer"
                }`}
              >
                {createOrder.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Yuklanmoqda...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    {t("createOrder")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CreateOrder);
