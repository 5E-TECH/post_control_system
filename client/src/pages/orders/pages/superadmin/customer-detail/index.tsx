import { memo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Package,
  Calendar,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Store,
  Eye,
  Loader2,
  Building2,
  Home,
  Edit3,
  X,
  Save,
  User,
} from "lucide-react";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import { useDistrict } from "../../../../../shared/api/hooks/useDistrict";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { Empty, Pagination, Input, type PaginationProps } from "antd";
import { buildAdminPath } from "../../../../../shared/const";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import Popup from "../../../../../shared/ui/Popup";
import dayjs from "dayjs";

// Status configuration
const statusConfig: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string; icon: any }
> = {
  new: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    darkBg: "dark:bg-sky-900/30",
    darkText: "dark:text-sky-400",
    icon: Clock,
  },
  pending: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    darkBg: "dark:bg-amber-900/30",
    darkText: "dark:text-amber-400",
    icon: Clock,
  },
  on_way: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    darkBg: "dark:bg-indigo-900/30",
    darkText: "dark:text-indigo-400",
    icon: Truck,
  },
  delivered: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    darkBg: "dark:bg-emerald-900/30",
    darkText: "dark:text-emerald-400",
    icon: CheckCircle2,
  },
  cancelled: {
    bg: "bg-red-100",
    text: "text-red-700",
    darkBg: "dark:bg-red-900/30",
    darkText: "dark:text-red-400",
    icon: XCircle,
  },
};

const statusLabels: Record<string, string> = {
  new: "Yangi",
  pending: "Kutilmoqda",
  on_way: "Yo'lda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi",
};

