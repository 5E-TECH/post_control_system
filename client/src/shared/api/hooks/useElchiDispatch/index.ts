import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../..";

/**
 * Elchi'ga jo'natish bilan bog'liq UI so'rovlari (pochta ekrani uchun).
 *
 * Ikki savolga javob beradi:
 *   1. jo'natishdan OLDIN — qaysi buyurtmalar darvozadan o'tmaydi?
 *   2. jo'natishdan KEYIN — nechtasi Elchi'ga haqiqatan yetdi?
 */

/** Bizning tizimda Elchi'ni ifodalovchi virtual kuryer belgisi. */
export const ELCHI_PROVIDER = "elchi";

export interface ElchiGateBlockedItem {
  order_id: string;
  /** Ko'rsatish uchun tayyor yorliq — `#100428` yoki UUID boshi. */
  label: string;
  district_name: string;
}

export interface ElchiGatePreview {
  total: number;
  allowed: number;
  blocked: ElchiGateBlockedItem[];
}

export interface ElchiDispatchStatus {
  total: number;
  /** Elchi'ga yetgan (posilka id'si olingan). */
  delivered: number;
  /** Yetmagan — qayta jo'natish kerak. */
  failed: number;
  items: Array<{
    order_id: string;
    elchi_shipment_id: string | null;
    last_error: string | null;
    send_attempts: number;
  }>;
}

const unwrap = <T,>(raw: unknown): T =>
  ((raw as { data?: T })?.data ?? raw) as T;

export const useElchiDispatch = () => {
  /**
   * DARVOZA OLDINDAN TEKSHIRUVI.
   *
   * Nega mutation (query emas): u tanlangan buyurtmalar ro'yxatiga bog'liq va
   * operator tanlovni o'zgartirgan sayin qayta chaqiriladi — avtomatik
   * keshlanadigan query bu yerda chalg'ituvchi bo'lardi.
   *
   * Xato TASHLAMAYDI — natija shunchaki ro'yxat.
   */
  const previewGate = useMutation({
    mutationFn: (orderIds: string[]) =>
      api
        .post("elchi/gate/preview", { order_ids: orderIds })
        .then((res) => unwrap<ElchiGatePreview>(res.data)),
  });

  /**
   * Pochta bo'yicha jo'natish holati.
   *
   * Dispatch fon rejimida ketadi (pochta jo'natish tranzaksiyasini
   * bloklamaslik uchun) — ya'ni "jo'natildi" xabari Elchi'ga YETGANINI
   * bildirmaydi. Bu so'rov jimgina yo'qolgan buyurtmani ko'rsatadi.
   *
   * ⚠️ `total` — Elchi'ga URINIB KO'RILGAN buyurtmalar soni, jo'natilganlar
   * soni EMAS: yozuv API javobidan KEYIN saqlanadi, ya'ni ro'yxat asta
   * to'ladi. Shu bois kutilgan son (`expected`) tashqaridan beriladi.
   */
  const useDispatchStatus = (postId?: string, expected?: number) =>
    useQuery({
      queryKey: ["elchi-dispatch-status", postId],
      queryFn: () =>
        api
          .get(`elchi/posts/${postId}/dispatch-status`)
          .then((res) => unwrap<ElchiDispatchStatus>(res.data)),
      enabled: Boolean(postId),
      refetchInterval: (query) => {
        const data = query.state.data as ElchiDispatchStatus | undefined;
        if (!data) return 2000;
        if (!expected) return false;
        // Hammasi hal bo'ldi (yetdi yoki xato berdi) — to'xtaymiz.
        if (data.delivered + data.failed >= expected) return false;
        /**
         * Yuqori chegara. Ba'zi xatolar (sozlama yo'q, tuman moslanmagan)
         * yozuv YARATILMASDAN oldin otiladi — u holda buyurtma ro'yxatda
         * umuman paydo bo'lmaydi va shartsiz so'rov CHEKSIZ aylanardi.
         * Taxminan bir daqiqadan keyin to'xtab, qo'lda yangilashga qoldiramiz.
         */
        if (query.state.dataUpdateCount > 30) return false;
        return 2000;
      },
    });

  /**
   * Yetmagan buyurtmani QAYTA jo'natish.
   *
   * Idempotent: Elchi tomonda posilka allaqachon bo'lsa yangisi ochilmaydi
   * (`external_order_id` kaliti bo'yicha), shu bois tugmani bir necha marta
   * bosish xavfsiz.
   */
  const retryDispatch = useMutation({
    mutationFn: (orderId: string) =>
      api
        .post(`elchi/orders/${orderId}/dispatch-retry`)
        .then((res) => res.data),
  });

  return { previewGate, useDispatchStatus, retryDispatch };
};
