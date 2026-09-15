/**
 * Elchi Partner API (`/partner/*`) so'rov/javob shakllari.
 *
 * Manba — Elchi'ning `docs/PARTNER_API.md` va gateway kodi. Elchi javoblarini
 * `{ statusCode, message, data }` qobig'ida qaytaradi; qobiqni ochish
 * `elchi-api.service.ts` ichida (himoyalangan usulda) bajariladi.
 */

/** `GET /partner/ping` — kalit tekshiruvi. */
export interface ElchiPingResponse {
  authenticated: boolean;
  partner?: { id?: string; name?: string };
}

/**
 * `GET /partner/regions` — `sato_code` bizning hududlarga AVTOMATIK moslash
 * uchun kalit (Elchi tomonida G1 tuzatishi bilan qo'shilgan).
 */
export interface ElchiRegion {
  id: string;
  name: string;
  sato_code: string | null;
}

/** `GET /partner/districts?region_id=` */
export interface ElchiDistrict {
  id: string;
  name: string;
  region_id: string;
  sato_code: string | null;
}

/**
 * `POST /partner/markets` — sotuvchi uchun Elchi market akkaunti (idempotent:
 * bir xil `external_seller_id` ikkinchi market ochmaydi).
 *
 * ⚠️ `tariff_home` / `tariff_center` YUBORILMASA Elchi tomonda **0** bo'ladi —
 * ya'ni Elchi bepul yetkazadi va butun naqd bizning balansimizga tushadi.
 * Shu bois ular MAJBURIY deb qaraladi (M4).
 */
export interface ElchiProvisionMarketRequest {
  external_seller_id: string;
  name: string;
  phone: string;
  tariff_home: number;
  tariff_center: number;
}

export interface ElchiProvisionMarketResponse {
  elchi_market_id: string;
}

/**
 * `POST /partner/shipments` — buyurtmani Elchi'ga posilka sifatida uzatish.
 *
 * `external_order_id` = bizning buyurtma UUID'i. Bu Elchi tomonda
 * IDEMPOTENTLIK kaliti: takroriy jo'natish yangi posilka ochmaydi, mavjudini
 * qaytaradi.
 *
 * ⚠️ `subtotal` bilan `cod_amount` TENG yuboriladi (M3). Sabab: Elchi'ning
 * sotuv matematikasi `to_be_paid`ni O'QIMAYDI — u `total_price` ustida ishlaydi.
 * Ikki maydon farq qilsa, pul hisobi biz kutgandan boshqacha chiqadi.
 */
export interface ElchiCreateShipmentRequest {
  external_order_id: string;
  elchi_market_id: string;
  customer: { name: string; phone: string };
  address?: string | null;
  region_id?: string | null;
  district_id: string;
  where_deliver?: 'center' | 'address';
  items?: Array<{
    name: string;
    quantity: number;
    /**
     * PCS mahsulot UUID'i. Elchi katalogida mahsulotni topish/yaratish shu
     * bo'yicha bajariladi (nom bo'yicha emas — nom o'zgaruvchan).
     */
    external_product_id?: string;
  }>;
  cod_amount: number;
  subtotal?: number;
  /**
   * BIZNING jismoniy yorliqdagi QR token (`order.qr_code_token`).
   *
   * Elchi uni buyurtmaning `qr_code_token` i sifatida saqlaydi — ya'ni
   * BIZNING yorlig'imiz ULARNING skanerida ishlaydi. Yuborilmasa Elchi o'z
   * tasodifiy tokenini yaratadi va ularning "Kiruvchi buyurtmalar" ekranida
   * qopdagi yorliq skanerlanmaydi ("topilmadi").
   *
   * Elchi tomonda noyoblik tekshiriladi: band bo'lsa 409.
   */
  label_token?: string;
  /**
   * QOP (batch) — bitta pochtada ketayotgan posilkalar guruhi.
   *
   * Elchi kiruvchi ekranida guruhlash uchun, va eng muhimi: operator QOP
   * ustidagi umumiy yorliqni skanerlaganda butun qop qabul qilinadi.
   * Busiz u 12 posilkani bittalab skanerlashga majbur bo'lardi.
   */
  batch_ref?: string;
  batch_label_token?: string;
  batch_size?: number;
}

