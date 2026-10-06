import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Test infratuzilmasining O'ZI ishlayotganini tasdiqlaydi (jsdom + RTL +
 * jest-dom matcherlari). Bu test yiqilsa — muammo komponentda emas,
 * konfiguratsiyada.
 */
describe("test infratuzilmasi", () => {
  it("jsdom + RTL + jest-dom ishlaydi", () => {
    render(<p>Markazda — market kutilmoqda</p>);
    expect(screen.getByText(/market kutilmoqda/i)).toBeInTheDocument();
  });
});
