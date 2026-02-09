/**
 * Refused Post Scanner Hook - Direct Mode
 *
 * Bekor qilingan buyurtmalarni skanerlash uchun hook
 * Visual va ovozli effectlar bilan
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePost } from "../../api/hooks/usePost";

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
export interface VisualFeedback {
  show: boolean;
  type: 'success' | 'error' | 'warning';
  message?: string;
}

interface UseRefusedPostScannerReturn {
  visualFeedback: VisualFeedback;
}

// ============ HOOK ============
export function useRefusedPostScanner(
  refetch?: () => void,
  setSelectedIds?: React.Dispatch<React.SetStateAction<string[]>>
): UseRefusedPostScannerReturn {
  const { checkRefusedPost } = usePost();
  const location = useLocation();

  const pathParts = location.pathname.split("/");
  const postId = pathParts[pathParts.length - 1];

  const [visualFeedback, setVisualFeedback] = useState<VisualFeedback>({
    show: false,
    type: 'success',
    message: ''
  });

  const showVisualFeedback = useCallback((type: 'success' | 'error' | 'warning', msg?: string) => {
    setVisualFeedback({ show: true, type, message: msg });
    setTimeout(() => {
      setVisualFeedback({ show: false, type: 'success', message: '' });
    }, 800);
  }, []);

  const refetchRef = useRef(refetch);
  const setSelectedIdsRef = useRef(setSelectedIds);
  const successTokens = useRef<Set<string>>(new Set());
  const processingTokens = useRef<Set<string>>(new Set());

  refetchRef.current = refetch;
  setSelectedIdsRef.current = setSelectedIds;

  useEffect(() => {
    successTokens.current.clear();
  }, [postId]);

  useEffect(() => {
    let scanned = "";
    let timer: any = null;

    const handleKeyPress = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Enter") {
        const tokenValue = scanned.trim();
        scanned = "";

        if (!tokenValue) return;

        const token = tokenValue.startsWith("http")
          ? tokenValue.split("/").pop()
          : tokenValue;

        if (!token) return;

        // Allaqachon topilgan
        if (successTokens.current.has(token)) {
          playSuccess();
          showVisualFeedback('warning', 'Allaqachon topilgan!');
          return;
        }

        // Hozir tekshirilmoqda
        if (processingTokens.current.has(token)) {
          return;
        }

        processingTokens.current.add(token);

        checkRefusedPost.mutate(
          {
            id: token as string,
            data: { postId },
          },
          {
            onSuccess: (res) => {
              const orderId = res.data.order?.id;

              playSuccess();
              showVisualFeedback('success', 'Buyurtma topildi!');
              successTokens.current.add(token);

              if (orderId && setSelectedIdsRef.current) {
                setSelectedIdsRef.current((prev) =>
                  prev.includes(orderId) ? prev : [...prev, orderId]
                );
              }

              refetchRef.current?.();
            },
            onError: (err: any) => {
              playError();

              const errorMsg = err?.response?.data?.message
                || err?.message
                || 'Xatolik';

              let displayError = 'Buyurtma topilmadi!';
              const errLower = errorMsg.toLowerCase();

              if (errLower.includes('not found') || errLower.includes('topilmadi')) {
                displayError = 'Bu pochtada yo\'q!';
              } else if (err?.response?.status === 404) {
                displayError = 'Bu pochtada yo\'q!';
              }

              showVisualFeedback('error', displayError);
            },
            onSettled: () => {
              processingTokens.current.delete(token);
            },
          }
        );
      } else {
        scanned += e.key;
        clearTimeout(timer);
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
  }, [
    checkRefusedPost,
    showVisualFeedback,
    postId,
  ]);

  return { visualFeedback };
}
