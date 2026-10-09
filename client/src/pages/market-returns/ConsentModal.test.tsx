import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import ConsentModal from "./ConsentModal";
import type {
  ConsentSession,
  ConsentStatus,
} from "../../shared/api/hooks/useMarketHandover";

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
    // ⚠️ Yangi QR darhol SO'RALMAYDI: server holati 3 s da bir keladi,
    // shuning uchun avto-yangilash bir polling oralig'ini kutadi
    // (xodim oxirgi soniyada skanerlagan bo'lishi mumkin).
    expect(onRegenerate).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
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

/**
 * ⚠️ QR/PIN BIR MARTALIK — ENG MUHIM QULF.
 *
 * Xodim skanerlashi bilan server sessiyani `PENDING → ACTIVE` ga o'tkazadi
 * va eski kod o'ladi. Avval market ekrani O'ZGARMASDI: u yaroqsiz QR'ni
 * ko'rsatib turardi, xodim esa «muddati tugagan» xatosini olardi —
 * ikkisi bir-birini aylanib yurardi. Shuning uchun server holati
 * ekranni ALMASHTIRISHI majburiy xulq.
 */
describe("ConsentModal — server holati (bir martalik QR)", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  const status = (
    over: Partial<ConsentStatus> = {},
  ): ConsentStatus => ({
    state: "waiting",
    session_id: "s-1",
    seconds_left: 120,
    handed_over_count: 0,
    pin_blocked: false,
    awaiting_count: 7,
    ...over,
  });

  /**
   * ⚠️ `document.body` DAN qidiriladi, `container` dan EMAS: antd `Modal`
   * portal bilan `body` ga chiqadi, ya'ni `container.querySelector` DOIM
   * `null` qaytarardi — «QR yo'q» testlari yolg'on yashil bo'lardi.
   */
  const qrNode = () =>
    document.body.querySelector('svg[shape-rendering="crispEdges"]');

  it("xodim skanerlagach QR YO'QOLADI va topshirish ekrani chiqadi", () => {
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
        status={status({ state: "handover", seconds_left: 540 })}
      />,
    );

    expect(qrNode()).toBeNull();
    expect(screen.queryByText("123456")).toBeNull();
    expect(screen.getByText(/Xodim skanerladi/)).toBeInTheDocument();
    // Xodimning 10 daqiqalik oynasi market ekranida ham ko'rinadi.
    expect(screen.getByText("09:00")).toBeInTheDocument();
  });

  it("topshirish borayotganda avto-yangilash ISHLAMAYDI", () => {
    const onRegenerate = vi.fn();
    render(
      <ConsentModal
        open
        onClose={() => {}}
        // Mahalliy sanoq allaqachon tugagan (ttl 0).
        session={session({ ttl_seconds: 0 })}
        loading={false}
        onRegenerate={onRegenerate}
        status={status({ state: "handover", seconds_left: 300 })}
      />,
    );
    // ⚠️ Ikkinchi QR xodimning TIRIK oynasi ustiga chiqib chalg'itardi.
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  it("PIN 5 marta xato kiritilsa sabab aytiladi va yangi ruxsat taklif qilinadi", () => {
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
        status={status({ state: "done", pin_blocked: true })}
      />,
    );
    expect(screen.getByText(/PIN 5 marta xato/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Yangi ruxsat/ }),
    ).toBeInTheDocument();
  });

  it("posilka qolmasa yangi ruxsat tugmasi BERILMAYDI", () => {
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
        status={status({ state: "done", awaiting_count: 0 })}
      />,
    );
    expect(screen.getByText(/qaytarish qolmadi/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Yangi ruxsat/ })).toBeNull();
  });

  /**
   * ⚠️ POYGA HIMOYASI. Market tugmani ikki marta bossa server yangi
   * sessiya yaratadi, polling esa ESKI sessiya holatini qaytarishi mumkin.
   * Boshqa sessiyaning holati yangi QR'ni o'chirib qo'ymasligi kerak.
   */
  it("BOSHQA sessiya holati joriy QR'ga ta'sir qilmaydi", () => {
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session({ session_id: "s-2" })}
        loading={false}
        onRegenerate={() => {}}
        status={status({ session_id: "s-1", state: "done" })}
      />,
    );
    expect(qrNode()).toBeTruthy();
    expect(screen.getByText("123456")).toBeInTheDocument();
  });

  it("holat kelmasa eski xulq saqlanadi (QR ko'rinadi)", () => {
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session()}
        loading={false}
        onRegenerate={() => {}}
      />,
    );
    expect(qrNode()).toBeTruthy();
  });
});

