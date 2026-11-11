import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const CARRIER_ACCOUNTS_KEY = "carrier-accounts";
const CARRIER_ACTIVITY_KEY = "carrier-account-activity";
const CARRIER_COURIERS_KEY = "carrier-courier-candidates";

/**
 * Carrier kuryerining `users.external_provider` qiymati — server
 * `CARRIER_EXTERNAL_PROVIDER` bilan BIR XIL bo'lishi shart.
 */
export const CARRIER_PROVIDER = "carrier";

/** Server `IP_ALLOWLIST_MAX_ENTRIES` va DTO `@MaxLength(64)` bilan bir xil. */
export const CARRIER_IP_ALLOWLIST_MAX = 50;
export const CARRIER_IP_ENTRY_MAX_LENGTH = 64;
export const CARRIER_NAME_MAX_LENGTH = 200;

/**
 * Admin javobidagi XAVFSIZ ko'rinish (`CarrierAccountView`).
 *
 * Kalit ham, uning xeshi ham bu yerda YO'Q — faqat `api_key_masked`
 * (`bpc_…a1b2`). Ochiq kalit faqat yaratish va kalitni yangilash javobida,
 * bir marta keladi (`CarrierKeyResult`).
 */
export interface CarrierAccount {
  id: string;
  name: string;
  courier_user_id: string;
  courier: {
    id: string;
    name: string;
    phone_number: string;
    /**
     * `active` | `inactive`. ⚠️ Faqat shu: server kuryer o'chirilgan yoki
     * boshqa provayderga (Elchi/LDG vakili) o'tkazilgan bo'lsa ham uni shu
     * yerda beradi va bu farqni ko'rsatmaydi (`external_provider`,
     * `is_deleted` yo'q) — bunday akkaunt «faol» ko'rinadi, kompaniya esa
     * 403 «Bog'langan kuryer faol emas» oladi. Server maydonni bermaguncha
     * frontend buni bila olmaydi.
     */
    status: string;
  } | null;
  api_key_masked: string;
  /** `null` — cheklov yo'q. Server kanonik shaklda saqlaydi. */
  ip_allowlist: string[] | null;
  is_active: boolean;
  /** `null` — kompaniya hali birorta muvaffaqiyatli so'rov yubormagan. */
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * ⚠️ OCHIQ KALIT. Bu obyekt react-query keshiga, localStorage'ga yoki
 * boshqa doimiy joyga TUSHMASLIGI kerak: uni olgan komponent kalitni
 * o'z holatiga oladi va mutatsiyani darhol `reset()` qiladi
 * (`gcTime: 0` bilan mutatsiya keshdan ham o'chadi).
 */
export interface CarrierKeyResult {
  account: CarrierAccount;
  api_key: string;
}

export interface CreateCarrierAccountDto {
  name: string;
  courier_id: string;
  /** Berilmasa — cheklov yo'q. */
  ip_allowlist?: string[];
}

export interface UpdateCarrierAccountDto {
  name?: string;
  /** Bo'sh massiv — IP cheklovi olib tashlanadi. */
  ip_allowlist?: string[];
}

export interface CarrierDeleteResult {
  id: string;
  deleted: true;
  /** `false` — kuryer provayderi orada boshqasiga o'zgartirilgan, unga tegilmadi. */
  courier_released: boolean;
}

/** `activity_logs` qatori (`entity_type = 'CarrierAccount'`). */
export interface CarrierActivityLog {
  id: string;
  action: string;
  description: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  user_name: string | null;
  user_role: string | null;
  created_at: number;
}

export interface CarrierActivityPage {
  logs: CarrierActivityLog[];
  total: number;
  page: number;
  limit: number;
}

/** Javob qobig'ini himoyalangan ochish (`{data}` bo'lishi ham, bo'lmasligi ham mumkin). */
const unwrap = <T>(raw: unknown): T =>
  ((raw as { data?: T })?.data ?? raw) as T;

/** Akkaunt tarixi — bitta sahifa yetadi (akkaunt boshiga bir necha o'nlab yozuv). */
export const CARRIER_ACTIVITY_LIMIT = 50;

/**
 * Ro'yxatni qayta so'rash oralig'i. Server `last_used_at` ni daqiqasiga ko'pi
 * bilan bir marta yozadi — tez-tez so'rashning ma'nosi yo'q. Kompaniya
 * ulanayotganda admin «Oxirgi so'rov» ni sahifani yangilamay ko'radi.
 */
export const CARRIER_LIST_REFETCH_MS = 60_000;

/**
 * Har mutatsiyadan keyin — MUVAFFAQIYATDA HAM, XATODA HAM — ro'yxat va
 * tarix qayta so'raladi (`onSettled`). Javob yo'qolgan bo'lsa ham (proxy 502,
 * timeout — server esa allaqachon yozgan) yoki boshqa admin akkauntni
 * o'zgartirgan bo'lsa (404), niqoblangan kalit va holat eskirib qolmaydi.
 * Invalidatsiya keshga javobni YOZMAYDI — kalit keshga tushmaydi.
 */
const useInvalidateCarrier = () => {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: [CARRIER_ACCOUNTS_KEY] });
    client.invalidateQueries({ queryKey: [CARRIER_ACTIVITY_KEY] });
  };
};

