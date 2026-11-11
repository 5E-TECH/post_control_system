import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CarrierApiChip from ".";

describe("CarrierApiChip", () => {
  it("carrier kuryerida «CARRIER API» belgisi", () => {
    render(<CarrierApiChip provider="carrier" />);
    expect(screen.getByText("CARRIER API")).toHaveClass("bg-indigo-600");
  });

  it.each([undefined, null, "", "ldg", "elchi"])("boshqa kuryerda (%s) — hech narsa", (provider) => {
    const { container } = render(<CarrierApiChip provider={provider} />);
    expect(container).toBeEmptyDOMElement();
  });
});
