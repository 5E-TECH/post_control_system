import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Gavel, ClipboardList, ListChecks, ScrollText, Sigma } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import OverdueTab from "./tabs/OverdueTab";
import LedgerTab from "./tabs/LedgerTab";
import RulesTab from "./tabs/RulesTab";
import SummaryTab from "./tabs/SummaryTab";

type TabKey = "overdue" | "summary" | "ledger" | "rules";

/**
 * KURYER SHTRAFLARI — admin ekrani.
 *
 * ⚠️ TAB TARTIBI MA'NO TASHIYDI. «Kechikkanlar» birinchi o'rinda, chunki
 * modulning eng katta kamchiligi aynan shu: shtraf faqat kuryer tugmani
 * BOSGANDA yoziladi, umuman bosmagan kuryer esa hech narsa to'lamaydi.
 * Ya'ni admin eng avval «kim bosmay o'tiribdi» degan savolga javob
 * ko'rishi kerak — qoidalar va daftar undan keyin keladi.
 *
 * Faol tab URL'da saqlanadi: admin kuryerga qo'ng'iroq qilib, orqaga
 * qaytganda yana birinchi tabdan boshlamasin.
 */
const CourierPenaltyPage = () => {
  const { t } = useTranslation("penalty");
  const [params, setParams] = useSearchParams();
  const active = (params.get("tab") as TabKey) || "overdue";

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: "overdue", label: t("tabs.overdue"), icon: <ListChecks className="h-4 w-4" /> },
    { key: "summary", label: t("tabs.summary"), icon: <Sigma className="h-4 w-4" /> },
    { key: "ledger", label: t("tabs.ledger"), icon: <ScrollText className="h-4 w-4" /> },
    { key: "rules", label: t("tabs.rules"), icon: <ClipboardList className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 p-3 sm:p-6 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
            <Gavel className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl dark:text-white">
              {t("title")}
            </h1>
            <p className="text-xs text-gray-500 sm:text-sm dark:text-gray-400">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setParams({ tab: tab.key }, { replace: true })}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                active === tab.key
                  ? "bg-purple-500 text-white shadow"
                  : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-[#2A263D] dark:text-gray-300 dark:hover:bg-[#332D4A]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {active === "overdue" && <OverdueTab />}
        {active === "summary" && <SummaryTab />}
        {active === "ledger" && <LedgerTab />}
        {active === "rules" && <RulesTab />}
      </div>
    </div>
  );
};

export default memo(CourierPenaltyPage);