/**
 * Tahrirlash, holat va o'chirish muvaffaqiyatida ro'yxat keshi DARHOL
 * yangilanadi — invalidatsiyadagi GET ni kutmasdan (u fonda ketaveradi).
 *
 * ⚠️ Aks holda toast chiqib, oyna yopiladi, ekranda esa GET kelguncha (sekin
 * tarmoqda soniyalab, GET yiqilsa — umuman) ESKI akkaunt turadi: olib
 * tashlangan IP ro'yxatda qoladi, qayta ochilgan «O'zgartirish» uni formaga
 * qaytaradi va keyingi saqlash bekor qilingan IP'ni yana ruxsat etardi.
 *
 * Faqat KALITSIZ javob yoziladi (`CarrierAccountView` — PATCH va status).
 * Yaratish va kalitni yangilash javobi (ochiq kalit bor) keshga HECH QACHON
 * yozilmaydi — ular faqat invalidatsiya bilan.
 */
const useCarrierListCache = () => {
  const client = useQueryClient();
  const edit = (fn: (list: CarrierAccount[]) => CarrierAccount[]) =>
    client.setQueryData<CarrierAccount[]>([CARRIER_ACCOUNTS_KEY], (list) =>
      list ? fn(list) : list,
    );
  return {
    put: (view: CarrierAccount) =>
      edit((list) => list.map((a) => (a.id === view?.id ? view : a))),
    drop: (id: string) => edit((list) => list.filter((a) => a.id !== id)),
  };
};

/**
 * CARRIER AKKAUNTLARI — `GET /api/v1/carrier-accounts` (SUPERADMIN, ADMIN).
 *
 * `staleTime: 0` — panel har ochilganda yangidan so'raydi. Ilova QueryClient'i
 * (`app/provider.tsx`) 2 daqiqa kutadi: Foydalanuvchilar'da carrier kuryerini
 * bloklab qaytgan admin aks holda «Faol» / «Kuryer bloklanmagan» ni 60 s
 * so'rovigacha ko'rardi.
 */
export const useCarrierAccountList = () =>
  useQuery({
    queryKey: [CARRIER_ACCOUNTS_KEY],
    queryFn: () =>
      api
        .get("carrier-accounts")
        .then((res) => unwrap<CarrierAccount[]>(res.data) ?? []),
    staleTime: 0,
    refetchInterval: CARRIER_LIST_REFETCH_MS,
    refetchOnWindowFocus: true,
  });

/**
 * Yangi akkaunt uchun kuryer tanlovi — `GET /user/couriers` (faol kuryerlar,
 * `cashbox` bilan). `enabled` — oyna ochiq.
 *
 * ⚠️ Har ochilishda YANGIDAN (`staleTime: 0`, alohida kalit). Umumiy
 * `["courier", undefined]` keshi (Elchi/LDG vakil tanlovi ham) ilovada
 * 2 daqiqa «yangi» hisoblanadi va hech qayerda invalidatsiya qilinmaydi —
 * Foydalanuvchilar'da kuryer yaratish faqat `["user"]` ni yangilaydi.
 * Ulanish tartibi esa «avval kuryer oching, keyin akkaunt yarating»:
 * hozirgina ochilgan kuryer ro'yxatda ko'rinmas, kassasi yopilgan kuryer
 * «Kassasi 0 emas» bo'lib qolardi.
 */
export const useCarrierCourierCandidates = (enabled: boolean) =>
  useQuery({
    queryKey: [CARRIER_COURIERS_KEY],
    queryFn: () => api.get("user/couriers").then((res): unknown => res.data),
    enabled,
    staleTime: 0,
  });