interface OrderHistoryItem {
  id: string;
  status: string;
  total_price: number;
  created_at: string | Date | number;
  where_deliver: string;
  market_name: string;
  items: {
    product_name: string;
    quantity: number;
  }[];
}

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useSelector((state: RootState) => state.roleSlice);

  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 10);

  const { getUserById, getCustomerOrderHistory } = useUser();
  const { data: customerData, isLoading: customerLoading, refetch: refetchCustomer } = getUserById(id);
  const customer = customerData?.data;

  // Get market_id from localStorage for market role
  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const market_id = market?.id;

  const { data: historyData, isLoading: historyLoading } =
    getCustomerOrderHistory(id || "", market_id, !!id);
  const orderHistory: OrderHistoryItem[] = historyData?.data?.orders || [];
  const totalOrders = historyData?.data?.total_orders || 0;
  // Calculate total spent from delivered orders
  const totalSpent = orderHistory
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + (o.total_price || 0), 0);

  // Get district info
  const { getDistrictById } = useDistrict();
  const { data: districtData } = getDistrictById(customer?.district_id);

  // Edit customer state
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const { updateOrdersUserPhoneAndName } = useOrder();
  const { handleApiError, handleSuccess } = useApiNotification();
  const canEdit = role !== "market" && role !== "courier";

  const handleOpenEditPopup = () => {
    setEditName(customer?.name || "");
    setEditPhone(customer?.phone_number || "");
    setIsEditPopupOpen(true);
  };

  const handleSaveCustomer = () => {
    updateOrdersUserPhoneAndName.mutate(
      {
        id: customer?.id,
        data: { name: editName, phone_number: editPhone },
      },
      {
        onSuccess: () => {
          setIsEditPopupOpen(false);
          refetchCustomer();
          handleSuccess("Mijoz ma'lumotlari muvaffaqiyatli yangilandi");
        },
        onError: (err: any) => {
          handleApiError(err, "Ma'lumotlarni yangilashda xatolik yuz berdi");
        },
      }
    );
  };

  // Format date helper
  const formatDate = (date: string | Date | number) => {
    if (!date) return "-";

    // Backend bigint timestamp'ni string sifatida qaytaradi
    // Uni raqamga aylantirib, Date() bilan parse qilamiz
    const timestamp = typeof date === "string" ? Number(date) : date;

    // Agar raqamga aylanmasa, ISO string sifatida parse qilish
    if (isNaN(timestamp as number)) {
      const d = dayjs(date);
      return d.isValid() ? d.format("DD.MM.YYYY") : "-";
    }

    // Timestamp millisekundlarda keladi
    const d = dayjs(timestamp);
    return d.isValid() ? d.format("DD.MM.YYYY") : "-";
  };

  // Pagination
  const paginatedOrders = orderHistory.slice((page - 1) * limit, page * limit);

  const onPageChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    const params = new URLSearchParams(searchParams);
    if (newPage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(newPage));
    }
    if (newLimit === 10) {
      params.delete("limit");
    } else {
      params.set("limit", String(newLimit));
    }
    setSearchParams(params);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleViewOrder = (orderId: string) => {
    navigate(buildAdminPath(`orders/order-detail/${orderId}`));
  };

  // Calculate statistics
  const deliveredOrders = orderHistory.filter(
    (o) => o.status === "delivered"
  ).length;
  const cancelledOrders = orderHistory.filter(
    (o) => o.status === "cancelled"
  ).length;
  const pendingOrders = orderHistory.filter(
    (o) => !["delivered", "cancelled"].includes(o.status)
  ).length;

  if (customerLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] flex items-center justify-center">
        <Empty description="Mijoz topilmadi" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              Mijoz ma'lumotlari
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Mijoz profili va buyurtmalar tarixi
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer Info */}
          <div className="space-y-6">
            {/* Customer Profile Card */}
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
              {/* Profile Header */}
              <div className="p-6 bg-gradient-to-r from-purple-500 to-indigo-600 relative">
                {canEdit && (
                  <button
                    onClick={handleOpenEditPopup}
                    className="absolute top-4 right-4 w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all cursor-pointer"
                    title="Tahrirlash"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <span className="text-3xl font-bold text-white">
                      {customer.name?.charAt(0)?.toUpperCase() || "M"}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white capitalize">
                      {customer.name}
                    </h2>
                    <p className="text-purple-100 text-sm mt-1">Mijoz</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="p-4 space-y-3">
                <a
                  href={`tel:${customer.phone_number}`}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-500 group-hover:shadow-lg transition-all">
                    <Phone className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Telefon raqam
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                      {customer.phone_number}
                    </p>
                  </div>
                </a>

                {customer.extra_number && (
                  <a
                    href={`tel:${customer.extra_number}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-500 group-hover:shadow-lg transition-all">
                      <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Qo'shimcha raqam
                      </p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {customer.extra_number}
                      </p>
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* Address Card */}
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                      Manzil
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Yetkazib berish manzili
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Viloyat
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">
                      {districtData?.data?.region?.name || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Tuman
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">
                      {districtData?.data?.name || "—"}
                    </p>
                  </div>
                </div>

                {customer.address && (
                  <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <Home className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        To'liq manzil
                      </p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {customer.address}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Statistics Card */}
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                      Statistika
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Buyurtmalar bo'yicha
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Jami
                    </span>
                  </div>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {totalOrders}
                  </p>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Yetkazildi
                    </span>
                  </div>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {deliveredOrders}
                  </p>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Jarayonda
                    </span>
                  </div>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {pendingOrders}
                  </p>
                </div>

                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Bekor
                    </span>
                  </div>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {cancelledOrders}
                  </p>
                </div>

                <div className="col-span-2 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-100 dark:border-green-800/30">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Umumiy xarid
                    </span>
                  </div>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {totalSpent?.toLocaleString()} so'm
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order History */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                        Buyurtmalar tarixi
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Jami: {totalOrders} ta buyurtma
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orders List */}
              <div className="p-4">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  </div>
                ) : paginatedOrders.length === 0 ? (
                  <Empty
                    description={
                      <span className="text-gray-500 dark:text-gray-400">
                        Buyurtmalar topilmadi
                      </span>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {paginatedOrders.map((order) => {
                      const status = statusConfig[order.status] || statusConfig.new;
                      const StatusIcon = status.icon;
                      return (
                        <div
                          key={order.id}
                          className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {/* Order Header */}
                              <div className="flex items-center gap-3 mb-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${status.bg} ${status.text} ${status.darkBg} ${status.darkText}`}
                                >
                                  <StatusIcon className="w-3.5 h-3.5" />
                                  {statusLabels[order.status] || order.status}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {formatDate(order.created_at)}
                                </span>
                              </div>

                              {/* Market & Products */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                  <Store className="w-4 h-4 text-purple-500" />
                                  <span className="font-medium capitalize">
                                    {order.market_name}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {order.items?.slice(0, 3).map((item, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-300"
                                    >
                                      <Package className="w-3 h-3" />
                                      {item.product_name} x{item.quantity}
                                    </span>
                                  ))}
                                  {order.items?.length > 3 && (
                                    <span className="inline-flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-xs text-purple-600 dark:text-purple-400">
                                      +{order.items.length - 3} ta
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Price & Action */}
                            <div className="flex flex-col items-end gap-2">
                              <p className="text-lg font-bold text-gray-800 dark:text-white">
                                {order.total_price?.toLocaleString()}{" "}
                                <span className="text-xs font-normal text-gray-500">
                                  so'm
                                </span>
                              </p>
                              <button
                                onClick={() => handleViewOrder(order.id)}
                                className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ko'rish
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalOrders > limit && (
                  <div className="flex justify-center mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/50">
                    <Pagination
                      showSizeChanger
                      current={page}
                      total={totalOrders}
                      pageSize={limit}
                      onChange={onPageChange}
                      className="[&_.ant-pagination-item-active]:bg-purple-500! [&_.ant-pagination-item-active]:border-purple-500! [&_.ant-pagination-item-active_a]:text-white!"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Customer Popup */}
      <Popup isShow={isEditPopupOpen} onClose={() => setIsEditPopupOpen(false)}>
        <div className="bg-white dark:bg-[#2A263D] w-[420px] rounded-2xl shadow-xl overflow-hidden">
          {/* Modal Header */}
          <div className="p-5 border-b border-gray-100 dark:border-gray-700/50 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Mijozni tahrirlash
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Mijoz ma'lumotlarini o'zgartirish
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditPopupOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ism
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ismni kiriting"
                  className="h-11 pl-11 rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Telefon raqam
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Phone className="w-5 h-5 text-gray-400" />
                </div>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Telefon raqamni kiriting"
                  className="h-11 pl-11 rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-5 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/30 flex justify-end gap-3">
            <button
              onClick={() => setIsEditPopupOpen(false)}
              className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
              Bekor qilish
            </button>
            <button
              onClick={handleSaveCustomer}
              disabled={updateOrdersUserPhoneAndName.isPending}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
                updateOrdersUserPhoneAndName.isPending
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-purple-500/25 cursor-pointer"
              }`}
            >
              {updateOrdersUserPhoneAndName.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saqlanmoqda...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Saqlash
                </>
              )}
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(CustomerDetail);
