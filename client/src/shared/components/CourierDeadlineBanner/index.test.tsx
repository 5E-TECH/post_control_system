import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CourierDeadlineReport } from "../../api/hooks/useCourierPenalty";

/**
 * ⚠️ BANNER YOLG'ON GAPIRMASLIGI KERAK. Soya rejimida pul YECHILMAYDI;
 * agar banner buni aytmasa, kuryer yechilmagan pulni yechilgan deb
 * o'ylardi va modul haqiqatan yoqilganda ogohlantirishga umuman
 * ishonmay qo'yardi. Shu shartnoma bu yerda qulflanadi.
 */

let role = "courier";
let report: CourierDeadlineReport | undefined;

vi.mock("react-redux", () => ({
  useSelector: (fn: (s: unknown) => unknown) =>
    fn({ roleSlice: { role } }),
}));

vi.mock("../../api/hooks/useCourierPenalty", () => ({
  useCourierPenalty: () => ({
    getMyDeadlines: () => ({ data: report }),
  }),
}));

const { default: CourierDeadlineBanner } = await import(".");

const base = (
  over: Partial<CourierDeadlineReport["summary"]> = {},
  moduleOver: Partial<CourierDeadlineReport["module"]> = {},
): CourierDeadlineReport => ({
  module: { active: false, exempt: false, ...moduleOver },
  summary: {
    pending: 5,
    due_today: 0,
    overdue: 0,
    penalty_now: 0,
    penalty_tomorrow: 0,
    penalty_max: 0,
    ...over,
  },
  orders: [],
});

beforeEach(() => {
  role = "courier";
  report = undefined;
});

describe("CourierDeadlineBanner", () => {
  it("kuryer bo'lmasa ko'rinmaydi", () => {
    role = "admin";
    report = base({ overdue: 3 });
    const { container } = render(<CourierDeadlineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("ma'lumot kelmagan bo'lsa ko'rinmaydi", () => {
    const { container } = render(<CourierDeadlineBanner />);
    expect(container.firstChild).toBeNull();
  });

  /** Istisno qilingan kuryerni bezovta qilmaymiz. */
  it("istisno qilingan kuryerga ko'rinmaydi", () => {
    report = base({ overdue: 3 }, { exempt: true });
    const { container } = render(<CourierDeadlineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("kechikkan ham, bugun tugaydigan ham bo'lmasa ko'rinmaydi", () => {
    report = base();
    const { container } = render(<CourierDeadlineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("bugun tugaydiganlar bo'lsa amber, kechikkanlar bo'lsa qizil", () => {
    report = base({ due_today: 2, penalty_tomorrow: 4000 });
    const { container, unmount } = render(<CourierDeadlineBanner />);
    expect(container.innerHTML).toContain("amber");
    unmount();

    report = base({ overdue: 1, penalty_now: 2000, penalty_tomorrow: 4000 });
    const { container: c2 } = render(<CourierDeadlineBanner />);
    expect(c2.innerHTML).toContain("red");
  });

  /**
   * ⚠️ «ERTAGA» SONI DOIM KO'RINADI — bugun bosish qarorini aynan shu
   * o'zgartiradi. «Hozir» esa 0 bo'lsa yashiriladi: «0 so'm» ogohlantirishni
   * kuchsizlantirardi.
   */
  it("ertangi summa doim, hozirgi summa faqat noldan katta bo'lsa", () => {
    report = base({ due_today: 1, penalty_now: 0, penalty_tomorrow: 2000 });
    const { container, unmount } = render(<CourierDeadlineBanner />);
    expect(container.textContent).toContain("2 000");
    expect(container.textContent).not.toContain("sumNow");
    unmount();

    report = base({ overdue: 1, penalty_now: 6000, penalty_tomorrow: 8000 });
    const { container: c2 } = render(<CourierDeadlineBanner />);
    expect(c2.textContent).toContain("6 000");
    expect(c2.textContent).toContain("8 000");
  });

  it("SOYA rejimida pul yechilmasligi AYTILADI", () => {
    report = base({ overdue: 1, penalty_now: 2000 }, { active: false });
    render(<CourierDeadlineBanner />);
    expect(screen.getByText(/shadowNotice|Sinov rejimi/)).toBeInTheDocument();
  });

  it("modul yoqilgan bo'lsa soya ogohlantirishi YO'Q", () => {
    report = base({ overdue: 1, penalty_now: 2000 }, { active: true });
    const { container } = render(<CourierDeadlineBanner />);
    expect(container.textContent).not.toContain("shadowNotice");
  });
});
