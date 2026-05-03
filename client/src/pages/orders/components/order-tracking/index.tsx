import { memo, useRef, useState, useCallback, useEffect } from "react";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { formatPhone } from "../../../../shared/helpers/formatPhone";
import {
  Clock,
  Loader2,
  ArrowRight,
  User,
  Package,
  XCircle,
  CheckCircle,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Edit3,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

const actionConfig: Record<string, { icon: any; color: string; ringColor: string; label: string }> = {
  created: {
    icon: Package,
    color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
    ringColor: "ring-blue-200 dark:ring-blue-900/50",
    label: "Yaratildi",
  },
  status_change: {
    icon: ArrowRight,
    color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",
    ringColor: "ring-purple-200 dark:ring-purple-900/50",
    label: "Holat o'zgardi",
  },
  sold: {
    icon: CheckCircle,
    color: "text-green-500 bg-green-100 dark:bg-green-900/30",
    ringColor: "ring-green-200 dark:ring-green-900/50",
    label: "Sotildi",
  },
  partly_sold: {
    icon: DollarSign,
    color: "text-teal-500 bg-teal-100 dark:bg-teal-900/30",
    ringColor: "ring-teal-200 dark:ring-teal-900/50",
    label: "Qisman sotildi",
  },
  payment: {
    icon: DollarSign,
    color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30",
    ringColor: "ring-emerald-200 dark:ring-emerald-900/50",
    label: "To'lov",
  },
  cancelled: {
    icon: XCircle,
    color: "text-red-500 bg-red-100 dark:bg-red-900/30",
    ringColor: "ring-red-200 dark:ring-red-900/50",
    label: "Bekor qilindi",
  },
  rollback: {
    icon: RotateCcw,
    color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30",
    ringColor: "ring-amber-200 dark:ring-amber-900/50",
    label: "Qaytarildi",
  },
  deleted: {
    icon: Trash2,
    color: "text-red-600 bg-red-100 dark:bg-red-900/30",
    ringColor: "ring-red-200 dark:ring-red-900/50",
    label: "O'chirildi",
  },
  return_requested: {
    icon: AlertTriangle,
    color: "text-orange-500 bg-orange-100 dark:bg-orange-900/30",
    ringColor: "ring-orange-200 dark:ring-orange-900/50",
    label: "Qaytarish so'rovi",
  },
  updated: {
    icon: Edit3,
    color: "text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30",
    ringColor: "ring-indigo-200 dark:ring-indigo-900/50",
    label: "Yangilandi",
  },
};

const defaultConfig = {
  icon: Clock,
  color: "text-gray-500 bg-gray-100 dark:bg-gray-800",
  ringColor: "ring-gray-200 dark:ring-gray-700",
  label: "Harakat",
};

const fieldLabels: Record<string, string> = {
  status: "Holat",
  total_price: "Umumiy narx",
  paid_amount: "To'langan",
  market_tariff: "Pochta tarifi",
  courier_tariff: "Kurier tarifi",
  comment: "Izoh",
  where_deliver: "Yetkazib berish",
  payment_type: "To'lov turi",
  address: "Manzil",
  district_id: "Tuman",
  customer_id: "Mijoz",
  operator_id: "Operator",
  post_id: "Pochta",
};

const statusLabels: Record<string, string> = {
  created: "Yaratildi",
  new: "Yangi",
  received: "Qabul qilindi",
  on_the_road: "Yo'lda",
  "on the road": "Yo'lda",
  waiting: "Kutilmoqda",
  sold: "Sotildi",
  cancelled: "Bekor qilindi",
  paid: "To'langan",
  partly_paid: "Qisman to'langan",
  cancelled_sent: "Bekor qilingan (pochtada)",
  "cancelled (sent)": "Bekor qilingan (pochtada)",
  closed: "Yopilgan",
};

const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "status" && typeof value === "string") {
    return statusLabels[value] || value;
  }
  if (
    typeof value === "number" &&
    (key.includes("price") || key.includes("amount") || key.includes("tariff"))
  ) {
    return `${value.toLocaleString("uz-UZ")} so'm`;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const getValueDiffs = (
  oldValue: Record<string, any> | null | undefined,
  newValue: Record<string, any> | null | undefined,
): Array<{ key: string; old: any; new: any }> => {
  const diffs: Array<{ key: string; old: any; new: any }> = [];
  const seen = new Set<string>();

  const allKeys = [
    ...Object.keys(oldValue || {}),
    ...Object.keys(newValue || {}),
  ];

  for (const key of allKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const oldV = oldValue?.[key];
    const newV = newValue?.[key];
    if (JSON.stringify(oldV) === JSON.stringify(newV)) continue;
    diffs.push({ key, old: oldV, new: newV });
  }

  return diffs;
};

const OrderTracking = ({ orderId }: { orderId: string }) => {
  const { getOrderActivityLog } = useOrder();
  const { data, isLoading } = getOrderActivityLog(orderId, !!orderId);

  const rawLogs = data?.data?.logs || [];
  // Backend DESC tartibida qaytaradi (yangidan eskigacha).
  // Gorizontal timeline uchun chap → o'ng — eski → yangi qilamiz.
  const logs = [...rawLogs].reverse();

  // Drag-to-scroll uchun ref va state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Faqat asosiy tugma (left click) bilan ishlatamiz, va a/button ustida bo'lmasa
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;

    const el = scrollRef.current;
    if (!el) return;
    setIsDragging(true);
    setHasMoved(false);
    dragState.current.startX = e.pageX - el.offsetLeft;
    dragState.current.scrollLeft = el.scrollLeft;
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const el = scrollRef.current;
      if (!el) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = x - dragState.current.startX;
      if (Math.abs(walk) > 4) setHasMoved(true);
      el.scrollLeft = dragState.current.scrollLeft - walk;
    },
    [isDragging],
  );

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Drag tugashidan keyin click eventini yutib yuboramiz (drag = click bo'lmasin)
  const onClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (hasMoved) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [hasMoved],
  );

  // Sichqoncha hududdan tashqariga ham releaseda to'xtashi uchun global listener
  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => setIsDragging(false);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [isDragging]);

  const formatDate = (timestamp: number | string) => {
    const date = new Date(Number(timestamp));
    return date.toLocaleString("uz-UZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      superadmin: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      admin: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
      registrator: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      courier: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      market: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
      operator: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
      logist: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
    };
    return styles[role] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-6 text-center">
        <Clock className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Tracking tarix topilmadi</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800 dark:text-white">Tracking tarix</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                Faqat admin
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {logs.length} ta yozuv — eskidan yangiga (chapdan o'ngga)
            </p>
          </div>
        </div>
        <div className="text-[11px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1">
          <span>🖱️ Sichqoncha bilan ushlab tortib scroll qiling</span>
        </div>
      </div>

      {/* Horizontal scrollable timeline — sichqoncha bilan ushlab tortib scroll qilish */}
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onClickCapture={onClickCapture}
        className={`order-tracking-scroll overflow-x-auto overflow-y-hidden select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ scrollBehavior: isDragging ? "auto" : "smooth" }}
      >
        <div className="relative px-6 py-6 min-w-max">
          {/* Horizontal timeline line — kartochkalar tepasidagi ikon markazi orqali */}
          <div className="absolute left-6 right-6 top-[52px] h-0.5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />

          <div className="flex items-start gap-4 relative">
            {logs.map((log: any, idx: number) => {
              const config = actionConfig[log.action] || defaultConfig;
              const Icon = config.icon;
              const diffs = getValueDiffs(log.old_value, log.new_value);
              const metadata = log.metadata || {};
              const metadataKeys = Object.keys(metadata);

              return (
                <div
                  key={log.id || idx}
                  className="flex flex-col items-center w-[280px] flex-shrink-0"
                >
                  {/* Step number */}
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1">
                    #{idx + 1}
                  </span>

                  {/* Icon — timeline line ustida */}
                  <div
                    className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-4 ring-white dark:ring-[#2A263D] ${config.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Card */}
                  <div
                    className={`mt-3 w-full rounded-xl border bg-gray-50/60 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/60 p-3 ring-1 ${config.ringColor}`}
                  >
                    {/* Action label + sana */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-white dark:bg-gray-900/50 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                        {config.label}
                      </span>
                    </div>

                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2 font-mono">
                      {formatDate(log.created_at)}
                    </p>

                    {/* JAVOBGAR — kim bajargan (yorqin, ko'zga tashlanadigan) */}
                    <div
                      className={`mb-2 p-2 rounded-lg border-l-4 ${
                        log.user_name || log.user_id
                          ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-500 dark:border-indigo-400"
                          : "bg-gray-50 dark:bg-gray-800/40 border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      <p className="text-[9px] uppercase tracking-wide font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Javobgar foydalanuvchi
                      </p>
                      {log.user_name ? (
                        <>
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate" title={log.user_name}>
                            {log.user_name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {log.user_role && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${getRoleBadge(
                                  log.user_role,
                                )}`}
                              >
                                {log.user_role}
                              </span>
                            )}
                            {log.user_phone && (
                              <a
                                href={`tel:${log.user_phone}`}
                                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {formatPhone(log.user_phone)}
                              </a>
                            )}
                          </div>
                        </>
                      ) : log.user_id ? (
                        <>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            ID: <span className="font-mono">{String(log.user_id).slice(0, 8)}…</span>
                          </p>
                          {log.user_role && (
                            <span
                              className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${getRoleBadge(
                                log.user_role,
                              )}`}
                            >
                              {log.user_role}
                            </span>
                          )}
                        </>
                      ) : (
                        <p className="text-xs italic text-gray-500 dark:text-gray-400">
                          Tizim tomonidan (avtomatik)
                        </p>
                      )}
                    </div>

                    {/* Field diffs */}
                    {diffs.length > 0 && (
                      <div className="space-y-1 mb-1.5">
                        {diffs.slice(0, 4).map((diff) => {
                          const label = fieldLabels[diff.key] || diff.key;
                          const hasOld =
                            diff.old !== undefined && diff.old !== null && diff.old !== "";
                          const hasNew =
                            diff.new !== undefined && diff.new !== null && diff.new !== "";

                          return (
                            <div
                              key={diff.key}
                              className="flex flex-col gap-0.5 text-[11px]"
                            >
                              <span className="text-gray-500 dark:text-gray-400 font-medium">
                                {label}
                              </span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {hasOld && (
                                  <>
                                    <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 line-through decoration-1 truncate max-w-[110px]">
                                      {formatValue(diff.key, diff.old)}
                                    </span>
                                    <ArrowRight className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                                  </>
                                )}
                                {hasNew ? (
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-medium truncate max-w-[140px] ${
                                      diff.key === "status"
                                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                        : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                                    }`}
                                  >
                                    {formatValue(diff.key, diff.new)}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 italic">
                                    o'chirildi
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {diffs.length > 4 && (
                          <p className="text-[10px] text-gray-400 italic">
                            +{diffs.length - 4} ta ko'proq...
                          </p>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    {metadataKeys.length > 0 && (
                      <div className="mt-2 px-2 py-1.5 rounded-md bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                        <p className="text-[9px] uppercase tracking-wide text-blue-600 dark:text-blue-400 font-semibold mb-1">
                          Qo'shimcha
                        </p>
                        <div className="space-y-0.5">
                          {metadataKeys.slice(0, 3).map((key) => (
                            <div
                              key={key}
                              className="flex items-start gap-1 text-[10px]"
                            >
                              <span className="text-gray-500 dark:text-gray-400 truncate">
                                {fieldLabels[key] || key}:
                              </span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium truncate">
                                {formatValue(key, metadata[key])}
                              </span>
                            </div>
                          ))}
                          {metadataKeys.length > 3 && (
                            <p className="text-[9px] text-gray-400 italic">
                              +{metadataKeys.length - 3} ta...
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderTracking);