export interface ElchiCreateShipmentResponse {
  shipment_id: string;
  /** Takroriy jo'natishda `true` — Elchi mavjud posilkani qaytardi. */
  idempotent?: boolean;
  order_status?: string;
  qr_code_token?: string;
  to_be_paid?: number;
}

/** `GET /partner/shipments/:id` — solishtirish (reconcile) uchun. */
export interface ElchiShipmentStatusResponse {
  shipment_id: string;
  external_order_id?: string;
  status: string;
  /**
   * `to_be_paid` — Elchi bizga QARZ summasi.
   *
   * ⚠️ Sotuvdan KEYIN Elchi bundan o'z tarifini ushlab qoladi, ya'ni qiymat
   * `total_price − elchi_tarifi` ga aylanadi. Sotuvgacha esa biz yuborgan
   * to'liq COD ga teng. Shu bois tarif farqini aynan shu maydondan hisoblaymiz.
   */
  cod_amount?: number;
  /**
   * `paid_amount` — Elchi shu qarzning QANCHASINI ALLAQACHON TO'LAB BERGAN.
   *
   * ⚠️ Bu "kuryer mijozdan yiqqan pul" EMAS. Elchi kodidagi izoh shunday
   * deyilgan, lekin haqiqatda `paid_amount` marketga to'lab berilgan qismni
   * bildiradi va oddiy sotuvda 0 bo'lib qoladi. Nomi chalg'itadi — hisob-kitob
   * (settlement) uchun ishlatiladi, pul solishtiruvi uchun EMAS.
   */
  cod_collected?: number;
  /**
   * HAQIQIY yig'ilgan naqd — kuryer mijozdan olgan pul (sotuv snapshoti).
   *
   * ⚠️ Yuqoridagi `cod_collected` NING O'RNINI BOSADI. U nomi yolg'on
   * bo'lgani uchun panelda uch xato ko'rsatkich chiqargan (audit M2).
   *
   * ⚠️ `0` HAQIQIY QIYMAT: mijoz onlayn to'lagan bo'lsa kuryer naqd
   * yig'maydi. `null` esa "hali sotilmagan / Elchi yubormagan" degani —
   * ikkisini aralashtirmaslik kerak.
   */
  collected_from_customer?: number | null;
  /** Elchi ushlab qolgan tarif (sotuv snapshoti). */
  elchi_fee?: number | null;
  /** Elchi bizga qarzi: `collected_from_customer - elchi_fee`. */
  market_amount?: number | null;
  /**
   * Elchi tomonidagi buyurtma narxi. Biz yuborgan `cod_amount_sent` bilan
   * teng bo'lishi SHART — farq bo'lsa kimdir Elchi tomonda narxni o'zgartirgan.
   */
  total_price?: number;
  /**
   * Elchi tomonida kuryer yozgan qo'shimcha xarajat.
   *
   * Biz ham o'z marketimizdan shu summani yechishimiz kerak — aks holda
   * ikki daftar shunga ajralib qoladi (bizda market hech narsa to'lamaydi).
   * Chegara ikki tizimda bir xil, shuning uchun oddiy holatda o'tadi.
   */
  extra_cost?: number;
  tracking?: string | null;
}

/**
 * `GET /partner/tariff?elchi_market_id=&where_deliver=` — Elchi tomonidagi
 * market tarifi. Bu bizga TEKSHIRUV uchun kerak: PCS'dagi virtual kuryer
 * tarifi bilan TENG bo'lishi shart, aks holda ikki daftar ajraladi (M4).
 */
export interface ElchiTariffResponse {
  elchi_market_id: string;
  where_deliver: string;
  market_tariff: number;
}

/** `POST /partner/shipments/:id/cancel` — yetkazilgan posilkada Elchi 409 beradi. */
export interface ElchiCancelShipmentResponse {
  shipment_id: string;
  status: string;
}
