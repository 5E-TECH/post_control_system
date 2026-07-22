/**
 * useManifestScanner — pochta ichidagi buyurtmalarni QR skaner orqali TASDIQLASH
 * (read-only) uchun umumiy yadro. Oddiy post va bekor-post skanerlari shu
 * yadrodan foydalanadi.
 *
 * G'OYA: sahifa ochilganda pochtaning BARCHA buyurtmasi (qr_code_token bilan)
 * allaqachon yuklangan. Shuning uchun har skanni serverga yubormay, xotiradagi
 * `manifest` (Map<normalizedToken, orderId>) orqali O(1) tezlikda tekshiramiz —
 * internet tezligiga BOG'LIQ EMAS, ~0ms.
 *
 * Faqat manifestda TOPILMAGAN (miss) token uchun serverga BIR MARTA so'rov
 * yuboramiz (resolveMiss): u sahifa ochilgandan keyin qo'shilgan yangi buyurtma
 * bo'lishi mumkin. Agar server ham "yo'q" desa — tokenni "xato kesh"ga
 * (errorTokens) qo'shamiz va keyingi skanlarida qayta serverga bormaymiz
 * (darrov "yo'q"). Shu sabab adashib begona buyurtma qayta-qayta skanerlansa
 * ham backendga ATIGI BIR MARTA boriladi.
 *
 * Ro'yxat haqiqatan o'zgarganda (manifest referensi yangilansa — masalan miss
 * hal bo'lib refetch yuz bersa yoki fon-yangilanishda) "xato kesh" tozalanadi:
 * shunda avval rad etilgan, endi pochtaga qo'shilgan tokenlarga qayta imkon
 * beriladi (self-healing).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeQrToken } from "../helpers/normalizeQrToken";

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
    // Audio init error
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

// ============ TYPES ============
export interface VisualFeedback {
  show: boolean;
  type: "success" | "error" | "warning";
  message?: string;
}

export interface UseManifestScannerParams {
  /**
   * normalizeQrToken(qr_code_token) -> orderId. Sahifa server predikatini AYNAN
   * takrorlab quradi (masalan status==='received' && post_id===postId).
   */
  manifest: Map<string, string>;
  /**
   * Manifestda yo'q (noma'lum) token uchun serverga BIR MARTA tekshiruv.
   * Topilsa orderId qaytaradi; topilmasa null qaytaradi yoki 404 bilan throw
   * qiladi (ikkalasi ham "yo'q" sifatida ishlanadi).
   */
  resolveMiss: (token: string) => Promise<string | null>;
  setSelectedIds?: React.Dispatch<React.SetStateAction<string[]>>;
  /** Server miss'ni tasdiqlagach ro'yxatni yangilash (yangi buyurtma ko'rinishi uchun). */
  onMissResolved?: () => void;
  /** O'zgarganda barcha keshlar tozalanadi (odatda postId). */
  resetKey?: string;
  enabled?: boolean;
}

