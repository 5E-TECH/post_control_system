import type { TdHTMLAttributes } from "react";
import dayjs from "dayjs";
import { BASE_URL } from "../../../../shared/const";
import type {
  CarrierAccount,
  CarrierActivityLog,
  UpdateCarrierAccountDto,
} from "../../../../shared/api/hooks/useCarrierAccounts";

/**
 * Carrier API paneli uchun SOF yordamchilar (React'siz) — testlanadi.
 */

export const NO_REQUEST_TEXT = "Hali so'rov yo'q";

/** Backend xato kontrakti: `{message, error}` — ikkisi ham STRING. */
export const errText = (e: unknown, fallback: string): string => {
  const msg = (e as { response?: { data?: { message?: unknown } } })?.response
    ?.data?.message;
  if (Array.isArray(msg)) return msg.join(". ");
  return typeof msg === "string" && msg.trim() ? msg : fallback;
};

/**
 * Bog'langan kuryer bloklanganmi.
 *
 * ⚠️ Faqat `courier.status` ni ko'ramiz. Backend o'chirilgan yoki boshqa
 * provayderga (Elchi/LDG vakili) o'tkazilgan kuryerni ham shu javobda
 * BERADI, lekin farqini ko'rsatmaydi (`external_provider`, `is_deleted`
 * yo'q) — bunday akkaunt bu yerda «faol» chiqadi, server guard'i esa
 * kompaniyaga 403 beradi va rotate/qayta yoqishni rad etadi (xabari
 * toast'da chiqadi). Server bu maydonni bermaguncha frontend bila olmaydi.
 */
export const isCourierBlocked = (a: CarrierAccount): boolean =>
  !!a.courier && a.courier.status !== "active";

export type CarrierAccountState = "stopped" | "courier_blocked" | "active";

/** Ro'yxatdagi holat: to'xtatilgan > kuryer bloklangan > faol. */
export const accountState = (a: CarrierAccount): CarrierAccountState => {
  if (!a.is_active) return "stopped";
  if (isCourierBlocked(a)) return "courier_blocked";
  return "active";
};

export const ipRules = (a: Pick<CarrierAccount, "ip_allowlist">): string[] =>
  a.ip_allowlist ?? [];

/** Server kanonik shaklda saqlaydi, shuning uchun shakl bo'yicha ajratish yetadi. */
export const ipKind = (rule: string): "IPv6" | "IPv4 diapazon" | "IPv4" => {
  if (rule.includes(":")) return "IPv6";
  if (rule.includes("/")) return "IPv4 diapazon";
  return "IPv4";
};

/**
 * Textarea → `ip_allowlist`. Har qatorda bitta yozuv; bo'sh qatorlar va
 * chetdagi bo'shliqlar tashlanadi. MA'NO tekshiruvi serverda (400 xabari
 * toast'da aynan chiqadi) — bu yerda ikki xil qoida bo'lib qolmasin.
 */
export const parseIpLines = (text: string | null | undefined): string[] =>
  String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Tahrirlash oynasi → `PATCH` body: faqat O'ZGARGAN maydonlar (server
 * qisman PATCH qiladi). Nom o'zgarmasa IP ro'yxati qayta yozilmaydi va
 * aksincha — orada boshqa admin o'zgartirgan maydon ustidan yozilmaydi.
 * Solishtirish oyna ochilgandagi ko'rinish bilan, tartib muhim (server
 * `sameList` kabi). `null` — hech narsa o'zgarmagan, so'rov kerak emas.
 */
export const editPatch = (
  before: Pick<CarrierAccount, "name" | "ip_allowlist">,
  values: { name: string; ip_allowlist?: string },
): UpdateCarrierAccountDto | null => {
  const dto: UpdateCarrierAccountDto = {};
  const name = values.name.trim();
  if (name !== before.name) dto.name = name;
  const next = parseIpLines(values.ip_allowlist);
  const prev = ipRules(before);
  const same = next.length === prev.length && next.every((ip, i) => ip === prev[i]);
  // Bo'sh massiv — server IP cheklovini olib tashlaydi.
  if (!same) dto.ip_allowlist = next;
  return Object.keys(dto).length ? dto : null;
};

const pad = (ts: number | string) => dayjs(Number(ts));

/** `10.11.2026, 14:32:05` */
export const formatDateTimeSec = (ts: number | string) =>
  pad(ts).format("DD.MM.YYYY, HH:mm:ss");

