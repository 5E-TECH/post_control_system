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
 * @param totalSeconds server bergan boshlang'ich qiymat (0/null — sanoq yo'q)
 * @param restartKey o'zgarganda sanoq QAYTA boshlanadi (masalan yangi sessiya id)
 * @returns qolgan soniya (0 ga yetganda to'xtaydi)
 */
export function useSecondsCountdown(
  totalSeconds: number | null | undefined,
  restartKey?: string | number,
): number {
  const [left, setLeft] = useState<number>(() =>
    Math.max(0, Math.floor(Number(totalSeconds ?? 0))),
  );
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    const total = Math.max(0, Math.floor(Number(totalSeconds ?? 0)));
    startedAt.current = Date.now();
    setLeft(total);
    if (total <= 0) return;

    // ⚠️ `left - 1` emas, o'tgan vaqtdan QAYTA hisoblash: tab fonga
    // o'tganda brauzer `setInterval`ni sekinlashtiradi (yoki to'xtatadi) va
    // kamaytirish usuli sanoqni haqiqatdan uzib qo'yardi — ekran "3:12
    // qoldi" deb turgan payt ruxsat allaqachon tugagan bo'lardi.
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      const next = Math.max(0, total - elapsed);
      setLeft(next);
      if (next <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [totalSeconds, restartKey]);

  return left;
}

/** `125` -> `"02:05"` */
export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
