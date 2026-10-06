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
 *   kuryerda → `returnStageCourier`  (bekor qilindi, markazga kelmoqda)
 *   markazda → `returnStageCenter`   (kuryerdan OLINDI, market kutilmoqda)
 *   marketda → `returnStageMarket`   (zanjir yopildi)
 *
 * ⚠️ Yorliq MATNI emas, `status` namespace'idagi KALIT qaytariladi —
 * chaqiruvchi uni `t()` orqali tarjima qiladi (uz/ru/en).
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
  /**
   * `status` NAMESPACE'idagi tarjima kaliti.
   *
   * ⚠️ MATN QAYTARILMAYDI — faqat KALIT. Avval bu yerda o'zbekcha matn
   * qotib turgan edi va ekranlar ru/en tillarida ham o'zbekcha ko'rsatardi.
   * Kalitlar `status` namespace'ida, chunki uni status yorlig'i
   * ko'rsatiladigan ekranlar allaqachon yuklaydi
   * (`useTranslation("status")`).
   */
  labelKey: string;
  /** Hover izohi kaliti — xodimga ma'noni to'liq aytadi. */
  titleKey: string;
  /** Tailwind sinflari — LITERAL (shablondan sinf yasab bo'lmaydi). */
  tone: string;
}

const BADGES: Record<ReturnStage, ReturnStageBadge> = {
  courier: {
    labelKey: "returnStageCourier",
    titleKey: "returnStageCourierHint",
    tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  center: {
    labelKey: "returnStageCenter",
    titleKey: "returnStageCenterHint",
    tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  market: {
    labelKey: "returnStageMarket",
    titleKey: "returnStageMarketHint",
    tone: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export function returnStageBadge(
  stage: ReturnStage | null,
): ReturnStageBadge | null {
  return stage ? BADGES[stage] : null;
}

/**
 * Buyurtma uchun KO'RSATILADIGAN bosqich yorlig'i (kalitlar bilan).
 *
 * Bekor-qaytarish zanjiridagi qator uchun bosqichni qaytaradi, qolganlari
 * uchun `null` — chaqiruvchi o'zining mavjud status xaritasidan foydalanadi.
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

/**
 * POSILKA YOSHI RANGI — bitta chegara to'plami.
 *
 * ⚠️ NEGA SHARED. Bu funksiya avval uchta faylda (market sahifasi, navbat
 * sahifasi, topshirish sahifasi) QO'LDA takrorlangan va chegaralar BOSHQACHA
 * edi: market ekranida 7/3, xodim ekranlarida 14/7/3. Natijada AYNI posilka
 * marketda QIZIL, xodimda esa SARIQ ko'rinardi — ikki tomon bir xil narsaga
 * boshqacha shoshilinchlik bilan qarardi. Chegara bitta joyda turadi.
 *
 * 14 kun — qizil (market javob bermayapti, eskalatsiya), 7 — to'q sariq,
 * 3 — sariq, undan kami — neytral.
 */
export function returnAgeTone(days: number): string {
  if (days >= 14)
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (days >= 7)
    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  if (days >= 3)
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}
