/**
 * Post Scanner Hook
 *
 * QR kod skanerlash uchun hook
 * Offline queue system bilan integratsiya qilingan
 *
 * Foydalanish:
 * - Pochta buyurtmalarini tekshirish uchun
 * - Offline rejimda skanlarni saqlaydi
 * - Internet qaytganda avtomatik sync qiladi
 */

import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { offlineQueueService } from "../../services/offline-queue";

const BASE_URL = import.meta.env.BASE_URL || '/';

interface UsePostScannerOptions {
  refetch?: () => void;
  setSelectedIds?: React.Dispatch<React.SetStateAction<string[]>>;
  onSuccess?: (orderId: string, token: string) => void;
  onError?: (error: any, token: string) => void;
}

interface UsePostScannerReturn {
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

export function usePostScanner(
  refetch?: () => void,
  setSelectedIds?: React.Dispatch<React.SetStateAction<string[]>>,
  options?: Omit<UsePostScannerOptions, 'refetch' | 'setSelectedIds'>
): UsePostScannerReturn {
  const location = useLocation();

  // URL dan postId ni ajratib olish
  const pathParts = location.pathname.split("/");
  const postId = pathParts[pathParts.length - 1];

  // Refs for stable callbacks
  const refetchRef = useRef(refetch);
  const setSelectedIdsRef = useRef(setSelectedIds);
  const onSuccessRef = useRef(options?.onSuccess);
  const onErrorRef = useRef(options?.onError);

  // Update refs
  refetchRef.current = refetch;
  setSelectedIdsRef.current = setSelectedIds;
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
    operationType: 'check_post',
    contextId: postId,
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

  // Operation result listener - success bo'lganda selectedIds ga qo'shish
  useEffect(() => {
    const unsubResult = offlineQueueService.onOperationResult(
      (operation: any, success: boolean, result: any, error?: string) => {
        if (operation.type !== 'check_post') return;
        if (operation.payload.contextId !== postId) return;

        if (success && result?.data?.order?.id) {
          const orderId = result.data.order.id;

          // Selected IDs ga qo'shish
          if (setSelectedIdsRef.current) {
            setSelectedIdsRef.current((prev) =>
              prev.includes(orderId) ? prev : [...prev, orderId]
            );
          }

          // Refetch
          refetchRef.current?.();

          // Custom callback
          onSuccessRef.current?.(orderId, operation.payload.token);
        } else if (!success) {
          // Custom error callback
          onErrorRef.current?.(error, operation.payload.token);
        }
      }
    );

    return () => {
      unsubResult();
    };
  }, [postId]);

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
export default usePostScanner;
