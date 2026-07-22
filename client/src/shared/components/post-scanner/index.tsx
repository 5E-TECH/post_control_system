/**
 * Post Scanner Hook — Client-side validation mode
 *
 * Pochta buyurtmalarini QR skaner orqali TASDIQLASH (read-only selection).
 *
 * AVVAL: har skan serverga `POST post/check/:id` so'rovi yuborardi — sekin
 * internetda bitta skan 4-5 soniyagacha kutardi.
 *
 * ENDI: sahifa ochilganda pochtaning barcha buyurtmasi (qr_code_token bilan)
 * allaqachon yuklangan. Shuning uchun har skanni xotiradagi `manifest` orqali
 * O(1) tezlikda (~0ms, internetsiz) tekshiramiz. Faqat manifestda yo'q (yangi
 * qo'shilgan yoki begona) token uchun serverga BIR MARTA `post/check/:id`
 * so'rovi yuboriladi — keyin natija keshlanadi.
 *
 * Manifest sahifa tomonidan quriladi (server predikatini AYNAN takrorlab:
 * status==='received' && post_id===postId) — useManifestScanner'ga uzatiladi.
 */

import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../api";
import {
  useManifestScanner,
  type VisualFeedback,
} from "../../hooks/useManifestScanner";

export type { VisualFeedback };

const EMPTY_MANIFEST = new Map<string, string>();

export interface UsePostScannerOptions {
  /** normalizeQrToken(qr_code_token) -> orderId. status==='received' && post_id===postId bo'yicha filtrlangan. */
  manifest?: Map<string, string>;
  /** Pochta ID (berilmasa URL oxirgi segmentidan olinadi). */
  postId?: string;
  /** Ruxsatsiz rollar uchun skanerni umuman o'rnatmaslik. */
  enabled?: boolean;
}

export function usePostScanner(
  refetch?: () => void,
  setSelectedIds?: React.Dispatch<React.SetStateAction<string[]>>,
  options?: UsePostScannerOptions,
): { visualFeedback: VisualFeedback } {
  const location = useLocation();
  const urlPostId = location.pathname.split("/").pop() || "";
  const postId = options?.postId || urlPostId;

  // Manifestda topilmagan token uchun yagona server tekshiruvi (yangi qo'shilgan
  // buyurtmani tutish uchun). 404 — bu pochtada yo'q.
  const resolveMiss = useCallback(
    async (token: string): Promise<string | null> => {
      const res = await api.post(`post/check/${token}`, { postId });
      return res?.data?.data?.order?.id ?? null;
    },
    [postId],
  );

  return useManifestScanner({
    manifest: options?.manifest ?? EMPTY_MANIFEST,
    resolveMiss,
    setSelectedIds,
    onMissResolved: refetch,
    resetKey: postId,
    enabled: options?.enabled,
  });
}

export default usePostScanner;
