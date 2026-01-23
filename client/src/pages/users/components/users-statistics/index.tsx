import { memo } from "react";
import { NavLink } from "react-router-dom";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useTranslation } from "react-i18next";
import { buildAdminPath } from "../../../../shared/const";
import { Users, Store, Briefcase } from "lucide-react";

const UsersStatistics = () => {
  const { t } = useTranslation("users");
  const { getUser } = useUser();
  const { data: allUsers } = getUser({ limit: 0 });

  const markets = Array.isArray(allUsers?.data?.data)
    ? allUsers?.data?.data?.filter((user: any) => user.role === "market")
    : [];

  const users = Array.isArray(allUsers?.data?.data)
    ? allUsers?.data?.data?.filter((user: any) => user.role !== "market")
    : [];

  const stats = [
    {
      label: t("allUsers"),
      value: allUsers?.data?.total || 0,
      icon: Users,
      color: "purple",
      path: "",
    },
    {
      label: t("markets"),
      value: markets?.length || 0,
      icon: Store,
      color: "emerald",
      path: buildAdminPath("all-users/markets"),
    },
    {
      label: t("employees"),
      value: users?.length || 0,
      icon: Briefcase,
      color: "blue",
      path: buildAdminPath("all-users/users"),
    },
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; icon: string; border: string }> = {
      purple: {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        icon: "text-purple-600 dark:text-purple-400",
        border: isActive ? "border-purple-500 ring-2 ring-purple-500/20" : "border-gray-100 dark:border-gray-700/50",
      },
      emerald: {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        icon: "text-emerald-600 dark:text-emerald-400",
        border: isActive ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-gray-100 dark:border-gray-700/50",
      },
      blue: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        icon: "text-blue-600 dark:text-blue-400",
        border: isActive ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-100 dark:border-gray-700/50",
      },
    };
    return colors[color] || colors.purple;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {stats.map((stat, index) => (
        <NavLink
          key={index}
          end={stat.path === ""}
          to={stat.path}
          className="block"
        >
          {({ isActive }) => {
            const colorClasses = getColorClasses(stat.color, isActive);
            return (
              <div
                className={`bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-4 border transition-all hover:shadow-md ${colorClasses.border}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      {stat.label}
                    </p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mt-0.5 sm:mt-1">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl ${colorClasses.bg} flex items-center justify-center flex-shrink-0`}
                  >
                    <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colorClasses.icon}`} />
                  </div>
                </div>
              </div>
            );
          }}
        </NavLink>
      ))}
    </div>
  );
};

export default memo(UsersStatistics);
