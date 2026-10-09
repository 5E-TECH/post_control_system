import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DeadlineBadge from ".";
import type { CourierDeadlineRowLike } from "../../lib/deadlineTone";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const row = (over: Partial<CourierDeadlineRowLike> = {}): CourierDeadlineRowLike => ({
  ms_left: 5 * DAY,
  days_left: 5,
  late_days: 0,
  due_today: false,
  penalty_now: 0,
  deadline_at: 1_790_000_000_000,
  deadline_days: 4,
  immune: false,
  ...over,
});

/**
 * ⚠️ NISHON SHOVQIN BO'LMASLIGI KERAK. Har buyurtmaga belgi qo'yilsa
 * ro'yxatda 30 ta yashil nishon turib, haqiqiy ogohlantirish ko'zdan
 * qochardi. Nishon FAQAT harakat kerak bo'lganda chiqadi — shu shartnoma
 * bu yerda qulflanadi.
 */
describe("DeadlineBadge — buyurtma muddati nishoni", () => {
  it("ma'lumot yo'q bo'lsa hech narsa chizmaydi", () => {
    const { container } = render(<DeadlineBadge row={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("vaqt yetarli bo'lsa KO'RINMAYDI", () => {
    const { container } = render(<DeadlineBadge row={row({ days_left: 5 })} />);
    expect(container.firstChild).toBeNull();
  });

  /**
   * ⚠️ GRANDFATHERING. Modul yoqilishidan oldin jo'natilgan buyurtma
   * shtrafga TUSHMAYDI — unga ogohlantirish qo'yilsa kuryer bo'lmagan
   * jazodan qo'rqib yurardi.
   */
  it("shtrafga tushmaydigan buyurtmaga ogohlantirish qo'yilmaydi", () => {
    const { container } = render(
      <DeadlineBadge row={row({ late_days: 9, immune: true })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("2 kun qolganda sariq, bugun tugasa amber, kechikkanda qizil", () => {
    const cases: Array<[Partial<CourierDeadlineRowLike>, string]> = [
      [{ days_left: 2, ms_left: 2 * DAY }, "yellow"],
      [{ days_left: 0, ms_left: 5 * HOUR, due_today: true }, "amber"],
      [{ days_left: null, ms_left: -DAY, late_days: 2 }, "red"],
    ];
    for (const [over, color] of cases) {
      const { container, unmount } = render(<DeadlineBadge row={row(over)} />);
      expect(container.innerHTML).toContain(`${color}-100`);
      unmount();
    }
  });

  /**
   * ⚠️ OXIRGI SUTKADA SOAT. «0 kun qoldi» kuryerga «hali vaqt bor» degan
   * yolg'on signal berardi — aynan shu holatda bosish eng muhim.
   */
  it("bir kundan kam qolsa soat ko'rsatiladi", () => {
    render(
      <DeadlineBadge
        row={row({ days_left: 0, ms_left: 5 * HOUR, due_today: true })}
      />,
    );
    // i18n sinovda kalitni qaytaradi — soat variantiga tushgani muhim
    expect(screen.getByText(/badgeHours|soat/)).toBeInTheDocument();
  });

  /** Nol summa yozilmaydi — ogohlantirishni kuchsizlantirardi. */
  it("shtraf 0 bo'lsa summa yozilmaydi", () => {
    const { container } = render(
      <DeadlineBadge
        row={row({ days_left: 0, ms_left: HOUR, due_today: true, penalty_now: 0 })}
      />,
    );
    expect(container.textContent).not.toContain("·");
  });

  it("shtraf bor bo'lsa summa ko'rsatiladi", () => {
    const { container } = render(
      <DeadlineBadge
        row={row({ days_left: null, ms_left: -DAY, late_days: 3, penalty_now: 6000 })}
      />,
    );
    expect(container.textContent).toContain("6 000");
  });
});
