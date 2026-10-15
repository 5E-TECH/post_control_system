import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Info, Layers, TrendingDown, TrendingUp, Undo2, Wallet } from "lucide-react";
import { useCourierPenaltyAdmin } from "../../../shared/api/hooks/useCourierPenalty";
import { formatSum } from "../../../shared/lib/deadlineTone";
import { TabError, TabLoading } from "../components/TabState";

/**
 * YIG'INDI — «yoqilsa nima bo'ladi» ekrani.
 *
 * ⚠️ YOQISH QARORINI AYNAN SHU EKRAN HAL QILADI. Shuning uchun u
 * raqamlarni ko'rsatib qo'ya qolmaydi, ularni O'QIYDI ham: `capped_count`
 * yuqori bo'lsa, bitta tekis qoida yetarli emas va kechikish darajalari
 * kerak degan xulosa ochiq yoziladi.
 *
 * ⚠️ IKKI QATLAM BIRINCHI O'RINDA, ARALASH SON PASTDA. Ilgari eng
 * tepada «Shtraf 122 000» turardi — bu HAQIQIY va SINOV qatlamlarining
 * yig'indisi edi, pastda esa «Haqiqiy 20 000» yozilardi. Admin ikki sonni
 * bir-biriga to'g'rilay olmasdi va ikkalasiga ham ishonmay qo'yardi.
 * Endi birinchi qatorda kassa bilan solishtiriladigan son turadi,
 * aralash hisob esa ochiq «ikki qatlam birga» yorlig'i bilan pastda.
 */

const LayerCard = ({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "real" | "test";
}) => (
  <div
    className={`rounded-2xl border p-4 ${
      tone === "real"
        ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/15"
        : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/15"
    }`}
  >
    <div
      className={`mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
        tone === "real"
          ? "text-red-700 dark:text-red-300"
          : "text-amber-700 dark:text-amber-300"
      }`}
    >
      {icon}
      {label}
    </div>
    <div
      className={`text-3xl font-bold tabular-nums ${
        tone === "real"
          ? "text-red-700 dark:text-red-300"
          : "text-amber-700 dark:text-amber-300"
      }`}
    >
      {value}
    </div>
    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{hint}</p>
  </div>
);

const MiniStat = ({
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
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-[#2A263D]">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold tabular-nums ${palette}`}>{value}</div>
      {sub && (
        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {sub}
        </div>
      )}
    </div>
  );
};

const SummaryTab = () => {
  const { t } = useTranslation("penalty");
  const { getSummary } = useCourierPenaltyAdmin();
  const { data, isLoading, isError, refetch } = getSummary();

  if (isError) return <TabError onRetry={() => refetch()} />;
  if (isLoading || !data) return <TabLoading />;

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
      {/* ─── Qaror uchun ikki son ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LayerCard
          tone="real"
          icon={<Wallet className="h-3.5 w-3.5" />}
          label={t("summary.layerReal")}
          value={`${formatSum(data.real.net)} ${t("currency")}`}
          hint={t("summary.layerRealHint", { count: data.real.count })}
        />
        <LayerCard
          tone="test"
          icon={<Layers className="h-3.5 w-3.5" />}
          label={t("summary.layerShadow")}
          value={`${formatSum(data.shadow.net)} ${t("currency")}`}
          hint={t("summary.layerShadowHint", { count: data.shadow.count })}
        />
      </div>

      {/* ─── Tafsilot: ikki qatlam BIRGA ─── */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          <Layers className="h-3.5 w-3.5" />
          {t("summary.breakdownTitle")}
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label={t("summary.penalty")}
            value={formatSum(data.penalty.sum)}
            sub={t("summary.entries", { count: data.penalty.count })}
            tone="bad"
          />
          <MiniStat
            icon={<TrendingDown className="h-3.5 w-3.5" />}
            label={t("summary.bonus")}
            value={formatSum(data.bonus.sum)}
            sub={t("summary.entries", { count: data.bonus.count })}
            tone="good"
          />
          <MiniStat
            icon={<Undo2 className="h-3.5 w-3.5" />}
            label={t("summary.waived")}
            value={formatSum(data.waiver.sum)}
            sub={t("summary.entries", { count: data.waiver.count })}
          />
          <MiniStat
            icon={<Info className="h-3.5 w-3.5" />}
            label={t("summary.couriersLabel")}
            value={String(data.couriers)}
            sub={t("summary.shadowEntries", { count: data.shadow_count })}
          />
        </div>
      </div>

      {/* ─── Xulosa, nafaqat raqam ─── */}
      <div
        className={`rounded-2xl border px-4 py-3 ${
          cappedShare > 50
            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
            : "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#2A263D]"
        }`}
      >
        <div className="text-sm font-semibold text-gray-800 dark:text-white">
          {t("summary.cappedTitle", {
            count: data.capped_count,
            share: cappedShare,
          })}
        </div>
        <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
          {cappedShare > 50 ? t("summary.cappedHigh") : t("summary.cappedLow")}
        </div>
      </div>
    </div>
  );
};

export default memo(SummaryTab);
