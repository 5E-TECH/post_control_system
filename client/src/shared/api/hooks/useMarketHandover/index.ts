import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../";

/**
 * BEKOR QAYTARISHNI MARKETGA TOPSHIRISH — API qatlami.
 *
 * Oqim:
 *   market  → createConsent()      QR (2 daq) + 6 xonali PIN
 *   xodim   → scan()               10 daqiqalik ruxsat (MRA-…)
 *   xodim   → heartbeat()          har 30 s — sahifa tirik ekani
 *   xodim   → complete() × N       partiya-partiya topshirish
 *   xodim   → finish() | release()  yakunlash / sahifadan chiqish
 *
 * ⚠️ Ruxsat SAHIFAGA bog'langan: heartbeat kelmasa server uni o'ldiradi.
 */
export const marketHandoverKey = "market-handover";

/**
 * MARKET RUXSATINING HOLATI.
 *
 * ⚠️ NEGA POLLING KERAK. QR/PIN BIR MARTALIK: xodim skanerlashi bilan
 * sessiya `PENDING → ACTIVE` ga o'tadi va eski kod o'ladi. Market ekranida
 * esa QR sanoq bilan TURAVERARDI — market yaroqsiz kodni ko'rsatib,
 * xodim «muddati tugagan» xatosini olardi.
 *
 *   waiting  — QR tirik, xodim hali skanerlamagan
 *   expired  — muddat o'tdi, YANGI QR kerak
 *   handover — xodim skanerladi, topshirish borayotgan payt
 *   done     — sessiya yopilgan (topshirildi / PIN bloklandi / bekor)
 *   none     — hali ruxsat yaratilmagan
 */
export type ConsentState =
  | "none"
  | "waiting"
  | "expired"
  | "handover"
  | "done";

export interface ConsentStatus {
  state: ConsentState;
  session_id?: string;
  seconds_left: number;
  handed_over_count: number;
  /** 5 marta xato PIN — market YANGI QR ko'rsatishi SHART. */
  pin_blocked: boolean;
  awaiting_count: number;
}

/** Bekor qaytarish bosqichi — SERVER hisoblaydi (hosila maydon). */
export type ReturnStage = "courier" | "center" | "market";

export interface AwaitingOrder {
  id: string;
  order_number: number;
  qr_code_token: string;
  total_price: number;
  status: string;
  center_received_at: number | null;
  age_days: number;
  escalated: boolean;
  return_stage: ReturnStage;

  /**
   * Posilkani TANIB olish uchun — pochta ichidagi buyurtma kartasi bilan
   * bir xil to'plam. Xodim 150 posilka orasidan qaysi birini topshirayotganini
   * raqamdan emas, MIJOZ va TUMAN bo'yicha ham tekshiradi.
   */
  customer_name: string | null;
  customer_phone: string | null;
  district_name: string | null;
  region_name: string | null;
  where_deliver: string | null;
  created_at: number | null;
  product_quantity: number | null;
  /**
   * QANDAY MAHSULOT bekor bo'lgan.
   *
   * ⚠️ Marketplace buyurtmalarida `order_item` YARATILMAYDI
   * (`marketplace-intake.service.ts`), ya'ni bu massiv BO'SH bo'lishi
   * mumkin — `product_quantity` esa > 0. Ko'rsatishda shu holat
   * qoplanishi SHART.
   */
  items: OrderProduct[];
  comment: string | null;

  /** Almashtirish yorlig'i (`ReplacementBadge`) uchun. */
  is_replacement_return: boolean;
  replacement_state: string | null;
  replacement_of_order_id: string | null;
  replacementOf: { order_number?: number } | null;
}

export interface AwaitingOrdersPage {
  orders: AwaitingOrder[];
  page: number;
  limit: number;
  total: number;
}

