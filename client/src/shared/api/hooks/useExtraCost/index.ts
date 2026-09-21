import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../";

export const extraCostKey = "extra-cost";

export type ExtraCostStatus =
  | "awaiting_proof"
  | "pending"
  | "approved"
  | "rejected"
  | "void"
  | "reversed";

export type ExtraCostCategory =
  | "taxi"
  | "lift"
  | "loading"
  | "revisit"
  | "customer_request"
  | "other";

export interface ExtraCostRequest {
  id: string;
  order_id: string;
  order_number: number;
  order_total_price: number;
  where_deliver: string | null;
  district_name: string | null;
  /** Snapshot maydonlari — buyurtma endpointiga tegmasdan ko'rsatish uchun. */
  region_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  market_name: string | null;
  courier_name: string | null;
  courier_id: string;
  market_id: string;
  action_type: "sell" | "cancel" | "partly_sold" | "price_cut";
  amount: number;
  limit_max: number;
  courier_tariff_snapshot: number;
  category: ExtraCostCategory;
  reason: string | null;
  proof_ids: string[];
  status: ExtraCostStatus;
  decision_mode: string | null;
  review_note: string | null;
  reviewed_at: number | null;
  settled_at: number | null;
  order_action_at: number;
  created_at: number;
  dup_proof_count: number;
  /** Javob berilmagani uchun admin arbitrajiga chiqqan vaqt. */
  escalated_at: number | null;
  seen_by_courier_at: number | null;
}

/** Market badge'i uchun sanoqlar. */
export interface MarketCounts {
  /** Tasdiq kutayotgan (FAQAT `pending` — badge shuni ko'rsatadi). */
  open: number;
  /** Shulardan muddati o'tib admin arbitrajiga chiqqanlari. */
  escalated: number;
  /** Tasdiq kutayotgan jami summa. */
  amount: number;
}

/** Kuryer badge'i uchun sanoqlar. */
export interface CourierCounts {
  /** Qaror chiqqan, lekin kuryer hali ko'rmagan. */
  unseen: number;
  /** ⚠️ ISH TALAB QILADI — isbot biriktirilmasa pul yo'qoladi. */
  awaiting_proof: number;
  /** Marketga yuborilgan, javob kutilmoqda. */
  pending: number;
}

export interface UploadedProof {
  proof_id: string;
  size_bytes: number;
  /** Shu surat oxirgi sutkada yana nechta so'rovda ishlatilgan. */
  dup_count: number;
}

