import { Order_status } from 'src/common/enums';

/**
 * Elchi statusi → bizning `Order_status` moslamasi.
 *
 * Ikki tizimning enum'lari deyarli bir xil (umumiy ajdoddan), shu bois moslash
 * qariyb bittama-bitta. Elchi'da ikkita QO'SHIMCHA holat bor:
 *   - `waiting_customer`    — kuryer yetkaza olmadi, mijoz kutmoqda (TERMINAL EMAS)
 *   - `returned_to_market`  — posilka egasiga qaytarildi (TERMINAL)
 *
 * Elchi qiymatlari (`libs/common/enums`): created · new · received ·
 * on the road · waiting · waiting_customer · sold · cancelled ·
 * returned_to_market · paid · partly_paid · cancelled (sent) · closed
 */

/** Terminal status kelganda ishga tushadigan biznes oqimi. */
export type ElchiTerminalAction = 'sell' | 'cancel' | 'return' | 'rollback';

export interface ElchiStatusMapping {
  /** Bizda qaysi holatga o'tadi. */
  order_status: Order_status;
  /** Boshqa o'zgarish kutilmaydi. */
  is_terminal: boolean;
  /**
   * `sell`     → `markDeliveredByElchi` (kassaga pul tushadi)
   * `cancel`   → `markCancelledByElchi`
   * `return`   → `markReturnedByElchi` (posilka qaytish yo'lida)
   * `rollback` → `markRolledBackByElchi` (Elchi o'z sotuvini bekor qildi)
   * `null`     → faqat status yangilanadi.
   */
  terminal_action: ElchiTerminalAction | null;
}

/** Elchi status qiymatini normallashtiradi (kichik harf, bo'shliqlar siqilgan). */
export function normalizeElchiStatus(status: string): string {
  return String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const MAPPING: Record<string, ElchiStatusMapping> = {
  // Elchi buyurtmani qabul qildi, lekin hali kuryerga bermadi. Bizda buyurtma
  // "yo'lda" — ya'ni bizdan chiqib ketgan.
  created: {
    order_status: Order_status.ON_THE_ROAD,
    is_terminal: false,
    terminal_action: null,
  },
  new: {
    order_status: Order_status.ON_THE_ROAD,
    is_terminal: false,
    terminal_action: null,
  },
  received: {
    order_status: Order_status.ON_THE_ROAD,
    is_terminal: false,
    terminal_action: null,
  },
  // Elchi ichida kuryerga berilgan / yetkazish jarayonida. Bizda "kutilmoqda" —
  // sotuv oqimi shu holatdan boshlanadi.
  'on the road': {
    order_status: Order_status.WAITING,
    is_terminal: false,
    terminal_action: null,
  },
  /**
   * ⚠️ `waiting` IKKI XIL MA'NODA keladi va shu bois terminal amal
   * SHARTLI bajariladi:
   *
   *   OLDINGA — kuryer pochtani qabul qildi, sotuv kutilmoqda (oddiy oqim);
   *   ORQAGA  — Elchi sotilgan buyurtmani qaytardi (rollback).
   *
   * Statusning o'zi ikkisini ajratmaydi, shuning uchun ajratish
   * `markRolledBackByElchi` ichida: faqat BIZDA sotilgan bo'lsa qaytariladi,
   * aks holda `skipped`. Ilgari bu yerda `null` turgani uchun rollback
   * UMUMAN qo'llanmasdi va pul kassada qolib ketardi (qabul mezoni №5).
   */
  waiting: {
    order_status: Order_status.WAITING,
    is_terminal: false,
    terminal_action: 'rollback',
  },
  // G4: kuryer yetkaza olmadi (mijoz javob bermadi/keyinga qoldirdi).
  // TERMINAL EMAS — buyurtma hamon kutmoqda, Elchi qayta urinadi.
  waiting_customer: {
    order_status: Order_status.WAITING,
    is_terminal: false,
    terminal_action: null,
  },
  sold: {
    order_status: Order_status.SOLD,
    is_terminal: true,
    terminal_action: 'sell',
  },
  // Elchi tomonda pul qismlab olingan/to'langan holatlar. Bizda sotuv oqimi
  // ishga tushadi; qisman summa `cod_collected` orqali ko'rinadi.
  paid: {
    order_status: Order_status.SOLD,
    is_terminal: true,
    terminal_action: 'sell',
  },
  partly_paid: {
    order_status: Order_status.SOLD,
    is_terminal: true,
    terminal_action: 'sell',
  },
  cancelled: {
    order_status: Order_status.CANCELLED,
    is_terminal: true,
    terminal_action: 'cancel',
  },
  // Bekor qilinib pochtaga qo'shildi — posilka bizga QAYTISH yo'lida.
  'cancelled (sent)': {
    order_status: Order_status.CANCELLED_SENT,
    is_terminal: true,
    terminal_action: 'return',
  },
  // G4: posilka market egasiga qaytarildi. Biz uchun bu ham "qaytish" —
  // posilka jismonan bizga keladi va skanerdan o'tishi kerak.
  returned_to_market: {
    order_status: Order_status.CANCELLED_SENT,
    is_terminal: true,
    terminal_action: 'return',
  },
};

/**
 * MODUL INVARIANTI — Elchi hech qachon buyurtmani `CLOSED` ("Yopilgan") qila
 * OLMAYDI. `CLOSED` faqat BIZNING skaner oqimimizdan qo'yiladi: posilka
 * jismonan qaytib kelib skanerdan o'tgandagina yopiladi.
 *
 * LDG'da aynan shu xato yuz bergan: `RETURNED` statusi to'g'ridan-to'g'ri
 * `CLOSED` ga xaritalanib, hali qaytib kelmagan posilkalar yopilgan deb
 * belgilangan edi. Shu bois bu tekshiruv modul YUKLANISHIDA ishlaydi — kimdir
 * mappingga `CLOSED` qo'shsa, ilova darhol yiqiladi va xato prodga yetib
 * bormaydi.
 */
for (const [status, mapping] of Object.entries(MAPPING)) {
  if (mapping.order_status === Order_status.CLOSED) {
    throw new Error(
      `Elchi status mapping xato: "${status}" → CLOSED taqiqlangan ` +
        `(CLOSED faqat skaner oqimidan qo'yiladi)`,
    );
  }
}

/**
 * Elchi statusini bizning moslamaga o'giradi.
 *
 * `null` — noma'lum yoki ATAYLAB e'tiborga olinmaydigan status (`closed`).
 * Bunday holatda webhook `skipped` deb qayd etiladi va buyurtma TEGILMAYDI.
 */
export function mapElchiStatus(status: string): ElchiStatusMapping | null {
  return MAPPING[normalizeElchiStatus(status)] ?? null;
}

/** Buyurtma tarixida ko'rsatish uchun o'zbekcha nom. */
const LABELS: Record<string, string> = {
  created: 'Yaratildi',
  new: 'Yangi',
  received: 'Qabul qilindi',
  'on the road': "Yo'lda",
  waiting: 'Kutilmoqda',
  waiting_customer: 'Mijoz kutilmoqda',
  sold: 'Sotildi',
  paid: "To'landi",
  partly_paid: "Qisman to'landi",
  cancelled: 'Bekor qilindi',
  'cancelled (sent)': 'Bekor (yuborilgan)',
  returned_to_market: 'Marketga qaytarildi',
  closed: 'Yopilgan',
};

export function elchiStatusLabel(status: string): string {
  const key = normalizeElchiStatus(status);
  return LABELS[key] ?? status;
}
