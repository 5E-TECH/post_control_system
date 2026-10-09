import { useEffect, useRef } from "react";
import { normalizeQrToken } from "../helpers/normalizeQrToken";
import { isTextEntryTarget } from "../helpers/isTextEntryTarget";

/** Market ruxsat QR'ining prefiksi (server `mrc-` KICHIK harfda yaratadi). */
export const MARKET_QR_PREFIX = "mrc-";

/**
 * MARKET RUXSAT QR'I UCHUN APPARAT SKANER — DOIM AKTIV.
 *
 * ⚠️ NEGA TUGMA YO'Q. Omborda skanerlash faqat APPARAT skaneri bilan
 * bo'ladi (klaviatura-wedge: o'qiydi, terib beradi, Enter bosadi). Xodim
 * sahifaga kirgan zahoti skaner ishlashi kerak — "QR skanerlash" tugmasini
 * bosib yurish ish oqimini sekinlashtiradi va kuniga ~150 posilkada
 * sezilarli yo'qotish beradi.
 *
 * ⚠️ `normalizeQrToken` HAMMASINI kichik harfga tushiradi (Caps Lock / RU
 * layout himoyasi) — shuning uchun prefiks ham kichik harfda tekshiriladi va
 * server tokenni AYNAN shunday yaratadi. Aks holda skanerlangan QR hech
 * qachon topilmasdi.
 *
 * Posilka QR'lari ALOHIDA tinglovchida (`useManifestScanner`) — ikkisi
 * ATAYLAB bir vaqtda yoqilmaydi: ruxsat ochilmaguncha faqat bu, ochilgandan
 * keyin faqat posilka skaneri ishlaydi.
 */
export function useMarketQrScanner({
  enabled,
  onMarketToken,
  onForeignToken,
}: {
  enabled: boolean;
  /** Normalizatsiyadan o'tgan `mrc-…` token. */
  onMarketToken: (token: string) => void;
  /** Market QR'i emas — xodimga "avval market QR'ini o'qiting" deyish uchun. */
  onForeignToken?: (token: string) => void;
}): void {
  const onMarket = useRef(onMarketToken);
  const onForeign = useRef(onForeignToken);
  onMarket.current = onMarketToken;
  onForeign.current = onForeignToken;

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyPress = (e: KeyboardEvent) => {
      // PIN maydoniga qo'lda terilayotgan bo'lsa tinglamaymiz — aks holda
      // har raqam skaner bufferiga ham tushib, Enter bosilganda
      // "noto'g'ri QR" deb ovoz berardi.
      //
      // ⚠️ Lekin CHECKBOX/RADIO va antd Select'ning `readOnly` ichki inputi
      // matn qabul qilmaydi — ular skanerni TO'SMASLIGI kerak
      // (`isTextEntryTarget` izohiga qara).
      if (isTextEntryTarget(e.target)) return;

      if (e.key === "Enter") {
        const raw = buffer.trim();
        buffer = "";
        if (!raw) return;

        // QR URL ko'rinishida bo'lsa oxirgi segmentni olamiz.
        const value = raw.startsWith("http")
          ? raw.split("/").pop() || raw
          : raw;
        const token = normalizeQrToken(value);
        if (!token) return;

        if (token.startsWith(MARKET_QR_PREFIX)) {
          onMarket.current(token);
        } else {
          onForeign.current?.(token);
        }
        return;
      }

      // Apparat skaner belgilarni juda tez yuboradi; 1.5 s jimlikdan keyin
      // buffer tozalanadi (odam klaviaturadan tergan tasodifiy belgilar
      // keyingi skanga qo'shilib ketmasin).
      if (e.key.length === 1) buffer += e.key;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        buffer = "";
      }, 1500);
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);
}
