import { describe, expect, it } from "vitest";
import { isTextEntryTarget } from "./isTextEntryTarget";

const el = (html: string): HTMLElement => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.firstElementChild as HTMLElement;
};

/**
 * ⚠️ PRODUCTION NUQSONI (audit, 2026-10-07).
 *
 * Skaner filtri `tagName === "INPUT"` edi. antd `Checkbox` ichida haqiqiy
 * `<input type="checkbox">`, antd `Select` esa bosilganda ichki
 * `<input type="search" readOnly>` ni fokuslaydi VA variant tanlangandan
 * keyin ham fokusni ushlab qoladi. Ikkalasi ham topshirish ekranining
 * asosiy ro'yxatida — ya'ni «yorlig'i yirtilgan posilkani qo'lda belgilash»
 * oqimidan KEYIN skaner JIM o'lardi: apparat bip qiladi, ekranda hech narsa
 * qo'shilmaydi, «Skaner tayyor» esa yozib turaveradi.
 */
describe("isTextEntryTarget — skaner fokus filtri", () => {
  it("MATN maydonlari skanerni to'sadi", () => {
    expect(isTextEntryTarget(el('<input type="text" />'))).toBe(true);
    expect(isTextEntryTarget(el("<textarea></textarea>"))).toBe(true);
    expect(isTextEntryTarget(el('<input type="tel" />'))).toBe(true);
    expect(isTextEntryTarget(el('<input type="password" />'))).toBe(true);
    // Qidiruv maydoni — xodim yozayotganda skaner aralashmasin.
    expect(isTextEntryTarget(el('<input type="search" />'))).toBe(true);
    // PIN maydoni ATAYLAB to'sadi (raqamlar maydonga tushishi kerak).
    expect(isTextEntryTarget(el('<input inputmode="numeric" />'))).toBe(true);
  });

  it("CHECKBOX va RADIO skanerni TO'SMAYDI", () => {
    // antd Checkbox — qo'lda belgilash oqimining asosiy nishoni.
    expect(isTextEntryTarget(el('<input type="checkbox" />'))).toBe(false);
    expect(isTextEntryTarget(el('<input type="radio" />'))).toBe(false);
    expect(isTextEntryTarget(el('<input type="button" />'))).toBe(false);
  });

  it("antd Select ning readOnly ichki inputi TO'SMAYDI", () => {
    // Unga yozib bo'lmaydi, demak skanerni to'sishi mantiqsiz — sabab
    // tanlangandan keyin fokus aynan shu yerda qoladi.
    expect(isTextEntryTarget(el('<input type="search" readonly />'))).toBe(
      false,
    );
    expect(isTextEntryTarget(el('<input type="text" disabled />'))).toBe(false);
  });

  it("contentEditable to'sadi, oddiy element yo'q", () => {
    const ce = el("<div></div>");
    Object.defineProperty(ce, "isContentEditable", { value: true });
    expect(isTextEntryTarget(ce)).toBe(true);
    expect(isTextEntryTarget(el("<div></div>"))).toBe(false);
    expect(isTextEntryTarget(el("<button></button>"))).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});
