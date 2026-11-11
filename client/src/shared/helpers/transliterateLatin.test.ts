import { describe, expect, it } from "vitest";
import {
  isAcceptableScanChar,
  scanCharFromKeyEvent,
  transliterateLatin,
} from "./transliterateLatin";

// today-orders skaner bufferi qanday yig'ilsa, xuddi shunday yig'amiz:
// har bir `keydown` belgisi filtrdan o'tadi, Enter'da transliteratsiya.
const scan = (keys: string) =>
  transliterateLatin([...keys].filter(isAcceptableScanChar).join(""));

/**
 * ⚠️ PRODUCTION NUQSONI (2026-10-22, Butsy integratsiyasi).
 *
 * Filtr faqat `[a-zA-Z0-9]` ni qabul qilardi. Butsy QR qiymati base64url
 * (`pc_17zVBH...`) — `_` va `-` jimgina tushib qolib, `/qrorder/find` har
 * skanga 404 qaytarardi. Adosh (raqamli) va Inhayat (hex) tokenlarida bu
 * belgilar yo'qligi uchun nuqson ko'rinmagan.
 */
describe("skaner bufferi — tashqi QR qiymati buzilmaydi", () => {
  it("Butsy base64url QR to'liq yetib keladi", () => {
    expect(scan("pc_17zVBHWnVmE12P4zO7QdivVW5eKmd7Ix")).toBe(
      "pc_17zVBHWnVmE12P4zO7QdivVW5eKmd7Ix",
    );
    expect(scan("pc_PqIO62Ebk_jr0CA67-cTQr0DKbbFJtTj")).toBe(
      "pc_PqIO62Ebk_jr0CA67-cTQr0DKbbFJtTj",
    );
  });

  it("mavjud integratsiya tokenlari o'zgarmaydi", () => {
    expect(scan("1768961635126511")).toBe("1768961635126511");
    expect(scan("6a39161617a653bce7455ed2")).toBe("6a39161617a653bce7455ed2");
  });

  it("RU layout'dagi harflar Latin'ga qaytadi, `_`/`-` saqlanadi", () => {
    // "pc_ab-1" RU layout'da: p→з, c→с, a→ф, b→и
    expect(scan("зс_фи-1")).toBe("pc_ab-1");
  });

  it("bo'shliq va boshqaruv belgilari qabul qilinmaydi", () => {
    expect(isAcceptableScanChar(" ")).toBe(false);
    expect(isAcceptableScanChar("\t")).toBe(false);
    expect(isAcceptableScanChar("Shift")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Klaviatura-emulyatsiya skaner (keyboard wedge) hodisalari.
// Skaner har bir belgini US layout'dagi jismoniy tugma + kerak bo'lsa Shift
// sifatida yuboradi; `e.key` ni esa OS layout va Caps Lock'ga qarab chiqaradi.
// ---------------------------------------------------------------------------
const US_SHIFTED: Record<string, string> = { _: "Minus" };
const US_PLAIN: Record<string, string> = { "-": "Minus" };
const RU_LETTER: Record<string, string> = {
  a: "ф", b: "и", c: "с", d: "в", e: "у", f: "а", g: "п", h: "р", i: "ш",
  j: "о", k: "л", l: "д", m: "ь", n: "т", o: "щ", p: "з", q: "й", r: "к",
  s: "ы", t: "е", u: "г", v: "м", w: "ц", x: "ч", y: "н", z: "я",
};

type Os = { capsLock: boolean; layout: "us" | "ru" };

/** Skaner `qr` ni yuborganda brauzer ko'radigan keydown hodisalari. */
const wedgeEvents = (qr: string, os: Os) =>
  [...qr].map((ch) => {
    const isLetter = /[a-zA-Z]/.test(ch);
    const shiftKey = isLetter ? ch === ch.toUpperCase() : ch in US_SHIFTED;
    const code = isLetter
      ? `Key${ch.toUpperCase()}`
      : /\d/.test(ch)
        ? `Digit${ch}`
        : (US_SHIFTED[ch] ?? US_PLAIN[ch]);
    let key = ch;
    if (isLetter) {
      const base = os.layout === "ru" ? RU_LETTER[ch.toLowerCase()] : ch.toLowerCase();
      key = shiftKey !== os.capsLock ? base.toUpperCase() : base; // Caps Lock registrni teskari qiladi
    }
    return {
      key,
      code,
      shiftKey,
      getModifierState: (k: string) => k === "CapsLock" && os.capsLock,
    };
  });

const scanEvents = (qr: string, os: Os) =>
  transliterateLatin(
    wedgeEvents(qr, os)
      .map(scanCharFromKeyEvent)
      .filter((c): c is string => c !== null)
      .join(""),
  );

describe("scanCharFromKeyEvent — Caps Lock va layout'dan qat'i nazar QR to'g'ri", () => {
  const BUTSY = "pc_PqIO62Ebk_jr0CA67-cTQr0DKbbFJtTj";

  it.each([
    { capsLock: false, layout: "us" },
    { capsLock: true, layout: "us" },
    { capsLock: false, layout: "ru" },
    { capsLock: true, layout: "ru" },
  ] as Os[])("Caps Lock=$capsLock, layout=$layout", (os) => {
    expect(scanEvents(BUTSY, os)).toBe(BUTSY);
  });

  it("Caps Lock o'chiq bo'lsa e.key o'zgarmaydi", () => {
    expect(
      scanCharFromKeyEvent({ key: "a", code: "KeyA", shiftKey: false, getModifierState: () => false }),
    ).toBe("a");
  });

  it("boshqaruv tugmalari va bo'shliq qabul qilinmaydi", () => {
    expect(scanCharFromKeyEvent({ key: "Shift", code: "ShiftLeft", shiftKey: true })).toBeNull();
    expect(scanCharFromKeyEvent({ key: " ", code: "Space", shiftKey: false })).toBeNull();
  });

  it("e.code bo'lmasa (virtual klaviatura) e.key ishlatiladi", () => {
    expect(
      scanCharFromKeyEvent({ key: "Q", code: "", shiftKey: false, getModifierState: () => true }),
    ).toBe("Q");
  });
});
