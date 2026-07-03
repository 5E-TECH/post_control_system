/**
 * Kuryer Order Scanner Hook — Optimistik rejim (B-lite)
 *
 * Pochta ichidagi buyurtmalarni QR skaner orqali bittalab qabul qilish.
 * Foydalanish: kuryer pochta detail sahifasida (status=SENT), mobil internetda.
 *
 * AVVAL: har skan serverga PATCH yuborib, JAVOBNI KUTIB turardi (+ har skanda
 * to'liq refetch). Sekin internetda har skan sekundlab kutardi.
 *
 * ENDI (optimistik): skan bo'lishi bilan DARROV ovoz + qator ro'yxatdan
 * yo'qoladi (manifestga tayanib client-side tekshiramiz). Mutatsiya FONDA
 * ketadi (kutilmaydi) + tarmoq xatosida retry. Doimiy xato bo'lsa optimistik
 * muvaffaqiyat QAYTARIB OLINADI (retract → refetch bilan haqiqat tiklanadi).
 *
 * Post RECEIVED qarori HAMISHA serverniki — faqat server `postReceived=true`
 * qaytarganda navigate qilinadi (client "oxirgisini skanerladim" deb o'zi
 * qaror qilmaydi).
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { api } from "../../api";
import { normalizeQrToken } from "../../helpers/normalizeQrToken";

const BASE_URL = import.meta.env.BASE_URL || "/";

// ============ AUDIO PRELOAD ============
let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;

if (typeof window !== "undefined") {
  try {
    successAudio = new Audio(`${BASE_URL}sound/beep.mp3`);
    successAudio.volume = 0.7;
    successAudio.load();

    errorAudio = new Audio(`${BASE_URL}sound/error.mp3`);
    errorAudio.volume = 1.0;
    errorAudio.load();
  } catch {
    /* ignore */
  }
}

const playSuccess = () => {
  try {
    if (successAudio) {
      successAudio.currentTime = 0;
      successAudio.play().catch(() => {});
    }
  } catch {
    /* ignore */
  }
};

const playError = () => {
  try {
    if (errorAudio) {
      errorAudio.currentTime = 0;
      errorAudio.play().catch(() => {});
    }
  } catch {
    /* ignore */
  }
};

export interface CourierScanFeedback {
  show: boolean;
  type: "success" | "error" | "warning";
  message?: string;
}