export const useExtraCost = () => {
  const client = useQueryClient();
  const invalidate = () =>
    client.invalidateQueries({ queryKey: [extraCostKey] });

  /**
   * ISBOT YUKLASH — sotuvdan ALOHIDA qadam.
   *
   * ⚠️ Sotuv so'rovi JSON bo'lib QOLADI. Kuryer rasm tanlaydi → fayl shu
   * yerga ketadi → qaytgan `proof_id` sotuv payload'iga oddiy maydon
   * sifatida qo'shiladi. Shu tufayli jonli pul yo'li (sell/cancel/partlySold)
   * umuman o'zgarmaydi.
   */
  const uploadProof = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      return api
        .post<{ data: UploadedProof[] }>("extra-cost/proof", form, {
          headers: { "Content-Type": "multipart/form-data" },
          // Sekin mobil internet — standart timeout yetmasligi mumkin.
          timeout: 120_000,
        })
        .then((res) => res.data.data);
    },
  });

  /** Isbot rasmining manzili (himoyalangan endpoint, token bilan). */
  const proofUrl = (requestId: string, proofId: string) =>
    `${api.defaults.baseURL}extra-cost/${requestId}/proof/${proofId}`;

  // ─────────────────────────── MARKET ───────────────────────────

  const getMarketRequests = (
    params: {
      status?: ExtraCostStatus;
      escalated?: "true";
      page?: number;
      limit?: number;
    },
    enabled = true,
  ) =>
    useQuery({
      queryKey: [extraCostKey, "market", params],
      queryFn: () =>
        api
          .get("extra-cost/market/me", { params })
          .then((res) => res.data?.data),
      enabled,
      // Market sahifasi ochiq turganda yangi so'rovlar o'zi ko'rinsin —
      // WebSocket yo'q, shuning uchun polling.
      refetchInterval: 30_000,
    });

  const getMarketCounts = (enabled = true) =>
    useQuery({
      queryKey: [extraCostKey, "market", "counts"],
      queryFn: () =>
        api.get("extra-cost/market/me/counts").then((res) => res.data?.data),
      enabled,
      refetchInterval: 60_000,
    });

  const approve = useMutation({
    mutationFn: (id: string) =>
      api.post(`extra-cost/${id}/approve`).then((res) => res.data),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ id, review_note }: { id: string; review_note: string }) =>
      api
        .post(`extra-cost/${id}/reject`, { review_note })
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  const bulkApprove = useMutation({
    mutationFn: (ids: string[]) =>
      api.post("extra-cost/bulk-approve", { ids }).then((res) => res.data),
    onSuccess: invalidate,
  });

  // ─────────────────────────── KURYER ───────────────────────────

  const getCourierRequests = (
    params: { status?: ExtraCostStatus; page?: number; limit?: number },
    enabled = true,
  ) =>
    useQuery({
      queryKey: [extraCostKey, "courier", params],
      queryFn: () =>
        api
          .get("extra-cost/courier/me", { params })
          .then((res) => res.data?.data),
      enabled,
      refetchInterval: 60_000,
    });

  const getCourierCounts = (enabled = true) =>
    useQuery({
      queryKey: [extraCostKey, "courier", "counts"],
      queryFn: () =>
        api.get("extra-cost/courier/me/counts").then((res) => res.data?.data),
      enabled,
      refetchInterval: 60_000,
    });

  /**
   * ISBOTNI KEYINCHALIK BIRIKTIRISH.
   *
   * ⚠️ Busiz "isbotsiz davom etish" TUZOQ edi: so'rov `awaiting_proof` da
   * qolib, 24 soatdan keyin bekor bo'lardi va kuryer pulini yo'qotardi.
   */
  const attachProof = useMutation({
    mutationFn: ({ id, proof_ids }: { id: string; proof_ids: string[] }) =>
      api
        .post(`extra-cost/${id}/attach-proof`, { proof_ids })
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  const markSeen = useMutation({
    mutationFn: () =>
      api.post("extra-cost/courier/me/seen").then((res) => res.data),
    onSuccess: invalidate,
  });

  // ─────────────────────────── ADMIN ───────────────────────────

  const getAdminRequests = (
    params: { status?: ExtraCostStatus; escalated?: string; page?: number },
    enabled = true,
  ) =>
    useQuery({
      queryKey: [extraCostKey, "admin", params],
      queryFn: () =>
        api.get("extra-cost/admin", { params }).then((res) => res.data?.data),
      enabled,
    });

  const adminResolve = useMutation({
    mutationFn: ({
      id,
      decision,
      review_note,
    }: {
      id: string;
      decision: "approve" | "reject";
      review_note: string;
    }) =>
      api
        .post(`extra-cost/${id}/admin-resolve`, { decision, review_note })
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  return {
    uploadProof,
    proofUrl,
    getMarketRequests,
    getMarketCounts,
    approve,
    reject,
    bulkApprove,
    getCourierRequests,
    getCourierCounts,
    attachProof,
    markSeen,
    getAdminRequests,
    adminResolve,
  };
};

/** O'zbekcha yorliqlar — UI bo'ylab YAGONA manba. */
export const EXTRA_COST_STATUS_LABEL: Record<ExtraCostStatus, string> = {
  awaiting_proof: "Isbot kutilmoqda",
  pending: "Tasdiq kutilmoqda",
  approved: "Tasdiqlandi",
  rejected: "Rad etildi",
  void: "Bekor bo'ldi",
  reversed: "Teskari qaytarildi",
};

export const EXTRA_COST_CATEGORY_LABEL: Record<ExtraCostCategory, string> = {
  taxi: "Taksi",
  lift: "Lift",
  loading: "Yuk ortish",
  revisit: "Qayta borish",
  customer_request: "Mijoz talabi",
  other: "Boshqa",
};
