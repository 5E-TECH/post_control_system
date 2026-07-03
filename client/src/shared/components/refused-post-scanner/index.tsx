/**
 * Refused Post Scanner Hook — Client-side validation mode
 *
 * Bekor qilingan pochta buyurtmalarini QR skaner orqali TASDIQLASH.
 *
 * Oddiy post skaneri bilan bir xil mantiq (useManifestScanner), faqat:
 *   - manifest server predikati: status==='cancelled (sent)' && canceled_post_id===postId
 *   - miss tekshiruvi: POST post/check/cancel/:id
 *
 * Har skan xotiradagi manifest orqali ~0ms da, internetsiz tekshiriladi; faqat
 * noma'lum token uchun serverga bir marta boriladi.
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

export interface UseRefusedPostScannerOptions {
  /** normalizeQrToken(qr_code_token) -> orderId. status==='cancelled (sent)' && canceled_post_id===postId bo'yicha filtrlangan. */
  manifest?: Map<string, string>;
  /** Pochta ID (berilmasa URL oxirgi segmentidan olinadi). */
  postId?: string;
  enabled?: boolean;
}

export function useRefusedPostScanner(
  refetch?: () => void,
  setSelectedIds?: React.Dispatch<React.SetStateAction<string[]>>,
  options?: UseRefusedPostScannerOptions,
): { visualFeedback: VisualFeedback } {
  const location = useLocation();
  const urlPostId = location.pathname.split("/").pop() || "";
  const postId = options?.postId || urlPostId;

  const resolveMiss = useCallback(
    async (token: string): Promise<string | null> => {
      const res = await api.post(`post/check/cancel/${token}`, { postId });
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

export default useRefusedPostScanner;
