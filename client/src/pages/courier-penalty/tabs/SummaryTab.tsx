import { memo } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical, Info, TrendingDown, TrendingUp, Undo2 } from "lucide-react";
import { useCourierPenaltyAdmin } from "../../../shared/api/hooks/useCourierPenalty";
import { formatSum } from "../../../shared/lib/deadlineTone";

/**
 * SOYA YIG'INDISI — «agar yoqilganda qancha bo'lardi».
 *
 * ⚠️ YOQISH QARORINI AYNAN SHU EKRAN HAL QILADI. Shuning uchun u
 * raqamlarni ko'rsatib qo'ya qolmaydi, ularni O'QIYDI ham: `capped_count`
 * yuqori bo'lsa, bitta tekis qoida yetarli emas va kechikish darajalari
 * kerak degan xulosa ochiq yoziladi. Aks holda bu son jadvalda turib,
 * hech kim undan xulosa chiqarmasdi.
 */
const Card = ({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "bad" | "good";
}) => {
  const palette = {
    neutral: "text-gray-800 dark:text-white",
    bad: "text-red-600 dark:text-red-400",
    good: "text-green-600 dark:text-green-400",
  }[tone];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#2A263D]">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${palette}`}>{value}</div>
      {sub && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</div>
      )}
    </div>
  );
};

const SummaryTab = () => {
  const { t } = useTranslation("penalty");
  const { getSummary } = useCourierPenaltyAdmin();
  const { data, isLoading } = getSummary();

  if (isLoading || !data)
    return <div className="p-6 text-sm text-gray-500">…</div>;

  const since = data.module.shadow_since
    ? new Date(data.module.shadow_since).toLocaleDateString()
    : null;

  /**
   * Pol qanchalik tez-tez ishlaganini ulushda ko'rsatamiz — yalang'och
   * son («12 ta») o'z-o'zidan hech narsa aytmaydi.
   */
  const cappedShare =
    data.penalty.count > 0
      ? Math.round((data.capped_count / data.penalty.count) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Modul holati */}
      <div
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
          data.module.active
            ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
            : "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40"
        }`}
      >
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
        <div className="text-sm">
          <div className="font-semibold text-gray-800 dark:text-white">
            {data.module.active ? t("summary.live") : t("summary.shadow")}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {data.module.active
              ? t("summary.liveHint")
              : t("summary.shadowHint", { since: since ?? "—" })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label={t("summary.penalty")}
          value={`${formatSum(data.penalty.sum)}`}
          sub={t("summary.entries", { count: data.penalty.count })}
          tone="bad"
        />
        <Card
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          label={t("summary.bonus")}
          value={`${formatSum(data.bonus.sum)}`}
          sub={t("summary.entries", { count: data.bonus.count })}
          tone="good"
        />
        <Card
          icon={<Undo2 className="h-3.5 w-3.5" />}
          label={t("summary.waived")}
          value={`${formatSum(data.waiver.sum)}`}
          sub={t("summary.entries", { count: data.waiver.count })}
        />
        <Card
          icon={<Info className="h-3.5 w-3.5" />}
          label={t("summary.net")}
          value={`${formatSum(data.net)}`}
          sub={t("summary.couriers", { count: data.couriers })}
          tone="bad"
        />
      </div>

      {/*
        ⚠️ XULOSA, RAQAM EMAS. `capped_count` — modulning eng muhim
        signali: ko'pchilik tarif chegarasiga ursa, bitta tekis qoida
        yetarli emas. Buni jadvalga qo'yib qo'ysak, hech kim undan
        xulosa chiqarmasdi.
      */}
      {data.penalty.count > 0 && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            cappedShare >= 50
              ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
              : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/30"
          }`}
        >
          <div className="font-medium text-gray-800 dark:text-white">
            {t("summary.cappedTitle", {
              count: data.capped_count,
              share: cappedShare,
            })}
          </div>
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {cappedShare >= 50
              ? t("summary.cappedHigh")
              : t("summary.cappedLow")}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(SummaryTab);
