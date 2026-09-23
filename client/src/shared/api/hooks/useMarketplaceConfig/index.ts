import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const MP_LIST_KEY = "marketplace-config-list";
const MP_ONE_KEY = "marketplace-config-one";
const MP_TARIFF_KEY = "marketplace-tariff-history";
const MP_STATUS_MAP_KEY = "marketplace-status-map";

/** Javob qobig'ini himoyalangan ochish (`{data}` bo'lishi ham, bo'lmasligi ham mumkin). */
const unwrap = <T,>(raw: unknown): T =>
  ((raw as { data?: T })?.data ?? raw) as T;

/**
 * Sekret maydonning XAVFSIZ ko'rinishi.
 *
 * Server hech qachon xom qiymat qaytarmaydi — faqat "kiritilganmi" va
 * oxirgi 4 belgi. Ya'ni admin kalit to'g'ri kiritilganini tekshira oladi,
 * lekin kalitning o'zi tarmoqqa ham, brauzer xotirasiga ham tushmaydi.
 */
export interface MarketplaceSecretState {
  set: boolean;
  hint: string | null;
}

/**
 * Sozlash bandlari. Har biri `true` bo'lmaguncha ulanishni YOQIB BO'LMAYDI —
 * bu qoidani server ham majburlaydi, UI shunchaki sababini ko'rsatadi.
 */
export interface MarketplaceChecklist {
  api_base_url: boolean;
  api_key: boolean;
  signing_secret: boolean;
  inbound_api_key: boolean;
  tariff: boolean;
  market: boolean;
  /** `MARKETPLACE_SECRET_KEY` sozlanganmi — busiz sekretlar ochiq matn. */
  encryption: boolean;
}

export interface MarketplaceTariffView {
  version: number;
  tariff_center: number;
  tariff_home: number;
  effective_from: number;
}

export interface MarketplaceConfigRow {
  id: string;
  name: string;
  slug: string;
  market_id: string;
  /**
   * Biriktirilgan market — marketplace pulining KASSASI.
   *
   * ⚠️ Avval javobda faqat `market_id` (UUID) bor edi va ekran uni
   * chizmasdi — admin «hech qanday marketga biriktirilmagan» deb
   * o'ylardi.
   */
  market: {
    id: string;
    name: string;
    phone_number: string;
    cashbox_balance: number | null;
  } | null;
  api_base_url: string | null;
  is_active: boolean;
  is_sandbox: boolean;
  request_timeout_ms: number;
  settlement_period_days: number;
  ip_allowlist: string[];
  last_ping_at: number | null;
  last_reconcile_at: number | null;
  last_settlement_at: number | null;
  secrets: {
    api_key: MarketplaceSecretState;
    signing_secret: MarketplaceSecretState;
    signing_secret_previous: MarketplaceSecretState;
    inbound_api_key: MarketplaceSecretState;
  };
  tariff: MarketplaceTariffView | null;
  checklist: MarketplaceChecklist;
  ready: boolean;
}

/** Daftar invarianti: `SUM(daftar) === kassa balansi` bo'lishi SHART. */
export interface MarketplaceInvariant {
  ok: boolean;
  ledger_sum: number;
  cashbox_balance: number;
  diff: number;
}

export interface MarketplaceHealth extends MarketplaceConfigRow {
  invariant: MarketplaceInvariant;
}

export interface CreateMarketplacePayload {
  name: string;
  slug: string;
  market_id: string;
  api_base_url?: string;
  tariff_center: number;
  tariff_home: number;
  is_sandbox?: boolean;
  settlement_period_days?: number;
  ip_allowlist?: string[];
}

/** ⚠️ `slug` va `market_id` ATAYLAB yo'q — server ham ularni o'zgartirmaydi. */
export interface UpdateMarketplacePayload {
  name?: string;
  api_base_url?: string;
  api_key?: string;
  request_timeout_ms?: number;
  settlement_period_days?: number;
  ip_allowlist?: string[];
  is_sandbox?: boolean;
}

/**
 * Status xaritasining bitta qatori.
 *
 * ⚠️ `partner` — admin kiritgan qiymat (hamkorda raqam, so'z yoki kod
 * bo'lishi mumkin). `effective` — HAQIQATAN yuboriladigan qiymat:
 * sozlanmagan bo'lsa kanonik nomning o'zi.
 */
