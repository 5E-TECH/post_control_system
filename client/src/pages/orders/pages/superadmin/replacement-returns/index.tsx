import { memo, useState } from "react";
import {
  Repeat,
  Loader2,
  Phone,
  User,
  Package,
  CheckCircle2,
  PackageCheck,
  Clock,
  Truck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import ConfirmPopup from "../../../../../shared/components/confirmPopup";

type StateFilter = "" | "pending" | "collected" | "returned";

const STATE_TABS: { key: StateFilter; label: string }[] = [
  { key: "", label: "Hammasi" },
  { key: "pending", label: "Kutilmoqda" },
  { key: "collected", label: "Olingan" },
  { key: "returned", label: "Qaytarildi" },
];

const formatDate = (ts?: number | null) => {
  if (!ts) return "—";
  try {
    return new Date(Number(ts)).toLocaleDateString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const formatPhone = (phone?: string) => {
  if (!phone) return "—";
  return phone
    .replace(/\D/g, "")
    .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
};

// replacement_state → ko'rinish
const stateChip = (state?: string) => {
  switch (state) {
    case "old_collected":
      return {
        label: "Olingan — marketga ketmoqda",
        cls: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
        icon: <Truck className="w-3 h-3" />,
      };
    case "old_returned":
      return {
        label: "Marketga qaytarildi",
        cls: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
        icon: <PackageCheck className="w-3 h-3" />,
      };
    default:
      return {
        label: "Kutilmoqda — kuryer olishi kerak",
        cls: "bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-300",
        icon: <Clock className="w-3 h-3" />,
      };
  }
};

const LIMIT = 20;

const ReplacementReturns = () => {
  const [stateFilter, setStateFilter] = useState<StateFilter>("");
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<{
    id: string;
    order_number: number;
  } | null>(null);

  const { getReplacementReturns, confirmOldReturned } = useOrder();
  const { handleSuccess, handleApiError } = useApiNotification();

  const { data, isLoading } = getReplacementReturns({
    state: stateFilter || undefined,
    page,
    limit: LIMIT,
  });

  const items: any[] = data?.data?.data || [];
  const total: number = data?.data?.total || 0;
  const totalPages: number = data?.data?.totalPages || 1;

  const handleConfirmReturned = () => {
    if (!confirmId) return;
    confirmOldReturned.mutate(confirmId.id, {
      onSuccess: () => {
        handleSuccess(
          `Eski buyurtma #${confirmId.order_number} marketga qaytarildi deb belgilandi`
        );
        setConfirmId(null);
      },
      onError: (err: any) => {
        handleApiError(err, "Qaytarishni tasdiqlashda xatolik");
        setConfirmId(null);
      },
    });
  };

  const switchTab = (key: StateFilter) => {
    setStateFilter(key);
    setPage(1);
  };

  return (
    <div className="space-y-4 overflow-y-auto h-full pb-4">
      {/* Header */}
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
          <Repeat className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
            Qaytarilayotgan mahsulotlar (almashtirish)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Jami {total} ta — eski mahsulotlar marketga qaytarilishi kerak
          </p>
        </div>
      </div>

      {/* State Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`px-4 h-9 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              stateFilter === tab.key
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                : "bg-white dark:bg-[#2A263D] text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-12 text-center">
          <Repeat className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Qaytarilayotgan mahsulot yo'q
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Hozircha almashtirish bo'yicha qaytariladigan mahsulot yo'q
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((order: any) => {
            const chip = stateChip(order.replacement_state);
            // Qo'lda topshirish faqat ZAXIRA: eski buyurtma bekor pochtaga
            // tushmagan bo'lsa (canceled_post_id yo'q). Odatda qabul avtomatik.
            const canConfirm =
              order.replacement_state === "old_collected" &&
              !order.canceled_post_id;
            return (
              <div
                key={order.id}
                className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Almashtirish header */}
                <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                    <Repeat className="w-4 h-4" />
                    ALMASHTIRISH — eski #{order.order_number}
                    {order.replacement_new_order?.order_number && (
                      <span className="font-normal text-amber-600/80 dark:text-amber-400/70">
                        → yangi #{order.replacement_new_order.order_number}
                      </span>
                    )}
                  </span>
                  <span
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${chip.cls}`}
                  >
                    {chip.icon}
                    {chip.label}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-800 dark:text-white text-sm truncate">
                        {order.customer?.name || "Noma'lum"}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-white whitespace-nowrap">
                      {(order.total_price || 0).toLocaleString()} so'm
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-3">
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <Phone className="w-3 h-3" />
                      {formatPhone(order.customer?.phone_number)}
                    </span>
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <Package className="w-3 h-3" />
                      {(order.items || [])
                        .map(
                          (i: any) =>
                            `${i.product?.name ?? "—"} x${i.quantity ?? 1}`
                        )
                        .join(", ") || "—"}
                    </span>
                    {order.old_product_collected_at && (
                      <span className="text-gray-400 dark:text-gray-500">
                        Olingan: {formatDate(order.old_product_collected_at)}
                      </span>
                    )}
                    {order.old_product_returned_at && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Qaytarildi: {formatDate(order.old_product_returned_at)}
                        {order.old_returned_by_name
                          ? ` (qabul: ${order.old_returned_by_name})`
                          : ""}
                      </span>
                    )}
                    {order.market?.name && (
                      <span className="text-gray-400 dark:text-gray-500">
                        Market: {order.market.name}
                      </span>
                    )}
                  </div>

                  {/* Eski mahsulot bekor pochtada — qabul kutilmoqda (avtomatik) */}
                  {order.replacement_state === "old_collected" &&
                    order.canceled_post_id && (
                      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <Truck className="w-3.5 h-3.5" />
                        Bekor pochtada — markazda qabul qilinishi kutilmoqda
                      </div>
                    )}

                  {/* Zaxira: pochtaga tushmagan eski buyurtmani qo'lda topshirish */}
                  {canConfirm && (
                    <button
                      onClick={() =>
                        setConfirmId({
                          id: order.id,
                          order_number: order.order_number,
                        })
                      }
                      className="h-9 px-4 rounded-xl flex items-center gap-2 text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Marketga topshirildi (qo'lda)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-9 w-9 rounded-xl flex items-center justify-center bg-white dark:bg-[#2A263D] text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-9 w-9 rounded-xl flex items-center justify-center bg-white dark:bg-[#2A263D] text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <ConfirmPopup
        isShow={!!confirmId}
        title={`Eski #${confirmId?.order_number} mahsuloti marketga topshirildimi?`}
        description="Mahsulot marketga jismonan qaytarib berilganini tasdiqlang. Bu moliyaga ta'sir qilmaydi (eski sotuv puli o'zgarmaydi)."
        confirmText="Ha, topshirildi"
        cancelText="Bekor qilish"
        confirmClassName="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600"
        onConfirm={handleConfirmReturned}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
};

export default memo(ReplacementReturns);
