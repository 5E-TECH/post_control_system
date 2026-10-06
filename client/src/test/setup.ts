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

/**
 * i18next — HAQIQIY tarjima fayllari bilan.
 *
 * ⚠️ NEGA SHUNDAY. Ilova i18n'ni `i18next-http-backend` bilan yuklaydi, test
 * muhitida esa HTTP yo'q — init qilinmasa `t("kalit")` KALIT NOMINI
 * qaytaradi va komponent testlari matn bo'yicha tekshira olmaydi.
 *
 * Shuning uchun `public/locales/uz` dagi ASL fayllar o'qiladi (`uz` —
 * `fallbackLng`). Foydasi ikki tomonlama: testlar haqiqiy matnni ko'radi VA
 * kalit yetishmasa ekranda kalit nomi chiqib test YIQILADI — ya'ni tarjima
 * uzilishi jimgina o'tib ketmaydi.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const UZ_DIR = join(process.cwd(), "public", "locales", "uz");
const resources: Record<string, Record<string, unknown>> = {};
for (const file of readdirSync(UZ_DIR).filter((f) => f.endsWith(".json"))) {
  resources[file.replace(/\.json$/, "")] = JSON.parse(
    readFileSync(join(UZ_DIR, file), "utf8"),
  ) as Record<string, unknown>;
}

void i18n.use(initReactI18next).init({
  lng: "uz",
  fallbackLng: "uz",
  resources: { uz: resources },
  interpolation: { escapeValue: false },
});
