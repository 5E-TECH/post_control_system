import { memo } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock } from "lucide-react";
import {
  deadlineCountdown,
  deadlineTone,
  formatSum,
  type CourierDeadlineRowLike,
} from "../../lib/deadlineTone";

/**
 * BITTA BUYURTMA MUDDATI — nishon.
 *
 * «Aynan qaysi buyurtmaga qancha vaqt qolgani» talabining javobi. Ohang va
 * matn `deadlineTone.ts` dan keladi — banner bilan AYNI manba, aks holda
 * ikki joy bir-biriga qarshi gapirardi.
 *
 * ⚠️ `safe` holatda KO'RINMAYDI. Har buyurtmaga yashil nishon qo'yilsa
 * ro'yxat shovqinga ko'milib, haqiqiy ogohlantirish ko'zdan qochardi.
 * Nishon faqat harakat kerak bo'lganda chiqadi.
 */
const DeadlineBadge = ({
  row,
  className = "",
}: {
  row?: CourierDeadlineRowLike | null;
  className?: string;
}) => {
  const { t } = useTranslation("orderList");
  if (!row) return null;

  const tone = deadlineTone(row);
  // Shtrafga tushmaydigan (modul yoqilishidan oldingi) buyurtmani
  // ogohlantirish bilan bezovta qilmaymiz.
  if (tone === "safe" || row.immune) return null;

  const palette = {
    late: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    today:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    soon: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    safe: "",
  }[tone];

  const countdown = deadlineCountdown(row.ms_left);
  const label =
    tone === "late"
      ? t("deadline.badgeLate", { count: row.late_days })
      : countdown.unit === "days"
        ? t("deadline.badgeDays", { count: countdown.value })
        : countdown.unit === "hours"
          ? t("deadline.badgeHours", { count: countdown.value })
          : t("deadline.badgeMinutes", { count: countdown.value });

  return (
    /*
      ⚠️ `flex-wrap` — nishon ichidagi IKKI bo'lak kerak bo'lsa ikki
      qatorga tushadi, lekin har bo'lakning O'ZI bo'linmaydi.

      Butun nishonga `whitespace-nowrap` qo'yilgan edi va u o'zbekcha
      matnda («6 kun kechikdi · 12 000 so'm») jadval katagidan toshib,
      yonidagi «Sotish» tugmasi ostida qolgandi. Ingliz tilida sig'gani
      uchun nuqson birinchi qarashda ko'rinmasdi — uch tilni ham tekshirish
      shart edi.
    */
    <span
      className={`inline-flex flex-wrap items-center gap-x-1 rounded-lg px-2 py-0.5 text-xs font-medium ${palette} ${className}`}
      title={t("deadline.badgeTitle", {
        days: row.deadline_days,
        date: new Date(row.deadline_at).toLocaleString(),
      })}
    >
      {/*
        Belgi va matn BITTA bo'lakda: alohida qoldirilsa, uzun tarjimada
        (ruscha «просрочено на 6 дн.») belgi yolg'iz qatorga tushib
        qolardi.
      */}
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {tone === "late" ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Clock className="h-3.5 w-3.5 shrink-0" />
        )}
        {label}
      </span>
      {/*
        Summa faqat NOLDAN KATTA bo'lganda. «0 so'm shtraf» yozuvi
        ogohlantirishni kuchsizlantirardi.
      */}
      {row.penalty_now > 0 && (
        <b className="whitespace-nowrap tabular-nums">
          · {formatSum(row.penalty_now)} {t("deadline.currency")}
        </b>
      )}
    </span>
  );
};

export default memo(DeadlineBadge);
