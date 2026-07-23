import { memo, useEffect, useMemo, useState } from "react";
import {
  Repeat,
  X,
  Check,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Search,
  User,
  Phone,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";

interface HistoryOrder {
  id: string;
  order_number: number;
  status: string;
  total_price: number;
  created_at: number;
  sold_at: number | null;
  where_deliver: string;
  comment?: string | null;
  customer?: { name?: string | null; phone_number?: string | null };
  items: { product_name: string; quantity: number }[];
}

export interface ReplacementSelection {
  id: string;
  order_number: number;
  created_at: number;
  customer_name?: string | null;
}

interface Props {
  customerId?: string;
  marketId?: string;
  value: ReplacementSelection | null;
  onChange: (sel: ReplacementSelection | null) => void;
}

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

const formatPhone = (phone?: string | null) => {
  if (!phone) return "—";
  return phone
    .replace(/\D/g, "")
    .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
};

const statusLabel = (s: string) => {
  switch (s) {
    case "sold":
      return "Sotilgan";
    case "paid":
      return "To'langan";
    case "partly_paid":
      return "Qisman to'langan";
    case "closed":
      return "Yopilgan";
    default:
      return s;
  }
};

/**
 * "Almashtirish uchun" pickeri — operator yangi buyurtmani avval YETKAZILGAN
 * buyurtmaga bog'laydi (kafolat-swap).
 *  - Default: shu mijozning shu marketdagi buyurtmalari.
 *  - Qidiruv: SHU MARKET bo'ylab telefon/ism/buyurtma raqami bo'yicha — BOSHQA
 *    mijoz buyurtmasini ham topish mumkin.
 * Bir xil mahsulot bir necha marta buyurtma qilingan bo'lsa, sana/izoh bo'yicha
 * ajratish uchun to'liq detallar ko'rsatiladi.
 */
const ReplacementPicker = ({
  customerId,
  marketId,
  value,
  onChange,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isSearching = debouncedQ.length >= 2;

  const params = useMemo(
    () =>
      isSearching
        ? { market_id: marketId, q: debouncedQ, limit: 30 }
        : { market_id: marketId, customer_id: customerId, limit: 30 },
    [isSearching, debouncedQ, marketId, customerId]
  );

  const { getReplaceableOrders } = useOrder();
  const enabled =
    (open || !!value) && !!marketId && (isSearching || !!customerId);
  const { data, isLoading } = getReplaceableOrders(params, enabled);
  const orders: HistoryOrder[] = data?.data?.data || [];

  const handleSelect = (o: HistoryOrder) => {
    onChange({
      id: o.id,
      order_number: o.order_number,
      created_at: o.created_at,
      customer_name: o.customer?.name || null,
    });
    setOpen(false);
    setSearchInput("");
  };

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <Repeat className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
            Almashtirish (ixtiyoriy)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Bu buyurtma avval yetkazilgan buyurtma o'rniga bo'lsa, eskisini
            tanlang — kuryer yangisini topshirib eskisini qaytarib oladi.
          </p>
        </div>
      </div>

      {/* Tanlangan eski buyurtma */}
      {value ? (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300 truncate">
              Eski #{value.order_number} ({formatDate(value.created_at)})
              {value.customer_name ? ` — ${value.customer_name}` : ""}{" "}
              almashtirilmoqda
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Bekor
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={!marketId}
            onClick={() => setOpen((p) => !p)}
            className={`w-full flex items-center justify-between gap-2 h-11 px-4 rounded-xl text-sm font-medium transition-all ${
              !marketId
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 cursor-pointer"
            }`}
          >
            <span className="flex items-center gap-2">
              <Repeat className="w-4 h-4" />
              Almashtirish uchun — eski buyurtmani tanlash
            </span>
            {open ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {open && (
            <div className="mt-3">
              {/* Qidiruv — boshqa mijoz buyurtmasini ham topish uchun */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Telefon yoki buyurtma raqami bo'yicha qidirish..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-amber-400 dark:focus:border-amber-600"
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                {isSearching
                  ? "Market bo'ylab qidiruv natijalari"
                  : "Shu mijozning oldingi buyurtmalari (boshqa mijoznikini qidirish uchun yuqorida yozing)"}
              </p>

              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Yuklanmoqda...
                </div>
              ) : orders.length === 0 ? (
                <div className="flex items-center gap-2 py-4 px-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-500 dark:text-gray-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {isSearching
                    ? "Qidiruv bo'yicha yetkazilgan buyurtma topilmadi."
                    : "Bu mijozning shu marketdan yetkazilgan buyurtmasi yo'q. Boshqa mijoznikini qidiring."}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {orders.map((o) => (
                    <button
                      type="button"
                      key={o.id}
                      onClick={() => handleSelect(o)}
                      className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all cursor-pointer"
                    >
                      {/* Qator 1: #raqam + sana + status */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white">
                            #{o.order_number}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Calendar className="w-3 h-3" />
                            {formatDate(o.created_at)}
                          </span>
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium">
                          {statusLabel(o.status)}
                        </span>
                      </div>

                      {/* Qator 2: mijoz (boshqa mijoz bo'lishi mumkin) */}
                      <div className="flex items-center gap-3 mb-1 text-xs text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1 min-w-0">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">
                            {o.customer?.name || "—"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {formatPhone(o.customer?.phone_number)}
                        </span>
                      </div>

                      {/* Qator 3: mahsulotlar + narx */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                          <Package className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span className="break-words">
                            {o.items
                              .map((i) => `${i.product_name} x${i.quantity}`)
                              .join(", ")}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0 whitespace-nowrap">
                          {Number(o.total_price).toLocaleString()} so'm
                        </span>
                      </div>

                      {/* Qator 4: izoh (mavjud bo'lsa — ajratish uchun muhim) */}
                      {o.comment && (
                        <div className="flex items-start gap-1 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700/50 text-xs text-amber-700 dark:text-amber-400">
                          <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span className="break-words">{o.comment}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default memo(ReplacementPicker);
