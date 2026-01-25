/**
 * Global Scanner Hook
 *
 * Buyurtmalarni qabul qilish uchun QR kod skanerlash hook
 * Offline queue system bilan integratsiya qilingan
 *
 * Foydalanish:
 * - Market buyurtmalarini qabul qilish uchun
 * - Offline rejimda skanlarni saqlaydi
 * - Internet qaytganda avtomatik sync qiladi
 */

import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { offlineQueueService } from "../../services/offline-queue";

const BASE_URL = import.meta.env.BASE_URL || '/';

interface UseGlobalScannerOptions {
  refetch?: () => void;
  onSuccess?: (token: string) => void;
  onError?: (error: any, token: string) => void;
}

interface UseGlobalScannerReturn {
  // Queue stats
  queueStats: {
    pending: number;
    processing: number;
    failed: number;
    total: number;
  };
  isOnline: boolean;
  isProcessing: boolean;
  failedOperations: any[];

  // Actions
  retryAllFailed: () => Promise<void>;
  clearAllFailed: () => Promise<void>;
}

export function useGlobalScanner(
  refetch?: () => void,
  options?: Omit<UseGlobalScannerOptions, 'refetch'>
): UseGlobalScannerReturn {
  const location = useLocation();

  // URL dan marketId ni ajratib olish
  const pathParts = location.pathname.split("/");
  const marketId = pathParts[pathParts.length - 1];

  // Refs for stable callbacks
  const refetchRef = useRef(refetch);
  const onSuccessRef = useRef(options?.onSuccess);
  const onErrorRef = useRef(options?.onError);

  // Update refs
  refetchRef.current = refetch;
  onSuccessRef.current = options?.onSuccess;
  onErrorRef.current = options?.onError;

  // Offline queue hook
  const {
    stats: queueStats,
    isOnline,
    isProcessing,
    failedOperations,
    addToQueue,
    retryAllFailed,
    clearAllFailed,
  } = useOfflineQueue({
    operationType: 'receive_order',
    contextId: marketId,
    autoProcess: true,
    showMessages: true
  });

  // Error sound
  const errorSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    errorSoundRef.current = new Audio(`${BASE_URL}sound/error.mp3`);
    return () => {
      errorSoundRef.current = null;
    };
  }, []);

  // Scanner handler
  const handleScan = useCallback(async (tokenValue: string) => {
    if (!tokenValue) return;

    // Agar URL bo'lsa faqat token qismini olamiz
    const token = tokenValue.startsWith("http")
      ? tokenValue.split("/").pop() || tokenValue
      : tokenValue;

    // Navbatga qo'shish
    const added = await addToQueue(token);

    if (!added) {
      // Allaqachon navbatda - error sound
      if (errorSoundRef.current) {
        errorSoundRef.current.currentTime = 0;
        errorSoundRef.current.play().catch(() => {});
      }
    }
  }, [addToQueue]);

  // Keyboard listener
  useEffect(() => {
    let scanned = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Agar input elementida bo'lsa, ishlamasin
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

  // Operation result listener
  useEffect(() => {
    const unsubResult = offlineQueueService.onOperationResult(
      (operation: any, success: boolean, _result: any, error?: string) => {
        if (operation.type !== 'receive_order') return;
        if (operation.payload.contextId !== marketId) return;

        if (success) {
          // Refetch
          refetchRef.current?.();

          // Custom callback
          onSuccessRef.current?.(operation.payload.token);
        } else if (!success && operation.status === 'failed') {
          // Custom error callback
          onErrorRef.current?.(error, operation.payload.token);
        }
      }
    );

    return () => {
      unsubResult();
    };
  }, [marketId]);

  return {
    queueStats,
    isOnline,
    isProcessing,
    failedOperations,
    retryAllFailed,
    clearAllFailed
  };
}

// Default export for backwards compatibility
export default useGlobalScanner;
