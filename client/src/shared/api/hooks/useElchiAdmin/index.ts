import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const ELCHI_HEALTH_KEY = "elchi-health";
const ELCHI_STATS_KEY = "elchi-stats";
const ELCHI_SHIPMENTS_KEY = "elchi-shipments";
const ELCHI_WEBHOOK_LOGS_KEY = "elchi-webhook-logs";
const ELCHI_SETTLEMENT_KEY = "elchi-settlement";

export type ElchiShipmentFilter =
  "all" | "pending" | "error" | "delivered" | "mismatch";

export interface ElchiPaginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ElchiShipmentRow {
  id: string;
  order_id: string;
  post_id: string | null;
  elchi_shipment_id: string | null;
  elchi_status: string | null;
  elchi_status_changed_at: number | null;
  last_synced_at: number | null;
  send_attempts: number;
  last_error: string | null;
  mismatch_at: number | null;
  mismatch_reason: string | null;
  cod_amount_sent: string;
  cod_collected_reported: string | null;
  created_at: number;
  order_number: number | null;
  order_status: string | null;
  order_total_price: string | number | null;
  /** `elchi` bo'lsa buyurtma BeePostda bloklangan (ikki marta sotilmasin). */
  control_owner: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  district_name: string | null;
  region_name: string | null;
  market_name: string | null;
}

export interface ElchiWebhookLogRow {
  event_id: string;
  synthesized_key: boolean;
  event_type: string | null;
  elchi_shipment_id: string | null;
  external_order_id: string | null;
  elchi_status: string | null;
  signature_valid: boolean;
  status: string;
  error_message: string | null;
  raw_payload: Record<string, unknown>;
  received_at: number;
  processed_at: number | null;
}

export interface ElchiStats {
  shipments: {
    total: number;
    dispatched: number;
    pending: number;
    failed: number;
    mismatch: number;
  };
  webhooks: {
    total: number;
    success: number;
    failed: number;
    invalid_signature: number;
    last_received_at: number | null;
  };
  money: {
    cod_sent: number;
    cod_collected: number;
    paid_by_elchi: number;
    debt: number;
    /** Elchi ushlab qolgan tarif — Elchi O'ZI aytadi (audit M2). */
    elchi_fee: number;
    /**
     * Yangi pul maydonlari YO'Q posilkalar soni.
     *
     * Ular yig'indiga kirmaydi (rost bilan yolg'onni qo'shmaslik uchun),
     * shu bois soni ochiq ko'rsatiladi.
     */
    unreported_count: number;
  };
}

export interface ElchiSettlement {
  period: {
    from: number;
    to: number;
    cod_sent: number;
    cod_collected: number;
    paid_by_elchi: number;
    dispatched_count: number;
    collected_count: number;
    /**
     * Elchi ushlab qolgan tarif.
     *
     * ⚠️ Ilgari `jo'natilgan − yig'ilgan` ayirmasi bilan TAXMIN qilinardi va
     * yig'ilgan 0 bo'lgani uchun tarif o'rniga butun COD chiqardi (audit M2).
     * Endi Elchi sotuvda ishlatilgan tarif snapshotini o'zi yuboradi.
     */
    elchi_fee: number;
  };
  /** ⚠️ Qarz FAQAT shu blokda — u davr bo'yicha kesilmaydi. */
  overall: {
    cod_sent: number;
    cod_collected: number;
    paid_by_elchi: number;
    debt: number;
    /** Elchi ushlab qolgan tarif — Elchi O'ZI aytadi (audit M2). */
    elchi_fee: number;
    /**
     * Yangi pul maydonlari YO'Q posilkalar soni.
     *
     * Ular yig'indiga kirmaydi (rost bilan yolg'onni qo'shmaslik uchun),
     * shu bois soni ochiq ko'rsatiladi.
     */
    unreported_count: number;
  };
  payments: Array<{
    id: string;
    amount: number;
    paid_at: number;
    note: string | null;
    created_by: string | null;
    created_at: number;
  }>;
}

const unwrap = <T>(raw: unknown): T =>
  ((raw as { data?: T })?.data ?? raw) as T;

/**
 * Sahifalangan javobni ochish.
 *
 * `{ data: [...], total }` shakli o'zi ham `data` maydoniga ega bo'lgani
 * uchun oddiy `unwrap` bu yerda XATO ishlaydi (massivni qaytarib yuborardi).
 * Shu bois alohida: `total` mavjudligiga qarab qaysi qatlam ekanini aniqlaymiz.
 */
const unwrapPage = <T>(raw: unknown): ElchiPaginated<T> => {
  const outer = raw as { data?: unknown; total?: number };
  if (Array.isArray(outer?.data) && typeof outer?.total === "number") {
    return outer as unknown as ElchiPaginated<T>;
  }
  const inner = outer?.data as ElchiPaginated<T> | undefined;
  if (inner && Array.isArray(inner.data)) return inner;
  return { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };
};

