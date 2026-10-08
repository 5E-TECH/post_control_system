import { useQuery } from "@tanstack/react-query";
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
