import { memo, useEffect, useState } from "react";
import { AlertTriangle, Timer } from "lucide-react";

/**
 * ISBOT MUDDATI — 24 soat.
 *
 * ⚠️ SERVERDAGI CRON BILAN BIR XIL BO'LISHI SHART
 * (`extra-cost.cron.ts` → `voidStaleAwaitingProof`). Ajralib ketsa kuryer
 * "6 soat bor" degan sanoqni ko'rib turganda so'rov allaqachon bekor
 * bo'lgan bo'lardi — ya'ni ekran yolg'on gapirardi.
 */
export const PROOF_DEADLINE_MS = 24 * 60 * 60 * 1000;

interface Props {
  /** So'rov yaratilgan vaqt (server epoch ms). */
  createdAt: number | null | undefined;
  /**
   * Server va telefon soati orasidagi farq (ms): `server_now - Date.now()`.
   *
   * ⚠️ NEGA KERAK. Arzon Android telefonlarda soat bir necha soatga
   * adashishi odatiy hol. Muddatni SERVER belgilaydi (CRON), shuning uchun
   * sanoq ham server vaqtida yurishi kerak — aks holda kuryer pulini
   * "vaqt bor" deb o'ylab turib yo'qotardi.
   */
  clockOffsetMs?: number;
  /** `compact` — karta ichidagi kichik ko'rinish. */
  variant?: "compact" | "banner";
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * TESKARI SANOQ — isbot biriktirishga qancha vaqt qolgani.
 *
 * ⚠️ HAR SONIYA O'ZI YANGILANADI, sahifani emas. Sanoq alohida komponent
 * bo'lgani uchun har soniyada FAQAT shu kichik matn qayta chiziladi —
 * butun ro'yxatni sekundiga bir marta qayta render qilish telefonda
 * sezilarli sekinlashuv berardi.
 */
function ProofCountdown({
  createdAt,
  clockOffsetMs = 0,
  variant = "compact",
}: Props) {
  const deadline = Number(createdAt ?? 0) + PROOF_DEADLINE_MS;

  const remaining = () => deadline - (Date.now() + clockOffsetMs);
  const [left, setLeft] = useState<number>(remaining);

  useEffect(() => {
    if (!createdAt) return;

    // Qiymatni darhol yangilaymiz — props o'zgarsa bir soniya kutib
    // turmasin (masalan isbot biriktirilib, ro'yxat yangilanganda).
    const first = remaining();
    setLeft(first);
    // Muddat tugagan bo'lsa sanaydigan narsa yo'q — soatni bekorga
    // yurgizib, telefon batareyasini yemaymiz.
    if (first <= 0) return;

    const id = setInterval(() => {
      const next = remaining();
      setLeft(next);
      if (next <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdAt, clockOffsetMs]);

  if (!createdAt) return null;

  const expired = left <= 0;
  const urgent = !expired && left < 60 * 60 * 1000; // 1 soatdan kam
  const soon = !expired && !urgent && left < 6 * 60 * 60 * 1000;

  const total = Math.max(0, Math.floor(left / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const clock = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;

  // ⚠️ Sinflar LITERAL — Tailwind shablon ifodasidan sinf yasay olmaydi
  // (`text-${tone}-700` qoidani UMUMAN yaratmaydi va matn rangsiz qoladi).
  const tone = expired
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : urgent
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : soon
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";

  const size =
    variant === "banner"
      ? "text-sm px-2.5 py-1"
      : "text-[11px] px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold tabular-nums ${tone} ${size} ${
        urgent && !expired ? "animate-pulse" : ""
      }`}
      title={
        expired
          ? "Isbot muddati tugadi"
          : "Shu vaqt ichida isbot biriktirilmasa so'rov bekor bo'ladi"
      }
    >
      {expired ? (
        <>
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Muddat tugadi
        </>
      ) : (
        <>
          <Timer className="h-3 w-3 shrink-0" />
          {clock}
        </>
      )}
    </span>
  );
}

export default memo(ProofCountdown);
