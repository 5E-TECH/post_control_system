import { memo, useEffect, useState } from "react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import { Pagination, type PaginationProps } from "antd";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import EmptyPage from "../../../../../shared/components/empty-page";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import ConfirmPopup from "../../../../../shared/components/confirmPopup";
import {
  User,
  Phone,
  MapPin,
  Store,
  Calendar,
  Home,
  Truck,
  Send,
  Loader2,
  Check,
  Package,
} from "lucide-react";

const CancelledOrders = () => {
  const { t } = useTranslation("orderList");
  const { t: st } = useTranslation("status");

  const [openPopup, setOpenPopup] = useState(false);

  // Pagination start
  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);

  const onChange: PaginationProps["onChange"] = (newPage, limit) => {
    if (newPage === 1) {
      removeParam("page");
    } else {
      setParam("page", newPage);
    }

    if (limit === 10) {
      removeParam("limit");
    } else {
      setParam("limit", limit);
    }
  };
  // Pagination end

  const { getCourierOrders } = useOrder();

  const { mutate: cancelPost, isPending } = usePost().canceledPost();
  const search = useSelector((state: RootState) => state.setUserFilter.search);
  const { from, to } = useSelector(
    (state: RootState) => state.dateFilterReducer
  );

  const { data, refetch, isLoading } = getCourierOrders({
    status: "cancelled",
    search,
    page,
    limit,
    startDate: from,
    endDate: to,
  });
  const total = data?.data?.total || 0;
  const orders = data?.data?.data || [];

  useEffect(() => {
    if (search) {
      setParam("page", 1);
    }
  }, [search]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { handleSuccess, handleApiError } = useApiNotification();

  useEffect(() => {
    if (orders?.length > 0) {
      setSelectedIds(orders.map((item: any) => item.id));
    }
  }, [data]);

  const handleClick = () => {
    const payload = {
      order_ids: selectedIds,
    };
    cancelPost(payload, {
      onSuccess: () => {
        handleSuccess("Buyurtmalar muvaffaqiyatli qaytarildi");
        refetch();
        setOpenPopup(false);
      },
      onError: (error: any) =>
        handleApiError(
          error,
          "Buyurtmalarni qaytarishda noma'lum xatolik yuz berdi"
        ),
    });
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((item: any) => item.id));
    }
  };

  // Helper functions
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("uz-UZ").format(price);
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    return phone
      .replace(/\D/g, "")
      .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  // Empty state
  if (!orders || orders.length === 0) {
    return (
      <div className="h-[65vh]">
        <EmptyPage />
      </div>
    );
  }

  return (
    <div>
      {/* Select All - Mobile */}
      <div className="lg:hidden mb-3 px-1">
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
        >
          <div
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              selectedIds.length === orders.length
                ? "bg-red-500 border-red-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            {selectedIds.length === orders.length && (
              <Check className="w-3 h-3 text-white" />
            )}
          </div>
          <span>Hammasini tanlash</span>
          {selectedIds.length > 0 && (
            <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
              ({selectedIds.length} ta tanlangan)
            </span>
          )}
        </button>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {orders.map((item: any) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <div
              key={item.id}
              onClick={() => toggleSelect(item.id)}
              className={`bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm transition-all cursor-pointer active:scale-[0.98] ${
                isSelected
                  ? "ring-2 ring-red-500 bg-red-50/50 dark:bg-red-900/10"
                  : ""
              }`}
            >
              {/* Top: Checkbox + Customer Info */}
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    isSelected
                      ? "bg-red-500 border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Customer Name & Price */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-800 dark:text-white text-sm truncate">
                          {item?.customer?.name || "Noma'lum"}
                        </h3>
                        <a
                          href={`tel:${item?.customer?.phone_number}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                          <Phone className="w-3 h-3 text-green-500" />
                          {formatPhone(item?.customer?.phone_number)}
                        </a>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-800 dark:text-white text-sm">
                        {formatPrice(Number(item?.total_price) || 0)}
                      </p>
                      <p className="text-xs text-gray-500">so'm</p>
                    </div>
                  </div>

                  {/* Info Row */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs mb-3">
                    {/* District */}
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>{item?.customer?.district?.name || "-"}</span>
                    </div>

                    {/* Market */}
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                      <Store className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate max-w-[100px]">
                        {item?.market?.name || "-"}
                      </span>
                    </div>

                    {/* Delivery Type */}
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                        item?.where_deliver === "address"
                          ? "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                          : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                      }`}
                    >
                      {item?.where_deliver === "address" ? (
                        <Home className="w-3 h-3" />
                      ) : (
                        <Truck className="w-3 h-3" />
                      )}
                      <span>
                        {item?.where_deliver === "address" ? "Uyga" : "Markazga"}
                      </span>
                    </div>
                  </div>

                  {/* Status & Date */}
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                      <Package className="w-3 h-3" />
                      {st(`${item.status}`)}
                    </span>

                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(item?.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white dark:bg-[#2A263D] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
        <table className="w-full table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm">
              <th className="py-4 px-3 text-left font-medium w-[4%]">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-white"
                  checked={selectedIds.length === orders.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="py-4 px-3 text-left font-medium w-[4%]">#</th>
              <th className="py-4 px-3 text-left font-medium w-[14%]">{t("mijoz")}</th>
              <th className="py-4 px-3 text-left font-medium w-[13%]">{t("phone")}</th>
              <th className="py-4 px-3 text-left font-medium w-[13%]">
                {t("detail.address")}
              </th>
              <th className="py-4 px-3 text-left font-medium w-[12%]">{t("market")}</th>
              <th className="py-4 px-3 text-left font-medium w-[10%]">{t("status")}</th>
              <th className="py-4 px-3 text-left font-medium w-[12%]">{t("price")}</th>
              <th className="py-4 px-3 text-left font-medium w-[8%]">
                {t("delivery")}
              </th>
              <th className="py-4 px-3 text-left font-medium w-[10%]">{t("sana")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {orders.map((item: any, inx: number) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <tr
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${
                    isSelected ? "bg-red-50 dark:bg-red-900/10" : ""
                  }`}
                >
                  <td className="py-3 px-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded accent-red-500"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-300 text-sm">
                    {(page - 1) * limit + inx + 1}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="font-medium text-gray-800 dark:text-white text-sm truncate">
                        {item?.customer?.name || "Noma'lum"}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <a
                      href={`tel:${item?.customer?.phone_number}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 truncate block"
                    >
                      {formatPhone(item?.customer?.phone_number)}
                    </a>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-600 dark:text-gray-300">
                    <span className="truncate block">
                      {item?.customer?.district?.name || "-"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-600 dark:text-gray-300">
                    <span className="truncate block">
                      {item?.market?.name || "-"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                      {st(`${item.status}`)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm font-medium text-gray-800 dark:text-white">
                    <span className="truncate block">
                      {formatPrice(Number(item?.total_price) || 0)} so'm
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-xs font-medium ${
                        item?.where_deliver === "address"
                          ? "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                          : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                      }`}
                    >
                      {item?.where_deliver === "address" ? (
                        <Home className="w-3 h-3" />
                      ) : (
                        <Truck className="w-3 h-3" />
                      )}
                      {t(`${item?.where_deliver}`)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-500 dark:text-gray-400">
                    <span className="truncate block">
                      {formatDate(item?.created_at)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center py-4">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
        />
      </div>

      {/* Send to Post Button */}
      <div className="pb-4 px-1">
        <button
          onClick={() => setOpenPopup(true)}
          disabled={isPending || selectedIds.length === 0}
          className={`w-full lg:w-auto lg:min-w-[200px] lg:ml-auto lg:flex h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
            isPending || selectedIds.length === 0
              ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl active:scale-[0.98]"
          }`}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Yuborilmoqda...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              {selectedIds.length} ta buyurtmani pochtaga yuborish
            </>
          )}
        </button>
      </div>

      {/* Confirm Popup */}
      {openPopup && (
        <ConfirmPopup
          isShow={openPopup}
          title="Buyurtmalarni pochtaga qo'shishni tasdiqlaysizmi?"
          description="Ushbu amalni ortga qaytarib bo'lmaydi."
          confirmText="Ha"
          cancelText="Bekor qilish"
          onConfirm={handleClick}
          onCancel={() => setOpenPopup(false)}
        />
      )}
    </div>
  );
};

export default memo(CancelledOrders);
