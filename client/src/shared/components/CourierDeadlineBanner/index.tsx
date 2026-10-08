import { memo } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock, FlaskConical } from "lucide-react";
import type { RootState } from "../../../app/store";
import { useCourierPenalty } from "../../api/hooks/useCourierPenalty";
import { bannerTone, formatSum } from "../../lib/deadlineTone";

/**
 * KURYERGA MUDDAT OGOHLANTIRISHI — banner.
 *
 * ⚠️ NEGA BANNER, TELEGRAM EMAS. Tizimda kuryerga Telegram orqali xabar
 * yuborishning yo'li YO'Q (`users.telegram_id` faqat MARKET va OPERATOR
 * uchun to'ldiriladi), WebSocket gateway esa amalda o'lik. Ya'ni kuryer
 * kuniga bir necha marta ochadigan ekrandagi belgi — YAGONA ishonchli
 * kanal. Ayni sabab `ExtraCostDecisionBanner` da ham yozilgan.
 *
 * ⚠️ SOYA REJIMIDA YOLG'ON GAPIRMAYDI. Modul `module.active = false`
 * bo'lsa pul YECHILMAYDI — banner buni OCHIQ aytadi. Aks holda kuryer
 * yechilmagan pulni yechilgan deb o'ylab, keyin modul haqiqatan
 * yoqilganda ogohlantirishga umuman ishonmay qo'yardi.
 */
const CourierDeadlineBanner = () => {
  const { t } = useTranslation("orderList");
  const role = useSelector((s: RootState) => s.roleSlice.role);
  const { getMyDeadlines } = useCourierPenalty();
  const { data } = getMyDeadlines(role === "courier");

  if (role !== "courier" || !data || data.module.exempt) return null;

  const { summary, module } = data;
  const tone = bannerTone(summary);
  if (!tone) return null;

  const late = tone === "late";
  const palette = late
    ? {
        box: "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20",
        chip: "bg-red-500/20",
        icon: "text-red-600 dark:text-red-400",
        title: "text-red-800 dark:text-red-300",
        sub: "text-red-700 dark:text-red-400",
      }
    : {
        box: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20",
        chip: "bg-amber-500/20",
        icon: "text-amber-600 dark:text-amber-400",
        title: "text-amber-800 dark:text-amber-300",
        sub: "text-amber-700 dark:text-amber-400",
      };

  return (
    <div
      className={`mb-4 w-full rounded-xl border px-4 py-3 ${palette.box}`}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${palette.chip}`}
        >
          {late ? (
            <AlertTriangle className={`h-4 w-4 ${palette.icon}`} />
          ) : (
            <Clock className={`h-4 w-4 ${palette.icon}`} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold ${palette.title}`}>
            {late
              ? t("deadline.bannerLate", { count: summary.overdue })
              : t("deadline.bannerToday", { count: summary.due_today })}
          </div>

          {/*
            Uch son: hozir, ertaga, eng ko'pi. «Ertaga» eng muhim —
            bugun bosish qarorini AYNAN shu o'zgartiradi.
          */}
          <div
            className={`mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] ${palette.sub}`}
          >
            {summary.penalty_now > 0 && (
              <span>
                {t("deadline.sumNow")}:{" "}
                <b className="tabular-nums">{formatSum(summary.penalty_now)}</b>{" "}
                {t("deadline.currency")}
              </span>
            )}
            <span>
              {t("deadline.sumTomorrow")}:{" "}
              <b className="tabular-nums">
                {formatSum(summary.penalty_tomorrow)}
              </b>{" "}
              {t("deadline.currency")}
            </span>
            <span>
              {t("deadline.sumMax")}:{" "}
              <b className="tabular-nums">{formatSum(summary.penalty_max)}</b>{" "}
              {t("deadline.currency")}
            </span>
          </div>

          {summary.due_today > 0 && late && (
            <div className={`mt-1 text-[11px] ${palette.sub}`}>
              {t("deadline.alsoDueToday", { count: summary.due_today })}
            </div>
          )}

          {/*
            ⚠️ SOYA OGOHLANTIRISHI. Pul yechilmasligi AYTILMASA banner
            yolg'on gapirgan bo'lardi.
          */}
          {!module.active && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">
              <FlaskConical className="h-3.5 w-3.5 shrink-0" />
              {t("deadline.shadowNotice")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(CourierDeadlineBanner);