export const useElchiAdmin = () => {
  const client = useQueryClient();

  /** Tayyorlik + raqamlar. Tashqi so'rov borligi uchun avtomatik yangilanmaydi. */
  const useHealth = () =>
    useQuery({
      queryKey: [ELCHI_HEALTH_KEY],
      queryFn: () => api.get("elchi/admin/health").then((res) => res.data),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    });

  /** Faqat raqamlar — tashqi so'rovsiz, tez-tez chaqirsa bo'ladi. */
  const useStats = () =>
    useQuery({
      queryKey: [ELCHI_STATS_KEY],
      queryFn: () =>
        api
          .get("elchi/admin/stats")
          .then((res) => unwrap<ElchiStats>(res.data)),
    });

  const useShipments = (params: {
    page?: number;
    limit?: number;
    filter?: ElchiShipmentFilter;
    search?: string;
  }) =>
    useQuery({
      queryKey: [ELCHI_SHIPMENTS_KEY, params],
      queryFn: () =>
        api
          .get("elchi/admin/shipments", { params })
          .then((res) => unwrapPage<ElchiShipmentRow>(res.data)),
    });

  const useWebhookLogs = (params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) =>
    useQuery({
      queryKey: [ELCHI_WEBHOOK_LOGS_KEY, params],
      queryFn: () =>
        api
          .get("elchi/admin/webhook-logs", { params })
          .then((res) => unwrapPage<ElchiWebhookLogRow>(res.data)),
    });

  const useSettlement = (params: { from?: number; to?: number }) =>
    useQuery({
      queryKey: [ELCHI_SETTLEMENT_KEY, params],
      queryFn: () =>
        api
          .get("elchi/admin/settlement", { params })
          .then((res) => unwrap<ElchiSettlement>(res.data)),
    });

  const invalidateShipments = () => {
    client.invalidateQueries({ queryKey: [ELCHI_SHIPMENTS_KEY] });
    client.invalidateQueries({ queryKey: [ELCHI_STATS_KEY] });
  };

  const resolveMismatch = useMutation({
    mutationFn: (orderId: string) =>
      api
        .post(`elchi/admin/shipments/${orderId}/resolve-mismatch`)
        .then((res) => res.data),
    onSuccess: invalidateShipments,
  });

  /** Bitta posilkani Elchi bilan tenglashtirish (CRON'ni kutmasdan). */
  const syncOne = useMutation({
    mutationFn: (orderId: string) =>
      api.post(`elchi/orders/${orderId}/reconcile`).then((res) => res.data),
    onSuccess: invalidateShipments,
  });

  const redispatch = useMutation({
    mutationFn: (orderId: string) =>
      api
        .post(`elchi/orders/${orderId}/dispatch-retry`)
        .then((res) => res.data),
    onSuccess: invalidateShipments,
  });

  /** ZAXIRA YO'LI — boshqaruvni Elchi'dan qaytarib olish. */
  const reclaimControl = useMutation({
    mutationFn: (params: { orderId: string; force?: boolean }) =>
      api
        .post(`elchi/orders/${params.orderId}/reclaim-control`, {
          force: !!params.force,
        })
        .then((res) => res.data),
    onSuccess: invalidateShipments,
  });

  const reprocessWebhook = useMutation({
    mutationFn: (eventId: string) =>
      api
        .post(
          `elchi/admin/webhook-logs/${encodeURIComponent(eventId)}/reprocess`,
        )
        .then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [ELCHI_WEBHOOK_LOGS_KEY] });
      invalidateShipments();
    },
  });

  const addPayment = useMutation({
    mutationFn: (dto: { amount: number; paid_at?: number; note?: string }) =>
      api.post("elchi/admin/settlement/payments", dto).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [ELCHI_SETTLEMENT_KEY] });
      client.invalidateQueries({ queryKey: [ELCHI_STATS_KEY] });
    },
  });

  const deletePayment = useMutation({
    mutationFn: (id: string) =>
      api
        .delete(`elchi/admin/settlement/payments/${id}`)
        .then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [ELCHI_SETTLEMENT_KEY] });
      client.invalidateQueries({ queryKey: [ELCHI_STATS_KEY] });
    },
  });

  const shutdown = useMutation({
    mutationFn: () => api.post("elchi/admin/shutdown").then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["elchi-config"] });
      client.invalidateQueries({ queryKey: ["elchi-readiness"] });
      client.invalidateQueries({ queryKey: [ELCHI_HEALTH_KEY] });
    },
  });

  return {
    useHealth,
    useStats,
    useShipments,
    useWebhookLogs,
    useSettlement,
    resolveMismatch,
    syncOne,
    redispatch,
    reclaimControl,
    reprocessWebhook,
    addPayment,
    deletePayment,
    shutdown,
  };
};
