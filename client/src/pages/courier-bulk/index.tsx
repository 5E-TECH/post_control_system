import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Zap,
  ScanLine,
  XCircle,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import { useOrder } from "../../shared/api/hooks/useOrder";
import { useApiNotification } from "../../shared/hooks/useApiNotification";
import { normalizeQrToken } from "../../shared/helpers/normalizeQrToken";

type Order = {
  id: string;
  qr_code_token: string;
  total_price: number;
  status: string;
  created_at?: string | number;
  customer?: { name?: string; phone_number?: string };
  district?: { name?: string };
  market?: { name?: string };
};

type ScanMode = "cancel" | "keep";
type FlashKind = "cancel" | "keep" | "warning" | "error" | null;

const STORAGE_KEY = "courier-bulk-scan-state";

const formatPrice = (n: number) =>
  new Intl.NumberFormat("uz-UZ").format(Math.round(n || 0));

// "+998 XX XXX XX XX" — kompakt formatda telefon raqam ko'rinishi
const formatPhone = (raw?: string | null): string => {
  if (!raw) return "—";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  if (digits.length === 0) return "—";
  const m = digits.match(/^(\d{1,2})(\d{0,3})(\d{0,2})(\d{0,2})$/);
  if (!m) return `+998 ${digits}`;
  return `+998 ${[m[1], m[2], m[3], m[4]].filter(Boolean).join(" ")}`;
};

// Buyurtma yaratilgan sanani qisqa ko'rinishda chiqaramiz: "30.04 21:50"
// (eng kompakt — kun.oy soat:daqiqa, joriy yil bo'lsa yil yo'q)
const formatShortDate = (timestamp?: string | number): string => {
  if (!timestamp) return "";
  const d = new Date(Number(timestamp));
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const yearPart =
    d.getFullYear() === new Date().getFullYear()
      ? ""
      : `.${String(d.getFullYear()).slice(2)}`;
  return `${dd}.${mm}${yearPart} ${hh}:${min}`;
};

// ============ AUDIO ENGINE ============
// Cancel / Keep / Warning — Web Audio sintezator (har xil frekans bilan farqlanadigan beep'lar).
// Error — tizimning umumiy error.mp3 fayli (today-orders va global-scannerdagi bilan bir xil).
const BASE_URL = import.meta.env.BASE_URL || "/";

let errorAudio: HTMLAudioElement | null = null;
if (typeof window !== "undefined") {
  try {
    errorAudio = new Audio(`${BASE_URL}sound/error.mp3`);
    errorAudio.volume = 1.0;
    errorAudio.load();
  } catch {}
}

class BeepEngine {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    try {
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private playOne(freq: number, dur: number, volume: number, delayMs = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const trigger = () => {
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.01);
        gain.gain.linearRampToValueAtTime(0, now + dur);
        osc.start(now);
        osc.stop(now + dur + 0.05);
      } catch {}
    };
    if (delayMs <= 0) trigger();
    else setTimeout(trigger, delayMs);
  }

  play(kind: "cancel" | "keep" | "warning") {
    if (kind === "cancel") {
      this.playOne(660, 0.12, 0.3);
    } else if (kind === "keep") {
      this.playOne(1100, 0.1, 0.3);
    } else if (kind === "warning") {
      this.playOne(500, 0.15, 0.3);
    }
  }
}

const beepEngine = new BeepEngine();

const playSound = (kind: "cancel" | "keep" | "warning" | "error") => {
  if (kind === "error") {
    try {
      if (errorAudio) {
        errorAudio.currentTime = 0;
        errorAudio.play().catch(() => {});
      }
    } catch {}
  } else {
    beepEngine.play(kind);
  }
};

interface BatchProgress {
  isProcessing: boolean;
  type: "cancel" | "sell" | null;
  current: number;
  total: number;
  successCount: number;
  failedCount: number;
}