/**
 * ⚠️ Kalit beradi: `gcTime: 0` — chaqiruvchi `reset()` qilgach mutatsiya
 * keshida ham kalit qolmaydi.
 */
export const useCreateCarrierAccount = () => {
  const invalidate = useInvalidateCarrier();
  return useMutation({
    mutationFn: (dto: CreateCarrierAccountDto) =>
      api
        .post("carrier-accounts", dto)
        .then((res) => unwrap<CarrierKeyResult>(res.data)),
    gcTime: 0,
    onSettled: () => invalidate(),
  });
};

export const useUpdateCarrierAccount = () => {
  const invalidate = useInvalidateCarrier();
  const cache = useCarrierListCache();
  return useMutation({
    mutationFn: (params: { id: string; dto: UpdateCarrierAccountDto }) =>
      api
        .patch(`carrier-accounts/${params.id}`, params.dto)
        .then((res) => unwrap<CarrierAccount>(res.data)),
    onSuccess: (view) => cache.put(view),
    onSettled: () => invalidate(),
  });
};

/**
 * Eski kalit DARHOL ishlamay qoladi; yangisi faqat shu javobda.
 * ⚠️ Kalit beradi: `gcTime: 0` (yuqoridagi kabi).
 */
export const useRotateCarrierKey = () => {
  const invalidate = useInvalidateCarrier();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .post(`carrier-accounts/${id}/rotate-key`)
        .then((res) => unwrap<CarrierKeyResult>(res.data)),
    gcTime: 0,
    onSettled: () => invalidate(),
  });
};

/** Kill switch: `false` — kompaniyaning barcha `/carrier/*` so'rovlari 403. */
export const useSetCarrierStatus = () => {
  const invalidate = useInvalidateCarrier();
  const cache = useCarrierListCache();
  return useMutation({
    mutationFn: (params: { id: string; is_active: boolean }) =>
      api
        .post(`carrier-accounts/${params.id}/status`, {
          is_active: params.is_active,
        })
        .then((res) => unwrap<CarrierAccount>(res.data)),
    onSuccess: (view) => cache.put(view),
    onSettled: () => invalidate(),
  });
};

/** Yumshoq o'chirish: kalit ishlamaydi, kuryer provayderdan bo'shatiladi. */
export const useRemoveCarrierAccount = () => {
  const invalidate = useInvalidateCarrier();
  const cache = useCarrierListCache();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .delete(`carrier-accounts/${id}`)
        .then((res) => unwrap<CarrierDeleteResult>(res.data)),
    onSuccess: (_res, id) => cache.drop(id),
    onSettled: () => invalidate(),
  });
};

/**
 * CARRIER AKKAUNTLARI — `/api/v1/carrier-accounts` (SUPERADMIN, ADMIN),
 * hammasi bir joyda. Komponentlar faqat keraklisini (yuqoridagi alohida
 * hooklar) chaqiradi — har chaqiruv o'z kuzatuvchisini yaratadi.
 *
 * Kalit beradigan javob (yaratish, kalitni yangilash) ro'yxat keshiga
 * YOZILMAYDI — faqat invalidatsiya. Tahrirlash va holat javobi (kalitsiz
 * ko'rinish) keshga darhol yoziladi, o'chirilgan akkaunt olib tashlanadi
 * (`useCarrierListCache`).
 */
export const useCarrierAccounts = () => ({
  list: useCarrierAccountList(),
  create: useCreateCarrierAccount(),
  update: useUpdateCarrierAccount(),
  rotateKey: useRotateCarrierKey(),
  setStatus: useSetCarrierStatus(),
  remove: useRemoveCarrierAccount(),
});

/**
 * Akkaunt tarixi — umumiy tizim jurnalidan (`GET /activity-log/:type/:id`).
 * Backend `CarrierAccount` uchun alohida endpoint bermaydi; bu o'sha
 * "Tizim jurnallari" sahifasi ishlatadigan endpoint.
 */
export const useCarrierAccountActivity = (id: string | null | undefined) =>
  useQuery({
    queryKey: [CARRIER_ACTIVITY_KEY, id],
    queryFn: () =>
      api
        .get(`activity-log/CarrierAccount/${id}`, {
          params: { page: 1, limit: CARRIER_ACTIVITY_LIMIT },
        })
        .then((res) => unwrap<CarrierActivityPage>(res.data)),
    enabled: Boolean(id),
  });
