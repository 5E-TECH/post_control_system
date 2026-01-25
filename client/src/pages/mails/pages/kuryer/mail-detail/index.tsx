import { memo, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { useTranslation } from "react-i18next";
import { buildAdminPath } from "../../../../../shared/const";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Truck,
  Home,
  Calendar,
  Package,
  CheckCircle2,
  Loader2,
  User,
  Search,
  Check,
} from "lucide-react";

const CourierMailDetail = () => {
  const { t } = useTranslation("mails");
  const regionName = useSelector((state: RootState) => state.region);
  const { id } = useParams();
  const navigate = useNavigate();

  const { getPostById, receivePost } = usePost();
  const { mutate: receivePostsByPostId, isPending } = receivePost();
  const { handleSuccess, handleApiError } = useApiNotification();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Dynamic fetching based on status
  const [params] = useSearchParams();
  const status = params.get("status");

  let endpoint = "";
  let condition = false;

  if (status === "received") {
    endpoint = "";
    condition = true;
  } else if (["canceled", "canceled_received"].includes(status as string)) {
    endpoint = "rejected/";
    condition = true;
  } else {
    endpoint = "";
    condition = true;
  }

  const { data, isLoading } = getPostById(id as string, endpoint, condition);
  const postData = data?.data?.allOrdersByPostId || [];

  useEffect(() => {
    if (postData?.length > 0) {
      setSelectedIds(postData.map((item: any) => item.id));
    }
  }, [postData]);

  const hideSend = regionName.hideSend;

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((item) => item !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === postData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(postData.map((item: any) => item.id));
    }
  };

  const handleReceive = () => {
    if (selectedIds.length === 0) {
      handleApiError(null, "Kamida bitta buyurtma tanlang");
      return;
    }

    receivePostsByPostId(
      { id: id as string, data: { order_ids: selectedIds } },
      {
        onSuccess: () => {
          handleSuccess("Pochtalar muvaffaqiyatli qabul qilindi");
          navigate(buildAdminPath("courier-mails"));
        },
        onError: (err: any) =>
          handleApiError(err, "Pochtalarni qabul qilishda xatolik yuz berdi"),
      }
    );
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Filter orders by search
  const filteredOrders = postData.filter((order: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order?.customer?.name?.toLowerCase().includes(query) ||
      order?.customer?.phone_number?.includes(query) ||
      order?.customer?.district?.name?.toLowerCase().includes(query)
    );
  });

  // Calculate totals
  const totalPrice = postData.reduce(
    (sum: number, order: any) => sum + (Number(order?.total_price) || 0),
    0
  );
  const selectedPrice = postData
    .filter((order: any) => selectedIds.includes(order.id))
    .reduce(
      (sum: number, order: any) => sum + (Number(order?.total_price) || 0),
      0
    );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("uz-UZ").format(price);
  };

  const formatDate = (timestamp: string | number) => {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp));
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    return phone
      .replace(/\D/g, "")
      .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-screen-xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3d3759] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white truncate">
              {regionName.regionName} {t("buyurtmalari")}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {postData.length} ta buyurtma
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white dark:bg-[#2A263D] rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Jami summa
              </span>
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
              {formatPrice(totalPrice)}{" "}
              <span className="text-xs font-normal text-gray-500">so'm</span>
            </p>
          </div>

          <div className="bg-white dark:bg-[#2A263D] rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Tanlangan
              </span>
            </div>
            <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">
              {selectedIds.length}{" "}
              <span className="text-xs font-normal text-gray-500">
                / {postData.length} ta
              </span>
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Mijoz ismi, telefon yoki tuman..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Select All */}
        {!hideSend && postData.length > 0 && (
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  selectedIds.length === postData.length
                    ? "bg-blue-500 border-blue-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {selectedIds.length === postData.length && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <span>Hammasini tanlash</span>
            </button>
            {selectedIds.length > 0 && (
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                {formatPrice(selectedPrice)} so'm
              </span>
            )}
          </div>
        )}

        {/* Orders List */}
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-[#2A263D] rounded-xl p-8 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? "Buyurtma topilmadi"
                  : "Buyurtmalar mavjud emas"}
              </p>
            </div>
          ) : (
            filteredOrders.map((order: any) => {
              const isSelected = selectedIds.includes(order.id);

              return (
                <div
                  key={order.id}
                  onClick={() => !hideSend && toggleSelect(order.id)}
                  className={`bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm transition-all ${
                    !hideSend ? "cursor-pointer active:scale-[0.98]" : ""
                  } ${
                    isSelected && !hideSend
                      ? "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                      : ""
                  }`}
                >
                  {/* Top: Checkbox + Customer Info */}
                  <div className="flex items-start gap-3">
                    {!hideSend && (
                      <div
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                          isSelected
                            ? "bg-blue-500 border-blue-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Customer Name & Phone */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-800 dark:text-white text-sm truncate">
                              {order?.customer?.name || "Noma'lum"}
                            </h3>
                            <a
                              href={`tel:${order?.customer?.phone_number}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <Phone className="w-3 h-3 text-green-500" />
                              {formatPhone(order?.customer?.phone_number)}
                            </a>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-gray-800 dark:text-white text-sm">
                            {formatPrice(Number(order?.total_price) || 0)}
                          </p>
                          <p className="text-xs text-gray-500">so'm</p>
                        </div>
                      </div>

                      {/* Info Row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                        {/* District */}
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span>{order?.customer?.district?.name || "-"}</span>
                        </div>

                        {/* Delivery Type */}
                        <div
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            order?.where_deliver === "address"
                              ? "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                              : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {order?.where_deliver === "address" ? (
                            <Home className="w-3 h-3" />
                          ) : (
                            <Truck className="w-3 h-3" />
                          )}
                          <span>
                            {order?.where_deliver === "address"
                              ? "Uyga"
                              : "Markazga"}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(order?.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Button */}
        {!hideSend && postData.length > 0 && (
          <div className="mt-4 pb-4">
            <button
              onClick={handleReceive}
              disabled={isPending || selectedIds.length === 0}
              className={`w-full h-14 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
                isPending || selectedIds.length === 0
                  ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 active:scale-[0.98]"
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Qabul qilinmoqda...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  {selectedIds.length} ta buyurtmani qabul qilish
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(CourierMailDetail);