export interface AwaitingMarketRow {
  market_id: string;
  market_name: string | null;
  market_phone: string | null;
  consent_required: boolean;
  parcel_count: number;
  total_price: number;
  oldest_center_received_at: number;
  oldest_age_days: number;
  newest_center_received_at: number;
  escalated_count: number;
  /** Posilkalar QAYSI viloyatlardan kelgan («Navoiy viloyati, Andijon viloyati»). */
  regions: string | null;
  district_count: number;
  /** Jami mahsulot donasi (posilka soni emas). */
  item_count: number;
  replacement_count: number;
  /** Shu market uchun topshirish ayni paytda OCHIQ — ikkinchi xodim kutsin. */
  active_session: boolean;
}

export interface AwaitingMarketsPage {
  markets: AwaitingMarketRow[];
  page: number;
  limit: number;
  total_markets: number;
  total_parcels: number;
  /** Omborda turgan qaytarishlarning UMUMIY summasi. */
  total_price: number;
  total_escalated: number;
}

export interface MarketReturnCounts {
  awaiting: number;
  oldest_center_received_at: number | null;
  oldest_age_days: number;
}

/** Market kabinetida chiqadigan ruxsat (xom token FAQAT shu javobda bo'ladi). */
export interface ConsentSession {
  session_id: string;
  qr_token: string;
  pin: string;
  expires_at: number;
  ttl_seconds: number;
  awaiting_count: number;
}

/** Xodim skan qilgach ochiladigan topshirish oynasi. */
/** Buyurtmadagi bitta mahsulot — ro'yxatda «nima bekor bo'lgan» ustuni uchun. */
export interface OrderProduct {
  name: string;
  quantity: number;
}

/**
 * TOPSHIRILGAN PARTIYA — «topshirilgan pochta» ekvivalenti.
 *
 * Market omborga BIR keladi va o'nlab posilkani BIRGA olib ketadi.
 * Yassi ro'yxat bu faktni yo'qotadi: market «falon kuni nima oldim?»
 * degan savolga javob topa olmaydi va bahsda dalil ko'rsatolmaydi.
 */
export interface HandoverBatch {
  session_id: string;
  market_id: string;
  market_name: string | null;
  market_phone: string | null;
  /** `web` — market QR/PIN ruxsati; `offline` — vakil akti. */
  channel: string;
  staff_name: string | null;
  representative_name: string | null;
  representative_phone: string | null;
  override_reason: string | null;
  handed_at: number;
  /** Toshkent kuni, `YYYY-MM-DD` (serverda bitta konversiya bilan). */
  day: string;
  parcel_count: number;
  item_count: number;
  total_price: number;
  replacement_count: number;
}

export interface HandoverBatchesPage {
  batches: HandoverBatch[];
  page: number;
  limit: number;
  total_batches: number;
}

/**
 * Partiya ichidagi posilka — TOPSHIRISH DALILI bilan.
 *
 * ⚠️ `market_handover_override_reason` NULL bo'lsa yorliq
 * SKANERLANGAN; qiymat bo'lsa xodim uni QO'LDA belgilagan (yorliq
 * o'qilmagan). Bu `mode` dan ALOHIDA fakt: sessiya market QR'i bilan
 * ochilgan bo'lsa ham ayrim posilkalar yorliqsiz o'tishi mumkin.
 */
export interface HandoverBatchOrder extends AwaitingOrder {
  market_handover_at: number | null;
  market_handover_mode: string | null;
  market_handover_override_reason: string | null;
  market_handover_by: string | null;
  market_handover_by_name: string | null;
  center_received_by: string | null;
  center_received_by_name: string | null;
}

export interface HandoverBatchDetail {
  session: {
    session_id: string;
    channel: string | null;
    /** Market QR'ini skanerlagan (sessiyani ochgan) xodim. */
    opened_by_name: string | null;
    closed_at: number | null;
    representative_name: string | null;
    representative_phone: string | null;
    override_reason: string | null;
  };
  orders: HandoverBatchOrder[];
  total: number;
  total_price: number;
}

