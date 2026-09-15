import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const ELCHI_CONFIG_KEY = "elchi-config";
const ELCHI_READINESS_KEY = "elchi-readiness";
const ELCHI_DISTRICTS_KEY = "elchi-districts";
const ELCHI_REMOTE_DISTRICTS_KEY = "elchi-remote-districts";
const ELCHI_REGIONS_KEY = "elchi-regions";

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

/**
 * VILOYAT darajasidagi darvoza manzarasi.
 *
 * `total` — viloyatdagi JAMI tuman, `mapped` — Elchi bilan moslangani,
 * `enabled` — darvozasi ochig'i.
 *
 * ⚠️ `fully_open` `enabled === total` bo'lgandagina `true`. Moslanmagan
 * tumanni ochib bo'lmaydi, lekin u ham pochtani to'sadi — shuning uchun
 * solishtiruv `mapped` bilan EMAS, `total` bilan.
 */
export interface ElchiRegionGateRow {
  region_id: string;
  region_name: string;
  total: number;
  mapped: number;
  enabled: number;
  fully_open: boolean;
  unmapped_names: string[];
}

export interface ElchiRegionGateResult {
  region_id: string;
  region_name: string;
  total: number;
  mapped: number;
  changed: number;
  enabled_after: number;
  unmapped_names: string[];
  fully_open: boolean;
}

/** Javob qobig'ini himoyalangan ochish (`{data}` bo'lishi ham, bo'lmasligi ham mumkin). */
const unwrap = <T>(raw: unknown): T =>
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

  /** Viloyatlar kesimidagi darvoza holati (moslanmagan tumanlar bilan). */
  const regions = useQuery({
    queryKey: [ELCHI_REGIONS_KEY],
    queryFn: () =>
      api
        .get("elchi/regions")
        .then((res) => unwrap<ElchiRegionGateRow[]>(res.data) ?? []),
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

  /**
   * BUTUN VILOYAT darvozasi. Elchi BeePost uchun "super kuryer" — operator
   * viloyat pochtasini butunligicha jo'nata olishi kerak, 16 ta tumanni
   * bittalab yoqib chiqmasdan.
   */
  const setRegionGate = useMutation({
    mutationFn: (params: { regionId: string; is_enabled: boolean }) =>
      api
        .patch(`elchi/regions/${params.regionId}/gate`, {
          is_enabled: params.is_enabled,
        })
        .then((res) => unwrap<ElchiRegionGateResult>(res.data)),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [ELCHI_REGIONS_KEY] });
      client.invalidateQueries({ queryKey: [ELCHI_DISTRICTS_KEY] });
      invalidateAll();
    },
  });

  /**
   * TUMANNI QO'LDA MOSLASH.
   *
   * ⚠️ NEGA KERAK. Avtomatik moslash SOATO kodi bo'yicha ishlaydi, lekin
   * Elchi tomonda haqiqiy SOATO bo'lmasa (o'rinbosar kod ishlatilgan bo'lsa)
   * moslash topilmaydi va o'sha tumandagi buyurtmalar jo'natilmaydi.
   * Backend endpointi bor edi, LEKIN frontend undan foydalanmaydi — ya'ni
   * operator bu holatni UI dan tuzata olmasdi va har safar dasturchi kerak
   * bo'lardi (auditda topildi).
   *
   * ⚠️ DARVOZAGA TEGMAYDI — moslash va ruxsat IKKI xil narsa. Moslangan
   * tuman avtomatik ochilib ketmaydi.
   */
  /**
   * ELCHI TOMONIDAGI tumanlar — qo'lda moslash oynasi uchun.
   *
   * `enabled: false` bilan boshlanadi: bu Elchi API'siga tashqi so'rov, va
   * u faqat operator moslash oynasini OCHGANDA kerak. Har sozlama sahifasi
   * ochilishida so'rov yuborish keraksiz yuk bo'lardi.
   */
  const remoteDistricts = useQuery({
    queryKey: [ELCHI_REMOTE_DISTRICTS_KEY],
    queryFn: () =>
      api.get("elchi/remote-districts").then((res) =>
        unwrap<
          Array<{
            id: string;
            name: string;
            region_id: string;
            sato_code: string | null;
          }>
        >(res.data),
      ),
    enabled: false,
  });

  const setDistrictMapping = useMutation({
    mutationFn: (params: {
      districtId: string;
      elchi_district_id: string;
      elchi_region_id?: string | null;
    }) =>
      api
        .patch(`elchi/districts/${params.districtId}/mapping`, {
          elchi_district_id: params.elchi_district_id,
          elchi_region_id: params.elchi_region_id ?? null,
        })
        .then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [ELCHI_DISTRICTS_KEY] });
      invalidateAll();
    },
  });

  /**
   * ELCHI'DA BEEPOST MARKET AKKAUNTINI OCHISH.
   *
   * Busiz posilka yaratib bo'lmaydi — `elchi_market_id` qattiq darvoza.
   * Idempotent: qayta bosilsa mavjudini qaytaradi. Tarif VAKIL-KURYERDAN
   * olinadi, ya'ni ikki tomonda teng bo'ladi (M4).
   */
  const provisionMarket = useMutation({
    mutationFn: () =>
      api.post("elchi/config/provision-market").then((res) => res.data),
    onSuccess: invalidateAll,
  });

  const reconcileAll = useMutation({
    mutationFn: () => api.post("elchi/reconcile").then((res) => res.data),
  });

  return {
    config,
    readiness,
    districts,
    regions,
    updateConfig,
    testConnection,
    bindCourier,
    syncDistricts,
    setDistrictGate,
    setRegionGate,
    setDistrictMapping,
    provisionMarket,
    remoteDistricts,
    reconcileAll,
  };
};
