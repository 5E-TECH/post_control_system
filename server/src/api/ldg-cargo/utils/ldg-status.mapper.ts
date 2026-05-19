import { Order_status, Post_status } from 'src/common/enums';

/**
 * LDG status code → bizning Order_status mapping.
 *
 * LDG GET /statuses dan kelgan statuslar:
 *   created (id:8), NEW (id:1), RECEIVED (id:2), IN_TRANSIT (id:3),
 *   OUT_FOR_DELIVERY (id:4), DELIVERED (id:5, terminal),
 *   RETURNED (id:6, terminal), CANCELLED (id:7, terminal)
 *
 * E'tibor: LDG `created` ni kichik harf bilan, qolganlarini UPPERCASE bilan yuboradi.
 * Shuning uchun normalizatsiya qilamiz.
 *
 * Status mantiqi (biz ↔ LDG):
 *  - Biz buyurtmani olib, qabul qilib LDG'ga jo'natamiz → bizda ON_THE_ROAD,
 *    LDG uchun esa bu yangi buyurtma (`created`/`NEW`).
 *  - LDG buyurtmani alohida qabul qiladi (`RECEIVED`) → bizda WAITING.
 *  - LDG yo'lda (`IN_TRANSIT`/`OUT_FOR_DELIVERY`) → bizda hamon WAITING.
 *  - LDG yetkazib berdi (`DELIVERED`) → bizda SOLD (sotuv oqimi).
 *  - LDG bekor qildi (`CANCELLED`) → bizda CANCELLED (bekor qilish oqimi).
 *  - LDG qaytarib berdi (`RETURNED`) → bizda CLOSED (bekor qilish oqimi + yopildi).
 */

/** Terminal status kelganda chaqiriladigan biznes oqimi. */
export type LdgTerminalAction = 'sell' | 'cancel' | 'return';

export interface LdgStatusMapping {
  // Bizning Order_status (qaysi holatga o'tkazamiz)
  order_status: Order_status;

  // Mos keluvchi post statusi (hozircha faqat ma'lumot uchun, webhook qo'llamaydi)
  post_status: Post_status | null;

  // LDG dagi terminal status (boshqa o'zgarish kutilmaydi)
  is_terminal: boolean;

  // Terminal status uchun qaysi biznes oqimi chaqiriladi:
  //   'sell'   → OrderService.markDeliveredByLdg (kassaga pul tushadi, SOLD)
  //   'cancel' → OrderService.markCancelledByLdg (bekor qilish oqimi, CANCELLED)
  //   'return' → OrderService.markReturnedByLdg  (bekor qilish oqimi + CLOSED)
  // Oraliq statuslar uchun `null` — faqat order statusi yangilanadi.
  terminal_action: LdgTerminalAction | null;
}

/**
 * LDG status code ni normalizatsiya qiladi (UPPERCASE).
 * `created` -> `CREATED`, `DELIVERED` -> `DELIVERED`.
 */
export function normalizeLdgStatusCode(code: string): string {
  return code.trim().toUpperCase();
}

const MAPPING: Record<string, LdgStatusMapping> = {
  CREATED: {
    order_status: Order_status.ON_THE_ROAD,
    post_status: null,
    is_terminal: false,
    terminal_action: null,
  },
  NEW: {
    order_status: Order_status.ON_THE_ROAD,
    post_status: null,
    is_terminal: false,
    terminal_action: null,
  },
  RECEIVED: {
    order_status: Order_status.WAITING,
    post_status: Post_status.RECEIVED,
    is_terminal: false,
    terminal_action: null,
  },
  IN_TRANSIT: {
    order_status: Order_status.WAITING,
    post_status: Post_status.SENT,
    is_terminal: false,
    terminal_action: null,
  },
  OUT_FOR_DELIVERY: {
    order_status: Order_status.WAITING,
    post_status: Post_status.SENT,
    is_terminal: false,
    terminal_action: null,
  },
  DELIVERED: {
    order_status: Order_status.SOLD,
    post_status: null,
    is_terminal: true,
    terminal_action: 'sell',
  },
  RETURNED: {
    order_status: Order_status.CLOSED,
    post_status: Post_status.CANCELED_RECEIVED,
    is_terminal: true,
    terminal_action: 'return',
  },
  CANCELLED: {
    order_status: Order_status.CANCELLED,
    post_status: Post_status.CANCELED,
    is_terminal: true,
    terminal_action: 'cancel',
  },
};

/**
 * LDG status -> bizning mapping. Noma'lum status uchun `null` qaytadi
 * (controller bunday hodisani log qiladi va status o'zgartirmaydi).
 */
export function mapLdgStatus(ldgStatusCode: string): LdgStatusMapping | null {
  const code = normalizeLdgStatusCode(ldgStatusCode);
  return MAPPING[code] ?? null;
}
