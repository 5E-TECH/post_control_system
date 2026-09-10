import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const ELCHI_CONFIG_KEY = "elchi-config";
const ELCHI_READINESS_KEY = "elchi-readiness";
const ELCHI_DISTRICTS_KEY = "elchi-districts";

/**
 * Elchi sozlamalarining XAVFSIZ ko'rinishi.
 *
 * Maxfiy maydonlar (`api_key`, `webhook_secret`) hech qachon qaytarilmaydi —
 * ularning o'rniga `*_set` bayroqlari keladi. Ya'ni UI "kiritilgan / yo'q"
 * ko'rsata oladi, lekin qiymatni ko'rsata olmaydi.
 */
export interface ElchiConfigSafe {
  id: string;
  is_active: boolean;
  webhook_enabled: boolean;
  reconcile_enabled: boolean;
  api_base_url: string | null;
  elchi_market_id: string | null;
  elchi_courier_user_id: string | null;
  last_ping_at: number | null;
  last_reconcile_at: number | null;
  api_key_set: boolean;
  webhook_secret_set: boolean;
  webhook_secret_previous_set: boolean;
  created_at: number;
  updated_at: number;
}

export interface UpdateElchiConfigDto {
  is_active?: boolean;
  webhook_enabled?: boolean;
  reconcile_enabled?: boolean;
  api_base_url?: string;
  api_key?: string;
  webhook_secret?: string;
  webhook_secret_previous?: string;
  elchi_market_id?: string;
}

export interface ElchiReadinessCheck {
  key: string;
  ok: boolean;
  detail: string;
}

export interface ElchiReadiness {
  ready: boolean;
  checks: ElchiReadinessCheck[];
}

export interface ElchiDistrictMapRow {
  id: string;
  district_id: string;
  elchi_district_id: string | null;
  elchi_region_id: string | null;
  sato_code: string | null;
  matched_automatically: boolean;
  /** DARVOZA — faqat `true` bo'lgan tumanlar Elchi'ga jo'natiladi. */
  is_enabled: boolean;
  district?: { id: string; name: string } | null;
}

/** Javob qobig'ini himoyalangan ochish (`{data}` bo'lishi ham, bo'lmasligi ham mumkin). */
const unwrap = <T,>(raw: unknown): T =>
  ((raw as { data?: T })?.data ?? raw) as T;

export const useElchiConfig = () => {
  const client = useQueryClient();

  const invalidateAll = () => {
    client.invalidateQueries({ queryKey: [ELCHI_CONFIG_KEY] });
    client.invalidateQueries({ queryKey: [ELCHI_READINESS_KEY] });
  };

  const config = useQuery({
    queryKey: [ELCHI_CONFIG_KEY],
    queryFn: () =>
      api.get("elchi/config").then((res) => unwrap<ElchiConfigSafe>(res.data)),
  });

  /**
   * Tayyorlik checklisti.
   *
   * ⚠️ Bu TASHQI so'rov qiladi (ping + tarif solishtiruvi) — sekin va Elchi
   * tarafiga yuk. Shu bois avtomatik yangilanmaydi: `staleTime` uzun va
   * `refetchOnWindowFocus` o'chirilgan. Operator "Tekshirish" tugmasi bilan
   * o'zi yangilaydi.
   */
  const readiness = useQuery({
    queryKey: [ELCHI_READINESS_KEY],
    queryFn: () =>
      api
        .get("elchi/readiness")
        .then((res) => unwrap<ElchiReadiness>(res.data)),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const districts = useQuery({
    queryKey: [ELCHI_DISTRICTS_KEY],
    queryFn: () =>
      api
        .get("elchi/districts")
        .then((res) => unwrap<ElchiDistrictMapRow[]>(res.data) ?? []),
  });

  const updateConfig = useMutation({
    mutationFn: (data: UpdateElchiConfigDto) =>
      api.patch("elchi/config", data).then((res) => res.data),
    onSuccess: invalidateAll,
  });

  const testConnection = useMutation({
    mutationFn: () => api.post("elchi/config/test").then((res) => res.data),
    onSuccess: invalidateAll,
  });

  const bindCourier = useMutation({
    mutationFn: (userId: string) =>
      api
        .post("elchi/config/bind-courier", { user_id: userId })
        .then((res) => res.data),
    onSuccess: invalidateAll,
  });

  /**
   * Tumanlarni SOATO bo'yicha moslash.
   *
   * ⚠️ DARVOZANI OCHMAYDI — moslash texnik amal, ruxsat esa ataylab qilinadigan
   * qaror. Server ham shu invariantni saqlaydi.
   */
  const syncDistricts = useMutation({
    mutationFn: () => api.post("elchi/districts/sync").then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [ELCHI_DISTRICTS_KEY] });
      invalidateAll();
    },
  });

  const setDistrictGate = useMutation({
    mutationFn: (params: { districtId: string; is_enabled: boolean }) =>
      api
        .patch(`elchi/districts/${params.districtId}/gate`, {
          is_enabled: params.is_enabled,
        })
        .then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [ELCHI_DISTRICTS_KEY] });
      invalidateAll();
    },
  });

  const reconcileAll = useMutation({
    mutationFn: () => api.post("elchi/reconcile").then((res) => res.data),
  });

  return {
    config,
    readiness,
    districts,
    updateConfig,
    testConnection,
    bindCourier,
    syncDistricts,
    setDistrictGate,
    reconcileAll,
  };
};
