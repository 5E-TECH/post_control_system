import { memo } from "react";
import { LayoutDashboard, Banknote, Activity, UserRound } from "lucide-react";
import SidebarLink from "./SidebarLink";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

const InvestorSidebar = () => {
  const { t } = useTranslation(["investor"]);

  const links = [
    {
      to: "/investor/overview",
      icon: <LayoutDashboard />,
      label: t("navOverview", "Umumiy"),
    },
    {
      to: "/investor/financials",
      icon: <Banknote />,
      label: t("navFinancials", "Moliya"),
    },
    {
      to: "/investor/operations",
      icon: <Activity />,
      label: t("navOperations", "Operatsiyalar"),
    },
    { to: "/profile", icon: <UserRound />, label: t("navProfile", "Profil") },
  ];

  const sidebarRedux = useSelector((state: RootState) => state.sidebar);

  return (
    <div className="bg-[var(--color-bg-py)] pt-6 dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5] h-full">
      <ul
        className={`flex flex-col gap-1.5 mr-4 ${
          !sidebarRedux.isOpen
            ? "w-[60px] transition-all duration-300 ease-in-out"
            : "w-61"
        }`}
      >
        {links.map((link, i) => (
          <li key={i}>
            <SidebarLink {...link} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default memo(InvestorSidebar);
