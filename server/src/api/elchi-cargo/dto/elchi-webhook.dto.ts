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
  'success' | 'failed' | 'skipped' | 'invalid_signature' | 'replay';

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

  /**
   * HAQIQIY yig'ilgan naqd (audit M2 tuzatishi) — `cod_collected` o'rniga.
   *
   * ⚠️ Yuqoridagi izoh "NET qiymat" deb taxmin qilgan, lekin haqiqat
   * yomonroq: Elchi u yerga `order.paid_amount` ni soladi — market qarzining
   * avto-to'langan qismini, oddiy sotuvda 0. Ya'ni ayirma tarifga teng
   * BO'LMAYDI, butun COD chiqadi.
   *
   * Endi Elchi sotuv snapshotidan aniq qiymat yuboradi.
   *
   * ⚠️ `0` HAQIQIY: mijoz onlayn to'lagan bo'lsa kuryer naqd yig'maydi.
   * `null` — hali sotilmagan yoki Elchi bu maydonni yubormagan (eski posilka).
   */
  collected_from_customer?: number | null;

  /** Elchi ushlab qolgan tarif (sotuv snapshoti). */
  elchi_fee?: number | null;

  /** Elchi bizga qarzi: `collected_from_customer - elchi_fee`. */
  market_amount?: number | null;

  /**
   * Elchi tomonidagi YAKUNIY narx.
   *
   * Elchi kuryeri buyurtmani boshqa narxga sotishi mumkin (500 000 lik narsa
   * 450 000 ga). Bu maydon bo'lsa, PCS sotishdan oldin o'z narxini shunga
   * tenglashtiradi — aks holda kassaga eski narx bo'yicha xato summa
   * tushardi. Buyurtma izohiga "qancha edi -> qanchaga" avtomatik yoziladi.
   */
  total_price?: number;

  /**
   * Elchi tomonida yozilgan qo'shimcha xarajat.
   *
   * Chegara ikki tizimda bir xil, shuning uchun oddiy holatda PCS'da ham
   * o'tadi. O'tmasa sotuv yiqilmaydi — xarajatsiz sotiladi va nomuvofiqlik
   * belgilanadi.
   */
  extra_cost?: number;

  occurred_at?: string;
}
