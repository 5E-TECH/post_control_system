import { useEffect, useRef, useState } from "react";

/**
 * TESKARI SANOQ — server bergan "qancha soniya qoldi" dan boshlab.
 *
 * ⚠️ NEGA `expires_at` (absolyut vaqt) ISHLATILMAYDI. Arzon telefon va
 * ish-stoli soatlari bir necha daqiqaga adashishi odatiy hol (ProofCountdown
 * izohida ham shu saboq bor). Muddatni SERVER belgilaydi, shuning uchun
 * sanoq ham serverning "qoldi" qiymatidan boshlanadi va mahalliy
 * o'tgan-vaqt bilan kamayadi — qurilma soati noto'g'ri bo'lsa ham sanoq
 * TO'G'RI ishlaydi.
 *
 * ⚠️⚠️ QIYMAT SAQLANMAYDI, HAR RENDERDA HOSIL QILINADI — VA BU
 * PRODUCTION NUQSONIDAN KEYINGI QAROR (2026-10-06).
 *
 * Avval `left` `useState` da saqlanib, faqat `useEffect` ichida
 * yangilanardi. Effektlar esa renderdan KEYIN ishlaydi, ya'ni
 * `restartKey` o'zgargan RENDERDA hook hamon ESKI qiymatni (odatda 0)
 * qaytarardi. Chaqiruvchilar shu bitta renderda «muddati tugagan»
 * degan xulosaga kelib, quyidagi ikki nuqsonni berardi:
 *
 *   · `HandoverSession`: `if (auth && left <= 0) setAuth(null)` —
 *     xodim PIN kiritgan yoki QR skanerlagan ZAHOTI ruxsat o'chardi va
 *     «ruxsat tugadi» chiqardi. Tasdiqlash umuman ishlamasdi.
 *
 *   · `ConsentModal`: `expired` → avto-yangilash → YANGI sessiya →
 *     yana stale 0 → yana yangilash. CHEKSIZ halqa: market ekranidagi
 *     QR bir renderdayoq eskirardi va xodim doim «muddati tugagan»
 *     xatosini olardi.
 *
 * Shuning uchun `left` endi holat EMAS: u har renderda `startedAt` va
 * `Date.now()` dan hisoblanadi. Interval faqat QAYTA RENDERNI
 * uyg'otadi, qiymatni o'zi belgilamaydi — ya'ni qiymat hech qachon
 * eskirmaydi.
 */
export function useSecondsCountdown(
  totalSeconds: number | null | undefined,
  restartKey?: string | number,
): number {
  const total = Math.max(0, Math.floor(Number(totalSeconds ?? 0)));

  /**
   * Sanoq boshlangan payt. `restartKey` yoki `total` o'zgarsa AYNI
   * RENDERDA qayta urug'lantiriladi — shuning uchun pastdagi hisob
   * darhol to'g'ri qiymat beradi.
   *
   * ⚠️ Render paytida ref o'zgartirish ataylab: u faqat propslardan
   * hosil bo'ladi va takroriy render ayni natijani beradi (idempotent).
   * Holatga (`setState`) o'tkazsak React renderni BEKOR QILIB qayta
   * yurgizardi va nuqson qaytib kelardi.
   */
  const seed = useRef({ key: restartKey, total, startedAt: Date.now() });
  if (seed.current.key !== restartKey || seed.current.total !== total) {
    seed.current = { key: restartKey, total, startedAt: Date.now() };
  }

  // Faqat qayta renderni uyg'otish uchun — qiymat bu yerdan olinmaydi.
  const [, tick] = useState(0);

  useEffect(() => {
    if (total <= 0) return;
    /**
     * ⚠️ `left - 1` emas, o'tgan vaqtdan QAYTA hisoblash: tab fonga
     * o'tganda brauzer `setInterval`ni sekinlashtiradi (yoki to'xtatadi)
     * va kamaytirish usuli sanoqni haqiqatdan uzib qo'yardi — ekran
     * "3:12 qoldi" deb turgan payt ruxsat allaqachon tugagan bo'lardi.
     */
    const id = setInterval(() => {
      tick((n) => n + 1);
      const elapsed = Math.floor((Date.now() - seed.current.startedAt) / 1000);
      if (seed.current.total - elapsed <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [total, restartKey]);

  const elapsed = Math.floor((Date.now() - seed.current.startedAt) / 1000);
  return Math.max(0, seed.current.total - elapsed);
}

/** `125` -> `"02:05"` */
export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
