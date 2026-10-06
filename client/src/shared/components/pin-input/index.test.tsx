import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import PinInput from ".";

/** Nazoratli qobiq — haqiqiy ishlatilish shakli. */
function Harness({ onComplete }: { onComplete?: (d: string) => void }) {
  const [pin, setPin] = useState("");
  return (
    <>
      <PinInput
        value={pin}
        onChange={setPin}
        onComplete={onComplete}
        label="PIN"
      />
      <span data-testid="value">{pin}</span>
    </>
  );
}

describe("PinInput — 6 xonali kod", () => {
  it("faqat raqam qabul qiladi", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("PIN"), "1a2b3c");
    expect(screen.getByTestId("value").textContent).toBe("123");
  });

  it("uzunlikdan oshig'ini kesadi", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("PIN"), "1234567890");
    expect(screen.getByTestId("value").textContent).toBe("123456");
  });

  /**
   * ⚠️ ASOSIY TEST. `onComplete` RAQAMLARNI argument bilan beradi, chunki
   * `onChange` dan keyin `value` propi hali yangilanmagan — chaqiruvchi
   * `value` ga tayansa serverga 5 xonali (eski) PIN ketardi va ruxsat
   * ochilmasdi.
   */
  it("to'lganda onComplete TO'LIQ kodni beradi", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.type(screen.getByLabelText("PIN"), "483920");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("483920");
  });

  it("to'lmaganda onComplete chaqirilmaydi", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await user.type(screen.getByLabelText("PIN"), "4839");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("joylashtirish ESKI raqamlarga qo'shilmaydi", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const input = screen.getByLabelText("PIN");
    await user.type(input, "11");
    await user.click(input);
    await user.paste("483920");
    expect(screen.getByTestId("value").textContent).toBe("483920");
    expect(onComplete).toHaveBeenCalledWith("483920");
  });

  /**
   * ⚠️ APPARAT SKANERI UCHUN KRITIK. Sahifada skaner doim aktiv va fokus
   * `INPUT` da bo'lsa `useMarketQrScanner` hodisani o'tkazib yuboradi.
   * PIN maydoni o'zini avtomatik fokuslasa, kirgan zahoti QR skanerlash
   * ISHLAMAY qolardi.
   */
  it("o'zini AVTOMATIK fokuslamaydi", () => {
    render(<Harness />);
    expect(screen.getByLabelText("PIN")).not.toHaveFocus();
    expect(screen.getByLabelText("PIN")).not.toHaveAttribute("autofocus");
  });

  it("telefonda raqamli klaviatura va OTP avto-to'ldirish", () => {
    render(<Harness />);
    const input = screen.getByLabelText("PIN");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
  });

  it("disabled holatda yozilmaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PinInput value="" onChange={onChange} disabled label="PIN" />);
    await user.type(screen.getByLabelText("PIN"), "123");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("invalid bo'lsa qizil ramka, to'lgan bo'lsa yashil", () => {
    const { unmount } = render(
      <PinInput value="483920" onChange={() => {}} invalid label="PIN" />,
    );
    expect(screen.getByLabelText("PIN").className).toMatch(/border-red-400/);
    expect(screen.getByLabelText("PIN")).toHaveAttribute("aria-invalid", "true");
    unmount();

    render(<PinInput value="483920" onChange={() => {}} label="PIN" />);
    expect(screen.getByLabelText("PIN").className).toMatch(
      /border-emerald-400/,
    );
  });
});
