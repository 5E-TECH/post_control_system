import {
  ChevronLeft,
  Edit,
  Trash2,
  Search,
  Printer,
  CheckSquare,
  Square,
  Package,
  Phone,
  MapPin,
  Clock,
  Home,
  Building2,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { usePost } from "../../../../shared/api/hooks/usePost";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import ConfirmPopup from "../../../../shared/components/confirmPopup";
import { useGlobalScanner } from "../../../../shared/components/global-scanner";
import { useTranslation } from "react-i18next";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import { buildAdminPath } from "../../../../shared/const";
import dayjs from "dayjs";

const OrderView = () => {
  useGlobalScanner();
  const { t } = useTranslation("todayOrderList");
  const { t: st } = useTranslation("status");

  const { id } = useParams();
  const user = useSelector((state: RootState) => state.roleSlice);
  const [deleteId, setDeleteId] = useState("");
  const [isPrintDisabled, setIsPrintDisabled] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchData, setSearch] = useState<any>(null);
  const { getOrderByMarket, getMarketsByMyNewOrders, deleteOrders } = useOrder();

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearch(value);
      }, 500),
    []
  );

  const params = searchData ? { search: searchData, limit: 0 } : { limit: 0 };
  const { createPost, createPrint } = usePost();
  const { data, refetch, isLoading } =
    user.role === "market"
      ? getMarketsByMyNewOrders(params)
      : getOrderByMarket(id, params);

  useEffect(() => {
    if (data?.data?.total === 0 && searchData == null) {
      navigate(-1);
    }
  }, [data]);

  useEffect(() => {
    if (data?.data?.data) {
      setSelectedIds(data.data?.data?.map((item: any) => item.id));
    }
  }, [data]);

  const { handleApiError, handleSuccess } = useApiNotification();

  const hanlerDelete = (id: string) => {
    deleteOrders.mutate(id, {
      onSuccess: () => {
        handleSuccess("Order muvaffaqiyatli o'chirildi");
      },
      onError: (err: any) => {
        handleApiError(err, "Orderni o'chirishda xatolik yuz berdi");
      },
    });
  };

  const handlePrint = () => {
    if (isPrintDisabled) return;
    setIsPrintDisabled(true);
    const orderids = { orderIds: selectedIds };
    createPrint.mutate(orderids, {
      onSuccess: () => {
        handleSuccess("Chop etildi");
      },
      onError: (err: any) => {
        handleApiError(err, "Chop etishda hatolik yuz berdi");
      },
      onSettled: () => {
        setTimeout(() => setIsPrintDisabled(false), 10000);
      },
    });
  };

  const handleAccapted = () => {
    const newOrder = { order_ids: selectedIds };
    createPost.mutate(newOrder, {
      onSuccess: () => {
        if (selectedIds.length !== data?.data?.data.length) {
          refetch();
        } else {
          setSelectedIds([]);
          navigate(buildAdminPath("order/markets/new-orders"));
        }
      },
      onError: (err: any) =>
        handleApiError(err, "Pochtani yaratishda xatolik yuz berdi"),
    });
  };

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((item) => item !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data?.data?.data?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data?.data?.data?.map((item: any) => item.id) || []);
    }
  };

  // Format phone number
  const formatPhone = (phone: string | undefined) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("998")) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10, 12)}`;
    }
    return phone;
  };

  // Format date
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

  const orders = data?.data?.data || [];
  const marketName = data?.message?.split("'s")[0] || "";
  const totalPrice = orders.reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col flex-1 overflow-hidden">
        {/* Header - fixed */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="text-gray-400 dark:text-gray-500">{t("title")}</span>
                  <span className="text-gray-300 dark:text-gray-600">/</span>
                  <span>{marketName}</span>
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {orders.length} ta buyurtma • {totalPrice.toLocaleString()} so'm
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  onChange={(e) => debouncedSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A263D] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm"
                  type="text"
                  placeholder={t("placeholder.search")}
                />
              </div>

              {/* Print button */}
              {user.role !== "market" && (
                <button
                  onClick={handlePrint}
                  disabled={isPrintDisabled || selectedIds.length === 0}
                  className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium border transition-all ${
                    isPrintDisabled || selectedIds.length === 0
                      ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"
                      : "border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  {isPrintDisabled ? "Kutayapti..." : "Chop etish"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 flex-1">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-12 text-center flex-1">
            <Package className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Buyurtmalar topilmadi
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Qidiruv natijasida hech narsa topilmadi
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
            {/* Select all header - fixed */}
            {user.role !== "market" && (
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-[#252139] flex items-center justify-between flex-shrink-0">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
                >
                  {selectedIds.length === orders.length ? (
                    <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                  {selectedIds.length === orders.length
                    ? "Barchasini bekor qilish"
                    : "Barchasini tanlash"}
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedIds.length} ta tanlangan
                </span>
              </div>
            )}

            {/* Orders list - scrollable */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {orders.map((order: any, inx: number) => (
                <div
                  key={order.id}
                  onClick={() => user.role !== "market" && toggleSelect(order.id)}
                  className={`p-4 rounded-xl transition-all border ${
                    user.role !== "market" ? "cursor-pointer" : ""
                  } ${
                    selectedIds.includes(order.id)
                      ? "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/50"
                      : "bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/30 hover:bg-purple-50 dark:hover:bg-purple-900/10"
                  }`}
                >
                  {/* Top row: checkbox, index, badges and date */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      {user.role !== "market" && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(order.id);
                          }}
                          className="flex-shrink-0"
                        >
                          {selectedIds.includes(order.id) ? (
                            <CheckSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <Square className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                        #{inx + 1}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                        <Clock className="w-4 h-4" />
                        {st(`${order.status}`)}
                      </span>
                      {order.where_deliver === "address" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          <Home className="w-4 h-4" />
                          Uyga
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          <Building2 className="w-4 h-4" />
                          Markaz
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(order.created_at)}
                    </span>
                  </div>

                  {/* Main row: customer info (horizontal) + price + actions */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-5 flex-1 min-w-0 flex-wrap">
                      {/* Name */}
                      <span className="text-base font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                        {order.customer?.name || "Noma'lum"}
                      </span>
                      {/* Phone */}
                      <span className="text-base text-gray-600 dark:text-gray-300 flex items-center gap-1.5 whitespace-nowrap">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {formatPhone(order.customer?.phone_number)}
                      </span>
                      {/* Location */}
                      <span className="text-base text-gray-500 dark:text-gray-400 flex items-center gap-1.5 whitespace-nowrap">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {order.customer?.district?.region?.name || "-"}, {order.customer?.district?.name || "-"}
                      </span>
                    </div>
                    {/* Price and actions */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <p className="text-base font-bold text-gray-800 dark:text-white whitespace-nowrap">
                        {order.total_price?.toLocaleString()} so'm
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(buildAdminPath(`orders/order-detail/${order.id}`));
                          }}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all cursor-pointer"
                          title="Tahrirlash"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(order.id);
                            setIsConfirmOpen(true);
                          }}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                          title="O'chirish"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Products row */}
                  {order.items && order.items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {order.items.slice(0, 4).map((item: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300"
                        >
                          {item.product?.name || item.product_name} x{item.quantity}
                        </span>
                      ))}
                      {order.items.length > 4 && (
                        <span className="text-sm text-gray-500 py-1">+{order.items.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Accept button - fixed at bottom */}
            {user.role !== "market" && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-[#252139] flex-shrink-0">
                <button
                  onClick={handleAccapted}
                  disabled={selectedIds.length === 0 || createPost.isPending}
                  className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-base font-medium transition-all ${
                    selectedIds.length === 0 || createPost.isPending
                      ? "opacity-50 cursor-not-allowed bg-gray-300 dark:bg-gray-700 text-gray-500"
                      : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-lg hover:shadow-emerald-500/25 cursor-pointer"
                  }`}
                >
                  {createPost.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  {t("qabulQilish")} ({selectedIds.length} ta buyurtma)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmPopup
        isShow={isConfirmOpen}
        title="Buyurtmani o'chirishni tasdiqlaysizmi?"
        description="O'chirilgandan so'ng uni qaytarib bo'lmaydi."
        confirmText="Ha, o'chirish"
        cancelText="Bekor qilish"
        onConfirm={() => {
          if (deleteId) {
            hanlerDelete(deleteId);
          }
          setIsConfirmOpen(false);
          setDeleteId("");
        }}
        onCancel={() => {
          setIsConfirmOpen(false);
          setDeleteId("");
        }}
      />
    </div>
  );
};

export default memo(OrderView);
