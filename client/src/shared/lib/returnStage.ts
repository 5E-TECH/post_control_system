/**
 * BEKOR QAYTARISH BOSQICHI — KO'RSATISH QATLAMI.
 *
 * ⚠️ NEGA KERAK. Bekor qilingan posilka markazga qabul qilinganda ham
 * `order.status` `cancelled (sent)` da QOLADI (yangi `Order_status` qiymati
 * ataylab qo'shilmadi — izoh: server migratsiyasi
 * `1750700000000-CancelReturnMarketHandover.ts`). Ya'ni XOM status yorlig'i
 * «Bekor (yuborilgan)» deb turadi va u YO'LDA degan ma'noni beradi —
 * holbuki posilka allaqachon omborda va kuryerdan OLINGAN.
 *
 * Shuning uchun status ko'rsatiladigan HAR JOYDA yorliq shu yerdan olinadi:
 *
 *   kuryerda → «Kuryerda»            (bekor qilindi, markazga kelmoqda)
 *   markazda → «Markazda»            (kuryerdan OLINDI, market kutilmoqda)
 *   marketda → «Marketga topshirildi» (zanjir yopildi)
 *
 * Server javobida `return_stage` keladi; kelmasa dalil ustunlaridan
 * hisoblanadi (zaxira) — shunda eski/boshqa endpointlarda ham to'g'ri
 * ko'rinadi.
 */

export type ReturnStage = "courier" | "center" | "market";

export interface ReturnStageSource {
  status?: string | null;
  return_stage?: ReturnStage | string | null;
  center_received_at?: number | string | null;
  market_handover_at?: number | string | null;
}

const CANCELLED_SENT = "cancelled (sent)";
const CLOSED = "closed";

/**
 * Bosqichni aniqlaydi. `null` — buyurtma bekor-qaytarish zanjirida emas.
 *
 * ⚠️ Dalil ustunlari STATUSDAN USTUN: almashtirish (kafolat-swap) qatorlari
 * zanjirdan o'tadi-yu statusi SOTILGAN bo'lib qoladi.
 */
export function resolveReturnStage(
  order: ReturnStageSource | null | undefined,
): ReturnStage | null {
  if (!order) return null;

  const fromServer = order.return_stage;
  if (
    fromServer === "courier" ||
    fromServer === "center" ||
    fromServer === "market"
  ) {
    return fromServer;
  }

  if (order.market_handover_at != null) return "market";
  if (order.center_received_at != null) return "center";
  if (order.status === CANCELLED_SENT) return "courier";
  // Dalilsiz CLOSED — LEGACY qator (oqim joriy etilishidan oldin yopilgan).
  if (order.status === CLOSED) return "market";
  return null;
}

export interface ReturnStageBadge {
  label: string;
  /** Tailwind sinflari — LITERAL (shablondan sinf yasab bo'lmaydi). */
  tone: string;
  /** Hover izohi — xodimga ma'noni to'liq aytadi. */
  title: string;
}

const BADGES: Record<ReturnStage, ReturnStageBadge> = {
  courier: {
    label: "Kuryerda",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    title: "Bekor qilindi — kuryer markazga olib kelmoqda",
  },
  center: {
    label: "Markazda",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    title: "Kuryerdan olindi va markazda turibdi — market olib ketishi kutilmoqda",
  },
  market: {
    label: "Marketga topshirildi",
    tone: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    title: "Market ruxsati bilan egasiga topshirildi — zanjir yopildi",
  },
};

export function returnStageBadge(
  stage: ReturnStage | null,
): ReturnStageBadge | null {
  return stage ? BADGES[stage] : null;
}

/**
 * Buyurtma uchun KO'RSATILADIGAN status yorlig'i.
 *
 * Bekor-qaytarish zanjiridagi qator uchun bosqich yorlig'ini qaytaradi,
 * qolganlari uchun `null` — chaqiruvchi o'zining mavjud xaritasidan
 * foydalanadi.
 */
export function returnStageDisplay(
  order: ReturnStageSource | null | undefined,
): ReturnStageBadge | null {
  return returnStageBadge(resolveReturnStage(order));
}

/** `1760000000000` → `06.10.2026 14:32` */
export function formatMoment(ts?: number | string | null): string {
  if (ts == null) return "—";
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Date(n).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
