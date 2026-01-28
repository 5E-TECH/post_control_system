/**
 * Post Scanner Hook - Direct Mode
 *
 * QR kod skanerlash uchun hook
 * TO'G'RIDAN-TO'G'RI API chaqirish - DARHOL javob
 *
 * Foydalanish:
 * - Pochta buyurtmalarini tekshirish uchun
 * - Har bir skan uchun darhol success/error ovozi
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { message } from "antd";
import { api } from "../../api";

const BASE_URL = import.meta.env.BASE_URL || '/';

// ============ AUDIO PRELOAD ============
let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;

if (typeof window !== 'undefined') {
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
  } catch { /* ignore */ }
};

const playError = () => {
  try {
    if (errorAudio) {
      errorAudio.currentTime = 0;
      errorAudio.play().catch(() => {});
    }
  } catch { /* ignore */ }
};

// ============ TYPES ============
interface UsePostScannerOptions {
  refetch?: () => void;
  setSelectedIds?: React.Dispatch<React.SetStateAction<string[]>>;
  onSuccess?: (orderId: string, token: string) => void;
  onError?: (error: any, token: string) => void;
}

interface ScanResult {
  token: string;
  success: boolean;
  orderId?: string;
  error?: string;
  timestamp: number;
}

// Visual feedback type
export interface VisualFeedback {
  show: boolean;
  type: 'success' | 'error' | 'warning';
  message?: string;
}

interface UsePostScannerReturn {
  // Scan history
  scanHistory: ScanResult[];
  successCount: number;
  errorCount: number;

  // Status
  isOnline: boolean;

  // Visual feedback
  visualFeedback: VisualFeedback;

  // Actions
  clearHistory: () => void;
}

// ============ HOOK ============
export function usePostScanner(
  refetch?: () => void,
  setSelectedIds?: React.Dispatch<React.SetStateAction<string[]>>,
  options?: Omit<UsePostScannerOptions, 'refetch' | 'setSelectedIds'>
): UsePostScannerReturn {
  const location = useLocation();

  // URL dan postId ni ajratib olish
  const pathParts = location.pathname.split("/");
  const postId = pathParts[pathParts.length - 1];

  // State
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [visualFeedback, setVisualFeedback] = useState<VisualFeedback>({
    show: false,
    type: 'success',
    message: ''
  });

  // Visual feedback ko'rsatish funksiyasi
  const showVisualFeedback = useCallback((type: 'success' | 'error' | 'warning', msg?: string) => {
    setVisualFeedback({ show: true, type, message: msg });
    setTimeout(() => {
      setVisualFeedback({ show: false, type: 'success', message: '' });
    }, 800);
  }, []);

  // Refs
  const refetchRef = useRef(refetch);
  const setSelectedIdsRef = useRef(setSelectedIds);
  const onSuccessRef = useRef(options?.onSuccess);
  const onErrorRef = useRef(options?.onError);
  const processingTokens = useRef<Set<string>>(new Set());

  // Alohida: muvaffaqiyatli va xato tokenlar
  const successTokens = useRef<Set<string>>(new Set());
  const errorTokens = useRef<Set<string>>(new Set());

  // Update refs
  refetchRef.current = refetch;
  setSelectedIdsRef.current = setSelectedIds;
  onSuccessRef.current = options?.onSuccess;
  onErrorRef.current = options?.onError;

  // PostId o'zgarganda tokenlarni tozalash
  useEffect(() => {
    successTokens.current.clear();
    errorTokens.current.clear();
    setScanHistory([]);
  }, [postId]);

  // Network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ============ DIRECT API CALL ============
  const checkOrderDirect = useCallback(async (token: string) => {
    // 1. OLDIN TOPILGAN BUYURTMA - success sound va sariq visual
    if (successTokens.current.has(token)) {
      playSuccess();
      showVisualFeedback('warning', 'Allaqachon topilgan!');
      return;
    }

    // 2. OLDIN XATO BO'LGAN - qayta urinish uchun o'chiramiz
    if (errorTokens.current.has(token)) {
      errorTokens.current.delete(token);
      // Davom etamiz - qayta serverga so'rov yuboramiz
    }

    // 3. Hozir tekshirilmoqda
    if (processingTokens.current.has(token)) {
      return;
    }

    // 4. Internet yo'q
    if (!navigator.onLine) {
      playError();
      showVisualFeedback('error', 'Internet yo\'q!');
      return;
    }

    processingTokens.current.add(token);

    try {
      // TO'G'RIDAN-TO'G'RI API CHAQIRISH - NAVBAT YO'Q!
      const response = await api.post(`post/check/${token}`, { postId });

      // MUVAFFAQIYAT!
      playSuccess();
      showVisualFeedback('success', 'Topildi!');
      successTokens.current.add(token);
      errorTokens.current.delete(token); // Agar oldin xato bo'lgan bo'lsa

      const orderId = response.data?.data?.order?.id;

      // Scan history ga qo'shish
      setScanHistory(prev => [{
        token,
        success: true,
        orderId,
        timestamp: Date.now()
      }, ...prev].slice(0, 100)); // Oxirgi 100 ta

      // Selected IDs ga qo'shish
      if (orderId && setSelectedIdsRef.current) {
        setSelectedIdsRef.current(prev =>
          prev.includes(orderId) ? prev : [...prev, orderId]
        );
      }

      // Refetch
      refetchRef.current?.();

      // Callback
      onSuccessRef.current?.(orderId, token);

    } catch (error: any) {
      // XATOLIK!
      playError();
      errorTokens.current.add(token); // Qayta urinish uchun xato tokenlar ro'yxatiga

      const errorMsg = error?.response?.data?.message
        || error?.message
        || 'Xatolik';

      // Foydalanuvchiga tushunarli xabar
      let displayError = 'Xatolik!';
      const errLower = errorMsg.toLowerCase();

      if (errLower.includes('not found') || errLower.includes('topilmadi')) {
        displayError = 'Bu pochtada yo\'q!';
      } else if (error?.response?.status === 404) {
        displayError = 'Bu pochtada yo\'q!';
      }

      showVisualFeedback('error', displayError);

      // Scan history ga qo'shish
      setScanHistory(prev => [{
        token,
        success: false,
        error: displayError,
        timestamp: Date.now()
      }, ...prev].slice(0, 100));

      // Callback
      onErrorRef.current?.(errorMsg, token);

    } finally {
      processingTokens.current.delete(token);
    }
  }, [postId]);

  // ============ SCANNER HANDLER ============
  const handleScan = useCallback((tokenValue: string) => {
    if (!tokenValue) return;

    // Agar URL bo'lsa faqat token qismini olamiz
    const token = tokenValue.startsWith("http")
      ? tokenValue.split("/").pop() || tokenValue
      : tokenValue;

    // Darhol tekshirish
    checkOrderDirect(token);
  }, [checkOrderDirect]);

  // ============ KEYBOARD LISTENER ============
  useEffect(() => {
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

        if (tokenValue) {
          handleScan(tokenValue);
        }
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
  }, [handleScan]);

  // ============ COMPUTED VALUES ============
  const successCount = scanHistory.filter(s => s.success).length;
  const errorCount = scanHistory.filter(s => !s.success).length;

  const clearHistory = useCallback(() => {
    setScanHistory([]);
    successTokens.current.clear();
    errorTokens.current.clear();
  }, []);

  return {
    scanHistory,
    successCount,
    errorCount,
    isOnline,
    visualFeedback,
    clearHistory
  };
}

// Default export
export default usePostScanner;
