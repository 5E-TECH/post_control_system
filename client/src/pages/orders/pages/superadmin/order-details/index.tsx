import { memo, useState } from "react";
import Details from "../../../components/orderDetails";
import ShippingAddress from "../../../components/shipping address";
import CustomerDetail from "../../../components/customer detail";
import { useNavigate, useParams } from "react-router-dom";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import QRCode from "react-qr-code";
import { useTranslation } from "react-i18next";
import { useGlobalScanner } from "../../../../../shared/components/global-scanner";
import { InputNumber, Modal } from "antd";
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
  Trash2,
  X,
  AlertCircle,
  Home,
} from "lucide-react";
import OrderTracking from "../../../components/order-tracking";

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

  const { getOrderById, rollbackOrder, deleteOrders, updateOrders } = useOrder();
  const { handleSuccess, handleApiError } = useApiNotification();
  const { data, isLoading, refetch } = getOrderById(id);
  const token = data?.data?.qr_code_token;
  const status = data?.data?.status;
  const statusStyle = statusConfig[status] || statusConfig.new;

  const { role, id: userId } = useSelector((state: RootState) => state.roleSlice);
  const currentRole = role || localStorage.getItem("role");
  const canRollback =
    currentRole === "superadmin" && (status === "paid" || status === "partly_paid");
  const canDelete = currentRole === "market" && status === "new";
  const canEditTariff =
    (currentRole === "admin" || currentRole === "superadmin") &&
    (status === "new" || status === "received" || status === "on the road");

  // Operator faqat o'z buyurtmalarini va faqat new/created statusda tahrirlashi mumkin
  const isOperatorOwnEditableOrder =
    currentRole === "operator" &&
    (status === "new" || status === "created") &&
    data?.data?.operator_id === userId;

  // Umumiy edit ruxsati: operator uchun maxsus, boshqalar uchun eski logika
  const canEditDetails =
    currentRole === "operator"
      ? isOperatorOwnEditableOrder
      : currentRole !== "market" && currentRole !== "courier";

  // Rollback state
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<"waiting" | "cancelled" | "cancelled_sent">("waiting");
  const [addToCancelledPost, setAddToCancelledPost] = useState(true);

  // Tariff editing state
  const [tariffModalOpen, setTariffModalOpen] = useState(false);
  const [tariffMarket, setTariffMarket] = useState<number | null>(null);
  const [tariffCourier, setTariffCourier] = useState<number | null>(null);
  const [editWhereDeliver, setEditWhereDeliver] = useState<string>("center");

  const openTariffEdit = () => {
    setTariffMarket(data?.data?.market_tariff ?? null);
    setTariffCourier(data?.data?.courier_tariff ?? null);
    setEditWhereDeliver(data?.data?.where_deliver || "center");
    setTariffModalOpen(true);
  };

  const closeTariffEdit = () => {
    setTariffModalOpen(false);
    setTariffMarket(null);
    setTariffCourier(null);
  };

  // Standart tarif hisoblash (modal ichidagi tanlangan where_deliver ga qarab)
  const marketTariffHome = data?.data?.market?.tariff_home ?? 0;
  const marketTariffCenter = data?.data?.market?.tariff_center ?? 0;
  const standardTariff = editWhereDeliver === "address" ? marketTariffHome : marketTariffCenter;

  // Kurier tarifi minimumlari
  const maxCourierTariffHome = data?.data?.max_courier_tariff_home ?? 0;
  const maxCourierTariffCenter = data?.data?.max_courier_tariff_center ?? 0;
  const assignedCourierTariffHome = data?.data?.assigned_courier_tariff_home ?? 0;
  const assignedCourierTariffCenter = data?.data?.assigned_courier_tariff_center ?? 0;
  // Yo'lda bo'lsa — aniq kurier tarifi, boshqa holatlarda — viloyat max tarifi
  const isOnTheRoad = status === "on the road";
  const courierMinTariff = isOnTheRoad
    ? (editWhereDeliver === "address" ? assignedCourierTariffHome : assignedCourierTariffCenter)
    : (editWhereDeliver === "address" ? maxCourierTariffHome : maxCourierTariffCenter);

  const isTariffInvalid = tariffMarket != null && tariffCourier != null && tariffMarket < tariffCourier;
  const isMarketBelowStandard = tariffMarket != null && tariffMarket < standardTariff;
  const isCourierBelowStandard = tariffCourier != null && tariffCourier < courierMinTariff;
  const hasValidationError = isTariffInvalid || isMarketBelowStandard || isCourierBelowStandard;

  const handleWhereDeliverChange = (value: string) => {
    setEditWhereDeliver(value);
    // Yetkazib berish joyi o'zgarganda custom tariflarni tozalash
    setTariffMarket(null);
    setTariffCourier(null);
  };

  const handleTariffSave = () => {
    if (hasValidationError) return;
    const payload: any = {};
    if (tariffMarket != null) payload.market_tariff = tariffMarket;
    if (tariffCourier != null) payload.courier_tariff = tariffCourier;
    // where_deliver o'zgargan bo'lsa yuborish
    if (editWhereDeliver !== data?.data?.where_deliver) {
      payload.where_deliver = editWhereDeliver;
    }
    if (Object.keys(payload).length === 0) {
      closeTariffEdit();
      return;
    }

    updateOrders.mutate(
      { id, data: payload },
      {
        onSuccess: () => {
          handleSuccess("Tarif muvaffaqiyatli yangilandi");
          closeTariffEdit();
          refetch();
        },
        onError: (err: any) => {
          handleApiError(err, "Tarifni yangilashda xatolik");
        },
      }
    );
  };

  const confirmRollback = () => {
    const actualTarget = rollbackTarget === "waiting"
      ? "waiting"
      : addToCancelledPost
        ? "cancelled_sent"
        : "cancelled";
    rollbackOrder.mutate(
      { id: id as string, target_status: actualTarget },
      {
        onSuccess: () => {
          const messages: Record<string, string> = {
            waiting: "Buyurtma kutilmoqda holatiga qaytarildi",
            cancelled: "Buyurtma bekor qilindi",
            cancelled_sent: "Buyurtma bekor qilinib pochtaga qo'shildi",
          };
          handleSuccess(messages[actualTarget] || "Rollback bajarildi");
          setRollbackModalOpen(false);
          setRollbackTarget("waiting");
          setAddToCancelledPost(true);
        },
        onError: (err: any) => {
          handleApiError(err, "Rollback bajarilmadi");
        },
      }
    );
  };

  const confirmDelete = () => {
    deleteOrders.mutate(id as string, {
      onSuccess: () => {
        handleSuccess("Buyurtma o'chirildi");
        navigate(-1);
      },
      onError: (err: any) => {
        handleApiError(err, "Buyurtmani o'chirishda xatolik");
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
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                  onClick={() => {
                    setRollbackTarget("waiting");
                    setAddToCancelledPost(true);
                    setRollbackModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Rollback
                </button>
              )}

              {/* Delete Button - Market uchun yangi buyurtmalarni o'chirish */}
              {canDelete && (
                <button
                  onClick={() =>
                    Modal.confirm({
                      title: "Buyurtmani o'chirishni tasdiqlaysizmi?",
                      content:
                        "Bu buyurtma butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.",
                      okText: "Ha, o'chirish",
                      cancelText: "Yo'q",
                      okButtonProps: { danger: true },
                      onOk: confirmDelete,
                    })
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  O'chirish
                </button>
              )}

              {/* Tariff Edit Button - Admin/Superadmin uchun */}
              {canEditTariff && (
                <button
                  onClick={openTariffEdit}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    data?.data?.market_tariff != null || data?.data?.courier_tariff != null
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                      : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50"
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  Tarif
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
            <CustomerDetail customer={data?.data?.customer} canEdit={canEditDetails} />

            {/* Shipping Address - Order dan manzil olish */}
            <ShippingAddress
              address={data?.data?.address || data?.data?.customer?.address}
              districtId={data?.data?.district_id || data?.data?.customer?.district_id}
              id={data?.data?.id}
              isOrderAddress={true}
              canEdit={canEditDetails}
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

            {/* Order Tracking History */}
            {id && (currentRole === "superadmin" || currentRole === "admin" || currentRole === "registrator") && (
              <OrderTracking orderId={id} />
            )}
          </div>
        </div>
      </div>

      {/* Rollback Modal */}
      {rollbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setRollbackModalOpen(false)}>
          <div
            className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Rollback</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Buyurtmani qaysi holatga qaytarish?
                    </p>
                  </div>
                </div>
                <button onClick={() => setRollbackModalOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Step 1: Asosiy tanlov */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Qaytarish holati</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRollbackTarget("waiting")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      rollbackTarget === "waiting"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                    }`}
                  >
                    <Loader2 className="w-6 h-6 text-blue-500" />
                    <span className="text-sm font-medium text-gray-800 dark:text-white">Kutilmoqda</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">Qayta sotish uchun</span>
                  </button>
                  <button
                    onClick={() => setRollbackTarget("cancelled")}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      rollbackTarget === "cancelled"
                        ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-red-300"
                    }`}
                  >
                    <X className="w-6 h-6 text-red-500" />
                    <span className="text-sm font-medium text-gray-800 dark:text-white">Bekor qilish</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">Buyurtma qaytgan</span>
                  </button>
                </div>
              </div>

              {/* Bekor qilingan pochtaga qo'shish checkbox (faqat bekor qilish tanlansa) */}
              {rollbackTarget !== "waiting" && (
                <label
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    addToCancelledPost
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                  onClick={() => setAddToCancelledPost(!addToCancelledPost)}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                    addToCancelledPost
                      ? "bg-orange-500 border-orange-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}>
                    {addToCancelledPost && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">Bekor qilingan pochtaga qo'shish</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Kurier pochtasiga biriktiriladi va qaytariladi</p>
                  </div>
                </label>
              )}

              {/* Ogohlantirish */}
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {rollbackTarget === "waiting"
                    ? "Kassa hisoblar orqaga qaytariladi va buyurtma qayta sotish uchun kutilmoqda holatiga o'tadi."
                    : addToCancelledPost
                    ? "Kassa hisoblar qaytariladi va buyurtma kurierning qaytarilgan pochtasiga qo'shiladi."
                    : "Kassa hisoblar qaytariladi va buyurtma bekor qilingan holatga o'tadi."}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
              <button
                onClick={() => setRollbackModalOpen(false)}
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={confirmRollback}
                disabled={rollbackOrder.isPending}
                className={`flex-1 h-11 rounded-xl text-white text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  rollbackTarget === "waiting"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500 hover:shadow-lg hover:shadow-blue-500/25"
                    : "bg-gradient-to-r from-red-500 to-rose-500 hover:shadow-lg hover:shadow-red-500/25"
                }`}
              >
                {rollbackOrder.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Tasdiqlash"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tariff Edit Modal */}
      {tariffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closeTariffEdit}>
          <div
            className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Yetkazib berish sozlamalari</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {data?.data?.customer?.name} — <span className="font-semibold">{Number(data?.data?.total_price || 0).toLocaleString("uz-UZ")} so'm</span>
                    </p>
                  </div>
                </div>
                <button onClick={closeTariffEdit} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Yetkazib berish joyi tanlash */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Qayerga yetkaziladi?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleWhereDeliverChange("center")}
                    className={`flex items-center justify-center gap-2.5 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      editWhereDeliver === "center"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <Store className={`w-5 h-5 ${editWhereDeliver === "center" ? "text-blue-500" : "text-gray-400"}`} />
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${editWhereDeliver === "center" ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                        Markazga
                      </p>
                      <p className="text-xs text-gray-400">{marketTariffCenter.toLocaleString()} so'm</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleWhereDeliverChange("address")}
                    className={`flex items-center justify-center gap-2.5 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      editWhereDeliver === "address"
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-400"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <Home className={`w-5 h-5 ${editWhereDeliver === "address" ? "text-orange-500" : "text-gray-400"}`} />
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${editWhereDeliver === "address" ? "text-orange-700 dark:text-orange-300" : "text-gray-700 dark:text-gray-300"}`}>
                        Uyga
                      </p>
                      <p className="text-xs text-gray-400">{marketTariffHome.toLocaleString()} so'm</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Tarif ma'lumotlari */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Pochta min</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-white">{standardTariff.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 rounded-xl">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{isOnTheRoad ? "Kurier tarifi" : "Kurier min"}</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-white">{courierMinTariff.toLocaleString()}</span>
                </div>
              </div>

              {/* Tariflar */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pochta tarifi
                  </label>
                  <InputNumber
                    min={standardTariff}
                    value={tariffMarket}
                    onChange={(v) => setTariffMarket(v)}
                    className="!w-full"
                    placeholder={standardTariff.toLocaleString()}
                    formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ""}
                    parser={(value) => Number(value!.replace(/\s/g, ""))}
                    size="large"
                    status={isTariffInvalid || isMarketBelowStandard ? "error" : undefined}
                    style={{ width: "100%", height: 48 }}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Minimum: {standardTariff.toLocaleString()} so'm</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kurier tarifi
                  </label>
                  <InputNumber
                    min={courierMinTariff}
                    value={tariffCourier}
                    onChange={(v) => setTariffCourier(v)}
                    className="!w-full"
                    placeholder={courierMinTariff.toLocaleString()}
                    formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ""}
                    parser={(value) => Number(value!.replace(/\s/g, ""))}
                    size="large"
                    status={isCourierBelowStandard ? "error" : undefined}
                    style={{ width: "100%", height: 48 }}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Minimum: {courierMinTariff.toLocaleString()} so'm</p>
                </div>
              </div>

              {/* Validatsiya ogohlantirishlari */}
              {(isMarketBelowStandard || isCourierBelowStandard || isTariffInvalid) && (
                <div className="space-y-2">
                  {isMarketBelowStandard && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/50">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Pochta tarifi <span className="font-semibold">{standardTariff.toLocaleString()}</span> so'mdan kam bo'lishi mumkin emas
                      </p>
                    </div>
                  )}
                  {isCourierBelowStandard && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/50">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Kurier tarifi {isOnTheRoad ? "tayinlangan kurier" : "viloyatdagi kurierlar"} tarifidan (<span className="font-semibold">{courierMinTariff.toLocaleString()}</span> so'm) kam bo'lishi mumkin emas
                      </p>
                    </div>
                  )}
                  {isTariffInvalid && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/50">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Pochta tarifi kurier tarifidan kam bo'lishi mumkin emas
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Bo'sh qoldirilsa pochta uchun {standardTariff.toLocaleString()} so'm, kurier uchun o'z tarifi ishlatiladi
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-3">
              <button
                onClick={closeTariffEdit}
                className="flex-1 h-12 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleTariffSave}
                disabled={updateOrders.isPending || hasValidationError}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateOrders.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "Saqlash"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(OrderDetails);
