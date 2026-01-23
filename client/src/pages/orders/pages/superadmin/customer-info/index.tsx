import {
  ArrowRight,
  ArrowLeft,
  Check,
  Store,
  User,
  ShoppingCart,
  Loader2,
  Phone,
  Package,
  Clock,
  Eye,
  AlertCircle,
  MapPin,
  Home,
  Building2,
} from "lucide-react";
import { memo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import CustomerInfo from "../../../components/customer-info";
import { useTranslation } from "react-i18next";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { buildAdminPath } from "../../../../../shared/const";
import dayjs from "dayjs";

const CustomerInfoOrder = () => {
  const { t } = useTranslation("createOrder");
  const { pathname } = useLocation();

  if (
    pathname.startsWith(buildAdminPath("orders/confirm", { absolute: true }))
  ) {
    return <Outlet />;
  }

  const customerData = useSelector(
    (state: RootState) => state.setCustomerData.customerData
  );
  const user = useSelector((state: RootState) => state.roleSlice);

  const marketdata = useSelector(
    (state: RootState) => state.authSlice.marketData
  );

  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const market_id = market?.id;
  const { createUser } = useUser("customer");
  const navigate = useNavigate();

  // Marketning yangi buyurtmalarini olish
  const { getMarketNewOrders } = useOrder();
  const { data: newOrdersData, isLoading: newOrdersLoading } = getMarketNewOrders(market_id, !!market_id);
  const marketNewOrders = newOrdersData?.data?.data || [];

  // Format date helper
  const formatDate = (date: string | Date | number) => {
    if (!date) return "-";
    const timestamp = typeof date === "string" ? Number(date) : date;
    if (isNaN(timestamp as number)) {
      const d = dayjs(date);
      return d.isValid() ? d.format("DD.MM.YYYY HH:mm") : "-";
    }
    const d = dayjs(timestamp);
    return d.isValid() ? d.format("DD.MM.YYYY HH:mm") : "-";
  };

  // Format phone number helper (998901234567 -> +998 90 123 45 67)
  const formatPhone = (phone: string | undefined) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("998")) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10, 12)}`;
    }
    if (cleaned.length === 9) {
      return `+998 ${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7, 9)}`;
    }
    return phone;
  };

  const handleViewOrder = (orderId: string) => {
    navigate(buildAdminPath(`orders/order-detail/${orderId}`));
  };

  const { handleApiError, handleWarning } = useApiNotification();

  const handleClick = () => {
    if (
      !customerData?.name ||
      !customerData?.phone_number ||
      !customerData?.district_id
    ) {
      handleWarning(
        "Foydalanuvchi malumotlari to'liq emas",
        "Iltimos malumotlarni to'ldiring"
      );
      return;
    }

    const customer = {
      phone_number: customerData?.phone_number.split(" ").join(""),
      district_id: customerData?.district_id,
      name: customerData?.name,
      address: customerData.address,
      market_id,
      extra_number: customerData.extra_number,
    };
    createUser.mutate(customer, {
      onSuccess: (res) => {
        localStorage.setItem("customer", JSON.stringify(res?.data?.data));
        navigate(buildAdminPath("orders/confirm"));
      },
      onError: (err: any) =>
        handleApiError(err, "Foydalanuvchi yaratishda xatolik yuz berdi"),
    });
  };

  const handleBack = () => {
    navigate(buildAdminPath("orders/choose-market"));
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
          <div className="w-full max-w-xs max-[1100px]:max-w-full flex-shrink-0">
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-5 sticky top-6">
              {/* Step 1 - Completed */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-0.5 h-12 bg-gradient-to-b from-green-500 to-purple-500 mt-2"></div>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                      1-qadam
                    </span>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                    Market tanlandi
                  </h3>
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Store className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 dark:text-white text-sm capitalize truncate">
                          {marketName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {marketPhone}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 - Current */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg ring-4 ring-purple-100 dark:ring-purple-900/30">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-0.5 h-12 bg-gray-200 dark:bg-gray-700 mt-2"></div>
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                      2-qadam
                    </span>
                    <span className="text-xs text-purple-500 dark:text-purple-400">
                      Hozirgi
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                    {t("step.two.title")}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t("step.two.description")}
                  </p>

                  {/* Customer Preview */}
                  {customerData?.name && customerData?.phone_number && (
                    <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 dark:text-white text-sm truncate">
                            {customerData.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {customerData.phone_number}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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
            {/* Customer Info Form */}
            <CustomerInfo />

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              {user.role !== "market" && (
                <button
                  onClick={handleBack}
                  className="h-11 px-5 rounded-xl flex items-center gap-2 text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Orqaga
                </button>
              )}
              <button
                disabled={createUser.isPending}
                onClick={handleClick}
                className={`h-11 px-6 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ml-auto ${
                  createUser.isPending
                    ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-purple-500/25 cursor-pointer"
                }`}
              >
                {createUser.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Yuklanmoqda...
                  </>
                ) : (
                  <>
                    {t("next")}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Marketning yangi buyurtmalari ro'yxati */}
            {market_id && (
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden border-2 border-emerald-200 dark:border-emerald-800/50">
                {/* Header */}
                <div className="p-4 border-b border-emerald-100 dark:border-emerald-800/30 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                          Yangi qo'shilgan buyurtmalar
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Hali jo'natilmagan buyurtmalar ro'yxati
                        </p>
                      </div>
                    </div>
                    {marketNewOrders.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {marketNewOrders.length} ta
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Orders List */}
                <div className="p-4">
                  {newOrdersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                    </div>
                  ) : marketNewOrders.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 dark:text-gray-400">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Yangi buyurtmalar yo'q</p>
                      <p className="text-xs text-gray-400 mt-1">Qo'shilgan buyurtmalar shu yerda ko'rinadi</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {marketNewOrders.map((order: any) => (
                        <div
                          key={order.id}
                          className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all border border-emerald-100 dark:border-emerald-800/30"
                        >
                          {/* Top row: badges and date */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                                <Clock className="w-3 h-3" />
                                Yangi
                              </span>
                              {order.where_deliver === "address" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                  <Home className="w-3 h-3" />
                                  Uyga
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  <Building2 className="w-3 h-3" />
                                  Markazga
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(order.created_at)}
                            </span>
                          </div>

                          {/* Main row: customer info (horizontal) + price */}
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0 flex-wrap">
                              {/* Name */}
                              <span className="text-sm font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                                {order.customer?.name || "Noma'lum mijoz"}
                              </span>
                              {/* Phone */}
                              <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1 whitespace-nowrap">
                                <Phone className="w-3.5 h-3.5" />
                                {formatPhone(order.customer?.phone_number)}
                              </span>
                              {/* Location */}
                              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 whitespace-nowrap">
                                <MapPin className="w-3.5 h-3.5" />
                                {order.customer?.district?.region?.name || order.district?.region?.name || "-"},{" "}
                                {order.customer?.district?.name || order.district?.name || "-"}
                              </span>
                            </div>
                            {/* Price and view */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <p className="text-sm font-bold text-gray-800 dark:text-white whitespace-nowrap">
                                {order.total_price?.toLocaleString()} so'm
                              </p>
                              <button
                                onClick={() => handleViewOrder(order.id)}
                                className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
                              >
                                <Eye className="w-4 h-4" />
                                Ko'rish
                              </button>
                            </div>
                          </div>

                          {/* Products row */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {order.items?.slice(0, 4).map((item: any, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-300"
                              >
                                {item.product?.name || item.product_name} x{item.quantity}
                              </span>
                            ))}
                            {order.items?.length > 4 && (
                              <span className="text-xs text-gray-500">+{order.items.length - 4}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerInfoOrder);
