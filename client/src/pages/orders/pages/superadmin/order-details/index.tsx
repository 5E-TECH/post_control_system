import { memo } from "react";
import Details from "../../../components/orderDetails";
import ShippingAddress from "../../../components/shipping address";
import CustomerDetail from "../../../components/customer detail";
import { useNavigate, useParams } from "react-router-dom";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import QRCode from "react-qr-code";
import { useTranslation } from "react-i18next";
import { useGlobalScanner } from "../../../../../shared/components/global-scanner";
import { Modal } from "antd";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import {
  ArrowLeft,
  Store,
  RotateCcw,
  Loader2,
  QrCode,
  Truck,
} from "lucide-react";

const statusConfig: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string; icon: string }
> = {
  new: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    darkBg: "dark:bg-sky-900/30",
    darkText: "dark:text-sky-400",
    icon: "🆕",
  },
  received: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    darkBg: "dark:bg-purple-900/30",
    darkText: "dark:text-purple-400",
    icon: "📦",
  },
  "on the road": {
    bg: "bg-orange-100",
    text: "text-orange-700",
    darkBg: "dark:bg-orange-900/30",
    darkText: "dark:text-orange-400",
    icon: "🚚",
  },
  waiting: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    darkBg: "dark:bg-amber-900/30",
    darkText: "dark:text-amber-400",
    icon: "⏳",
  },
  sold: {
    bg: "bg-green-100",
    text: "text-green-700",
    darkBg: "dark:bg-green-900/30",
    darkText: "dark:text-green-400",
    icon: "✅",
  },
  cancelled: {
    bg: "bg-red-100",
    text: "text-red-700",
    darkBg: "dark:bg-red-900/30",
    darkText: "dark:text-red-400",
    icon: "❌",
  },
  paid: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    darkBg: "dark:bg-emerald-900/30",
    darkText: "dark:text-emerald-400",
    icon: "💰",
  },
  partly_paid: {
    bg: "bg-teal-100",
    text: "text-teal-700",
    darkBg: "dark:bg-teal-900/30",
    darkText: "dark:text-teal-400",
    icon: "💵",
  },
  "cancelled (sent)": {
    bg: "bg-gray-100",
    text: "text-gray-700",
    darkBg: "dark:bg-gray-800",
    darkText: "dark:text-gray-400",
    icon: "🚫",
  },
  closed: {
    bg: "bg-zinc-100",
    text: "text-zinc-700",
    darkBg: "dark:bg-zinc-800",
    darkText: "dark:text-zinc-400",
    icon: "🔒",
  },
};

const OrderDetails = () => {
  useGlobalScanner();
  const { t } = useTranslation("orderList");
  const { t: st } = useTranslation("status");
  const { id } = useParams();
  const navigate = useNavigate();

  const { getOrderById, rollbackOrder } = useOrder();
  const { handleSuccess, handleApiError } = useApiNotification();
  const { data, isLoading } = getOrderById(id);
  const token = data?.data?.qr_code_token;
  const status = data?.data?.status;
  const statusStyle = statusConfig[status] || statusConfig.new;

  const role =
    useSelector((state: RootState) => state.roleSlice.role) ||
    localStorage.getItem("role");
  const canRollback =
    role === "superadmin" && (status === "paid" || status === "partly_paid");

  const confirmRollback = () => {
    rollbackOrder.mutate(id as string, {
      onSuccess: () => {
        handleSuccess("Buyurtma rollback qilindi");
      },
      onError: (err: any) => {
        handleApiError(err, "Rollback bajarilmadi");
      },
    });
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Orqaga qaytish
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white capitalize">
                  {data?.data?.market?.name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("detail.title")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${statusStyle.bg} ${statusStyle.text} ${statusStyle.darkBg} ${statusStyle.darkText}`}
              >
                <span>{statusStyle.icon}</span>
                {st(`${status}`)}
              </span>

              {/* Rollback Button */}
              {canRollback && (
                <button
                  onClick={() =>
                    Modal.confirm({
                      title: "Rollback qilishni tasdiqlaysizmi?",
                      content:
                        "To'langan (paid/partly_paid) buyurtma kutilgan holatga qaytariladi, balanslar orqaga o'zgaradi.",
                      okText: "Ha",
                      cancelText: "Yo'q",
                      onOk: confirmRollback,
                    })
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Rollback
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Details
              items={data?.data?.items}
              to_be_paid={data?.data?.to_be_paid}
              paid_amount={data?.data?.paid_amount}
              total_price={data?.data?.total_price}
              marketId={data?.data?.market?.id}
              comment={data?.data?.comment}
              deleveryStatus={data?.data?.where_deliver}
              status={data?.data?.status}
            />

            {/* QR Code */}
            {token && (
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">
                      QR Kod
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Buyurtmani tasdiqlash uchun skanerlang
                    </p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl shadow-inner">
                    <QRCode
                      size={160}
                      value={token}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Customer & Shipping Info */}
          <div className="space-y-6">
            {/* Customer Details */}
            <CustomerDetail customer={data?.data?.customer} />

            {/* Shipping Address - Order dan manzil olish */}
            <ShippingAddress
              address={data?.data?.address || data?.data?.customer?.address}
              districtId={data?.data?.district_id || data?.data?.customer?.district_id}
              id={data?.data?.id}
              isOrderAddress={true}
            />

            {/* Courier Info */}
            {data?.data?.post?.courier && (
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 dark:text-white">
                        {t("detail.courier")}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Yetkazib beruvchi ma'lumotlari
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {t("detail.courierName")}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-white">
                      {data?.data?.post?.courier?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {t("detail.courierPhone")}
                    </span>
                    <a
                      href={`tel:${data?.data?.post?.courier?.phone_number}`}
                      className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      {data?.data?.post?.courier?.phone_number}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderDetails);
