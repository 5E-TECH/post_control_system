/**
 * LDG webhook payload tuzilishi (envelope).
 *
 * Real misol (webhook.test eventi sandbox dan):
 *   {
 *     "id": "evt_019df817-...",
 *     "delivery_id": "whd_019df817-...",
 *     "type": "webhook.test",
 *     "created_at": "2026-05-05T12:23:06+00:00",
 *     "tenant":  { id, slug, name },
 *     "client":  { id: 32 },
 *     "data":    { ... event-specific ... }
 *   }
 *
 * Real package event lar uchun `data` ichida package_id, tracking_number,
 * status va h.k. bo'lishi kutilmoqda — defensiv parser yozamiz.
 */

export interface LdgWebhookEnvelope<TData = Record<string, unknown>> {
  id: string;
  delivery_id: string;
  type: string;
  created_at: string;
  tenant?: {
    id: string;
    slug: string;
    name: string;
  };
  client?: {
    id: number;
  };
  data: TData;
}

/**
 * Package lifecycle event'lari uchun kutilayotgan `data` shakli.
 * Hamma maydonlar optional — chunki LDG har xil eventlarda har xil maydonlarni
 * yuborishi mumkin. Biz qaysisi mavjud bo'lsa, shuni ishlatamiz.
 */
export interface LdgPackageEventData {
  // LDG ichki order ID — POST /orders javobida `order_id`, REST GET javobida `id`.
  // LDG webhook'i ikkalasidan birini yuborishi mumkin, shuning uchun ikkalasi ham bor.
  order_id?: number;
  id?: number;
  package_id?: number;
  external_order_id?: string;
  tracking_number?: string;
  status?: {
    code: string;
    name: string | null;
  };
  previous_status?: {
    code: string;
    name: string | null;
  };
  changed_at?: string;
}

/**
 * LDG webhook headers (Express req.headers dan o'qiymiz).
 * Express headers ni lowercase qiladi.
 */
export const LDG_HEADERS = {
  SIGNATURE: 'x-fcargo-signature',
  TIMESTAMP: 'x-fcargo-timestamp',
  DELIVERY_ID: 'x-fcargo-delivery-id',
  EVENT_ID: 'x-fcargo-event-id',
  EVENT: 'x-fcargo-event',
  API_VERSION: 'x-fcargo-api-version',
} as const;
