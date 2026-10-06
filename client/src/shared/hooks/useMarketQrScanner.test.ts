import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMarketQrScanner } from "./useMarketQrScanner";

/**
 * APPARAT SKANER — klaviatura-wedge: belgilarni tez terib Enter bosadi.
 *
 * ⚠️ ENG MUHIM HOLAT: Caps Lock yoqiq skaner KATTA harfda yuboradi, klient
 * normalizatori esa hammasini kichik harfga tushiradi. Server tokenni AYNAN
 * kichik harfda yaratadi (`mrc-…`) — shuning uchun bu yo'l ishlashi uchun
 * prefiks tekshiruvi ham kichik harfda bo'lishi SHART. Bu test aynan o'sha
 * nuqsonni qo'riqlaydi (u bir marta sodir bo'lgan: prefiks `MRC-` edi va
 * skanerlangan QR hech qachon topilmasdi).
 */
function scanText(text: string, target?: HTMLElement) {
  const el = target ?? window;
  for (const ch of text) {
    el.dispatchEvent(
      new KeyboardEvent("keypress", { key: ch, bubbles: true }),
    );
  }
  el.dispatchEvent(
    new KeyboardEvent("keypress", { key: "Enter", bubbles: true }),
  );
}

describe("useMarketQrScanner", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("market QR'ini o'qib onMarketToken chaqiradi (tugma bosilmaydi)", () => {
    const onMarketToken = vi.fn();
    renderHook(() =>
      useMarketQrScanner({ enabled: true, onMarketToken }),
    );

    scanText("mrc-abc123");

    expect(onMarketToken).toHaveBeenCalledTimes(1);
    expect(onMarketToken).toHaveBeenCalledWith("mrc-abc123");
  });

  it("⭐ CAPS LOCK bilan KATTA harfda kelsa ham ishlaydi", () => {
    const onMarketToken = vi.fn();
    const onForeignToken = vi.fn();
    renderHook(() =>
      useMarketQrScanner({ enabled: true, onMarketToken, onForeignToken }),
    );

    scanText("MRC-ABC123");

    expect(onForeignToken).not.toHaveBeenCalled();
    expect(onMarketToken).toHaveBeenCalledWith("mrc-abc123");
  });

  it("posilka QR'i market QR'i deb qabul qilinmaydi", () => {
    const onMarketToken = vi.fn();
    const onForeignToken = vi.fn();
    renderHook(() =>
      useMarketQrScanner({ enabled: true, onMarketToken, onForeignToken }),
    );

    scanText("a1b2c3d4e5f6a1b2c3d4e5f6");

    expect(onMarketToken).not.toHaveBeenCalled();
    expect(onForeignToken).toHaveBeenCalledWith("a1b2c3d4e5f6a1b2c3d4e5f6");
  });

  it("QR URL ko'rinishida bo'lsa oxirgi segment olinadi", () => {
    const onMarketToken = vi.fn();
    renderHook(() => useMarketQrScanner({ enabled: true, onMarketToken }));

    scanText("https://beepost.uz/q/mrc-zz99");

    expect(onMarketToken).toHaveBeenCalledWith("mrc-zz99");
  });

  it("enabled=false bo'lsa UMUMAN tinglamaydi (ruxsat ochiq paytda)", () => {
    const onMarketToken = vi.fn();
    const onForeignToken = vi.fn();
    renderHook(() =>
      useMarketQrScanner({ enabled: false, onMarketToken, onForeignToken }),
    );

    scanText("mrc-abc123");

    expect(onMarketToken).not.toHaveBeenCalled();
    expect(onForeignToken).not.toHaveBeenCalled();
  });

  it("PIN maydoniga QO'LDA terilganda tinglamaydi", () => {
    // Aks holda har raqam skaner bufferiga ham tushib, Enter bosilganda
    // "noto'g'ri QR" deb ovoz berardi.
    const onMarketToken = vi.fn();
    const onForeignToken = vi.fn();
    renderHook(() =>
      useMarketQrScanner({ enabled: true, onMarketToken, onForeignToken }),
    );

    const input = document.createElement("input");
    document.body.appendChild(input);
    scanText("123456", input);

    expect(onMarketToken).not.toHaveBeenCalled();
    expect(onForeignToken).not.toHaveBeenCalled();
  });

  it("Enter'siz tugagan skan 1.5 s dan keyin tozalanadi", () => {
    const onMarketToken = vi.fn();
    renderHook(() => useMarketQrScanner({ enabled: true, onMarketToken }));

    // Yarim skan (Enter kelmadi)
    for (const ch of "mrc-aa") {
      window.dispatchEvent(new KeyboardEvent("keypress", { key: ch }));
    }
    vi.advanceTimersByTime(2000);
    // Keyingi to'liq skan oldingi qoldiq bilan QO'SHILMASLIGI kerak.
    scanText("mrc-bb");

    expect(onMarketToken).toHaveBeenCalledTimes(1);
    expect(onMarketToken).toHaveBeenCalledWith("mrc-bb");
  });

  it("bo'sh Enter hech narsa qilmaydi", () => {
    const onMarketToken = vi.fn();
    const onForeignToken = vi.fn();
    renderHook(() =>
      useMarketQrScanner({ enabled: true, onMarketToken, onForeignToken }),
    );

    window.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter" }));

    expect(onMarketToken).not.toHaveBeenCalled();
    expect(onForeignToken).not.toHaveBeenCalled();
  });

  it("unmount'dan keyin tinglovchi qolmaydi", () => {
    const onMarketToken = vi.fn();
    const { unmount } = renderHook(() =>
      useMarketQrScanner({ enabled: true, onMarketToken }),
    );
    unmount();

    scanText("mrc-abc123");

    expect(onMarketToken).not.toHaveBeenCalled();
  });
});
