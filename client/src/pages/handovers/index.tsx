import { memo } from "react";
import { useTranslation } from "react-i18next";
import { PackageCheck } from "lucide-react";
import BatchList from "./BatchList";

/**
 * XODIM: TOPSHIRILGAN QAYTARISHLAR TARIXI.
 *
 * «Market kutilmoqda» ekranining juftligi: u hali topshirilmaganlarni
 * ko'rsatadi, bu esa topshirilganlarni — xuddi «topshirilgan pochta»
 * kabi partiya bo'lib.
 */
function HandoversPage() {
  const { t } = useTranslation("marketReturns");

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
          <PackageCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-800 sm:text-xl dark:text-white">
            {t("historyTitle")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("historySubtitle")}
          </p>
        </div>
      </div>

      <BatchList mode="staff" />
    </div>
  );
}

export default memo(HandoversPage);
