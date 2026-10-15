import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * YUKLANISH / XATO / BO'SH — UCHALASI UCHUN YAGONA KO'RINISH.
 *
 * ⚠️ NEGA BU FAYL BOR. Ilgari har tab faqat `isLoading` va `!data` ni
 * ko'rardi. So'rov 403/500 bilan yiqilsa `data` undefined qolib, ekranda
 * «ma'lumot yo'q» chiqardi — Kechikkanlar tabi esa YASHIL «hammasi
 * joyida» deb yozardi, ya'ni buzilgan so'rov XUSHXABARGA aylanardi va
 * nosozlikni topib bo'lmasdi. Endi xato alohida, qizil va qayta urinish
 * tugmasi bilan ko'rsatiladi.
 */

export const TabLoading = () => (
  <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-16 text-sm text-gray-500 dark:border-gray-800 dark:bg-[#2A263D] dark:text-gray-400">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>…</span>
  </div>
);

export const TabError = ({ onRetry }: { onRetry?: () => void }) => {
  const { t } = useTranslation("penalty");
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 py-12 text-center dark:border-red-900/50 dark:bg-red-900/15">
      <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
      <div>
        <p className="font-semibold text-red-800 dark:text-red-300">
          {t("state.errorTitle")}
        </p>
        <p className="mt-1 max-w-md px-4 text-sm text-red-700/80 dark:text-red-400/80">
          {t("state.errorHint")}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/30"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("state.retry")}
        </button>
      )}
    </div>
  );
};

export const TabEmpty = ({
  icon,
  title,
  hint,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  tone?: "neutral" | "good";
}) => (
  <div
    className={`flex flex-col items-center gap-2 rounded-2xl border py-14 text-center ${
      tone === "good"
        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
        : "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#2A263D]"
    }`}
  >
    <div
      className={
        tone === "good"
          ? "text-green-600 dark:text-green-400"
          : "text-gray-400 dark:text-gray-500"
      }
    >
      {icon}
    </div>
    <p
      className={`text-sm font-semibold ${
        tone === "good"
          ? "text-green-800 dark:text-green-300"
          : "text-gray-700 dark:text-gray-200"
      }`}
    >
      {title}
    </p>
    {hint && (
      <p className="max-w-sm px-4 text-xs text-gray-500 dark:text-gray-400">
        {hint}
      </p>
    )}
  </div>
);
