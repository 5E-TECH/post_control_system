import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../";

export const courierPenaltyKey = "courier-penalty";

/** Server shartnomasi: `server/src/api/courier-penalty/courier-penalty.types.ts`. */
export interface CourierDeadlineRow {
  id: string;
  order_number: number | null;
  market_name: string | null;
  dispatched_at: number;
  /** Birinchi shtraf kuni AYNI shu paytda boshlanadi. */
  deadline_at: number;
  deadline_days: number;
  ms_left: number;
  days_left: number | null;
  late_days: number;
  due_today: boolean;
  penalty_now: number;
  penalty_tomorrow: number;
  penalty_max: number;
  capped: boolean;
  /** Modul yoqilishidan oldin jo'natilgan — shtrafga tushmaydi. */
  immune: boolean;
}

export interface CourierDeadlineReport {
  module: { active: boolean; exempt: boolean };
  summary: {
    pending: number;
    due_today: number;
    overdue: number;
    penalty_now: number;
    penalty_tomorrow: number;
    penalty_max: number;
  };
  orders: CourierDeadlineRow[];
}

export const useCourierPenalty = () => {
  /**
   * KURYERNING O'Z MUDDATLARI.
   *
   * `refetchInterval` 60 s — sanoq soat bilan ko'rsatiladi, shuning uchun
   * sahifa ochiq turganda ham yangilanib tursin. Buyurtma belgilangach
   * ro'yxat o'zgaradi, lekin alohida invalidatsiya QO'YILMADI: 60 soniya
   * kutish buyurtma oqimini to'smaydi va har sotuvda qo'shimcha so'rov
   * tug'dirmaydi.
   */
  const getMyDeadlines = (enabled = true) =>
    useQuery<CourierDeadlineReport>({
      queryKey: [courierPenaltyKey, "my-deadlines"],
      queryFn: () =>
        api
          .get("courier-penalty/my-deadlines")
          .then((res) => res.data?.data as CourierDeadlineReport),
      enabled,
      refetchInterval: 60_000,
    });

  return { getMyDeadlines };
};

// ════════════════════ ADMIN TOMONI ════════════════════

export interface OverdueOrder {
  id: string;
  order_number: number | null;
  market_name: string | null;
  total_price: number;
  dispatched_at: number;
  deadline_at: number;
  late_days: number;
  penalty_now: number;
  base_tariff: number;
  capped: boolean;
  /** Modul yoqilishidan oldin jo'natilgan — shtrafga tushmaydi. */
  immune: boolean;
}

export interface OverdueCourier {
  courier_id: string;
  courier_name: string | null;
  courier_phone: string | null;
  overdue_count: number;
  oldest_late_days: number;
  penalty_now: number;
  orders: OverdueOrder[];
}

export interface OverdueReport {
  module: { active: boolean };
  summary: { couriers: number; orders: number; penalty_now: number };
  couriers: OverdueCourier[];
}

export interface PenaltyEntry {
  id: string;
  created_at: number;
  order_id: string;
  order_number: number | null;
  courier_id: string;
  courier_name: string | null;
  kind: "penalty" | "bonus" | "waiver";
  reason: string;
  amount: number;
  late_days: number | null;
  base_tariff: number | null;
  shadow: boolean;
  waives_entry_id: string | null;
  /** Shu yozuv ustiga bekor qilish qatori yozilganmi. */
  waived: boolean;
  note: string | null;
}

export interface PenaltySummary {
  module: {
    active: boolean;
    activated_at: number | null;
    shadow_since: number | null;
  };
  penalty: { count: number; sum: number };
  bonus: { count: number; sum: number };
  waiver: { count: number; sum: number };
  couriers: number;
  shadow_count: number;
  /** Tarif chegarasiga urilganlar — «darajalar kerakmi» signali. */
  capped_count: number;
  net: number;
}

export interface PenaltyRule {
  id: string;
  scope_type: "global" | "courier" | "region";
  scope_id: string | null;
  scope_name: string | null;
  event: "late_mark" | "early_mark" | "damage";
  threshold_days: number;
  calc: "per_day" | "once";
  /** ISHORALI: shtraf manfiy, bonus musbat. */
  amount: number;
  max_amount: number | null;
  priority: number;
  active_from: number;
  active_to: number | null;
  is_active: boolean;
}

const ADMIN = "courier-penalty/admin";

export const useCourierPenaltyAdmin = () => {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [courierPenaltyKey] });

  const getOverdue = (params: { courierId?: string; minDays?: number } = {}) =>
    useQuery<OverdueReport>({
      queryKey: [courierPenaltyKey, "overdue", params],
      queryFn: () =>
        api.get(`${ADMIN}/overdue`, { params }).then((r) => r.data?.data),
      refetchInterval: 60_000,
    });

  const getEntries = (
    params: { courierId?: string; kind?: string; page?: number; limit?: number } = {},
  ) =>
    useQuery<{ total: number; page: number; limit: number; items: PenaltyEntry[] }>({
      queryKey: [courierPenaltyKey, "entries", params],
      queryFn: () =>
        api.get(`${ADMIN}/entries`, { params }).then((r) => r.data?.data),
    });

  const getSummary = () =>
    useQuery<PenaltySummary>({
      queryKey: [courierPenaltyKey, "summary"],
      queryFn: () => api.get(`${ADMIN}/summary`).then((r) => r.data?.data),
    });

  const getRules = () =>
    useQuery<PenaltyRule[]>({
      queryKey: [courierPenaltyKey, "rules"],
      queryFn: () => api.get(`${ADMIN}/rules`).then((r) => r.data?.data),
    });

  const getWaiverReasons = () =>
    useQuery<string[]>({
      queryKey: [courierPenaltyKey, "waiver-reasons"],
      queryFn: () => api.get(`${ADMIN}/waiver-reasons`).then((r) => r.data?.data),
      // Yopiq ro'yxat — o'zgarmaydi, qayta so'ramaymiz.
      staleTime: Infinity,
    });

  const getCouriers = () =>
    useQuery<Array<{ id: string; name: string; phone_number: string }>>({
      queryKey: [courierPenaltyKey, "couriers"],
      queryFn: () => api.get(`${ADMIN}/couriers`).then((r) => r.data?.data),
      staleTime: 5 * 60_000,
    });

  const createRule = useMutation({
    mutationFn: (body: Partial<PenaltyRule>) =>
      api.post(`${ADMIN}/rules`, body).then((r) => r.data),
    onSuccess: invalidate,
  });

  const updateRule = useMutation({
    mutationFn: ({ id, ...body }: Partial<PenaltyRule> & { id: string }) =>
      api.patch(`${ADMIN}/rules/${id}`, body).then((r) => r.data),
    onSuccess: invalidate,
  });

  const deactivateRule = useMutation({
    mutationFn: (id: string) =>
      api.delete(`${ADMIN}/rules/${id}`).then((r) => r.data),
    onSuccess: invalidate,
  });

  const waive = useMutation({
    mutationFn: ({
      id,
      reason,
      note,
    }: {
      id: string;
      reason: string;
      note?: string;
    }) =>
      api.post(`${ADMIN}/entries/${id}/waive`, { reason, note }).then((r) => r.data),
    onSuccess: invalidate,
  });

  return {
    getOverdue,
    getEntries,
    getSummary,
    getRules,
    getWaiverReasons,
    getCouriers,
    createRule,
    updateRule,
    deactivateRule,
    waive,
  };
};
