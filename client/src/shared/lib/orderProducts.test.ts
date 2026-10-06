import { describe, expect, it } from "vitest";
import { summarizeProducts } from "./orderProducts";

describe("summarizeProducts — ro'yxatdagi mahsulot ustuni", () => {
  it("bitta mahsulot nomi va soni bilan chiqadi", () => {
    const p = summarizeProducts([{ name: "televizor", quantity: 2 }], 2);
    expect(p.nameless).toBe(false);
    expect(p.visible).toEqual([{ name: "televizor", quantity: 2 }]);
    expect(p.hiddenCount).toBe(0);
    expect(p.fullText).toBe("televizor x2");
  });

  it("uchtadan ko'pi qisqartiriladi, tooltipda TO'LIQ qoladi", () => {
    const p = summarizeProducts(
      [
        { name: "rus tili", quantity: 2 },
        { name: "ingliz tili", quantity: 1 },
        { name: "matematika", quantity: 3 },
        { name: "fizika", quantity: 1 },
      ],
      7,
    );
    expect(p.visible).toHaveLength(2);
    expect(p.hiddenCount).toBe(2);
    // Tooltip hammasini ko'rsatadi — ustun qisqargani bilan ma'lumot yo'qolmaydi.
    expect(p.fullText).toBe(
      "rus tili x2, ingliz tili x1, matematika x3, fizika x1",
    );
    expect(p.totalQuantity).toBe(7);
  });

  /**
   * ⚠️ MARKETPLACE HOLATI. `marketplace-intake` ataylab `order_item`
   * YARATMAYDI, ya'ni `product_quantity > 0` bo'lsa ham `items` BO'SH.
   * Qoplanmasa ustun bo'm-bo'sh chiqib, market «mahsulot yo'qolibdi»
   * deb o'ylardi.
   */
  it("items BO'SH bo'lsa donaga qaytadi (marketplace buyurtmasi)", () => {
    const p = summarizeProducts([], 3);
    expect(p.nameless).toBe(true);
    expect(p.totalQuantity).toBe(3);
    expect(p.visible).toEqual([]);
  });

  it("null/undefined xavfsiz", () => {
    expect(summarizeProducts(null, null).nameless).toBe(true);
    expect(summarizeProducts(undefined, undefined).totalQuantity).toBe(0);
  });

  it("bo'sh nomli qatorlar tashlanadi (mahsulot o'chirilgan)", () => {
    // Server `item.product` null bo'lsa `"—"` qaytaradi; bo'sh satr esa
    // ustunni «nomsiz» holatga tushirmasligi kerak.
    const p = summarizeProducts(
      [
        { name: "  ", quantity: 1 },
        { name: "tv", quantity: 1 },
      ],
      2,
    );
    expect(p.visible).toEqual([{ name: "tv", quantity: 1 }]);
    expect(p.nameless).toBe(false);
  });

  it("manfiy/buzuq son 0 ga keltiriladi", () => {
    const p = summarizeProducts(
      [{ name: "tv", quantity: -5 as number }],
      -1,
    );
    expect(p.visible[0].quantity).toBe(0);
    expect(p.totalQuantity).toBe(0);
  });
});
