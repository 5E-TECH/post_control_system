// Barqaror qurilma identifikatori — audit-log uchun. Bir brauzer profilida
// birinchi so'rovда yaratiladi va localStorage'да saqlanadi; login/logout'да
// TOZALANMAYDI (aynan shu qurilma-ID login'lararo barqaror qolishi kerak —
// birov o'zganing paroli bilan O'Z qurilmasidan kirsa, uni ajratib olish uchun).
//
// Eslatma: bu telemetriya signali, XAVFSIZLIK chegarasi emas — foydalanuvchi
// DevTools orqali o'zgartira oladi va incognito/boshqa brauzerда yangi ID chiqadi.
// IP + User-Agent bilan birga forensika uchun kuchli, lekin yagona dalil emas.

const DEVICE_ID_KEY = "x-device-id";

let cachedId: string | null = null;

/** RFC4122 v4 — crypto.randomUUID mavjud bo'lmasa (HTTP non-secure context) zaxira. */
function uuidv4(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* non-secure context — pastdagi zaxiraga o'tamiz */
  }
  const buf = new Uint8Array(16);
  (globalThis.crypto || (window as any).crypto).getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
  buf[8] = (buf[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

/** Barqaror qurilma-ID'ni qaytaradi (yo'q bo'lsa yaratib saqlaydi). */
export function getDeviceId(): string {
  if (cachedId) return cachedId;
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    cachedId = id;
    return id;
  } catch {
    // localStorage ishlamasa (private mode) — sessiya davomida barqaror ID
    if (!cachedId) cachedId = uuidv4();
    return cachedId;
  }
}
