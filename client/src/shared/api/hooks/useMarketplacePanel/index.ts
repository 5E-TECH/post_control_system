import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const MP_SUGGEST_KEY = "marketplace-settlement-suggest";
const MP_MISMATCH_KEY = "marketplace-mismatches";

const unwrap = <T,>(raw: unknown): T =>
  ((raw as { data?: T })?.data ?? raw) as T;

export const MARKETPLACE_SETTLEMENT_METHODS = [
  { value: "bank_transfer", label: "Bank o'tkazmasi" },
  { value: "cash", label: "Naqd" },
  { value: "card", label: "Karta" },
] as const;

export type MarketplaceSettlementMethod =
  (typeof MARKETPLACE_SETTLEMENT_METHODS)[number]["value"];


export interface MarketplaceInvariantView {
  ok: boolean;
  ledger_sum: number;
  cashbox_balance: number;
  diff: number;
}

/**
 * Hisob-kitob ko'rinishi.
 *
 * ⚠️ SOTUVCHILAR RO'YXATI YO'Q — ataylab. Biz marketplace'ning
 * sotuvchilarini bilmaymiz va ular bizga faqat ID yuborishi mumkin
 * (`SLR-77`). Bunday qatorni adminga ko'rsatish foydasiz shovqin: u
 * ID kimligini bilmaydi va unga qarab qaror qabul qila olmaydi.
 *
 * `seller_id` BACKENDDA qoladi — har posilka hodisasida va kunlik
 * snapshotda marketplace'ga boradi, ular o'zi taqsimlaydi.
 */
export interface MarketplaceSettlementSuggest {
  integration: { slug: string; name: string };
  /** Ularga qancha qarzdormiz — MARKET KASSASI balansi. */
  total_payable: number;
  invariant: MarketplaceInvariantView;
}

/** Solishtiruv belgilagan posilka — hal qilinmagan nomuvofiqlik. */
export interface MarketplaceMismatchRow {
  id: string;
  external_parcel_id: string;
  external_order_id: string;
  seller_id: string | null;
  cod_amount: number;
  scan_state: string;
  remote_status: string | null;
  last_sent_seq: number;
  mismatch_at: number | null;
  mismatch_reason: string | null;
  order_id: string | null;
}

export interface MarketplaceReconcileResult {
  parcels: { checked: number; mismatches: number; requeued: number };
  ledger: {
    invariant: MarketplaceInvariantView;
    remote_balance: number | null;
    diff: number | null;
    sellers: unknown[];
  };
}

export const useMarketplacePanel = (slug?: string) => {
  const client = useQueryClient();

  const invalidate = () => {
    client.invalidateQueries({ queryKey: [MP_SUGGEST_KEY, slug] });
    client.invalidateQueries({ queryKey: [MP_MISMATCH_KEY, slug] });
  };

  /**
   * To'lov taklifi.
   *
   * ⚠️ Kassani va butun daftarni jamlaydi — arzon emas. Avtomatik
   * yangilanmaydi; admin «Yangilash» bilan o'zi chaqiradi.
   */
  const suggest = useQuery({
    queryKey: [MP_SUGGEST_KEY, slug],
    enabled: !!slug,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: () =>
      api
        .get(`marketplace/${slug}/settlement/suggest`)
        .then((res) => unwrap<MarketplaceSettlementSuggest>(res.data)),
  });

  const mismatches = useQuery({
    queryKey: [MP_MISMATCH_KEY, slug],
    enabled: !!slug,
    refetchOnWindowFocus: false,
    queryFn: () =>
      api
        .get(`marketplace/${slug}/mismatches`)
        .then((res) => unwrap<MarketplaceMismatchRow[]>(res.data) ?? []),
  });

  /**
   * ⚠️ `allocation` yig'indisi `amount` ga TENG bo'lishi shart — server
   * rad etadi. Marketplace sotuvchilarga shu ro'yxat bo'yicha to'laydi;
   * mos kelmasa farq hech qayerda ko'rinmaydi.
   */
  /**
   * ⚠️ YAXLIT TO'LOV — taqsimot YO'Q.
   *
   * Marketplace pulni oladi va o'z sotuvchilariga O'ZI tarqatadi.
   * Kim qancha ishlab topgani ularga posilka hodisalaridagi `seller_id`
   * orqali allaqachon ma'lum.
   */
  const pay = useMutation({
    mutationFn: (params: {
      slug: string;
      amount: number;
      method: MarketplaceSettlementMethod;
      reference?: string;
      note?: string;
    }) => {
      const { slug: s, ...body } = params;
      return api
        .post(`marketplace/${s}/settlement`, body)
        .then((res) =>
          unwrap<{
            settlement_id: string;
            amount: number;
            balance_after: number;
          }>(res.data),
        );
    },
    onSuccess: invalidate,
  });

  const clearMismatch = useMutation({
    // ⚠️ Yo'lda `slug` bor: server posilka SHU ulanishga tegishliligini
    // tekshiradi (boshqa marketplace'ning belgisini o'chirib bo'lmaydi).
    mutationFn: (parcelId: string) =>
      api
        .post(`marketplace/${slug}/mismatches/${parcelId}/clear`)
        .then((res) => res.data),
    onSuccess: invalidate,
  });

  /** Solishtiruvni QO'LDA ishga tushirish (CRON 15 daqiqada o'zi ham qiladi). */
  const runReconcile = useMutation({
    mutationFn: (s: string) =>
      api
        .post(`marketplace/${s}/reconcile`)
        .then((res) => unwrap<MarketplaceReconcileResult>(res.data)),
    onSuccess: invalidate,
  });

  return { suggest, mismatches, pay, clearMismatch, runReconcile };
};