export interface HandoverHistoryParams {
  page?: number;
  limit?: number;
  /** `YYYY-MM-DD` — TOSHKENT kuni (epoch EMAS). */
  from?: string;
  to?: string;
  search?: string;
  market_id?: string;
}

export interface HandoverAuthorization {
  session_id: string;
  market_id: string;
  authorization_token: string;
  expires_at: number;
  remaining_seconds: number;
  heartbeat_interval_seconds: number;
}

export interface ManualOverride {
  order_id: string;
  /** ⚠️ YOPIQ ro'yxatdan AYNAN shu matn — tarjima qilingan yorliq EMAS. */
  reason: string;
}

/**
 * Shikastlangan yorliq uchun yopiq sabab ro'yxati.
 *
 * ⚠️ Qiymatlar backend `MARKET_HANDOVER_MANUAL_REASONS` bilan AYNAN bir xil
 * bo'lishi shart (`@IsIn` tekshiradi). Tarjima qilinsa 422 qaytadi.
 */
export const MANUAL_OVERRIDE_REASONS = [
  "QR yirtilgan",
  "QR o'qilmayapti",
  "Yorliq yo'qolgan",
  "QR namlangan yoki xiralashgan",
] as const;

/**
 * Sabab QIYMATI → TARJIMA KALITI.
 *
 * ⚠️ NEGA ALOHIDA XARITA. Yuqoridagi qiymatlar serverga AYNAN shu holda
 * ketadi (`@IsIn`), shuning uchun ularni tarjima qilish MUMKIN EMAS. Lekin
 * xodim ekranida ruscha/inglizcha interfeys bo'lsa ro'yxat o'zbekcha
 * qolardi. Yechim: qiymat o'zgarmaydi, FAQAT ko'rinadigan yorliq
 * tarjima qilinadi — shuning uchun qiymat va kalit ajratilgan.
 */
export const MANUAL_OVERRIDE_REASON_KEYS: Record<
  (typeof MANUAL_OVERRIDE_REASONS)[number],
  string
> = {
  "QR yirtilgan": "reasonQrTorn",
  "QR o'qilmayapti": "reasonQrUnreadable",
  "Yorliq yo'qolgan": "reasonLabelLost",
  "QR namlangan yoki xiralashgan": "reasonQrWet",
};

