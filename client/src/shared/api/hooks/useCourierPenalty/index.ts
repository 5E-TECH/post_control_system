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
  /**
   * ⚠️ IKKI QATLAM ATAYLAB AJRATILGAN.
   *
   * `real` — kuryer kassasiga HAQIQATAN yozilgan summa. Faqat shu son
   * kassa bilan solishtiriladi.
   * `shadow` — «yoqilganda qancha bo'lardi»; kassada hech qachon aks
   * etmaydi. Ikkisini qo'shish bir-biriga to'g'ri kelmaydigan raqam
   * yasash degani.
   */
  real: { count: number; net: number };
  shadow: { count: number; net: number };
  net: number;
}

export interface PenaltyConfig {
  id: string;
  is_active: boolean;
  activated_at: number | null;
  shadow_since: number | null;
}

export interface PenaltyCourier {
  id: string;
  name: string;
  phone_number: string;
  penalty_exempt: boolean;
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
      /**
       * ⚠️ 5 DAQIQA, 60 SONIYA EMAS.
       *
       * Ro'yxat KUNLAB kechikkan buyurtmalardan iborat — bir daqiqada
       * o'zgarmaydi. Lekin u SAHIFALANMAYDI: javob hamma kechikkan
       * buyurtmani olib keladi, ya'ni katta to'planmada har so'rov og'ir.
       * Tez-tez so'rash foyda bermay, faqat yuk qo'shardi.
       *
       * Kuryerning o'z sanog'i (`my-deadlines`) esa 60 soniyada qoladi:
       * u kichik, shaxsiy va soat bilan ko'rsatiladi.
       */
      refetchInterval: 5 * 60_000,
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

  const getConfig = () =>
    useQuery<PenaltyConfig | null>({
      queryKey: [courierPenaltyKey, "config"],
      queryFn: () => api.get(`${ADMIN}/config`).then((r) => r.data?.data),
    });

  const getCouriers = () =>
    useQuery<PenaltyCourier[]>({
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

  /**
   * MODULNI YOQISH / O'CHIRISH.
   *
   * ⚠️ `activated_at` ni klient BERMAYDI — uni server qo'yadi. Aks holda
   * langarni orqaga surib, o'tgan davr uchun pul yechish mumkin bo'lardi.
   */
  const setActive = useMutation({
    mutationFn: (active: boolean) =>
      api.post(`${ADMIN}/config/active`, { active }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const setExempt = useMutation({
    mutationFn: ({ id, exempt }: { id: string; exempt: boolean }) =>
      api.patch(`${ADMIN}/couriers/${id}/exempt`, { exempt }).then((r) => r.data),
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
    getConfig,
    setActive,
    setExempt,
    getRules,
    getWaiverReasons,
    getCouriers,
    createRule,
    updateRule,
    deactivateRule,
    waive,
  };
};
