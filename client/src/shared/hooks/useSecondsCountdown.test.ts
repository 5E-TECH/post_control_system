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
