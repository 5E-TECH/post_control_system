import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const MP_SESSION_KEY = "marketplace-scan-session";
const MP_AVAILABLE_KEY = "marketplace-available";

const unwrap = <T,>(raw: unknown): T =>
  ((raw as { data?: T })?.data ?? raw) as T;

/** Rad etish sabablari — backend `MarketplaceRejectReason` bilan BIR XIL. */
export const MARKETPLACE_REJECT_REASONS = [
  { value: "DAMAGED", label: "Buzilgan / shikastlangan" },
  { value: "NOT_OURS", label: "Bizniki emas" },
  { value: "OUT_OF_COVERAGE", label: "Hududimiz emas" },
  { value: "MISSING_DATA", label: "Ma'lumot yetishmaydi" },
  { value: "DUPLICATE", label: "Takroriy" },
  { value: "OTHER", label: "Boshqa sabab" },
] as const;

export type MarketplaceRejectReason =
  (typeof MARKETPLACE_REJECT_REASONS)[number]["value"];

/**
 * Bitta skanning natijasi.
 *
 * ⚠️ `blockers` va `warnings` FARQLI: bloker bo'lsa posilka qabulda
 * yiqiladi (masalan tuman topilmagan), ogohlantirish esa faqat belgi
 * (masalan sotuvchi reestrda yo'q) — qabulga to'sqinlik qilmaydi.
 */
export interface MarketplaceScanOutcome {
  parcel_id: string;
  external_parcel_id: string;
  external_order_id: string;
  qr_token: string;
  seller_id: string | null;
  seller_name: string | null;
  customer_name: string;
  phone: string;
  district_name: string | null;
  address: string | null;
  cod_amount: number;
  prepaid: boolean;
  parcel_index: number;
  parcel_count: number;
  where_deliver: "center" | "address";
  blockers: string[];
  warnings: string[];
  duplicate_in_session: boolean;
}

export interface MarketplaceScanSession {
  id: string;
  integration_id: string;
  operator_id: string;
  status: "open" | "accepted" | "cancelled";
  scanned_count: number;
  created_at: number;
}

/** Bazadagi posilka qatori — sahifa yangilanganda sessiyani tiklash uchun. */
export interface MarketplaceParcelRow {
  id: string;
  external_parcel_id: string;
  external_order_id: string;
  qr_token_raw: string;
  seller_id: string | null;
  cod_amount: number;
  prepaid: boolean;
  parcel_index: number;
  parcel_count: number;
  scan_state: string;
  reject_reason: string | null;
  reject_note: string | null;
  scanned_at: number | null;
  raw_payload: Record<string, unknown> | null;
  /**
   * SOATO kodidan aniqlangan tuman — MARSHRUTLASH shu bo'yicha ketadi.
   * `raw_payload.customer.address` (hamkorning erkin matni) bilan mos
   * kelmasligi mumkin, shuning uchun ekranda ikkalasi ALOHIDA ko'rsatiladi.
   */
  district_name: string | null;
}

export interface MarketplaceAcceptResult {
  batch_id: string;
  accepted: Array<{
    external_parcel_id: string;
    order_id: string;
    order_number: number;
  }>;
  rejected: string[];
  failed: Array<{ external_parcel_id: string; reason: string }>;
  confirmed_remotely: boolean;
}

/** Operator ko'radigan minimal ko'rinish — sozlama emas. */
export interface MarketplaceAvailableRow {
  id: string;
  name: string;
  slug: string;
  /** Biriktirilgan market nomi — skan ekrani sarlavhasida ko'rinadi. */
  market_name: string | null;
}

/**
 * Skan qilish mumkin bo'lgan marketplace'lar.
 *
 * ⚠️ `marketplace/config` EMAS — u faqat admin uchun va registrator uni
 * chaqirsa 403 oladi, ya'ni skan ekrani registratorda umuman ishlamasdi.
 * Bu endpoint uchala rolga ochiq va faqat nom/slug qaytaradi.
 */
export const useMarketplaceAvailable = () =>
  useQuery({
    queryKey: [MP_AVAILABLE_KEY],
    staleTime: 60_000,
    queryFn: () =>
      api
        .get("marketplace/available")
        .then((res) => unwrap<MarketplaceAvailableRow[]>(res.data) ?? []),
  });

export const useMarketplaceScan = (slug?: string, sessionId?: string) => {
  const client = useQueryClient();

  const invalidateSession = () => {
    if (sessionId)
      client.invalidateQueries({ queryKey: [MP_SESSION_KEY, sessionId] });
  };

  /**
   * Sessiyani tiklash.
   *
   * ⚠️ Skan natijalari SERVERDA saqlanadi, brauzerda emas. Sahifa
   * yangilansa yoki planshet o'chib qolsa, operator o'nlab posilkani
   * qaytadan skanerlamaydi.
   */
  const session = useQuery({
    queryKey: [MP_SESSION_KEY, sessionId],
    enabled: !!sessionId,
    refetchOnWindowFocus: false,
    queryFn: () =>
      api.get(`marketplace/scan-session/${sessionId}`).then((res) =>
        unwrap<{
          session: MarketplaceScanSession;
          parcels: MarketplaceParcelRow[];
        }>(res.data),
      ),
  });

  const openSession = useMutation({
    mutationFn: (s: string) =>
      api
        .post(`marketplace/${s}/scan-session`)
        .then((res) => unwrap<MarketplaceScanSession>(res.data)),
  });

  const scan = useMutation({
    mutationFn: (params: { session_id: string; qr_token: string }) =>
      api
        .post(`marketplace/${slug}/scan`, params)
        .then((res) => unwrap<MarketplaceScanOutcome>(res.data)),
    onSuccess: invalidateSession,
  });

  const undoLast = useMutation({
    mutationFn: (sid: string) =>
      api
        .post(`marketplace/scan-session/${sid}/undo`)
        .then((res) => unwrap<{ removed: string }>(res.data)),
    onSuccess: invalidateSession,
  });

  const reject = useMutation({
    mutationFn: (params: {
      session_id: string;
      parcel_id: string;
      reason: MarketplaceRejectReason;
      note?: string;
    }) =>
      api
        .post(`marketplace/scan-session/${params.session_id}/reject`, {
          parcel_id: params.parcel_id,
          reason: params.reason,
          note: params.note,
        })
        .then((res) => res.data),
    onSuccess: invalidateSession,
  });

  /**
   * ⚠️ `idempotency_key` ni CHAQIRUVCHI beradi va qayta urinishda
   * O'ZGARTIRMAYDI. Yangi kalit = ikkinchi qop = ikki marta buyurtma.
   */
  const accept = useMutation({
    mutationFn: (params: { session_id: string; idempotency_key: string }) =>
      api
        .post(`marketplace/${slug}/accept`, params)
        .then((res) => unwrap<MarketplaceAcceptResult>(res.data)),
    onSuccess: invalidateSession,
  });

  return { session, openSession, scan, undoLast, reject, accept };
};
