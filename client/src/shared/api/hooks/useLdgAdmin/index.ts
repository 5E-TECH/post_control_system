import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const HEALTH_KEY = "ldg-admin-health";
const LOGS_KEY = "ldg-admin-webhook-logs";
const SHIPMENTS_KEY = "ldg-admin-shipments";

export interface LdgHealth {
  ready: boolean;
  courier_name: string | null;
  checklist: {
    api_key_set: boolean;
    webhook_secret_set: boolean;
    tenant_domain_set: boolean;
    courier_set: boolean;
    sender_complete: boolean;
    is_active: boolean;
    is_sandbox: boolean;
  };
  shipments: {
    total: number;
    delivered: number;
    with_error: number;
    pending: number;
    mismatch: number;
  };
  webhooks: {
    total: number;
    success: number;
    skipped: number;
    failed: number;
    invalid_signature: number;
    last_received_at: number | null;
  };
  server_time: string;
  server_time_ms: number;
}

export interface LdgWebhookLog {
  delivery_id: string;
  event_id: string | null;
  event_type: string;
  signature_valid: boolean;
  status: string;
  error_message: string | null;
  raw_payload: Record<string, unknown>;
  received_at: number;
  processed_at: number | null;
}

export interface LdgShipmentRow {
  id: string;
  order_id: string;
  ldg_order_id: number | null;
  tracking_number: string | null;
  ldg_status: string | null;
  ldg_status_changed_at: number | null;
  ldg_created_at: number | null;
  last_synced_at: number | null;
  send_attempts: number;
  last_error: string | null;
  mismatch_at: number | null;
  mismatch_reason: string | null;
  created_at: number;
  order_number: number | null;
  order_status: string | null;
  order_total_price: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  district_name: string | null;
  region_name: string | null;
  market_name: string | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  status_count?: number;
}

export interface ActionResult {
  success?: boolean;
  message: string;
  http_status?: number;
}

// Backend ba'zan {data:...} envelope bilan, ba'zan to'g'ridan-to'g'ri qaytaradi
const unwrap = <T>(raw: unknown): T => {
  const r = raw as Record<string, unknown>;
  if (r && typeof r === "object" && "data" in r && !Array.isArray(r)) {
    // Paginatsiya javoblari ham {data: [...]} bo'ladi — ularni o'zini qaytaramiz
    if (
      "total" in r ||
      "ready" in r ||
      "checklist" in r ||
      "success" in r
    ) {
      return raw as T;
    }
    return (r.data as T) ?? (raw as T);
  }
  return raw as T;
};

export const useLdgAdmin = () => {
  const client = useQueryClient();

  const getHealth = (enabled = true) =>
    useQuery<LdgHealth>({
      queryKey: [HEALTH_KEY],
      queryFn: () =>
        api.get("ldg/admin/health").then((res) => unwrap<LdgHealth>(res.data)),
      enabled,
      refetchInterval: 30000,
    });

  const getWebhookLogs = (
    params: { page?: number; limit?: number; status?: string; event_type?: string },
    enabled = true,
  ) =>
    useQuery<Paginated<LdgWebhookLog>>({
      queryKey: [LOGS_KEY, params],
      queryFn: () =>
        api
          .get("ldg/admin/webhook-logs", { params })
          .then((res) => unwrap<Paginated<LdgWebhookLog>>(res.data)),
      enabled,
      refetchInterval: 30000,
    });

  const getShipments = (
    params: { page?: number; limit?: number; filter?: string },
    enabled = true,
  ) =>
    useQuery<Paginated<LdgShipmentRow>>({
      queryKey: [SHIPMENTS_KEY, params],
      queryFn: () =>
        api
          .get("ldg/admin/shipments", { params })
          .then((res) => unwrap<Paginated<LdgShipmentRow>>(res.data)),
      enabled,
      refetchInterval: 30000,
    });

  const testConnection = useMutation({
    mutationFn: () =>
      api
        .post("ldg/admin/test-connection")
        .then((res) => unwrap<TestConnectionResult>(res.data)),
  });

  const redispatch = useMutation({
    mutationFn: (orderId: string) =>
      api
        .post(`ldg/admin/shipments/${orderId}/redispatch`)
        .then((res) => unwrap<ActionResult>(res.data)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [SHIPMENTS_KEY] });
      client.invalidateQueries({ queryKey: [HEALTH_KEY] });
    },
  });

  // Yuborilmagan/xatoli barcha order_id'lar (imperativ — tugma bosilganda chaqiriladi)
  const getRetryCandidates = async (): Promise<string[]> =>
    api
      .get("ldg/admin/shipments/retry-candidates")
      .then((res) => unwrap<string[]>(res.data));

  // Bir guruh (10 ta) buyurtmani ketma-ket qayta jo'natish.
  // Frontend butun ro'yxatni 10 tadan bo'lib shu mutatsiyani ketma-ket chaqiradi.
  const redispatchBatch = useMutation({
    mutationFn: (orderIds: string[]) =>
      api
        .post("ldg/admin/shipments/redispatch-batch", { orderIds })
        .then((res) =>
          unwrap<{
            total: number;
            success: number;
            failed: number;
            results: Array<{
              order_id: string;
              success: boolean;
              message: string;
            }>;
          }>(res.data),
        ),
  });

  const reprocessWebhook = useMutation({
    mutationFn: (deliveryId: string) =>
      api
        .post(`ldg/admin/webhook-logs/${deliveryId}/reprocess`)
        .then((res) => unwrap<ActionResult>(res.data)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [LOGS_KEY] });
      client.invalidateQueries({ queryKey: [SHIPMENTS_KEY] });
      client.invalidateQueries({ queryKey: [HEALTH_KEY] });
    },
  });

  // Bitta shipment statusini LDG'dan tortib olish
  const syncOne = useMutation({
    mutationFn: (orderId: string) =>
      api
        .post(`ldg/admin/shipments/${orderId}/sync`)
        .then((res) => unwrap<ActionResult & { ldg_status?: string }>(res.data)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [SHIPMENTS_KEY] });
      client.invalidateQueries({ queryKey: [HEALTH_KEY] });
    },
  });

  // Barcha faol shipmentlarni LDG bilan tenglashtirish
  const reconcileAll = useMutation({
    mutationFn: () =>
      api.post("ldg/admin/reconcile").then(
        (res) =>
          unwrap<{
            checked: number;
            applied: number;
            unchanged: number;
            errors: number;
          }>(res.data),
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [SHIPMENTS_KEY] });
      client.invalidateQueries({ queryKey: [HEALTH_KEY] });
    },
  });

  // Mismatch'ni "hal qilindi" deb belgilash (admin qo'lda tekshirib chiqqach)
  const resolveMismatch = useMutation({
    mutationFn: (orderId: string) =>
      api
        .post(`ldg/admin/shipments/${orderId}/resolve-mismatch`)
        .then((res) => unwrap<ActionResult>(res.data)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [SHIPMENTS_KEY] });
      client.invalidateQueries({ queryKey: [HEALTH_KEY] });
    },
  });

  return {
    getHealth,
    getWebhookLogs,
    getShipments,
    testConnection,
    redispatch,
    getRetryCandidates,
    redispatchBatch,
    reprocessWebhook,
    syncOne,
    reconcileAll,
    resolveMismatch,
  };
};
