/**
 * Kuryer Order Scanner Hook
 *
 * Pochta ichidagi buyurtmalarni QR skaner orqali bittalab qabul qilish.
 * Foydalanish: kuryer pochta detail sahifasida (status=SENT) ishlaydi.
 *
 * Skaner qurilmasi klaviatura sifatida ishlaydi: token ketma-ket harf
 * sifatida emit qiladi, oxirida Enter bosadi. Biz Enter ni payqab oxirgi
 * tokeni serverga yuboramiz.
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

interface UseCourierOrderScannerOptions {
  enabled?: boolean;
  refetch?: () => void;
  onPostReceived?: () => void;
  onSuccess?: (info: ScanReceiveResponse["data"]) => void;
}

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

  const refetchRef = useRef(options?.refetch);
  const onPostReceivedRef = useRef(options?.onPostReceived);
  const onSuccessRef = useRef(options?.onSuccess);
  refetchRef.current = options?.refetch;
  onPostReceivedRef.current = options?.onPostReceived;
  onSuccessRef.current = options?.onSuccess;

  const showFeedback = useCallback(
    (type: "success" | "error" | "warning", message?: string) => {
      setFeedback({ show: true, type, message });
      // 1500ms — full-screen overlay foydalanuvchiga aniq ko'rinishi uchun
      // (xuddi today-orders va post-checking skanerlardagi 800-1500ms davom)
      setTimeout(() => setFeedback({ show: false, type: "success" }), 1500);
    },
    [],
  );

  const receive = useCallback(
    async (rawToken: string) => {
      // Caps Lock va RU layout muammosini bartaraf qilamiz
      const token = normalizeQrToken(rawToken);
      if (!token) return;

      if (successTokens.current.has(token)) {
        playSuccess();
        showFeedback("warning", "Allaqachon qabul qilingan!");
        return;
      }

      if (errorTokens.current.has(token)) {
        errorTokens.current.delete(token);
      }

      if (processingTokens.current.has(token)) return;

      if (!navigator.onLine) {
        playError();
        showFeedback("error", "Internet yo'q!");
        return;
      }

      processingTokens.current.add(token);

      try {
        const res = await api.patch<ScanReceiveResponse>(
          `post/receive/order/scan/token/${token}`,
        );
        const data = res.data?.data;

        playSuccess();
        successTokens.current.add(token);

        const remaining = data?.remaining ?? 0;
        const postReceived = data?.postReceived ?? false;

        if (postReceived) {
          showFeedback("success", "Pochta to'liq qabul qilindi!");
        } else {
          showFeedback("success", `Qabul qilindi! ${remaining} ta qoldi`);
        }

        setLastReceived({
          customer_name: data?.customer_name ?? null,
          remaining,
        });

        setScanHistory((prev) =>
          [
            {
              token,
              success: true,
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 50),
        );

        onSuccessRef.current?.(data);
        refetchRef.current?.();

        if (postReceived) {
          onPostReceivedRef.current?.();
        }
      } catch (error: any) {
        const errorMsg: string =
          error?.response?.data?.message ||
          error?.message ||
          "Xatolik yuz berdi";

        let display = errorMsg;
        const errLower = errorMsg.toLowerCase();
        let warningInsteadOfError = false;

        if (errLower.includes("allaqachon")) {
          successTokens.current.add(token);
          warningInsteadOfError = true;
          display = "Allaqachon qabul qilingan!";
        } else if (
          errLower.includes("topilmadi") ||
          error?.response?.status === 404
        ) {
          display = "Topilmadi!";
        }

        if (warningInsteadOfError) {
          playSuccess();
          showFeedback("warning", display);
        } else {
          errorTokens.current.add(token);
          playError();
          showFeedback("error", display);
        }

        setScanHistory((prev) =>
          [
            {
              token,
              success: false,
              error: display,
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 50),
        );
      } finally {
        processingTokens.current.delete(token);
      }
    },
    [showFeedback],
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
          // URL bo'lsa pop oxiridan token
          const token = value.startsWith("http")
            ? value.split("/").pop() || value
            : value;
          receive(token);
        }
        return;
      }

      // Faqat ko'rinadigan belgilar (tab/shift/etc'larni e'tiborsiz qoldiramiz)
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
