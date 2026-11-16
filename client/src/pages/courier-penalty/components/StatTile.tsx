import { memo } from "react";

/**
 * STATISTIKA KATAKCHASI.
 *
 * ⚠️ `emphasis` BOR, CHUNKI UCHTA SON TENG EMAS. Ilgari «Kuryerlar /
 * Buyurtmalar / Hozirgi shtraf» bir qatorda mayda matn bo'lib turardi va
 * eng muhim son — pul — ko'zga tashlanmasdi. Admin ekranga «qancha
 * yig'ilyapti» degan savol bilan keladi, shuning uchun o'sha katak
 * kattaroq va ohangli.
 */
export type TileTone = "neutral" | "danger" | "good" | "muted";

const toneRing: Record<TileTone, string> = {
  neutral: "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#2A263D]",
  danger: "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/15",
  good: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/15",
  muted: "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-[#231F35]",
};

const toneValue: Record<TileTone, string> = {
  neutral: "text-gray-900 dark:text-white",
  danger: "text-red-600 dark:text-red-400",
  good: "text-green-700 dark:text-green-400",
  muted: "text-gray-700 dark:text-gray-200",
};

const StatTile = ({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  emphasis = false,
  badge,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: TileTone;
  emphasis?: boolean;
  badge?: React.ReactNode;
}) => (
  <div className={`rounded-2xl border px-4 py-3 ${toneRing[tone]}`}>
    <div className="flex items-center gap-2">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </p>
      {badge}
    </div>
    <p
      className={`mt-1 font-bold tabular-nums ${toneValue[tone]} ${
        emphasis ? "text-2xl sm:text-3xl" : "text-xl"
      }`}
    >
      {value}
      {unit && (
        <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">
          {unit}
        </span>
      )}
    </p>
    {hint && (
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
    )}
  </div>
);

export default memo(StatTile);