interface ScanRecord {
  token: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface ScanReceiveResponse {
  data?: {
    order_id?: string;
    customer_name?: string | null;
    remaining?: number;
    postReceived?: boolean;
  };
  message?: string;
  statusCode?: number;
}

/** Manifest yozuvi: ON_THE_ROAD buyurtma id'si + mijoz ismi (feedback uchun). */
export interface CourierManifestEntry {
  id: string;
  name: string | null;
}

interface UseCourierOrderScannerOptions {
  enabled?: boolean;
  /** normalizeQrToken(qr_code_token) -> {id,name}. Faqat ON_THE_ROAD buyurtmalar. */
  manifest?: Map<string, CourierManifestEntry>;
  /** Optimistik: skan bo'lishi bilan qatorni cache'dan olib tashlash (page). */
  onOptimisticReceive?: (orderId: string) => void;
  /** Haqiqatni qayta yuklash (xato/retract va kutilmagan server-yo'l muvaffaqiyatida). */
  refetch?: () => void;
  onPostReceived?: () => void;
  onSuccess?: (info: ScanReceiveResponse["data"]) => void;
}

const EMPTY_MANIFEST = new Map<string, CourierManifestEntry>();
const MAX_RETRIES = 2;

export function useCourierOrderScanner(options?: UseCourierOrderScannerOptions) {
  const enabled = options?.enabled !== false;

  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [feedback, setFeedback] = useState<CourierScanFeedback>({
    show: false,
    type: "success",
  });
  const [lastReceived, setLastReceived] = useState<{
    customer_name: string | null;
    remaining: number;
  } | null>(null);

  const successTokens = useRef<Set<string>>(new Set());
  const errorTokens = useRef<Set<string>>(new Set());
  const processingTokens = useRef<Set<string>>(new Set());

  // Refs — keypress listener'i va fon-mutatsiyalar eng yangi qiymatlarni ko'rsin.
  const manifestRef = useRef(options?.manifest ?? EMPTY_MANIFEST);
  const onOptimisticReceiveRef = useRef(options?.onOptimisticReceive);
  const refetchRef = useRef(options?.refetch);
  const onPostReceivedRef = useRef(options?.onPostReceived);
  const onSuccessRef = useRef(options?.onSuccess);
  manifestRef.current = options?.manifest ?? EMPTY_MANIFEST;
  onOptimisticReceiveRef.current = options?.onOptimisticReceive;
  refetchRef.current = options?.refetch;
  onPostReceivedRef.current = options?.onPostReceived;
  onSuccessRef.current = options?.onSuccess;

  const showFeedback = useCallback(
    (type: "success" | "error" | "warning", message?: string) => {
      setFeedback({ show: true, type, message });
      setTimeout(() => setFeedback({ show: false, type: "success" }), 1500);
    },
    [],
  );

  // Optimistik "necha ta qoldi" — manifestdagi hali qabul qilinmagan tokenlar.
  const computeRemaining = useCallback(() => {
    let r = 0;
    manifestRef.current.forEach((_entry, tok) => {
      if (!successTokens.current.has(tok)) r++;
    });
    return r;
  }, []);

  const pushHistory = useCallback(
    (token: string, success: boolean, error?: string) => {
      setScanHistory((prev) =>
        [{ token, success, error, timestamp: Date.now() }, ...prev].slice(0, 50),
      );
    },
    [],
  );

  /**
   * Serverga qabul qilish so'rovini yuborish (retry bilan).
   * optimistic=true — UI allaqachon muvaffaqiyat ko'rsatgan; xatoda retract.
   * optimistic=false — manifestda yo'q (kamdan-kam) token; javobni kutamiz.
   */
  const sendReceive = useCallback(
    async (token: string, optimistic: boolean) => {
      processingTokens.current.add(token);
      try {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const res = await api.patch<ScanReceiveResponse>(
              `post/receive/order/scan/token/${token}`,
            );
            const data = res.data?.data;

            if (!optimistic) {
              // Server-yo'l: kutilmaganda manifest tashqarisidagi token qabul bo'ldi.
              playSuccess();
              successTokens.current.add(token);
              const remaining = data?.remaining ?? 0;
              setLastReceived({
                customer_name: data?.customer_name ?? null,
                remaining,
              });
              showFeedback(
                "success",
                data?.postReceived
                  ? "Pochta to'liq qabul qilindi!"
                  : `Qabul qilindi! ${remaining} ta qoldi`,
              );
              pushHistory(token, true);
              refetchRef.current?.(); // ro'yxatni server haqiqati bilan sync
            }

            onSuccessRef.current?.(data);
            if (data?.postReceived) onPostReceivedRef.current?.();
            return;
          } catch (error: unknown) {
            const status = (error as { response?: { status?: number } })?.response
              ?.status;
            const msg = (
              (error as { response?: { data?: { message?: string } } })?.response
                ?.data?.message ||
              (error as { message?: string })?.message ||
              ""
            ).toLowerCase();

            // "Allaqachon qabul qilingan" — xato emas, dublikat. Muvaffaqiyatni
            // saqlab qolamiz (optimistik qator olib tashlangani to'g'ri).
            if (msg.includes("allaqachon")) {
              successTokens.current.add(token);
              if (!optimistic) {
                playSuccess();
                showFeedback("warning", "Allaqachon qabul qilingan!");
              }
              return;
            }

            // Tarmoq/timeout/5xx — qayta urinishga arziydi (fon retry).
            const retryable =
              !status || status === 408 || status === 429 || status >= 500;
            if (retryable && attempt < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
              continue;
            }

            // ===== DOIMIY XATO =====
            if (optimistic) {
              // Optimistik muvaffaqiyatni QAYTARIB OLAMIZ — refetch haqiqatni
              // tiklaydi (qator yana ON_THE_ROAD bo'lib qaytadi).
              successTokens.current.delete(token);
              refetchRef.current?.();
            }
            errorTokens.current.add(token);
            playError();
            const display =
              msg.includes("topilmadi") || status === 404
                ? "Topilmadi!"
                : "Qabul qilinmadi — qayta skanerlang!";
            showFeedback("error", display);
            pushHistory(token, false, display);
            return;
          }
        }
      } finally {
        processingTokens.current.delete(token);
      }
    },
    [showFeedback, pushHistory],
  );

  const receive = useCallback(
    async (rawToken: string) => {
      const token = normalizeQrToken(rawToken);
      if (!token) return;

      // Shu sessiyada allaqachon qabul qilingan — darrov (tarmoqsiz)
      if (successTokens.current.has(token)) {
        playSuccess();
        showFeedback("warning", "Allaqachon qabul qilingan!");
        return;
      }

      // Avval xato bo'lgan tokenni qayta urinishga ruxsat (tarmoq tiklangandir)
      if (errorTokens.current.has(token)) {
        errorTokens.current.delete(token);
      }

      // Hozir jarayonda
      if (processingTokens.current.has(token)) return;

      // Internet yo'q — B-lite offline saqlashni qo'llab-quvvatlamaydi, shuning
      // uchun noto'g'ri optimistik muvaffaqiyat ko'rsatmaymiz (keyin retract
      // bo'lib chalkashtirmasin). Ikkala yo'l ham tarmoqqa muhtoj.
      if (!navigator.onLine) {
        playError();
        showFeedback("error", "Internet yo'q!");
        return;
      }

      const entry = manifestRef.current.get(token);

      if (entry) {
        // ===== OPTIMISTIK YO'L — manifestda bor (ON_THE_ROAD, shu post) =====
        playSuccess();
        successTokens.current.add(token);
        const remaining = computeRemaining();
        setLastReceived({ customer_name: entry.name, remaining });
        showFeedback("success", `Qabul qilindi! ${remaining} ta qoldi`);
        pushHistory(token, true);
        onOptimisticReceiveRef.current?.(entry.id); // qatorni cache'dan olib tashlash
        void sendReceive(token, true); // fon — kutmaymiz
        return;
      }

      // ===== SERVER YO'LI — manifestda yo'q (kamdan-kam / xato) =====
      await sendReceive(token, false);
    },
    [showFeedback, pushHistory, computeRemaining, sendReceive],
  );

  // Klaviatura listener (skaner qurilmasi klaviatura sifatida emit qiladi)
  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Enter") {
        const value = buffer.trim();
        buffer = "";
        if (value) {
          const token = value.startsWith("http")
            ? value.split("/").pop() || value
            : value;
          receive(token);
        }
        return;
      }

      if (e.key.length === 1) {
        buffer += e.key;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          buffer = "";
        }, 1200);
      }
    };

    window.addEventListener("keypress", handleKey);
    return () => {
      window.removeEventListener("keypress", handleKey);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, receive]);

  const successCount = scanHistory.filter((s) => s.success).length;
  const errorCount = scanHistory.filter((s) => !s.success).length;

  return {
    feedback,
    scanHistory,
    successCount,
    errorCount,
    lastReceived,
    receiveByToken: receive,
  };
}

export default useCourierOrderScanner;
