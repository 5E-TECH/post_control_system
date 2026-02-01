import { memo, useEffect, useState, useMemo, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useTranslation } from "react-i18next";
import { useRefusedPostScanner } from "../../../../../shared/components/refused-post-scanner";
import debounce from "lodash/debounce";
import {
  ArrowLeft,
  Search,
  AlertTriangle,
  User,
  Phone,
  MapPin,
  Truck,
  Calendar,
  CheckCircle,
  Loader2,
  Package,
  Store,
  XCircle,
  RefreshCw,
} from "lucide-react";

// Skeleton Loading Component
const SkeletonCard = () => (
  <div className="bg-red-50/50 dark:bg-red-900/10 rounded-xl p-3 sm:p-4 animate-pulse border border-red-100 dark:border-red-900/20">
    <div className="flex items-center gap-4">
      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-600 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4 flex-1">
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-28" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20" />
      </div>
    </div>
  </div>
);

const RefusedMailDetailSkeleton = () => (
  <div className="h-full flex flex-col overflow-hidden">
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col flex-1 overflow-hidden">
      {/* Header Skeleton */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-56 animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-2 animate-pulse" />
            </div>
          </div>
          <div className="w-full sm:w-72 h-11 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>

        {/* Stats Card Skeleton */}
        <div className="mt-4">
          <div className="bg-white dark:bg-[#2A263D] rounded-xl p-3 sm:p-4 shadow-sm border border-red-200 dark:border-red-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-12 mt-1 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 border border-red-100 dark:border-red-900/20">
        <div className="px-4 py-3 border-b border-red-100 dark:border-red-900/20 flex items-center gap-3 flex-shrink-0">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        </div>
        <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const RefusedMailDetail = () => {
  const { t } = useTranslation("mails");

  const { id } = useParams();
  const { state } = useLocation();
  const regionName = state?.regionName;
  const navigate = useNavigate();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { visualFeedback } = useRefusedPostScanner(undefined, setSelectedIds);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setDebouncedSearch(value), 400),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [debouncedSetSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSetSearch(value);
  };

  const { data, isLoading } = usePost().getRejectedPostsByPostId(id as string);
  const postData = data?.data?.allOrdersByPostId || data?.data || [];

  useEffect(() => {
    if (data?.data) {
      setSelectedIds([]);
    }
  }, [data]);

  // Filter locally by name or phone
  const filteredPostData = useMemo(() => {
    if (!postData || !Array.isArray(postData)) return postData;
    if (!debouncedSearch) return postData;
    const searchLower = debouncedSearch.toLowerCase();
    return postData.filter((order: any) => {
      const name = order?.customer?.name?.toLowerCase() || "";
      const phone = order?.customer?.phone_number || "";
      return name.includes(searchLower) || phone.includes(debouncedSearch);
    });
  }, [postData, debouncedSearch]);

  const { handleSuccess, handleApiError } = useApiNotification();
  const { mutate: receiveCancelPost, isPending } =
    usePost().receiveCanceledPost();

  const handleClick = () => {
    const payload = {
      order_ids: selectedIds,
    };
    receiveCancelPost(
      { id: id as string, data: payload },
      {
        onSuccess: () => {
          handleSuccess("Buyurtmalar muvaffaqiyatli qabul qilindi");
          navigate(-1);
        },
        onError: (err: any) =>
          handleApiError(err, "Buyurtmalarni bekor qilishda xatolik yuz berdi"),
      }
    );
  };

  const toggleSelect = useCallback((orderId: string) => {
    setSelectedIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((item) => item !== orderId)
        : [...prev, orderId]
    );
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked && filteredPostData) {
        setSelectedIds(filteredPostData.map((item: any) => item.id));
      } else {
        setSelectedIds([]);
      }
    },
    [filteredPostData]
  );

  const hideSend = state?.hideSend;

  const formatDate = (timestamp: string | number) => {
    if (!timestamp) return "-";
    return new Date(Number(timestamp)).toLocaleString("uz-UZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return <RefusedMailDetailSkeleton />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-[#3A3650] transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <span className="truncate">{regionName || "Rad etilgan pochta"}</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 ml-10 sm:ml-13">
                  {filteredPostData?.length || 0} ta rad etilgan buyurtma
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Ism yoki telefon raqam..."
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A263D] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />
            </div>
          </div>

          {/* Selection Status Card */}
          {!hideSend && (
            <div className="mt-4">
              <div className={`bg-white dark:bg-[#2A263D] rounded-xl p-3 sm:p-4 shadow-sm border ${
                selectedIds.length === postData?.length && postData?.length > 0
                  ? "border-emerald-500"
                  : "border-red-400"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedIds.length === postData?.length && postData?.length > 0
                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : "bg-red-100 dark:bg-red-900/30"
                  }`}>
                    <CheckCircle className={`w-5 h-5 ${
                      selectedIds.length === postData?.length && postData?.length > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tanlangan</p>
                    <p className={`text-lg font-bold ${
                      selectedIds.length === postData?.length && postData?.length > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {selectedIds.length} / {postData?.length || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
          {/* Select All Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3 flex-shrink-0">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
              checked={!!filteredPostData?.length && selectedIds.length === filteredPostData.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Barchasini tanlash
            </span>
          </div>

          {/* Orders List */}
          <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1">
            {!filteredPostData?.length ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-center">
                  <AlertTriangle className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                    Buyurtmalar topilmadi
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {debouncedSearch
                      ? "Qidiruv natijasi topilmadi"
                      : "Rad etilgan buyurtmalar mavjud emas"}
                  </p>
                </div>
              </div>
            ) : (
              filteredPostData.map((order: any) => {
                const isSelected = selectedIds.includes(order.id);
                return (
                  <div
                    key={order?.id}
                    onClick={() => toggleSelect(order.id)}
                    className={`bg-gray-50 dark:bg-[#3A3650] rounded-xl p-3 sm:p-4 transition-all cursor-pointer hover:bg-gray-100 dark:hover:bg-[#4A4660] ${
                      isSelected ? "ring-2 ring-red-500" : ""
                    }`}
                  >
                    {/* Mobile Layout */}
                    <div className="block sm:hidden">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 mt-0.5 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            checked={isSelected}
                            onChange={() => toggleSelect(order.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                              {order?.customer?.name || "-"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {order?.customer?.phone_number || "-"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${
                            isSelected
                              ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {isSelected ? "Tanlangan" : "Tanlanmagan"}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="truncate">{order?.customer?.district?.name || "-"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                          <Store className="w-3 h-3 text-gray-400" />
                          <span className="truncate">{order?.market?.name || "-"}</span>
                        </div>
                        <div className="font-semibold text-red-600 dark:text-red-400">
                          {new Intl.NumberFormat("uz-UZ").format(Number(order?.total_price) || 0)} so'm
                        </div>
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                          <Truck className="w-3 h-3 text-gray-400" />
                          <span className="truncate">{t(`${order?.where_deliver}`) || "-"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(order?.created_at)}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          onClick={(e) => e.stopPropagation()}
                          checked={isSelected}
                          onChange={() => toggleSelect(order.id)}
                        />

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 lg:gap-4 flex-1">
                          {/* Customer Name */}
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                              {order?.customer?.name || "-"}
                            </span>
                          </div>

                          {/* Phone */}
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {order?.customer?.phone_number || "-"}
                            </span>
                          </div>

                          {/* District */}
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                              {order?.customer?.district?.name || "-"}
                            </span>
                          </div>

                          {/* Market Name */}
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                              {order?.market?.name || "-"}
                            </span>
                          </div>

                          {/* Price */}
                          <div>
                            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                              {new Intl.NumberFormat("uz-UZ").format(Number(order?.total_price) || 0)} so'm
                            </span>
                          </div>

                          {/* Delivery */}
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {t(`${order?.where_deliver}`) || "-"}
                            </span>
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {formatDate(order?.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ml-4 ${
                          isSelected
                            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {isSelected ? "Tanlangan" : "Tanlanmagan"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Accept Button */}
          {!hideSend && (
            <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700/50 flex-shrink-0">
              <button
                disabled={isPending || selectedIds.length === 0}
                onClick={handleClick}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Package className="w-5 h-5" />
                )}
                {t("accept")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Fixed Action Button */}
      {!hideSend && selectedIds.length > 0 && (
        <div className="sm:hidden fixed bottom-4 left-4 right-4 z-50">
          <button
            disabled={isPending}
            onClick={handleClick}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Package className="w-5 h-5" />
                {selectedIds.length} ta buyurtmani qabul qilish
              </>
            )}
          </button>
        </div>
      )}
      {/* ============ VISUAL FEEDBACK OVERLAY ============ */}
      {visualFeedback.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div
            className={`absolute inset-0 transition-opacity duration-200 ${
              visualFeedback.type === 'success'
                ? 'bg-green-500/20'
                : visualFeedback.type === 'warning'
                ? 'bg-amber-500/20'
                : 'bg-red-500/20'
            }`}
          />
          <div className="relative flex flex-col items-center justify-center animate-in zoom-in duration-200">
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

export default memo(RefusedMailDetail);
