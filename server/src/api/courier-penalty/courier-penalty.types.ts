/**
 * KURYER MUDDAT HISOBOTI — server va klient o'rtasidagi shartnoma.
 *
 * ⚠️ Summalar ISHORALI emas: `penalty_*` har doim MUSBAT (shtraf) yoki 0.
 * Bonus bu hisobotga kirmaydi — ekranning vazifasi OGOHLANTIRISH.
 */
export interface CourierDeadlineRow {
  id: string;
  order_number: number | null;
  market_name: string | null;
  /** Pochta jo'natilgan payt — sanoq shundan boshlanadi. */
  dispatched_at: number;
  /** Birinchi shtraf kuni AYNI shu paytda boshlanadi. */
  deadline_at: number;
  /** Shu buyurtmaga amal qiluvchi muddat (kun). */
  deadline_days: number;
  /** `deadline_at` gacha qolgan vaqt; manfiy — muddat o'tgan. */
  ms_left: number;
  /** Qolgan to'liq kun; muddat o'tgan bo'lsa `null`. */
  days_left: number | null;
  late_days: number;
  /** Bugun bosilmasa ertaga shtraf boshlanadi. */
  due_today: boolean;
  /** Hozir bosilsa qancha shtraf. */
  penalty_now: number;
  /** Ertaga bosilsa qancha bo'ladi. */
  penalty_tomorrow: number;
  /** Eng yomon holat — tarif (pol 0). */
  penalty_max: number;
  /** Shtraf tarif chegarasiga yetgan. */
  capped: boolean;
  /**
   * Modul yoqilishidan OLDIN jo'natilgan — bu buyurtma shtrafga
   * tushmaydi (grandfathering).
   */
  immune: boolean;
}

export interface CourierDeadlineReport {
  module: {
    /** `false` — soya rejimi: sanoq ko'rinadi, pul YECHILMAYDI. */
    active: boolean;
    /** Kuryer umuman qamralmaydi (tashqi provayder yoki qo'lda istisno). */
    exempt: boolean;
  };
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
