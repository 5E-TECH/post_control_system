import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const SYNC_KEY = "integration-sync";

// Sync status types
export type SyncStatus = 'pending' | 'processing' | 'success' | 'failed';
export type SyncAction = 'sold' | 'canceled' | 'paid' | 'rollback' | 'waiting';

// Pagination interface
export interface SyncPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// All syncs response
export interface AllSyncsResponse {
  data: SyncJob[];
  pagination: SyncPagination;
}

// Sync job interface
export interface SyncJob {
  id: string;
  order_id: string;
  integration_id: string;
  action: SyncAction;
  old_status: string;
  new_status: string;
  external_status: string;
  external_order_id: string;
  payload: Record<string, any>;
  status: SyncStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  last_response: Record<string, any> | null;
  next_retry_at: number | null;
  synced_at: number | null;
  created_at: number;
  updated_at: number;
  integration?: {
    id: string;
    name: string;
    slug: string;
  };
  order?: {
    id: string;
    external_id: string;
  };
}

// Sync statistics
export interface SyncStats {
  pending: number;
  processing: number;
  success: number;
  failed: number;
  permanently_failed: number;
  total: number;
}

export const useIntegrationSync = () => {
  const client = useQueryClient();

  // Sync statistikasi
  const getSyncStats = (enabled: boolean = true) =>
    useQuery({
      queryKey: [SYNC_KEY, "stats"],
      queryFn: () =>
        api.get("integration-sync/stats").then((res) => res.data),
      enabled,
      staleTime: 1000 * 30, // 30 sekund
      refetchInterval: 1000 * 60, // Har 1 daqiqada yangilanadi
    });

  // Failed sync joblarni olish
  const getFailedSyncs = (integrationId?: string, enabled: boolean = true) =>
    useQuery({
      queryKey: [SYNC_KEY, "failed", integrationId],
      queryFn: () => {
        const params = integrationId ? `?integration_id=${integrationId}` : "";
        return api.get(`integration-sync/failed${params}`).then((res) => res.data);
      },
      enabled,
      staleTime: 1000 * 30,
    });

  // Pending sync joblarni olish
  const getPendingSyncs = (enabled: boolean = true) =>
    useQuery({
      queryKey: [SYNC_KEY, "pending"],
      queryFn: () =>
        api.get("integration-sync/pending").then((res) => res.data),
      enabled,
      staleTime: 1000 * 30,
    });

  // Barcha sync joblarni olish (pagination bilan)
  const getAllSyncs = (
    page: number = 1,
    limit: number = 20,
    status?: SyncStatus,
    integrationId?: string,
    enabled: boolean = true
  ) =>
    useQuery({
      queryKey: [SYNC_KEY, "all", page, limit, status, integrationId],
      queryFn: () => {
        const params = new URLSearchParams();
        params.append("page", String(page));
        params.append("limit", String(limit));
        if (status) params.append("status", status);
        if (integrationId) params.append("integration_id", integrationId);
        return api.get(`integration-sync/all?${params.toString()}`).then((res) => res.data);
      },
      enabled,
      staleTime: 1000 * 30,
    });

  // Muvaffaqiyatli sync joblarni olish
  const getSuccessfulSyncs = (integrationId?: string, limit: number = 50, enabled: boolean = true) =>
    useQuery({
      queryKey: [SYNC_KEY, "success", integrationId, limit],
      queryFn: () => {
        const params = new URLSearchParams();
        if (integrationId) params.append("integration_id", integrationId);
        params.append("limit", String(limit));
        return api.get(`integration-sync/success?${params.toString()}`).then((res) => res.data);
      },
      enabled,
      staleTime: 1000 * 30,
    });

  // Buyurtma bo'yicha sync tarixini olish
  const getSyncsByOrder = (orderId: string, enabled: boolean = true) =>
    useQuery({
      queryKey: [SYNC_KEY, "order", orderId],
      queryFn: () =>
        api.get(`integration-sync/order/${orderId}`).then((res) => res.data),
      enabled: enabled && !!orderId,
      staleTime: 1000 * 30,
    });

  // Bitta job ni qayta sync qilish
  const retrySync = useMutation({
    mutationFn: (jobId: string) =>
      api.post(`integration-sync/${jobId}/retry`).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [SYNC_KEY] });
    },
  });

  // Bir nechta job ni qayta sync qilish
  const bulkRetrySync = useMutation({
    mutationFn: (jobIds: string[]) =>
      api.post("integration-sync/bulk-retry", { job_ids: jobIds }).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [SYNC_KEY] });
    },
  });

  // Barcha failed joblarni qayta sync qilish
  const retryAllFailed = useMutation({
    mutationFn: (integrationId?: string) => {
      const params = integrationId ? `?integration_id=${integrationId}` : "";
      return api.post(`integration-sync/retry-all-failed${params}`).then((res) => res.data);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [SYNC_KEY] });
    },
  });

  // Sync job ni o'chirish
  const deleteSync = useMutation({
    mutationFn: (jobId: string) =>
      api.delete(`integration-sync/${jobId}`).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [SYNC_KEY] });
    },
  });

  // Cache ni yangilash (manual refresh)
  const refreshSyncData = () => {
    client.invalidateQueries({ queryKey: [SYNC_KEY] });
  };

  return {
    getSyncStats,
    getFailedSyncs,
    getPendingSyncs,
    getAllSyncs,
    getSuccessfulSyncs,
    getSyncsByOrder,
    retrySync,
    bulkRetrySync,
    retryAllFailed,
    deleteSync,
    refreshSyncData,
  };
};
