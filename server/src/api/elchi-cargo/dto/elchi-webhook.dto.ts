/**
 * Elchi chiquvchi webhook kontrakti.
 *
 * Elchi `POST <webhook_url>` qiladi, tanani HMAC-SHA256 bilan imzolab
 * `X-Elchi-Signature` headerida yuboradi. Boshqa header YO'Q — hodisa id'si
 * ham TANADA keladi (`event_id`).
 *
 * Manba: `Elchi-Backend/docs/PARTNER_API.md` §4 va
 * `integration-service.service.ts` `enqueuePartnerWebhook`.
 */

export const ELCHI_SIGNATURE_HEADER = 'x-elchi-signature';

/** Webhook jurnalidagi qayta ishlash holati. */
export type ElchiWebhookStatus =
  | 'success'
  | 'failed'
  | 'skipped'
  | 'invalid_signature'
  | 'replay';

export interface ElchiWebhookPayload {
  /** Hozircha yagona qiymat: `shipment.status_changed`. */
  event?: string;

  /**
   * Hodisaning unikal id'si (UUID). TAKROR HIMOYASI aynan shu maydonga
   * tayanadi — `status` bo'yicha dedup qilib BO'LMAYDI, chunki bir status
   * qayta yuz berishi mumkin (`sold` → rollback → `sold`).
   *
   * Elchi tomonida G2 tuzatishi bilan qo'shilgan. Kelmasa — zaxira kalit
   * yasaladi (`elchi-webhook.service.ts`).
   */
  event_id?: string;

  /** Bizning buyurtma UUID'i (Elchi uchun bu `external_order_id`). */
  external_order_id?: string;

  /** Elchi tomonidagi posilka id'si. */
  shipment_id?: string | number;

  /** Elchi `Order_status` qiymati. */
  status?: string;

  /**
   * Elchi qaytargan summa.
   *
   * ⚠️ M2: Elchi buni "yig'ilgan pul" deb ataydi, lekin amalda u O'ZINING
   * TARIFINI AYIRGANDAN KEYINGI (NET) qiymat. Biz uni faqat
   * `elchi_shipment.cod_collected_reported`ga yozamiz va hisob-kitobda
   * `cod_amount_sent` bilan solishtiramiz — ayirmasi Elchi tarifiga teng
   * bo'lishi kutiladi.
   */
  cod_collected?: number;

  occurred_at?: string;
}
