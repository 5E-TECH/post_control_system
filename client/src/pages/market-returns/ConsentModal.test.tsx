import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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

  /**
   * ⚠️ APPARAT SKANER TELEFON EKRANIDAN O'QIYDI — geometriya SHART:
   *
   *  · QUIET ZONE: QR standarti chetda 4 modul bo'sh joy talab qiladi.
   *    Qat'iy `p-4` (16px) 29 modulli QR'da ~2 modul chiqardi va imager
   *    QR'ni rad etardi.
   *  · MODUL BUTUN PIKSEL: o'lcham modul soniga karrali bo'lmasa
   *    (224/29=7.72px) antialiasing modul chetlarini kulrang qiladi va
   *    kontrast yo'qoladi.
   *  · QR modal ichiga SIG'ISHI kerak: 360px telefonda foydali kenglik
   *    min(420, 360−16) − 2×12 = 320px.
   */
  /**
   * ⚠️ `viewBox` bo'yicha tanlab bo'lmaydi: lucide ikonkalari ham
   * `0 0 24 24` beradi. QR'ning yagona o'ziga xos belgisi —
   * `shape-rendering="crispEdges"`.
   */
  const qrSvg = () =>
    document.querySelector<SVGElement>('svg[shape-rendering="crispEdges"]');

  it("⭐ TELEFON: QR geometriyasi — butun modul + 4 modulli quiet zone", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });

    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
      />,
    );

    await waitFor(() => expect(qrSvg()).toBeTruthy());
    const svg = qrSvg()!;

    const modules = Number(svg.getAttribute("viewBox")!.split(" ")[2]);
    const size = Number(svg.getAttribute("width"));
    expect(modules).toBeGreaterThan(0);

    // 1) Modul BUTUN piksel.
    expect(size % modules).toBe(0);
    const modulePx = size / modules;
    expect(modulePx).toBeGreaterThanOrEqual(5);

    // 2) Quiet zone AYNAN 4 modul.
    const wrap = svg.parentElement as HTMLElement;
    expect(wrap.style.padding).toBe(`${modulePx * 4}px`);

    // 3) Modal ichiga sig'adi (360px telefon → 320px foydali kenglik).
    expect(size + modulePx * 8).toBeLessThanOrEqual(320);

    // 4) Antialiasing o'chirilgan.
    expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
  });

  it("⭐ chetga tegish ruxsatni YO'Q QILMAYDI (maskClosable=false)", () => {
    // Telefonda tasodifiy chet tegish modalni yopardi va `onClose`
    // sessiyani tashlardi → market qaytadan bosib, serverda YANGI sessiya
    // ochilardi (QR/PIN almashadi, xodim eski QR bilan xato oladi).
    const onClose = vi.fn();
    render(
      <ConsentModal
        open
        onClose={onClose}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
      />,
    );

    const mask = document.querySelector(".ant-modal-wrap");
    (mask as HTMLElement)?.click();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("⭐ TELEFON: ekran uxlamasligi uchun wakeLock so'raladi va qaytariladi", () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });

    const { unmount } = render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
      />,
    );
    expect(request).toHaveBeenCalledWith("screen");

    unmount();
    // release — mikro-vazifadan keyin chaqiriladi.
    return Promise.resolve().then(() => {
      expect(release).toHaveBeenCalled();
    });
  });

  it("wakeLock qo'llab-quvvatlanmasa JIM o'tkazib yuboriladi", () => {
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: undefined,
    });
    expect(() =>
      render(
        <ConsentModal
          open
          onClose={() => {}}
          session={session()}
          loading={false}
          onRegenerate={() => {}}
        />,
      ),
    ).not.toThrow();
  });

  it("yorqinlik eslatmasi ko'rsatiladi (skaner xira ekranni o'qimaydi)", () => {
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
      />,
    );
    expect(screen.getByText(/yorqinligini oshirsangiz/i)).toBeInTheDocument();
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
