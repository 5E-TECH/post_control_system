import { memo } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical, Siren } from "lucide-react";
import { useCourierPenaltyAdmin } from "../../../shared/api/hooks/useCourierPenalty";
import { formatDate } from "../lib/penaltyFormat";

/**
 * MODUL HOLATI — HAR TABNING TEPASIDA.
 *
 * ⚠️ NEGA BU ELEMENT KERAK. Modulning eng ko'p chalkashtiradigan tomoni
 * ekranda umuman ko'rinmasdi: (1) sinov rejimida raqamlar ko'rinadi,
 * lekin pul yechilmaydi; (2) LANGARdan oldin jo'natilgan buyurtmalar
 * hech qachon shtrafga tushmaydi. Ikkisi birga «modul ishlamayapti»
 * degan taassurot berardi — aslida modul to'g'ri ishlab, ko'rsatadigan
 * narsasi yo'q edi. Endi ikkala fakt ham birinchi qatorda turadi.
 *
 * Langar sifatida AYNAN ro'yxat ishlatadigan qiymat ko'rsatiladi
 * (`activated_at ?? shadow_since`) — aks holda bar bir sanani, ro'yxat
 * esa boshqasini nazarda tutardi.
 */
const ModuleStatusBar = () => {
  const { t } = useTranslation("penalty");
  const { getConfig } = useCourierPenaltyAdmin();
  const { data } = getConfig();

  if (!data) return null;

  const live = data.is_active;
  const anchor = data.activated_at ?? data.shadow_since ?? null;

  return (
    <div
      className={`mb-4 flex flex-col gap-2 rounded-2xl border-l-4 px-4 py-3 sm:flex-row sm:items-center sm:gap-5 ${
        live
          ? "border-l-red-500 border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/15"
          : "border-l-amber-500 border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/15"
      }`}
    >
      <span
        className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
          live
            ? "bg-red-500 text-white"
            : "bg-amber-500 text-white"
        }`}
      >
        {live ? <Siren className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />}
        {live ? t("status.live") : t("status.test")}
      </span>

      <p
        className={`text-sm ${
          live
            ? "text-red-800 dark:text-red-200"
            : "text-amber-900 dark:text-amber-200"
        }`}
      >
        {live ? t("status.liveHint") : t("status.testHint")}
      </p>

      {anchor && (
        <p className="text-xs text-gray-600 sm:ml-auto sm:text-right dark:text-gray-300">
          <span className="font-semibold tabular-nums">
            {t("status.anchor")}: {formatDate(anchor)}
          </span>
          <br />
          <span className="text-gray-500 dark:text-gray-400">
            {t("status.anchorHint")}
          </span>
        </p>
      )}
    </div>
  );
};

export default memo(ModuleStatusBar);
