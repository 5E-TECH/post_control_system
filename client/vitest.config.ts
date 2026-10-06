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
  },
});
