import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import SearchInput from ".";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SearchInput
        value={value}
        onChange={setValue}
        placeholder="Qidirish"
        aria-label="qidiruv"
      />
      <span data-testid="value">{value}</span>
    </>
  );
}

describe("SearchInput", () => {
  it("yozilgan matnni yuqoriga uzatadi", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("qidiruv"), "Anvar");
    expect(screen.getByTestId("value").textContent).toBe("Anvar");
  });

  /**
   * ⚠️ TOZALASH TUGMASI qiymat BO'LGANDA paydo bo'ladi. Bo'sh inputda
   * turgan X foydasiz bo'lib, teginish nishonini egallab turardi.
   */
  it("tozalash tugmasi faqat qiymat bo'lganda chiqadi", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByLabelText("clear")).toBeNull();
    await user.type(screen.getByLabelText("qidiruv"), "a");
    expect(screen.getByLabelText("clear")).toBeTruthy();
  });

  it("tozalagandan keyin fokus inputda qoladi", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Anvar" />);
    await user.click(screen.getByLabelText("clear"));
    expect(screen.getByTestId("value").textContent).toBe("");
    // Yozishni darhol davom etish uchun — aks holda foydalanuvchi
    // qaytib inputga bosishi kerak bo'lardi.
    expect(screen.getByLabelText("qidiruv")).toHaveFocus();
  });

  it("Escape tozalaydi", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Anvar" />);
    const input = screen.getByLabelText("qidiruv");
    await user.click(input);
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("value").textContent).toBe("");
  });

  it("Enter onEnter'ni chaqiradi", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    render(
      <SearchInput
        value="a"
        onChange={() => {}}
        onEnter={onEnter}
        aria-label="qidiruv"
      />,
    );
    await user.click(screen.getByLabelText("qidiruv"));
    await user.keyboard("{Enter}");
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("loading bo'lsa spinner, aks holda lupa", () => {
    const { container, unmount } = render(
      <SearchInput value="" onChange={() => {}} loading aria-label="q" />,
    );
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    unmount();

    const { container: c2 } = render(
      <SearchInput value="" onChange={() => {}} aria-label="q" />,
    );
    expect(c2.querySelector(".animate-spin")).toBeNull();
  });

  /**
   * ⚠️ Ikonka `pointer-events-none` bo'lmasa, uning ustiga bosilganda
   * input FOKUSLANMAYDI — foydalanuvchi «bosdim, yozilmadi» deydi.
   */
  it("ikonka bosishni to'smaydi", () => {
    const { container } = render(
      <SearchInput value="" onChange={() => {}} aria-label="q" />,
    );
    expect(container.querySelector(".pointer-events-none")).toBeTruthy();
  });
});