/**
 * ⚠️ PRODUCTION NUQSONI (2026-10-06) — CHEKSIZ «YANGI QR» HALQASI.
 *
 * Sanoq hooki yangi sessiya uchun bir renderda ESKI 0 ni qaytarganda
 * `expired` rost bo'lib, avto-yangilash DARHOL yangi ruxsat so'rardi;
 * yangi sessiya kelardi → yana stale 0 → yana so'rov. Market ekranidagi
 * QR bir renderdayoq eskirar, xodim esa doim «muddati tugagan» xatosini
 * olardi.
 *
 * Hook tuzatildi, LEKIN modal ham mustaqil qo'riqlanadi: har yangi
 * sessiya uchun birinchi baho o'tkazib yuboriladi.
 */
describe("ConsentModal — yangi sessiya darhol «tugagan» deb hisoblanmaydi", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("YANGI sessiya kelganda avto-yangilash CHAQIRILMAYDI", () => {
    const onRegenerate = vi.fn();
    const { rerender } = render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session({ session_id: "s-1", ttl_seconds: 120 })}
        loading={false}
        onRegenerate={onRegenerate}
      />,
    );
    expect(onRegenerate).not.toHaveBeenCalled();

    // Ketma-ket yangi sessiyalar — halqa aynan shu yerda tug'ilardi.
    for (const id of ["s-2", "s-3", "s-4"]) {
      rerender(
        <ConsentModal
          open
          onClose={() => {}}
          session={session({ session_id: id, ttl_seconds: 120 })}
          loading={false}
          onRegenerate={onRegenerate}
        />,
      );
    }
    expect(onRegenerate).not.toHaveBeenCalled();

    // Sanoq ham to'g'ri: 02:00 ko'rinadi, 00:00 emas.
    expect(screen.getByText("02:00")).toBeInTheDocument();
  });

  it("muddat HAQIQATAN tugagach bir marta yangilanadi", () => {
    const onRegenerate = vi.fn();
    render(
      <ConsentModal
        open
        onClose={() => {}}
        session={session({ session_id: "s-9", ttl_seconds: 2 })}
        loading={false}
        onRegenerate={onRegenerate}
      />,
    );
    expect(onRegenerate).not.toHaveBeenCalled();
    // ⚠️ IKKI BOSQICH: avval sanoq tugaydi (render → `expired`), ANDAN
    // KEYIN kutish taymeri rejalashtiriladi. Bitta `advanceTimersByTime`
    // ichida React effektlari oraliqda yuvilmaydi.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Qo'riqlagich HAQIQIY muddat tugashini TO'SMAYDI.
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });
});

/**
 * ⚠️ POLLING BILAN POYGA (audit, 2026-10-07).
 *
 * Mahalliy sanoq 0 ga yetgan payt xodim xuddi shu soniyalarda
 * skanerlagan bo'lishi mumkin; server holati esa 3 s da bir keladi.
 * Darhol yangilasak topshirish O'RTASIDA yangi sessiya yaratilib,
 * `sameSession` buzilardi va «Xodim skanerladi» ekrani ko'rinmasdi.
 */
describe("ConsentModal — oxirgi soniyadagi skan yangi sessiya yaratmaydi", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("kutish oynasi ichida holat `handover` ga o'tsa YANGILANMAYDI", () => {
    const onRegenerate = vi.fn();
    const props = (status?: ConsentStatus) => ({
      open: true as const,
      onClose: () => {},
      session: session({ session_id: "s-1", ttl_seconds: 2 }),
      loading: false,
      onRegenerate,
      status: status ?? null,
    });

    const { rerender } = render(<ConsentModal {...props()} />);

    // Sanoq tugadi — kutish oynasi boshlandi.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onRegenerate).not.toHaveBeenCalled();

    // Polling yetib keldi: xodim skanerlagan ekan.
    rerender(
      <ConsentModal
        {...props({
          state: "handover",
          session_id: "s-1",
          seconds_left: 600,
          handed_over_count: 0,
          pin_blocked: false,
          awaiting_count: 7,
        })}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    // ⚠️ Yangi sessiya YARATILMADI va ekran topshirish holatida.
    expect(onRegenerate).not.toHaveBeenCalled();
    expect(screen.getByText(/Xodim skanerladi/)).toBeInTheDocument();
  });
});

