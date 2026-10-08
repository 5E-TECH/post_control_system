import { describe, expect, it } from "vitest";
import {
  bannerTone,
  deadlineCountdown,
  deadlineTone,
  formatSum,
} from "./deadlineTone";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("deadlineTone", () => {
  it("kechikkan — late", () => {
    expect(deadlineTone({ late_days: 2, due_today: false, days_left: null })).toBe("late");
  });

  /** Kechikish ustun: ikkalasi bir vaqtda bo'lmaydi, lekin tartib muhim. */
  it("kechikish `due_today` dan ustun", () => {
    expect(deadlineTone({ late_days: 1, due_today: true, days_left: null })).toBe("late");
  });

  it("bugun oxirgi kun — today", () => {
    expect(deadlineTone({ late_days: 0, due_today: true, days_left: 0 })).toBe("today");
  });

  it("2 kun va kamroq — soon", () => {
    expect(deadlineTone({ late_days: 0, due_today: false, days_left: 2 })).toBe("soon");
    expect(deadlineTone({ late_days: 0, due_today: false, days_left: 3 })).toBe("safe");
  });
});

describe("deadlineCountdown", () => {
  /**
   * ⚠️ Oxirgi sutkada SOAT ko'rsatiladi. «0 kun qoldi» kuryerga
   * «hali vaqt bor» degan yolg'on signal berardi.
   */
  it("bir kundan kam qolsa soat", () => {
    expect(deadlineCountdown(5 * HOUR)).toEqual({ unit: "hours", value: 5 });
    expect(deadlineCountdown(23.9 * HOUR).unit).toBe("hours");
  });

  it("bir soatdan kam qolsa daqiqa", () => {
    expect(deadlineCountdown(30 * 60_000)).toEqual({ unit: "minutes", value: 30 });
  });

  /** Nolga yaqin qolgan vaqt «0 daqiqa» emas — kamida 1. */
  it("juda kam qolsa 1 daqiqa", () => {
    expect(deadlineCountdown(5_000)).toEqual({ unit: "minutes", value: 1 });
  });

  it("kun bo‘yicha", () => {
    expect(deadlineCountdown(3 * DAY + HOUR)).toEqual({ unit: "days", value: 3 });
  });

  it("o‘tgan muddat", () => {
    expect(deadlineCountdown(0).unit).toBe("passed");
    expect(deadlineCountdown(-DAY).unit).toBe("passed");
  });
});

describe("bannerTone", () => {
  /**
   * ⚠️ Kechikkan PUL ALLAQACHON KETYAPTI — «bugun tugaydi» esa shunchaki
   * ogohlantirish. Tartib teskari bo'lsa kuryer o'sib borayotgan zararni
   * payqamay qolardi.
   */
  it("kechikkan `due_today` dan ustun", () => {
    expect(bannerTone({ overdue: 1, due_today: 5 })).toBe("late");
  });

  it("faqat bugun tugaydiganlar", () => {
    expect(bannerTone({ overdue: 0, due_today: 2 })).toBe("today");
  });

  it("hech narsa yo‘q — banner ko‘rinmaydi", () => {
    expect(bannerTone({ overdue: 0, due_today: 0 })).toBeNull();
  });
});

describe("formatSum", () => {
  it("ming ajratkich", () => {
    expect(formatSum(1234567)).toBe("1 234 567");
    expect(formatSum(2000)).toBe("2 000");
    expect(formatSum(0)).toBe("0");
  });
});
