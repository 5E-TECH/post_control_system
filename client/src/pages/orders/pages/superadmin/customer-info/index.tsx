import {
  ArrowRight,
  ArrowLeft,
  Check,
  Store,
  User,
  ShoppingCart,
  Loader2,
  Phone,
} from "lucide-react";
import { memo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import CustomerInfo from "../../../components/customer-info";
import { useTranslation } from "react-i18next";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { buildAdminPath } from "../../../../../shared/const";

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerInfoOrder);
