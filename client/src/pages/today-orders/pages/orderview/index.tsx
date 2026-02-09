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
  AlertCircle,
  WifiOff,
  Check,
  XCircle,
  RefreshCw,
  ChevronDown,
  Globe,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
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
  const { createPost, createPrint, createBrowserPrint } = usePost();
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);
  const { data, refetch, isLoading } =
    user.role === "market"
      ? getMarketsByMyNewOrders(params)
      : getOrderByMarket(id, params);

  // Offline queue scanner
  const {
    successCount,
    errorCount,
    isOnline,
    visualFeedback,
    clearHistory
  } = useGlobalScanner(refetch);

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
    setPrintDropdownOpen(false);
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

  const handleBrowserPrint = () => {
    if (isPrintDisabled || selectedIds.length === 0) return;
    setIsPrintDisabled(true);
    setPrintDropdownOpen(false);
    const orderids = { orderIds: selectedIds };
    createBrowserPrint.mutate(orderids, {
      onSuccess: (res: any) => {
        const html = res?.data?.html || res?.html;
        if (html) {
          const printWindow = window.open("", "_blank");
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            handleSuccess("Chek tayyor");
          } else {
            handleApiError(null, "Brauzer yangi oyna ochishga ruxsat bermadi. Popup blockerni o'chiring.");
          }
        } else {
          handleApiError(null, "Chek ma'lumotlari topilmadi");
        }
      },
      onError: (err: any) => {
        handleApiError(err, "Chek yaratishda xatolik yuz berdi");
      },
      onSettled: () => {
        setTimeout(() => setIsPrintDisabled(false), 3000);
      },
    });
  };

  // Close print dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printDropdownRef.current && !printDropdownRef.current.contains(e.target as Node)) {
        setPrintDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

              {/* Print button with dropdown */}
              {user.role !== "market" && (
                <div className="relative" ref={printDropdownRef}>
                  <button
                    onClick={() => {
                      if (!isPrintDisabled && selectedIds.length > 0) {
                        setPrintDropdownOpen((prev) => !prev);
                      }
                    }}
                    disabled={isPrintDisabled || selectedIds.length === 0}
                    className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium border transition-all ${
                      isPrintDisabled || selectedIds.length === 0
                        ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"
                        : "border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    {isPrintDisabled ? "Kutayapti..." : "Chop etish"}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${printDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {printDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-[#2A263D] rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden">
                      <button
                        onClick={handlePrint}
                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white">Termal printer</p>
                          <p className="text-xs text-gray-400">MQTT orqali</p>
                        </div>
                      </button>
                      <div className="border-t border-gray-100 dark:border-gray-700" />
                      <button
                        onClick={handleBrowserPrint}
                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                      >
                        <Globe className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white">Brauzer orqali</p>
                          <p className="text-xs text-gray-400">Istalgan printer</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Scan Status Indicator */}
          {(successCount > 0 || errorCount > 0 || !isOnline) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Online/Offline Status */}
              {!isOnline && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-xs font-medium">Offline</span>
                </div>
              )}

              {/* Success Count */}
              {successCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-medium">
                    {successCount} ta qabul qilindi
                  </span>
                </div>
              )}

              {/* Error Count */}
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">
                    {errorCount} ta xato
                  </span>
                </div>
              )}

              {/* Clear History */}
              {(successCount > 0 || errorCount > 0) && (
                <button
                  onClick={clearHistory}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Tozalash
                </button>
              )}
            </div>
          )}
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
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                        <Clock className="w-3.5 h-3.5" />
                        {st(`${order.status}`)}
                      </span>
                      {order.where_deliver === "address" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          <Home className="w-3.5 h-3.5" />
                          Uyga
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          <Building2 className="w-3.5 h-3.5" />
                          Markaz
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
                      {formatDate(order.created_at)}
                    </span>
                  </div>

                  {/* Customer name + price */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-base font-semibold text-gray-800 dark:text-white truncate">
                      {order.customer?.name || "Noma'lum"}
                    </p>
                    <p className="text-sm font-bold text-gray-800 dark:text-white whitespace-nowrap flex-shrink-0">
                      {order.total_price?.toLocaleString()} so'm
                    </p>
                  </div>

                  {/* Phone + Actions row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5 whitespace-nowrap">
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {formatPhone(order.customer?.phone_number)}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(buildAdminPath(`orders/order-detail/${order.id}`));
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all cursor-pointer"
                        title="Tahrirlash"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(order.id);
                          setIsConfirmOpen(true);
                        }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Location row */}
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {order.customer?.district?.region?.name || "-"}, {order.customer?.district?.name || "-"}
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

      {/* ============ VISUAL FEEDBACK OVERLAY ============ */}
      {visualFeedback.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          {/* Overlay background */}
          <div
            className={`absolute inset-0 transition-opacity duration-200 ${
              visualFeedback.type === 'success'
                ? 'bg-green-500/20'
                : visualFeedback.type === 'warning'
                ? 'bg-amber-500/20'
                : 'bg-red-500/20'
            }`}
          />

          {/* Big icon */}
          <div className="relative flex flex-col items-center justify-center animate-in zoom-in duration-200">
            {/* Circle background */}
            <div
              className={`w-40 h-40 sm:w-52 sm:h-52 rounded-full flex items-center justify-center shadow-2xl ${
                visualFeedback.type === 'success'
                  ? 'bg-green-500 shadow-green-500/50'
                  : visualFeedback.type === 'warning'
                  ? 'bg-amber-500 shadow-amber-500/50'
                  : 'bg-red-500 shadow-red-500/50'
              }`}
            >
              {visualFeedback.type === 'success' ? (
                <CheckCircle className="w-24 h-24 sm:w-32 sm:h-32 text-white" strokeWidth={2.5} />
              ) : visualFeedback.type === 'warning' ? (
                <RefreshCw className="w-24 h-24 sm:w-32 sm:h-32 text-white" strokeWidth={2.5} />
              ) : (
                <XCircle className="w-24 h-24 sm:w-32 sm:h-32 text-white" strokeWidth={2.5} />
              )}
            </div>

            {/* Message text */}
            {visualFeedback.message && (
              <p
                className={`mt-6 text-2xl sm:text-3xl font-bold ${
                  visualFeedback.type === 'success'
                    ? 'text-green-600'
                    : visualFeedback.type === 'warning'
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}
              >
                {visualFeedback.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(OrderView);