/** `10.11.2026, 14:32` */
export const formatDateTime = (ts: number | string) =>
  pad(ts).format("DD.MM.YYYY, HH:mm");

/** `10.11.2026` */
export const formatDate = (ts: number | string) => pad(ts).format("DD.MM.YYYY");

/** `14:32` */
export const formatTime = (ts: number | string) => pad(ts).format("HH:mm");

/** «2 daqiqa oldin» — oxirgi so'rov kartasi uchun. */
export const timeAgo = (ts: number | string, now: number = Date.now()) => {
  const diff = Math.max(0, now - Number(ts));
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "hozirgina";
  if (min < 60) return `${min} daqiqa oldin`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} soat oldin`;
  return `${Math.floor(hours / 24)} kun oldin`;
};

/**
 * Kompaniya dasturchisiga beriladigan API manzili — `.../api/v1`.
 * `VITE_BASE_URL` nisbiy (`/api/v1/`) bo'lsa joriy domen bilan to'ldiriladi.
 */
export const carrierApiBase = (
  base: string | undefined = BASE_URL,
  origin: string = window.location.origin,
): string => {
  try {
    return new URL(base || "/api/v1/", `${origin}/`).href.replace(/\/+$/, "");
  } catch {
    return `${origin}/api/v1`;
  }
};

/** `https://x/api/v1` → `/api/v1` (hujjat yo'llarini qisqa ko'rsatish uchun). */
export const apiPath = (apiBase: string): string => {
  try {
    return new URL(apiBase).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/api/v1";
  }
};

// ─────────────────────────── kuryer tanlash ───────────────────────────

/** `GET /user/couriers` qatori — faqat FAOL kuryerlar, `cashbox` bilan. */
export interface CourierListItem {
  id: string;
  name?: string | null;
  phone_number?: string | null;
  cashbox?: {
    balance?: number | string | null;
    balance_cash?: number | string | null;
    balance_card?: number | string | null;
  } | null;
}

export const unwrapCourierList = (raw: unknown): CourierListItem[] => {
  const candidates = [
    (raw as { data?: { data?: unknown } })?.data?.data,
    (raw as { data?: unknown })?.data,
    raw,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c as CourierListItem[];
  return [];
};

const money = (v: number) => v.toLocaleString("ru-RU");

/**
 * Kuryerni tanlab bo'lmasligi sababi — FAQAT frontend biladigan narsalar:
 *   - allaqachon carrier akkauntiga bog'langan (`GET /carrier-accounts`);
 *   - kassasi 0 emas (`GET /user/couriers` dagi `cashbox`).
 * Pochtasi bor, boshqa provayderga bog'langan yoki yaqinda kirilgan
 * kuryerni ro'yxat bilmaydi — server «Yaratish»da rad etadi (toast).
 */
export const courierBlockReason = (
  courier: CourierListItem,
  accounts: Pick<CarrierAccount, "name" | "courier_user_id">[],
): string | null => {
  const bound = accounts.find((a) => a.courier_user_id === courier.id);
  if (bound) return `«${bound.name}» carrier akkauntiga bog'langan`;
  const box = courier.cashbox;
  if (box) {
    const nonZero = [box.balance, box.balance_cash, box.balance_card]
      .map((v) => Number(v ?? 0))
      .find((v) => Number.isFinite(v) && v !== 0);
    if (nonZero !== undefined) return `Kassasi 0 emas: ${money(nonZero)} so'm`;
  }
  return null;
};

export const courierLabel = (c: Pick<CourierListItem, "name" | "phone_number">) =>
  `${c.name || "Nomsiz"} — ${c.phone_number || "telefon yo'q"}`;

export interface CourierOption {
  value: string;
  label: string;
  disabled: boolean;
  reason: string | null;
}

/** Tanlab bo'ladiganlar tepada, tanlab bo'lmaydiganlar — sababi bilan pastda. */
export const courierOptions = (
  couriers: CourierListItem[],
  accounts: Pick<CarrierAccount, "name" | "courier_user_id">[],
): CourierOption[] => {
  const rows = couriers.map((c) => {
    const reason = courierBlockReason(c, accounts);
    return { value: c.id, label: courierLabel(c), disabled: !!reason, reason };
  });
  return [...rows.filter((r) => !r.disabled), ...rows.filter((r) => r.disabled)];
};

// ─────────────────────────── faollik ───────────────────────────

/**
 * Carrier akkaunt tarixi amallari — server `carrier-account.service.ts`
 * yozadigan `action` qiymatlari. `created`, `updated`, `deleted` nomlari
 * "Tizim jurnallari" sahifasidagi (`logs-page` ACTION_CONFIG) bilan bir xil;
 * `key_rotated`, `activated`, `deactivated` faqat shu yerda. Ranglar — antd
 * `Tag` presetlari (loglar sahifasi o'z Tailwind ohanglarini ishlatadi).
 */
export const ACTIVITY_ACTIONS: Record<string, { label: string; color: string }> = {
  created: { label: "Yaratildi", color: "blue" },
  updated: { label: "Yangilandi", color: "geekblue" },
  key_rotated: { label: "Kalit yangilandi", color: "orange" },
  activated: { label: "Qayta yoqildi", color: "green" },
  deactivated: { label: "To'xtatildi", color: "red" },
  deleted: { label: "O'chirildi", color: "magenta" },
};

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : [];

const plain = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
};

