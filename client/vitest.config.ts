import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

/**
 * VITEST — klient testlari uchun ALOHIDA konfiguratsiya.
 *
 * ⚠️ NEGA `vite.config.ts` GA QO'SHILMADI: build konfiguratsiyasi
 * (`base: "/admin/"`, tailwind plugin, dev proxy) deploy yo'liga tegishli.
 * Vitest alohida faylda bo'lganda build xulqi 0% o'zgarmaydi — test
 * infratuzilmasini kiritish prod chiqarishga xavf tug'dirmaydi.
 *
 * Tailwind plugin ataylab YO'Q: testlar DOM va mantiqni tekshiradi,
 * ko'rinishni emas; u faqat testlarni sekinlashtirardi.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false, // `describe`/`it`/`expect` ataylab ANIQ import qilinadi
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
    clearMocks: true,
    /**
     * ⚠️ TEST VAQT CHEGARASI — 30 s (sukut 5 s edi).
     *
     * Klient testlari deploy paytida PROD SERVERDA ishlaydi
     * (`deploy.yml` → `npm run test`), u esa dasturchi Mac'idan ~3 barobar
     * sekin va bir vaqtda jonli ilovani ham xizmat qiladi. 2026-11-17
     * relizida carrier testlari (antd + StrictMode + jsdom) Mac'da
     * 0.4–3.2 s o'tardi, prodda esa 4.7–6.6 s ketib 18 tasi 5 s
     * chegarasida yiqildi va deploy to'xtadi.
     *
     * Chegara tezlik o'lchovi emas — osilib qolgan testni to'xtatish uchun
     * xavfsizlik to'ri. Haqiqiy xato (topilmagan element, noto'g'ri
     * so'rov) baribir darhol, aniq xabar bilan yiqiladi.
     */
    testTimeout: 30_000,
  },
});
