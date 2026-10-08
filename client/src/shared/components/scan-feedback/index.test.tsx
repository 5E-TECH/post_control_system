import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ScanFeedback from ".";

/**
 * ⚠️ RANG MA'NO TASHIYDI. Xodim skanerlaganda ko'zi POSILKADA bo'ladi,
 * ekranda emas — u MATNNI emas, RANGNI ko'radi. Ranglar aralashsa
 * market ruxsati «yana bitta posilka topildi» deb o'qilardi.
 */
describe("ScanFeedback — skaner javobi overlayi", () => {
  const veil = (c: HTMLElement) => c.querySelector("div > div");

  it("ko'rinmasa hech narsa render qilmaydi", () => {
    const { container } = render(
      <ScanFeedback state={{ show: false, type: "success" }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("market QR = KO'K, posilka = YASHIL, xato = QIZIL, takror = SARIQ", () => {
    const tones: Array<[("info"|"success"|"error"|"warning"), string]> = [
      ["info", "sky"],
      ["success", "green"],
      ["error", "red"],
      ["warning", "amber"],
    ];
    for (const [type, color] of tones) {
      const { container, unmount } = render(
        <ScanFeedback state={{ show: true, type, message: "x" }} />,
      );
      expect(container.innerHTML).toContain(`${color}-500`);
      unmount();
    }
  });

  it("xabar ko'rsatiladi va animatsiya klassi qo'yiladi", () => {
    const { container } = render(
      <ScanFeedback state={{ show: true, type: "success", message: "Topildi!" }} />,
    );
    expect(screen.getByText("Topildi!")).toBeInTheDocument();
    // `index.css` dagi maxsus klass — Tailwind `animate-in` EMAS
    // (u modallarga ham tegib, ularni yo'q qilib yuborardi).
    expect(container.querySelector(".scan-feedback-anim")).toBeTruthy();
  });

  it("bosishni TO'SMAYDI — xodim ketma-ket skanerlaydi", () => {
    const { container } = render(
      <ScanFeedback state={{ show: true, type: "success" }} />,
    );
    expect(container.querySelector(".pointer-events-none")).toBeTruthy();
    expect(veil(container)).toBeTruthy();
  });
});
