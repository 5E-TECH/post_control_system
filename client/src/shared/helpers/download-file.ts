import { saveAs } from "file-saver";
import { api } from "../api";

/**
 * SERVERDAN FAYL YUKLAB OLISH (axios orqali).
 *
 * ⚠️ NEGA KERAK. Loyihada bu ish to'rt joyda xom `fetch` bilan takrorlangan
 * edi (cardDetail, cashDetail, mainDetail x2). Xom `fetch` esa
 * `shared/api/index.ts` dagi interceptordan CHETLAB o'tadi, ya'ni:
 *   · 401 da avtomatik `user/refresh` + qayta urinish ISHLAMAYDI —
 *     sahifaning qolgan qismi (axios) ishlayverar, faqat yuklash tugmasi
 *     sababsiz «xatolik» berardi;
 *   · `X-Device-Id` va `withCredentials` yuborilmaydi, audit jurnalida
 *     so'rov qurilmasiz ko'rinadi.
 *
 * ⚠️ BLOB XATOSI TUZOG'I. `responseType: "blob"` da server XATO qaytarsa,
 * javob tanasi ham Blob bo'ladi — ya'ni `e.response.data.message` HAR DOIM
 * `undefined`. Shuning uchun xato matnini ko'rsatish uchun blob'ni matnga
 * o'girish shart; `blobErrorMessage` aynan shuni qiladi.
 */

/** `Content-Disposition: attachment; filename="..."` dan nom ajratadi. */
const nameFromDisposition = (header: unknown): string | null => {
  if (typeof header !== "string") return null;
  // RFC 5987 (`filename*=UTF-8''...`) birinchi, oddiy `filename=` ikkinchi.
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* buzuq kodlash — oddiy variantga o'tamiz */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || null;
};

/**
 * Xato javobidagi Blob'ni o'qib, backend xabarini ajratadi.
 *
 * Xato kontrakti: `{message, error}` — ikkisi ham STRING.
 * `data.message` o'qiladi, `data.error.message` EMAS.
 */
export const blobErrorMessage = async (
  e: unknown,
  fallback: string,
): Promise<string> => {
  const data = (e as { response?: { data?: unknown } })?.response?.data;

  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text) as { message?: unknown };
      if (typeof parsed?.message === "string" && parsed.message) {
        return parsed.message;
      }
    } catch {
      /* Blob JSON emas (masalan nginx HTML sahifasi) — fallback qoladi */
    }
  }

  // Blob bo'lmagan holat: oddiy axios xatosi yoki `new Error(...)`.
  const msg = (data as { message?: unknown })?.message;
  if (typeof msg === "string" && msg) return msg;
  if (e instanceof Error && e.message) return e.message;

  return fallback;
};

/**
 * Excel (yoki boshqa) faylni yuklab oladi va brauzerga saqlatadi.
 *
 * @param path   `api` instansiyasining baseURL'iga nisbatan yo'l
 * @param params query parametrlari (`paramsSerializer` api'da o'rnatilgan)
 * @param fallbackName server `Content-Disposition` bermasa ishlatiladigan nom
 * @throws axios xatosi (401 refreshdan keyin ham yiqilsa) yoki bo'sh fayl xatosi
 */
export const downloadFile = async (
  path: string,
  params: Record<string, unknown> | undefined,
  fallbackName: string,
): Promise<void> => {
  const res = await api.get(path, { params, responseType: "blob" });
  const blob = res.data as Blob;

  /**
   * ⚠️ `if (!res.data)` YETARLI EMAS: `new Blob()` (0 bayt) ham TRUTHY.
   * Tekshiruvsiz brauzer 0 KB `.xlsx` saqlaydi va Excel «fayl buzilgan»
   * deydi — foydalanuvchi uchun bu «yuklandi, lekin ochilmaydi» bo'ladi.
   */
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("Server bo'sh fayl qaytardi");
  }

  /**
   * ⚠️ 200 + JSON = yashirin xato. Ba'zi yo'llar xatoni 200 bilan JSON
   * qilib qaytarishi mumkin; uni `.xlsx` deb saqlash eng yomon natija.
   */
  if (blob.type.includes("application/json")) {
    let msg = "Server fayl o'rniga xato qaytardi";
    try {
      const parsed = JSON.parse(await blob.text()) as { message?: unknown };
      if (typeof parsed?.message === "string" && parsed.message) {
        msg = parsed.message;
      }
    } catch {
      /* JSON emas — umumiy xabar qoladi */
    }
    throw new Error(msg);
  }

  saveAs(blob, nameFromDisposition(res.headers?.["content-disposition"]) ?? fallbackName);
};