/**
 * `old_value` → `new_value` farqi, bir qatorda. Faqat ikkalasida ham bor
 * maydonlar (yaratish va kalit yangilashda eski qiymat yo'q — farq ham yo'q).
 */
export const activityDiff = (
  log: Pick<CarrierActivityLog, "old_value" | "new_value">,
): string | null => {
  const before = log.old_value;
  const after = log.new_value;
  if (!before || !after) return null;
  const parts: string[] = [];
  for (const key of Object.keys(after)) {
    if (!(key in before)) continue;
    if (key === "ip_allowlist") {
      const a = asList(before[key]);
      const b = asList(after[key]);
      const added = b.filter((x) => !a.includes(x));
      const removed = a.filter((x) => !b.includes(x));
      const changes = [
        added.length ? `+ ${added.join(", ")}` : "",
        removed.length ? `− ${removed.join(", ")}` : "",
      ].filter(Boolean);
      parts.push(
        `ip_allowlist: ${a.length} ta → ${b.length} ta qoida${
          changes.length ? ` (${changes.join("; ")})` : ""
        }`,
      );
      continue;
    }
    parts.push(`${key}: ${plain(before[key])} → ${plain(after[key])}`);
  }
  return parts.length ? parts.join(" · ") : null;
};

// ─────────────────────────── jadval ───────────────────────────

/**
 * ≤ 900px da `index.css` jadvalni kartochkaga aylantiradi: `th` yashiriladi,
 * `td::before` esa `data-cell` ni yorliq qilib ko'rsatadi. antd `onCell`
 * qaytargan atributlar `<td>` ga tushadi.
 */
export const dataCell =
  (label: string) => (): TdHTMLAttributes<HTMLTableCellElement> =>
    ({ "data-cell": label }) as unknown as TdHTMLAttributes<HTMLTableCellElement>;

// ─────────────────────────── qorong'i rejim ───────────────────────────

/**
 * `showCount` li `Input` qobig'i qorong'i rejimda. `index.css` dagi
 * `.dark .ant-input` faqat ichki `<input>` ni bo'yaydi; qobiq
 * (`.ant-input-affix-wrapper`) antd'ning #141414 fonida qolib, maydon ikki
 * rangli ko'rinardi. Qobiq o'sha #312d4b / #4b5563 ga bo'yaladi, ichki
 * input shaffof. Xato holatidagi qizil chegara saqlanadi.
 * (Tailwind `!` — `@layer utilities` ichida, shuning uchun `index.css`
 * dagi qatlamsiz `!important` dan ustun.)
 */
export const DARK_COUNT_INPUT = {
  // ⚠️ Klasslar to'liq yozilgan: Tailwind manbadan aynan shu satrlarni
  // qidiradi, `${}` bilan yig'ilgan klass CSS'ga tushmaydi.
  rootClassName:
    "dark:!bg-[#312d4b] " +
    "dark:[&:not(.ant-input-status-error)]:!border-[#4b5563] " +
    "dark:[&:not(.ant-input-status-error):hover]:!border-[#7c3aed] " +
    "dark:[&:not(.ant-input-status-error):focus-within]:!border-[#7c3aed]",
  classNames: { input: "dark:!bg-transparent" },
};
