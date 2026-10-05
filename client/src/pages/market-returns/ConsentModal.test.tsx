import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import ConsentModal from "./ConsentModal";
import type { ConsentSession } from "../../shared/api/hooks/useMarketHandover";

const session = (over: Partial<ConsentSession> = {}): ConsentSession => ({
  session_id: "s-1",
  qr_token: "MRC-abcdef",
  pin: "123456",
  expires_at: Date.now() + 120_000,
  ttl_seconds: 120,
  awaiting_count: 7,
  ...over,
});

/**
 * ⚠️ ELCHI FRONTENDIDAGI NUQSON SHU TESTDA QULFLANADI.
 *
 * Elchi'da market QR modalida sanoq YO'Q: market yaroqsiz QR ko'rsatib
 * turadi, xodim skanerlaydi, "muddati tugagan" chiqadi va ikkisi ham nima
 * bo'layotganini tushunmaydi. Shuning uchun bu yerda taymer ko'rinishi va
 * tugaganda ruxsat o'zi yangilanishi MAJBURIY xulq.
 */
describe("ConsentModal — market QR/PIN ruxsati", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("QR, PIN va TAYMER ko'rsatiladi", () => {
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
      />,
    );

    expect(screen.getByText("123456")).toBeInTheDocument();
    // 2 daqiqa — server bergan ttl_seconds dan.
    expect(screen.getByText("02:00")).toBeInTheDocument();
    expect(
      screen.getByText(/7 ta posilka uchun amal qiladi/),
    ).toBeInTheDocument();
  });

  it("taymer sanab kamayadi", () => {
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("01:55")).toBeInTheDocument();
  });

  it("muddat tugaganda «Yangi ruxsat» chiqadi va avto-yangilanadi BIR MARTA", () => {
    const onRegenerate = vi.fn();
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session({ ttl_seconds: 2 })}
        loading={false}
        onRegenerate={onRegenerate}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText(/Muddati tugadi/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Yangi ruxsat/ }),
    ).toBeInTheDocument();

    // ⚠️ BIR MARTA: aks holda market modalni ochiq qoldirsa server
    // soniyada bitta sessiya yaratib yotardi.
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("MODAL YOPIQ bo'lsa avto-yangilanish ISHLAMAYDI", () => {
    const onRegenerate = vi.fn();
    render(
      <ConsentModal
        open={false}
        onClose={() => {}}
        session={session({ ttl_seconds: 1 })}
        loading={false}
        onRegenerate={onRegenerate}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it("yuklanayotganda holat ko'rsatiladi", () => {
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={null}
        loading
        onRegenerate={() => {}}
      />,
    );
    expect(screen.getByText(/tayyorlanmoqda/)).toBeInTheDocument();
  });
});