// ============ HOOK ============
export function useManifestScanner({
  manifest,
  resolveMiss,
  setSelectedIds,
  onMissResolved,
  resetKey,
  enabled = true,
}: UseManifestScannerParams): { visualFeedback: VisualFeedback } {
  const [visualFeedback, setVisualFeedback] = useState<VisualFeedback>({
    show: false,
    type: "success",
    message: "",
  });

  const showVisualFeedback = useCallback(
    (type: VisualFeedback["type"], msg?: string) => {
      setVisualFeedback({ show: true, type, message: msg });
      setTimeout(() => {
        setVisualFeedback({ show: false, type: "success", message: "" });
      }, 800);
    },
    [],
  );

  // Refs — keypress listener'i har renderda qayta o'rnatilmasligi uchun.
  const manifestRef = useRef(manifest);
  const resolveMissRef = useRef(resolveMiss);
  const setSelectedIdsRef = useRef(setSelectedIds);
  const onMissResolvedRef = useRef(onMissResolved);
  manifestRef.current = manifest;
  resolveMissRef.current = resolveMiss;
  setSelectedIdsRef.current = setSelectedIds;
  onMissResolvedRef.current = onMissResolved;

  // Topilgan / "yo'q" deb tasdiqlangan / hozir tekshirilayotgan tokenlar.
  const successTokens = useRef<Set<string>>(new Set());
  const errorTokens = useRef<Set<string>>(new Set());
  const processingTokens = useRef<Set<string>>(new Set());

  // Kontekst (postId) o'zgarsa — barcha keshlarni tozalaymiz.
  useEffect(() => {
    successTokens.current.clear();
    errorTokens.current.clear();
    processingTokens.current.clear();
  }, [resetKey]);

  // Ro'yxat (manifest) haqiqatan o'zgarganda "xato kesh"ni tozalaymiz, shunda
  // avval rad etilgan, endi qo'shilgan tokenlarga qayta imkon beriladi.
  // successTokens ataylab saqlanadi: topilgan token topilgan bo'lib qoladi.
  useEffect(() => {
    errorTokens.current.clear();
  }, [manifest]);

  const select = useCallback((orderId: string) => {
    if (orderId && setSelectedIdsRef.current) {
      setSelectedIdsRef.current((prev) =>
        prev.includes(orderId) ? prev : [...prev, orderId],
      );
    }
  }, []);

  const handleToken = useCallback(
    async (token: string) => {
      // 1. Allaqachon topilgan — DARROV (tarmoqsiz)
      if (successTokens.current.has(token)) {
        playSuccess();
        showVisualFeedback("warning", "Allaqachon topilgan!");
        return;
      }

      // 2. Manifestda bor — DARROV (tarmoqsiz)
      const fromManifest = manifestRef.current.get(token);
      if (fromManifest) {
        playSuccess();
        showVisualFeedback("success", "Topildi!");
        successTokens.current.add(token);
        select(fromManifest);
        return;
      }

      // 3. Avval "yo'q" deb tasdiqlangan — DARROV (tarmoqsiz), backendga BORMAYDI
      if (errorTokens.current.has(token)) {
        playError();
        showVisualFeedback("error", "Bu pochtada yo'q!");
        return;
      }

      // 4. Hozir tekshirilmoqda
      if (processingTokens.current.has(token)) {
        return;
      }

      // 5. Internet yo'q — miss'ni hal qila olmaymiz (xato keshga QO'SHMAYMIZ,
      //    internet kelganda qayta urinish mumkin bo'lsin)
      if (!navigator.onLine) {
        playError();
        showVisualFeedback("error", "Internet yo'q!");
        return;
      }

      // 6. Yangi (noma'lum) token — serverdan BIR MARTA so'raymiz
      processingTokens.current.add(token);
      try {
        const orderId = await resolveMissRef.current(token);
        if (orderId) {
          // Sahifa ochilgandan keyin qo'shilgan buyurtma — qabul qilamiz va
          // ro'yxatni yangilaymiz (manifest qayta quriladi, keyingi skani ~0ms).
          playSuccess();
          showVisualFeedback("success", "Topildi!");
          successTokens.current.add(token);
          select(orderId);
          onMissResolvedRef.current?.();
        } else {
          playError();
          showVisualFeedback("error", "Bu pochtada yo'q!");
          errorTokens.current.add(token); // negativ kesh
        }
      } catch (err) {
        playError();
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 404) {
          showVisualFeedback("error", "Bu pochtada yo'q!");
          errorTokens.current.add(token); // negativ kesh — qayta serverga bormaydi
        } else {
          // Tarmoq/server xatosi — keshlamaymiz, qayta urinishga ruxsat beramiz
          showVisualFeedback("error", "Xatolik!");
        }
      } finally {
        processingTokens.current.delete(token);
      }
    },
    [showVisualFeedback, select],
  );

  // ============ KEYBOARD (SCANNER) LISTENER ============
  useEffect(() => {
    if (!enabled) return;

    let scanned = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Enter") {
        const tokenValue = scanned.trim();
        scanned = "";
        if (!tokenValue) return;

        // URL bo'lsa faqat token qismini olamiz
        const rawToken = tokenValue.startsWith("http")
          ? tokenValue.split("/").pop() || tokenValue
          : tokenValue;

        // Caps Lock / RU layout muammosini bartaraf qilamiz (server bilan bir xil)
        const token = normalizeQrToken(rawToken);
        if (token) handleToken(token);
      } else {
        scanned += e.key;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          scanned = "";
        }, 1500);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, handleToken]);

  return { visualFeedback };
}

export default useManifestScanner;
