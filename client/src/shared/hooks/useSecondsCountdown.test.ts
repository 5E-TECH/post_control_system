import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { formatMmSs, useSecondsCountdown } from "./useSecondsCountdown";

describe("formatMmSs", () => {
  it("mm:ss shaklida", () => {
    expect(formatMmSs(0)).toBe("00:00");
    expect(formatMmSs(5)).toBe("00:05");
    expect(formatMmSs(125)).toBe("02:05");
    expect(formatMmSs(600)).toBe("10:00");
  });

  it("manfiy qiymat 00:00 bo'ladi (sanoq orqaga ketmaydi)", () => {
    expect(formatMmSs(-10)).toBe("00:00");
  });
});

describe("useSecondsCountdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("server bergan qiymatdan boshlanadi", () => {
    const { result } = renderHook(() => useSecondsCountdown(120));
    expect(result.current).toBe(120);
  });

  it("har soniyada kamayadi", () => {
    const { result } = renderHook(() => useSecondsCountdown(10));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(7);
  });

  it("0 ga yetganda TO'XTAYDI (manfiyga ketmaydi)", () => {
    const { result } = renderHook(() => useSecondsCountdown(2));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(0);
  });

  it("tab fonda turib interval kechikkanda ham HAQIQIY vaqtni ko'rsatadi", () => {
    // ⚠️ Bu asosiy sabab: brauzer fon tabda `setInterval`ni sekinlashtiradi.
    // "har tikda bittaga kamaytirish" usuli ekranda "3:12 qoldi" deb
    // turganda ruxsat allaqachon tugagan bo'lardi.
    const { result } = renderHook(() => useSecondsCountdown(600));
    act(() => {
      // Vaqt 100 s o'tdi, lekin interval faqat bir marta ishladi.
      vi.setSystemTime(Date.now() + 100_000);
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(499);
  });

  it("restartKey o'zgarsa sanoq QAYTA boshlanadi (yangi sessiya)", () => {
    const { result, rerender } = renderHook(
      ({ total, key }: { total: number; key: string }) =>
        useSecondsCountdown(total, key),
      { initialProps: { total: 120, key: "s1" } },
    );
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(90);

    rerender({ total: 120, key: "s2" });
    expect(result.current).toBe(120);
  });

  it("null/0 qiymatda sanoq yurmaydi", () => {
    const { result } = renderHook(() => useSecondsCountdown(null));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(0);
  });
});

/**
 * ⚠️ PRODUCTION NUQSONI (2026-10-06) — ENG MUHIM TEST.
 *
 * SIMPTOM: xodim PIN kiritgan yoki QR skanerlagan ZAHOTI «ruxsat tugadi»
 * chiqardi va tasdiqlash ishlamasdi.
 *
 * SABAB: `left` faqat `useState` INITIALIZER ida (birinchi mount) va
 * `useEffect` ichida yangilanardi. Effektlar esa renderdan KEYIN ishlaydi,
 * ya'ni `restartKey` o'zgargan RENDERDA hook hamon ESKI qiymatni (0)
 * qaytarardi. Chaqiruvchi shu bitta renderda «muddati tugagan» degan
 * xulosaga kelardi:
 *   · HandoverSession: `if (auth && left <= 0) setAuth(null)` → ruxsat
 *     ochilgan zahoti O'CHIRILARDI;
 *   · ConsentModal: `expired` → avto-yangilash → YANGI sessiya → yana
 *     stale 0 → yana yangilash — CHEKSIZ halqa, market ekranidagi QR
 *     doim eskirgan bo'lardi (xodim «muddati tugagan» xatosini olardi).
 *
 * Shuning uchun sanoq `restartKey` o'zgarganda AYNI RENDERDA to'g'ri
 * qiymat berishi SHART.
 */
describe("useSecondsCountdown — restartKey o'zgarganda AYNI RENDERDA", () => {
  it("yangi kalit kelgan renderda ESKI qiymat qaytarmaydi", () => {
    const seen: number[] = [];

    const { rerender } = renderHook(
      ({ total, key }: { total: number | undefined; key: string | undefined }) => {
        const left = useSecondsCountdown(total, key);
        seen.push(left);
        return left;
      },
      {
        initialProps: { total: undefined, key: undefined } as {
          total: number | undefined;
          key: string | undefined;
        },
      },
    );

    expect(seen.at(-1)).toBe(0);

    // Ruxsat ochildi: 600 soniya, yangi sessiya kaliti.
    seen.length = 0;
    rerender({ total: 600, key: "sessiya-1" });

    // ⚠️ BIRINCHI render 0 bo'lMASLIGI kerak — aks holda chaqiruvchi
    // «tugagan» deb hisoblab ruxsatni darhol o'chiradi.
    expect(seen[0]).toBe(600);
    expect(seen).not.toContain(0);
  });

  it("ketma-ket sessiyalarda ham nol oralig'i yo'q", () => {
    const seen: number[] = [];
    const { rerender } = renderHook(
      ({ total, key }: { total: number; key: string }) => {
        const left = useSecondsCountdown(total, key);
        seen.push(left);
        return left;
      },
      { initialProps: { total: 120, key: "s1" } },
    );

    seen.length = 0;
    rerender({ total: 120, key: "s2" });
    rerender({ total: 120, key: "s3" });

    // Market modalidagi cheksiz «yangi QR» halqasi aynan shu nolda tug'ilardi.
    expect(seen).not.toContain(0);
  });

  it("muddat HAQIQATAN tugaganda 0 qaytaradi (yolg'on tuzatma emas)", () => {
    const { result } = renderHook(() => useSecondsCountdown(0, "s1"));
    expect(result.current).toBe(0);
  });
});