export interface MarketplaceStatusRow {
  canonical: string;
  partner: string | null;
  effective: string;
}

export interface MarketplaceStatusMapView {
  slug: string;
  rows: MarketplaceStatusRow[];
  /** Ikki kanonik status BIR qiymatga tushgan holatlar. */
  conflicts: Array<{ value: string; statuses: string[] }>;
  configured: number;
}

export interface MarketplaceTariffRow {
  id: string;
  version: number;
  tariff_center: number;
  tariff_home: number;
  effective_from: number;
  effective_to: number | null;
  note: string | null;
}

export interface MarketplaceTestResult {
  ok: boolean;
  kind?: string;
  message?: string;
  latency_ms?: number;
  version?: string | null;
}

/** Aylantirish javobi — sekret SHU YERDA, BIR MARTA keladi. */
export interface MarketplaceRotateResult {
  signing_secret?: string;
  inbound_api_key?: string;
  warning: string;
}

export const useMarketplaceConfig = (slug?: string) => {
  const client = useQueryClient();

  const invalidate = () => {
    client.invalidateQueries({ queryKey: [MP_LIST_KEY] });
    if (slug) client.invalidateQueries({ queryKey: [MP_ONE_KEY, slug] });
  };

  const list = useQuery({
    queryKey: [MP_LIST_KEY],
    queryFn: () =>
      api
        .get("marketplace/config")
        .then((res) => unwrap<MarketplaceConfigRow[]>(res.data) ?? []),
  });

  /**
   * Bitta ulanish + daftar invarianti.
   *
   * ⚠️ `health` kassani va daftarni jamlaydi — arzon emas. Avtomatik
   * qayta so'ralmaydi; admin "Yangilash" bilan o'zi chaqiradi.
   */
  const detail = useQuery({
    queryKey: [MP_ONE_KEY, slug],
    enabled: !!slug,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: () =>
      api
        .get(`marketplace/config/${slug}/health`)
        .then((res) => unwrap<MarketplaceHealth>(res.data)),
  });

  const tariffHistory = useQuery({
    queryKey: [MP_TARIFF_KEY, slug],
    enabled: !!slug,
    queryFn: () =>
      api
        .get(`marketplace/config/${slug}/tariff`)
        .then((res) => unwrap<MarketplaceTariffRow[]>(res.data) ?? []),
  });

  /**
   * Hamkorning status lug'ati.
   *
   * ⚠️ Qo'lda sozlanadi: ularning tizimi allaqachon mavjud bo'lishi va
   * butunlay boshqa qiymatlar ishlatishi mumkin (`7`, `dostavleno`,
   * `ST-07`). Koddan taxmin qilib bo'lmaydi.
   */
  const statusMap = useQuery({
    queryKey: [MP_STATUS_MAP_KEY, slug],
    enabled: !!slug,
    refetchOnWindowFocus: false,
    queryFn: () =>
      api
        .get(`marketplace/config/${slug}/status-map`)
        .then((res) => unwrap<MarketplaceStatusMapView>(res.data)),
  });

  const setStatusMap = useMutation({
    mutationFn: (params: { slug: string; status_map: Record<string, string> }) =>
      api
        .post(`marketplace/config/${params.slug}/status-map`, {
          status_map: params.status_map,
        })
        .then((res) => unwrap<MarketplaceStatusMapView>(res.data)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [MP_STATUS_MAP_KEY, slug] });
      invalidate();
    },
  });

  const create = useMutation({
    mutationFn: (data: CreateMarketplacePayload) =>
      api.post("marketplace/config", data).then((res) => res.data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (params: { slug: string; data: UpdateMarketplacePayload }) =>
      api
        .patch(`marketplace/config/${params.slug}`, params.data)
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  /** MASTER kalit — o'chirilsa skan ham, hodisa navbati ham to'xtaydi. */
  const setActive = useMutation({
    mutationFn: (params: { slug: string; is_active: boolean }) =>
      api
        .post(`marketplace/config/${params.slug}/active`, {
          is_active: params.is_active,
        })
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  /**
   * ⚠️ Xato PARTLAMAYDI — `{ok:false, kind, message}` qaytadi. Shuning
   * uchun `onError` emas, natijaning o'zi tekshiriladi.
   */
  const testConnection = useMutation({
    mutationFn: (s: string) =>
      api
        .post(`marketplace/config/${s}/test`)
        .then((res) => unwrap<MarketplaceTestResult>(res.data)),
    onSuccess: invalidate,
  });

  /**
   * IMZO SINOVI — `webhook.test` hodisasi imzolangan yo'ldan yuboriladi.
   *
   * ⚠️ «Ulanishni tekshirish» (ping) ATAYLAB imzolanmaydi, ya'ni u faqat
   * «manzil javob beryapti» deydi. Imzo sekreti noto'g'ri bo'lsa xato
   * faqat birinchi HAQIQIY sotuvdan keyin chiqardi.
   */
  const testSignature = useMutation({
    mutationFn: (s: string) =>
      api
        .post(`marketplace/config/${s}/test-signature`)
        .then((res) => unwrap<MarketplaceTestResult & { signed?: boolean; applied?: boolean | null }>(res.data)),
  });

  /**
   * SOTUVCHI REESTRINI QO'LDA SINXRONLASH.
   *
   * Avtomatik sinxron kechasi 04:00 da ishlaydi — yangi sozlangan
   * integratsiyada ertaga tonggacha har skanda «Sotuvchi reestrda yo'q»
   * ogohlantirishi chiqib turardi. Javobda faqat SANOQ bor.
   */
  const syncSellers = useMutation({
    mutationFn: (s: string) =>
      api
        .post(`marketplace/config/${s}/sync-sellers`)
        .then((res) => unwrap<{ synced: number }>(res.data)),
  });

  const setTariff = useMutation({
    mutationFn: (params: {
      slug: string;
      tariff_center: number;
      tariff_home: number;
      note?: string;
    }) =>
      api
        .post(`marketplace/config/${params.slug}/tariff`, {
          tariff_center: params.tariff_center,
          tariff_home: params.tariff_home,
          note: params.note,
        })
        .then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [MP_TARIFF_KEY, slug] });
      invalidate();
    },
  });

  const rotateSigning = useMutation({
    mutationFn: (s: string) =>
      api
        .post(`marketplace/config/${s}/secret/signing/rotate`)
        .then((res) => unwrap<MarketplaceRotateResult>(res.data)),
    onSuccess: invalidate,
  });

  const clearPreviousSigning = useMutation({
    mutationFn: (s: string) =>
      api
        .post(`marketplace/config/${s}/secret/signing/clear-previous`)
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  const rotateInbound = useMutation({
    mutationFn: (s: string) =>
      api
        .post(`marketplace/config/${s}/secret/inbound/rotate`)
        .then((res) => unwrap<MarketplaceRotateResult>(res.data)),
    onSuccess: invalidate,
  });

  return {
    list,
    detail,
    tariffHistory,
    statusMap,
    setStatusMap,
    create,
    update,
    setActive,
    testConnection,
    testSignature,
    syncSellers,
    setTariff,
    rotateSigning,
    clearPreviousSigning,
    rotateInbound,
  };
};

/** Checklist kalitlarining o'zbekcha nomlari — xato xabarlarida ishlatiladi. */
export const MARKETPLACE_CHECKLIST_LABELS: Record<
  keyof MarketplaceChecklist,
  string
> = {
  api_base_url: "API manzili",
  api_key: "Ularning API kaliti",
  signing_secret: "Imzo sekreti",
  inbound_api_key: "Kiruvchi API kalit",
  tariff: "Tarif",
  market: "Biriktirilgan market",
  // ⚠️ Nom `SECRET_ENC_KEY` ga o'zgargan; `MARKETPLACE_SECRET_KEY` hamon
  // zaxira sifatida o'qiladi, lekin yorliqda yangi nom turishi kerak —
  // aks holda devops `.env` ga eskirgan nomni qo'yadi.
  encryption: "Sekret shifrlash kaliti (serverda .env: SECRET_ENC_KEY)",
};
