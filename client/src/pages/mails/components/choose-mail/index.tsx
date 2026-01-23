import { memo, type FC } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Package, AlertTriangle, Clock } from "lucide-react";

interface Props {
  role: string;
}

const ChooseMail: FC<Props> = ({ role }) => {
  const { t } = useTranslation("mails");

  const links =
    role === "superadmin"
      ? [
          { to: "/mails", label: t("todayMails"), icon: Package, color: "emerald" },
          { to: "/mails/refused", label: t("refusedMails"), icon: AlertTriangle, color: "red" },
          { to: "/mails/old", label: t("oldMails"), icon: Clock, color: "blue" },
        ]
      : role === "courier"
        ? [
            { to: "/courier-mails", label: t("newMails"), icon: Package, color: "emerald" },
            { to: "/courier-mails/refused", label: t("refusedMails"), icon: AlertTriangle, color: "red" },
            { to: "/courier-mails/old", label: t("oldMails"), icon: Clock, color: "blue" },
          ]
        : [];

  const colorClasses: Record<string, { active: string; inactive: string; iconBg: string }> = {
    emerald: {
      active: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25",
      inactive: "bg-white dark:bg-[#2A263D] text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-gray-200 dark:border-gray-700",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    },
    red: {
      active: "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25",
      inactive: "bg-white dark:bg-[#2A263D] text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700",
      iconBg: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    },
    blue: {
      active: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25",
      inactive: "bg-white dark:bg-[#2A263D] text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700",
      iconBg: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    },
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {links.map((link) => {
        const Icon = link.icon;
        const colors = colorClasses[link.color];

        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/mails" || link.to === "/courier-mails"}
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 py-2.5 lg:py-3 rounded-xl font-medium transition-all cursor-pointer ${
                isActive ? colors.active : colors.inactive
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? "bg-white/20" : colors.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm hidden lg:inline">{link.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
};

export default memo(ChooseMail);
