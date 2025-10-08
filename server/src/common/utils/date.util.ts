// src/common/utils/date.util.ts

const UZB_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * YYYY-MM-DD formatidagi sanani (UZB bo'yicha)
 * UTC timestampga (millisekund) o'zgartiradi.
 * endOfDay = true -> 23:59:59.999 (kun oxiri)
 */
export function toUzbekistanTimestamp(
  dateString: string,
  endOfDay = false,
): number {
  const [year, month, day] = dateString.split('-').map(Number);

  // Date.UTC(...) — bu bevosita UTC ga nisbatlangan timestamp beradi.
  // Ammo biz UZB (UTC+5) bo'yicha berilgan vaqtni UTC ga aylantirmoqchimiz,
  // shuning uchun UZB offsetni ayiramiz:
  const utcMs = Date.UTC(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );

  // UZB vaqt = UTC + UZB_OFFSET_MS
  // shuning uchun UZB vaqtdagi "2025-10-06 00:00"ning UTC dagi epoch_ms:
  // utcMs - UZB_OFFSET_MS
  return utcMs - UZB_OFFSET_MS;
}

/**
 * Hozirgi (bugungi) UZB sanasini aniqlab,
 * shu kunning boshi va oxirini UTC timestamp (ms) qaytaradi.
 */
export function getUzbekistanDayRange(): { start: number; end: number } {
  // Hozirgi UTC timestamp
  const nowUtcMs = Date.now();
  // UZB bo'yicha hozirgi vaqt uchun ms
  const uzNowMs = nowUtcMs + UZB_OFFSET_MS;
  const uzNow = new Date(uzNowMs);

  const year = uzNow.getUTCFullYear();
  const month = uzNow.getUTCMonth() + 1; // 1..12
  const day = uzNow.getUTCDate();

  const start = toUzbekistanTimestamp(
    `${year}-${pad(month)}-${pad(day)}`,
    false,
  );
  const end = toUzbekistanTimestamp(`${year}-${pad(month)}-${pad(day)}`, true);

  return { start, end };
}
