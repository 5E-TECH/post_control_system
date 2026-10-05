import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Har testdan keyin DOM tozalanadi — aks holda ketma-ket testlarda
 * `getByText` bir nechta element topib "found multiple elements" bilan
 * yiqiladi va sabab topish qiyin bo'ladi.
 */
afterEach(() => {
  cleanup();
});

/**
 * jsdom SHIM'LARI — antd komponentlari uchun.
 *
 * ⚠️ antd Modal/Select ochilganda `rc-util` scroll-bar o'lchamini
 * `getComputedStyle(el, pseudoElt)` bilan o'lchaydi; jsdom pseudo-element
 * variantini QO'LLAB-QUVVATLAMAYDI va har renderda ulkan "Not implemented"
 * stack-trace chiqaradi. Test yiqilmaydi, lekin natija o'qilmaydigan bo'lib
 * ketadi va keyin HAQIQIY xatolar shovqin ichida ko'rinmay qoladi.
 */
const realGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((el: Element, pseudo?: string | null) =>
  pseudo
    ? ({ getPropertyValue: () => "" } as unknown as CSSStyleDeclaration)
    : realGetComputedStyle(el)) as typeof window.getComputedStyle;

// antd responsive observer `matchMedia` ni talab qiladi (jsdom'da yo'q).
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