const CourierBulkPage = () => {
  const { t } = useTranslation("courierBulk");
  const {
    getCourierOrders,
    findOrderByQrToken,
    bulkSellOrders,
    bulkCancelOrders,
  } = useOrder();
  const { handleApiError } = useApiNotification();

  // Server enum statusini i18n key'ga moslash
  const translateStatus = (s?: string) =>
    s ? t(`status_${s}` as any, { defaultValue: s }) : t("status_unknown" as any, { defaultValue: "?" });

  const { data, isLoading, refetch } = getCourierOrders({
    status: "waiting",
    page: 1,
    limit: 500,
  });
  const allOrders: Order[] = useMemo(() => data?.data?.data || [], [data]);

  const [cancelIds, setCancelIds] = useState<Set<string>>(new Set());
  const [keepIds, setKeepIds] = useState<Set<string>>(new Set());
  const [scanMode, setScanMode] = useState<ScanMode>("cancel");
  // confirmType: null = yopiq, "cancel-only" = faqat bekor, "full" = bekor + sotish
  const [confirmType, setConfirmType] = useState<"cancel-only" | "full" | null>(
    null,
  );
  const [safetyChecked, setSafetyChecked] = useState(false);
  const confirmOpen = confirmType !== null;

  // Vizual feedback — full-screen flash va so'nggi skan info
  const [flash, setFlash] = useState<FlashKind>(null);
  const [lastScan, setLastScan] = useState<{
    kind: FlashKind;
    title: string;
    subtitle?: string;
  } | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Caps Lock holatini kuzatamiz — agar yoqiq bo'lsa, foydalanuvchini
  // ogohlantiramiz (skaner caps yoqiq paytda noto'g'ri yuborishi mumkin,
  // ammo biz token'ni normalize qilganimiz uchun ish baribir ishlaydi).
  const [capsLockOn, setCapsLockOn] = useState(false);
  useEffect(() => {
    const onKeyEvent = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === "function") {
        setCapsLockOn(e.getModifierState("CapsLock"));
      }
    };
    window.addEventListener("keydown", onKeyEvent);
    window.addEventListener("keyup", onKeyEvent);
    return () => {
      window.removeEventListener("keydown", onKeyEvent);
      window.removeEventListener("keyup", onKeyEvent);
    };
  }, []);

  // Vizual + audio feedbackni birga ko'rsatadi (today-orders uslubi: 800ms)
  const showFeedback = useCallback(
    (kind: FlashKind, title: string, subtitle?: string) => {
      // Audio (instant)
      if (kind) {
        playSound(kind as any);
      }
      // Flash + lastScan birga ko'rsatiladi (markazda katta ikon)
      setFlash(kind);
      setLastScan({ kind, title, subtitle });
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (lastScanTimerRef.current) clearTimeout(lastScanTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setFlash(null);
        setLastScan(null);
      }, 900);
    },
    [],
  );

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (lastScanTimerRef.current) clearTimeout(lastScanTimerRef.current);
    };
  }, []);
  const [progress, setProgress] = useState<BatchProgress>({
    isProcessing: false,
    type: null,
    current: 0,
    total: 0,
    successCount: 0,
    failedCount: 0,
  });
  const [result, setResult] = useState<{
    cancelSuccess: number;
    cancelFailed: { id: string; reason: string }[];
    sellSuccess: number;
    sellFailed: { id: string; reason: string }[];
  } | null>(null);

  // LocalStorage — state saqlash
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.cancelIds))
          setCancelIds(new Set(parsed.cancelIds));
        if (Array.isArray(parsed.keepIds)) setKeepIds(new Set(parsed.keepIds));
        if (typeof parsed.scanMode === "string") setScanMode(parsed.scanMode);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          cancelIds: Array.from(cancelIds),
          keepIds: Array.from(keepIds),
          scanMode,
        }),
      );
    } catch {}
  }, [cancelIds, keepIds, scanMode]);

  // Skan handler
  const handleToken = useCallback(
    async (rawToken: string) => {
      // Caps Lock va RU layout muammosini bartaraf qilamiz
      const token = normalizeQrToken(rawToken);
      if (token.length < 5) return;

      const local = allOrders.find((o) => o.qr_code_token === token);
      if (local) {
        setCancelIds((prev) => {
          const next = new Set(prev);
          next.delete(local.id);
          if (scanMode === "cancel") next.add(local.id);
          return next;
        });
        setKeepIds((prev) => {
          const next = new Set(prev);
          next.delete(local.id);
          if (scanMode === "keep") next.add(local.id);
          return next;
        });
        const customerName = local.customer?.name || "—";
        const price = formatPrice(local.total_price);
        showFeedback(
          scanMode,
          t(scanMode === "cancel" ? "feedback_cancel" : "feedback_keep", {
            name: customerName,
          }),
          `${price} so'm`,
        );
        return;
      }

      // Lokalda yo'q — serverdan tekshiramiz
      try {
        const res = await findOrderByQrToken(token);
        const data = res?.data;
        if (!data) throw new Error("Topilmadi");
        if (!data.belongs_to_me) {
          showFeedback(
            "error",
            t("feedback_not_yours_title"),
            data.customer_name || t("feedback_not_yours_subtitle"),
          );
          return;
        }
        if (!data.can_act) {
          showFeedback(
            "warning",
            t("feedback_wrong_status_title", {
              status: translateStatus(data.status),
            }),
            t("feedback_wrong_status_subtitle"),
          );
          return;
        }
        showFeedback(
          "warning",
          t("feedback_new_found_title"),
          t("feedback_new_found_subtitle"),
        );
        refetch();
      } catch {
        showFeedback(
          "error",
          t("feedback_not_found_title"),
          t("feedback_not_found_subtitle"),
        );
      }
    },
    [allOrders, scanMode, findOrderByQrToken, refetch, showFeedback, t],
  );

  // Global keyboard listener (input/textarea'larda ishlamaydi)
  useEffect(() => {
    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onKey = (e: KeyboardEvent) => {
      // Modal yoki input ichida bo'lsa — o'tkazib yuboramiz
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      // Submit modal ochiq bo'lsa skanni o'tkazib yuboramiz
      if (confirmOpen || progress.isProcessing || result) return;

      if (e.key === "Enter") {
        const value = buffer.trim();
        buffer = "";
        if (value) handleToken(value);
      } else if (e.key.length === 1) {
        buffer += e.key;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          buffer = "";
        }, 1500);
      }
    };

    window.addEventListener("keypress", onKey);
    return () => {
      window.removeEventListener("keypress", onKey);
      if (timer) clearTimeout(timer);
    };
  }, [handleToken, confirmOpen, progress.isProcessing, result]);

  const getOrderStatus = (id: string): "cancel" | "keep" | "sell" => {
    if (cancelIds.has(id)) return "cancel";
    if (keepIds.has(id)) return "keep";
    return "sell";
  };

  const removeFromAny = (id: string) => {
    setCancelIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setKeepIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const stats = useMemo(() => {
    const cancel = allOrders.filter((o) => cancelIds.has(o.id));
    const keep = allOrders.filter((o) => keepIds.has(o.id));
    const sell = allOrders.filter(
      (o) => !cancelIds.has(o.id) && !keepIds.has(o.id),
    );
    const sum = (arr: Order[]) =>
      arr.reduce((s, o) => s + Number(o.total_price || 0), 0);
    return {
      cancel: { count: cancel.length, total: sum(cancel) },
      keep: { count: keep.length, total: sum(keep) },
      sell: { count: sell.length, total: sum(sell) },
    };
  }, [allOrders, cancelIds, keepIds]);

  const resetAll = () => {
    Modal.confirm({
      title: t("reset_confirm_title"),
      okText: t("reset_confirm_yes"),
      cancelText: t("reset_confirm_no"),
      onOk: () => {
        setCancelIds(new Set());
        setKeepIds(new Set());
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      },
    });
  };

  // Yakuniy bajarish — alohida loading bekor va sotish uchun
  // type: "cancel-only" → faqat skanerlangan bekor qilingan orderlar bajariladi
  // type: "full"        → bekor + qolganlarni avtomatik sotish (kun yakunlash)
  const handleSubmit = async (type: "cancel-only" | "full") => {
    const cancelArr = Array.from(cancelIds);
    const sellArr =
      type === "full"
        ? allOrders
            .filter((o) => !cancelIds.has(o.id) && !keepIds.has(o.id))
            .map((o) => o.id)
        : []; // cancel-only — sotishga hech narsa yuborilmaydi
    setConfirmType(null);
    setSafetyChecked(false);

    const finalResult = {
      cancelSuccess: 0,
      cancelFailed: [] as { id: string; reason: string }[],
      sellSuccess: 0,
      sellFailed: [] as { id: string; reason: string }[],
    };

    try {
      // 1) BEKOR QILISH (alohida loading)
      if (cancelArr.length > 0) {
        setProgress({
          isProcessing: true,
          type: "cancel",
          current: 0,
          total: cancelArr.length,
          successCount: 0,
          failedCount: 0,
        });

        const cancelRes: any = await bulkCancelOrders.mutateAsync({
          order_ids: cancelArr,
        });
        const data = cancelRes?.data || cancelRes;
        finalResult.cancelSuccess = data?.totalSuccess || 0;
        finalResult.cancelFailed = data?.failed || [];

        setProgress((p) => ({
          ...p,
          current: cancelArr.length,
          successCount: finalResult.cancelSuccess,
          failedCount: finalResult.cancelFailed.length,
        }));

        // Qisqa pauza — UX uchun (loading "ko'rinib" qolsin)
        await new Promise((r) => setTimeout(r, 600));
      }

      // 2) SOTISH (alohida loading)
      if (sellArr.length > 0) {
        setProgress({
          isProcessing: true,
          type: "sell",
          current: 0,
          total: sellArr.length,
          successCount: 0,
          failedCount: 0,
        });

        const sellRes: any = await bulkSellOrders.mutateAsync({
          order_ids: sellArr,
        });
        const data = sellRes?.data || sellRes;
        finalResult.sellSuccess = data?.totalSuccess || 0;
        finalResult.sellFailed = data?.failed || [];

        setProgress((p) => ({
          ...p,
          current: sellArr.length,
          successCount: finalResult.sellSuccess,
          failedCount: finalResult.sellFailed.length,
        }));

        await new Promise((r) => setTimeout(r, 600));
      }

      // Loading'ni yopib natija ko'rsatish
      setProgress({
        isProcessing: false,
        type: null,
        current: 0,
        total: 0,
        successCount: 0,
        failedCount: 0,
      });
      setResult(finalResult);

      // State'ni tozalash:
      //   - cancel-only: faqat bekor qilinganlar tozalanadi, keep va sell ro'yxatda qoladi
      //   - full: hammasi tozalanadi (kun yakunlandi)
      if (type === "full") {
        setCancelIds(new Set());
        setKeepIds(new Set());
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      } else {
        // Faqat muvaffaqiyatli bekor qilinganlarni cancel ro'yxatdan olib tashlash
        // (xato bo'lganlari qoladi, qayta urinish mumkin)
        // Eng oson — refetch keyingi load'da WAITING bo'lmaganlar avto chiqib ketadi
        setCancelIds(new Set());
      }
      refetch();
    } catch (err: any) {
      setProgress({
        isProcessing: false,
        type: null,
        current: 0,
        total: 0,
        successCount: 0,
        failedCount: 0,
      });
      handleApiError(err, "Bulk amalda xato");
    }
  };

  const totalAction = stats.cancel.count + stats.sell.count;
  // Kun yakunlash har doim safety checkbox so'raydi (sotildi soni qancha bo'lishidan qat'iy nazar).
  // Faqat bekor qilish — ogohlantirish kerak emas (kunlik oddiy amal).
  const needsSafetyConfirm = confirmType === "full";

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] p-3 sm:p-6 relative">
      {/* ============ KATTA MARKAZIY VIZUAL FEEDBACK (today-orders uslubi) ============ */}
      {flash &&
        (() => {
          // Har bir holat uchun aniq farqlanadigan rang sxemasi
          const styles = {
            cancel: {
              bgOverlay: "bg-rose-500/20",
              circleBg: "bg-rose-500",
              circleShadow: "shadow-rose-500/50",
              textColor: "text-rose-700 dark:text-rose-300",
            },
            keep: {
              bgOverlay: "bg-amber-500/20",
              circleBg: "bg-amber-500",
              circleShadow: "shadow-amber-500/50",
              textColor: "text-amber-700 dark:text-amber-300",
            },
            warning: {
              bgOverlay: "bg-blue-500/20",
              circleBg: "bg-blue-500",
              circleShadow: "shadow-blue-500/50",
              textColor: "text-blue-700 dark:text-blue-300",
            },
            error: {
              bgOverlay: "bg-red-700/30",
              circleBg: "bg-red-700",
              circleShadow: "shadow-red-700/60",
              textColor: "text-red-800 dark:text-red-300",
            },
          }[flash];
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
              <div
                className={`absolute inset-0 transition-opacity duration-200 ${styles.bgOverlay}`}
              />
              <div className="relative flex flex-col items-center justify-center animate-in zoom-in duration-200">
                <div
                  className={`w-40 h-40 sm:w-52 sm:h-52 rounded-full flex items-center justify-center shadow-2xl ${styles.circleBg} ${styles.circleShadow}`}
                >
                  {flash === "cancel" && (
                    <XCircle
                      className="w-24 h-24 sm:w-32 sm:h-32 text-white"
                      strokeWidth={2.5}
                    />
                  )}
                  {flash === "keep" && (
                    <Clock
                      className="w-24 h-24 sm:w-32 sm:h-32 text-white"
                      strokeWidth={2.5}
                    />
                  )}
                  {flash === "warning" && (
                    <AlertTriangle
                      className="w-24 h-24 sm:w-32 sm:h-32 text-white"
                      strokeWidth={2.5}
                    />
                  )}
                  {flash === "error" && (
                    <AlertCircle
                      className="w-24 h-24 sm:w-32 sm:h-32 text-white"
                      strokeWidth={2.5}
                    />
                  )}
                </div>
                {lastScan?.title && (
                  <p
                    className={`mt-6 text-2xl sm:text-3xl font-bold drop-shadow-lg text-center px-4 ${styles.textColor}`}
                  >
                    {lastScan.title}
                  </p>
                )}
                {lastScan?.subtitle && (
                  <p className="mt-2 text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200 drop-shadow text-center px-4">
                    {lastScan.subtitle}
                  </p>
                )}
              </div>
            </div>
          );
        })()}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
              {t("title")}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {t("subtitle")}
            </p>
          </div>
          <button
            onClick={resetAll}
            className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-1 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("reset")}
          </button>
        </div>

        {/* 2 ta tab + skan zonasi */}
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-4 mb-4 border border-gray-100 dark:border-gray-800">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setScanMode("cancel")}
              className={`h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                scanMode === "cancel"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              <XCircle className="w-4 h-4" />
              {t("mode_cancel")} ({stats.cancel.count})
            </button>
            <button
              onClick={() => setScanMode("keep")}
              className={`h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                scanMode === "keep"
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              <Clock className="w-4 h-4" />
              {t("mode_keep")} ({stats.keep.count})
            </button>
          </div>

          {/* Skan zonasi — vizual indikator, klaviatura handler global */}
          <div
            className={`h-14 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-all ${
              scanMode === "cancel"
                ? "border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-900/10"
                : "border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10"
            }`}
          >
            <ScanLine
              className={`w-5 h-5 ${
                scanMode === "cancel" ? "text-rose-500" : "text-amber-500"
              }`}
            />
            <span
              className={`text-sm font-medium ${
                scanMode === "cancel" ? "text-rose-700" : "text-amber-700"
              }`}
            >
              {scanMode === "cancel"
                ? t("scan_zone_ready_cancel")
                : t("scan_zone_ready_keep")}
            </span>
          </div>

          {/* Caps Lock ogohlantirishi — skan baribir ishlaydi (avto-normalize),
              lekin foydalanuvchi yaxshiroq UX uchun bilishi kerak */}
          {capsLockOn && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-center gap-2 text-xs text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t("caps_lock_warning")}</span>
            </div>
          )}
        </div>

        {/* Order ro'yxati — ranglar bilan */}
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
              {t("orders_list_title")} ({t("orders_total", { count: allOrders.length })})
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {stats.cancel.count}
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {stats.keep.count}
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {stats.sell.count}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : allOrders.length === 0 ? (
            <div className="text-center py-20 text-gray-500 text-sm">
              {t("no_orders")}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[55vh] overflow-y-auto px-1 py-1">
              {allOrders.map((o) => {
                const st = getOrderStatus(o.id);
                const colorClass = {
                  cancel:
                    "bg-rose-50 dark:bg-rose-900/20 border-l-4 border-l-rose-500",
                  keep: "bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-500",
                  sell: "bg-emerald-50/50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500",
                }[st];
                return (
                  <div
                    key={o.id}
                    onClick={() => st !== "sell" && removeFromAny(o.id)}
                    className={`px-3 sm:px-4 py-3 rounded-md border border-gray-200/70 dark:border-gray-700/50 transition-all ${colorClass} ${
                      st !== "sell" ? "cursor-pointer hover:opacity-80" : ""
                    }`}
                    title={st !== "sell" ? t("remove_marker_hint") : ""}
                  >
                    {/* 1-qator: ism (chap) + narx (o'ng) */}
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="font-semibold text-base text-gray-800 dark:text-white truncate min-w-0">
                        {o.customer?.name || "—"}
                      </div>
                      <div className="font-bold text-base text-gray-800 dark:text-white shrink-0">
                        {formatPrice(o.total_price)}
                        <span className="ml-0.5 text-xs font-normal text-gray-500">
                          so'm
                        </span>
                      </div>
                    </div>
                    {/* 2-qator: telefon · tuman · market · sana (kompakt, wrap) */}
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                      <span className="font-mono text-gray-600 dark:text-gray-300">
                        {formatPhone(o.customer?.phone_number)}
                      </span>
                      {o.district?.name && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span>{o.district.name}</span>
                        </>
                      )}
                      {o.market?.name && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="text-purple-600 dark:text-purple-400 font-medium truncate max-w-[160px]">
                            {o.market.name}
                          </span>
                        </>
                      )}
                      {o.created_at && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <span className="font-mono text-xs">
                            {formatShortDate(o.created_at)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pastki — Yakunlash tugmasi */}
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-lg p-4 sticky bottom-3 border border-gray-100 dark:border-gray-800">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="text-rose-600 font-medium">
                {t("stat_cancel", { count: stats.cancel.count })}
              </span>
              <span className="text-emerald-600 font-medium">
                {t("stat_sell", { count: stats.sell.count })}
              </span>
              <span className="text-amber-600 font-medium">
                {t("stat_keep", { count: stats.keep.count })}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Tugma 1: Faqat bekorlarni bajarish — kun davomida bir necha marta ishlatish mumkin */}
              <button
                onClick={() => {
                  setConfirmType("cancel-only");
                  setSafetyChecked(false);
                }}
                disabled={stats.cancel.count === 0}
                className={`h-12 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                  stats.cancel.count === 0
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                    : "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/30"
                }`}
              >
                <XCircle className="w-4 h-4" />
                {t("btn_cancel_only", { count: stats.cancel.count })}
              </button>
              {/* Tugma 2: Kun yakunlash — bekor + qolganlarni avto-sotish */}
              <button
                onClick={() => {
                  setConfirmType("full");
                  setSafetyChecked(false);
                }}
                disabled={totalAction === 0}
                className={`h-12 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                  totalAction === 0
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-xl"
                }`}
              >
                <Zap className="w-4 h-4" />
                {t("btn_finalize", {
                  cancel: stats.cancel.count,
                  sell: stats.sell.count,
                })}
              </button>
            </div>
          </div>
        </div>

        {/* Tasdiqlash modali */}
        <Modal
          open={confirmOpen}
          onCancel={() => {
            setConfirmType(null);
            setSafetyChecked(false);
          }}
          footer={null}
          centered
          width={460}
        >
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
              {confirmType === "cancel-only"
                ? t("confirm_title_cancel_only")
                : t("confirm_title_full")}
            </h3>

            <div className="space-y-3 mb-5">
              {stats.cancel.count > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20">
                  <span className="text-sm font-medium text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {t("row_cancel")}
                  </span>
                  <span className="font-bold text-rose-700 dark:text-rose-400">
                    {stats.cancel.count} ta ·{" "}
                    {formatPrice(stats.cancel.total)} so'm
                  </span>
                </div>
              )}

              {confirmType === "full" && stats.sell.count > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {t("row_sell")}
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {stats.sell.count} ta · {formatPrice(stats.sell.total)}{" "}
                    so'm
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 opacity-70">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t("row_keep")}
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {confirmType === "cancel-only"
                    ? stats.sell.count + stats.keep.count
                    : stats.keep.count}{" "}
                  ta
                </span>
              </div>
            </div>

            {needsSafetyConfirm && (
              <div className="mb-4 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong className="block mb-1">
                      {t("warning_title")}
                    </strong>
                    {t("warning_message", { count: stats.sell.count })}
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={safetyChecked}
                    onChange={(e) => setSafetyChecked(e.target.checked)}
                    className="w-4 h-4 accent-yellow-600"
                  />
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    {t("warning_checkbox")}
                  </span>
                </label>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setConfirmType(null);
                  setSafetyChecked(false);
                }}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200"
              >
                {t("btn_cancel")}
              </button>
              <button
                disabled={needsSafetyConfirm && !safetyChecked}
                onClick={() => handleSubmit(confirmType!)}
                className={`px-5 py-2 rounded-lg text-white text-sm font-semibold transition-all ${
                  needsSafetyConfirm && !safetyChecked
                    ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                    : confirmType === "cancel-only"
                      ? "bg-rose-500 hover:bg-rose-600"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600"
                }`}
              >
                {t("btn_confirm")}
              </button>
            </div>
          </div>
        </Modal>

        {/* Loading modali — bekor va sotish uchun ALOHIDA */}
        {progress.isProcessing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
              <div
                className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  progress.type === "cancel"
                    ? "bg-rose-100 dark:bg-rose-900/30"
                    : "bg-emerald-100 dark:bg-emerald-900/30"
                }`}
              >
                <Loader2
                  className={`w-10 h-10 animate-spin ${
                    progress.type === "cancel"
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}
                />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-800 dark:text-white mb-2">
                {progress.type === "cancel"
                  ? t("loading_cancelling")
                  : t("loading_selling")}
              </h3>
              <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-4">
                {t("loading_count", {
                  current: progress.current,
                  total: progress.total,
                })}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    progress.type === "cancel"
                      ? "bg-gradient-to-r from-rose-500 to-pink-600"
                      : "bg-gradient-to-r from-emerald-500 to-green-600"
                  }`}
                  style={{
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {progress.successCount}
                  </span>
                </div>
                {progress.failedCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      {progress.failedCount}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                {t("loading_warning")}
              </p>
            </div>
          </div>
        )}

        {/* Natija modali */}
        <Modal
          open={!!result}
          onCancel={() => setResult(null)}
          footer={null}
          centered
          width={460}
        >
          {result && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                    {t("result_title")}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {t("result_subtitle")}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-between">
                  <span className="text-sm font-medium text-rose-700">
                    {t("result_cancelled")}
                  </span>
                  <span className="font-bold text-rose-700">
                    {result.cancelFailed.length > 0
                      ? t("result_with_errors", {
                          count: result.cancelSuccess,
                          failed: result.cancelFailed.length,
                        })
                      : t("result_count", { count: result.cancelSuccess })}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-700">
                    {t("result_sold")}
                  </span>
                  <span className="font-bold text-emerald-700">
                    {result.sellFailed.length > 0
                      ? t("result_with_errors", {
                          count: result.sellSuccess,
                          failed: result.sellFailed.length,
                        })
                      : t("result_count", { count: result.sellSuccess })}
                  </span>
                </div>
                {(result.cancelFailed.length > 0 ||
                  result.sellFailed.length > 0) && (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      {t("result_show_errors")}
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1 p-2 bg-gray-50 dark:bg-gray-900/40 rounded">
                      {result.cancelFailed.map((f) => (
                        <div key={`c-${f.id}`} className="text-rose-600">
                          {f.id.slice(0, 8)}…: {f.reason}
                        </div>
                      ))}
                      {result.sellFailed.map((f) => (
                        <div key={`s-${f.id}`} className="text-emerald-600">
                          {f.id.slice(0, 8)}…: {f.reason}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <div className="flex justify-end mt-5">
                <button
                  onClick={() => setResult(null)}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold"
                >
                  {t("result_close")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default memo(CourierBulkPage);