export const useMarketHandover = () => {
  const client = useQueryClient();
  const invalidate = () =>
    client.invalidateQueries({ queryKey: [marketHandoverKey] });

  // ─────────────────────────── MARKET ───────────────────────────

  /**
   * Market o'z qaytarishlarini ko'radi.
   *
   * ⚠️ `market_id` YUBORILMAYDI — server uni TOKENDAN oladi (IDOR'ga
   * qarshi). Shuning uchun bu endpointda market tanlash imkoni yo'q.
   */
  const getMyReturns = (
    params: { page?: number; limit?: number; search?: string } = {},
    enabled = true,
  ) =>
    useQuery<AwaitingOrdersPage>({
      queryKey: [marketHandoverKey, "my", params],
      queryFn: () =>
        api
          .get("market-handover/my/returns", { params })
          .then((res) => res.data?.data),
      enabled,
      // Markazga yangi posilka qabul qilinsa market o'zi ko'rsin (WebSocket yo'q).
      refetchInterval: 60_000,
    });

  const getMyReturnCounts = (enabled = true) =>
    useQuery<MarketReturnCounts>({
      queryKey: [marketHandoverKey, "my", "counts"],
      queryFn: () =>
        api
          .get("market-handover/my/returns/counts")
          .then((res) => res.data?.data),
      enabled,
      refetchInterval: 60_000,
    });

  /**
   * Ruxsat holatini KUZATADI (faqat modal ochiq bo'lganda).
   *
   * ⚠️ 3 SONIYA: xodim QR'ni skanerlagach market ekrani DARHOL
   * almashishi kerak — aks holda u yaroqsiz QR'ni ko'rsatib turadi.
   * 60 s (boshqa so'rovlardagi oraliq) bu yerda juda sekin.
   *
   * ⚠️ `enabled` — modal yopiq bo'lsa so'rov KETMAYDI: market kuni bo'yi
   * kabinetda ochiq o'tiradi, 3 soniyalik polling bekorga yuk bo'lardi.
   */
  const getConsentStatus = (enabled = true) =>
    useQuery<ConsentStatus>({
      queryKey: [marketHandoverKey, "consent", "status"],
      queryFn: () =>
        api.get("market-handover/consent/status").then((res) => res.data?.data),
      enabled,
      refetchInterval: enabled ? 3_000 : false,
      // Modal qayta ochilganda eski holat ko'rinib qolmasin.
      staleTime: 0,
    });

  /** MARKET: men olgan qaytarishlar — partiya bo'yicha. */
  const getMyHandovers = (
    params: HandoverHistoryParams = {},
    enabled = true,
  ) =>
    useQuery<HandoverBatchesPage>({
      queryKey: [marketHandoverKey, "my", "handovers", params],
      queryFn: () =>
        api
          .get("market-handover/my/handovers", { params })
          .then((res) => res.data?.data),
      enabled,
    });

  /** XODIM: barcha marketlarning topshirish partiyalari. */
  const getHandovers = (params: HandoverHistoryParams = {}, enabled = true) =>
    useQuery<HandoverBatchesPage>({
      queryKey: [marketHandoverKey, "handovers", params],
      queryFn: () =>
        api
          .get("market-handover/handovers", { params })
          .then((res) => res.data?.data),
      enabled,
    });

  /** Bitta partiya ichi — posilkalar + mahsulotlari. */
  const getHandoverBatch = (sessionId: string, enabled = true) =>
    useQuery<HandoverBatchDetail>({
      queryKey: [marketHandoverKey, "handovers", "batch", sessionId],
      queryFn: () =>
        api
          .get(`market-handover/handovers/${sessionId}`)
          .then((res) => res.data?.data),
      enabled: enabled && Boolean(sessionId),
    });

  const createConsent = useMutation<ConsentSession, unknown, void>({
    mutationFn: () =>
      api.post("market-handover/consent").then((res) => res.data?.data),
  });

  // ─────────────────────────── XODIM ───────────────────────────

  const getAwaitingMarkets = (
    params: { page?: number; limit?: number; search?: string } = {},
    enabled = true,
  ) =>
    useQuery<AwaitingMarketsPage>({
      queryKey: [marketHandoverKey, "awaiting", params],
      queryFn: () =>
        api
          .get("market-handover/awaiting", { params })
          .then((res) => res.data?.data),
      enabled,
      refetchInterval: 60_000,
    });

  const getAwaitingOrders = (
    marketId: string,
    params: { page?: number; limit?: number; search?: string } = {},
    enabled = true,
  ) =>
    useQuery<AwaitingOrdersPage>({
      queryKey: [marketHandoverKey, "awaiting", marketId, params],
      queryFn: () =>
        api
          .get(`market-handover/awaiting/${marketId}`, { params })
          .then((res) => res.data?.data),
      enabled: enabled && Boolean(marketId),
    });

  /**
   * SKANERLANGAN YORLIQ sahifadagi ro'yxatda YO'Q bo'lsa — uni qidiradi.
   *
   * ⚠️ NEGA KERAK. Navbatda 450+ posilka bo'lishi mumkin, ekranda esa bir
   * sahifa (20–50). Xodim 3-sahifadagi posilkani skanerlasa `manifest` da
   * topilmaydi va skaner "noma'lum yorliq" deb beradi. Shu funksiya server
   * qidiruvi orqali ID ni aniqlaydi, keyin ro'yxat yangilanadi.
   *
   * ⚠️ `useQuery` EMAS — skaner ichidan императив chaqiriladi (har o'qishda
   * yangi token), shuning uchun oddiy funksiya.
   */
  const resolveAwaitingByToken = async (
    marketId: string,
    token: string,
  ): Promise<string | null> => {
    const res = await api.get(`market-handover/awaiting/${marketId}`, {
      params: { search: token, limit: 1 },
    });
    return res?.data?.data?.orders?.[0]?.id ?? null;
  };

  const scan = useMutation<
    HandoverAuthorization,
    unknown,
    { qr_token?: string; market_id?: string; pin?: string }
  >({
    mutationFn: (body) =>
      api.post("market-handover/scan", body).then((res) => res.data?.data),
  });

  const heartbeat = useMutation<
    { session_id: string; remaining_seconds: number; handed_over_count: number },
    unknown,
    string
  >({
    mutationFn: (authorization_token) =>
      api
        .post("market-handover/heartbeat", { authorization_token })
        .then((res) => res.data?.data),
  });

  const complete = useMutation<
    { handed_over: number; order_ids: string[] },
    unknown,
    {
      market_id: string;
      order_ids: string[];
      authorization_token: string;
      manual_overrides?: ManualOverride[];
    }
  >({
    mutationFn: (body) =>
      api.post("market-handover/complete", body).then((res) => res.data?.data),
    onSuccess: invalidate,
  });

  const finish = useMutation<unknown, unknown, string>({
    mutationFn: (authorization_token) =>
      api
        .post("market-handover/finish", { authorization_token })
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  const offlineHandover = useMutation<
    { handed_over: number; mode: string },
    unknown,
    {
      market_id: string;
      order_ids: string[];
      representative_name: string;
      representative_phone: string;
      reason: string;
    }
  >({
    mutationFn: (body) =>
      api.post("market-handover/offline", body).then((res) => res.data?.data),
    onSuccess: invalidate,
  });

  const setConsentRequired = useMutation<
    unknown,
    unknown,
    { marketId: string; required: boolean }
  >({
    mutationFn: ({ marketId, required }) =>
      api
        .patch(`market-handover/markets/${marketId}/consent-required`, {
          cancel_handover_consent_required: required,
        })
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  return {
    getMyReturns,
    getMyReturnCounts,
    getConsentStatus,
    getMyHandovers,
    getHandovers,
    getHandoverBatch,
    createConsent,
    getAwaitingMarkets,
    getAwaitingOrders,
    resolveAwaitingByToken,
    scan,
    heartbeat,
    complete,
    finish,
    offlineHandover,
    setConsentRequired,
  };
};

/**
 * Ruxsatni YOPISH — sahifadan chiqqanda.
 *
 * ⚠️ `sendBeacon` ishlatiladi, chunki `beforeunload` paytida oddiy
 * `fetch`/`axios` so'rovi brauzer tomonidan BEKOR qilinadi — ya'ni ruxsat
 * ochiq qolib ketardi. Beacon esa sahifa yopilgandan keyin ham yuboriladi.
 *
 * React Query mutation'i bu yerda ishlamaydi (komponent allaqachon
 * unmount bo'lgan), shuning uchun alohida funksiya.
 */
export function releaseHandoverBeacon(
  baseUrl: string,
  authorizationToken: string,
): void {
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/market-handover/release`;
    const body = JSON.stringify({ authorization_token: authorizationToken });
    const token = localStorage.getItem("x-auth-token");

    // `sendBeacon` sarlavha qo'yolmaydi — shuning uchun token URL'da emas,
    // balki keyin oddiy `fetch(keepalive)` bilan yuboriladi. Beacon faqat
    // zaxira: keepalive ham bekor bo'lsa server heartbeat orqali o'zi yopadi.
    void fetch(url, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      credentials: "include",
    }).catch(() => {});
  } catch {
    /* sahifa yopilyapti — xato ko'rsatadigan odam yo'q */
  }
}
