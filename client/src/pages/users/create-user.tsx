import { memo } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  UserPlus,
  Shield,
  ClipboardList,
  Truck,
  Store,
} from "lucide-react";

const roleIcons: Record<string, React.ElementType> = {
  admin: Shield,
  registrator: ClipboardList,
  courier: Truck,
  market: Store,
};

const roleColors: Record<
  string,
  { gradient: string; bg: string; icon: string }
> = {
  admin: {
    gradient: "from-purple-500 to-indigo-600",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    icon: "text-purple-600 dark:text-purple-400",
  },
  registrator: {
    gradient: "from-blue-500 to-cyan-600",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    icon: "text-blue-600 dark:text-blue-400",
  },
  courier: {
    gradient: "from-amber-500 to-orange-600",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    icon: "text-amber-600 dark:text-amber-400",
  },
  market: {
    gradient: "from-emerald-500 to-green-600",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
};

const CreateUser = () => {
  const { t } = useTranslation("users");
  const navigate = useNavigate();

  const roles = [
    { key: "admin", path: "", label: t("admin") },
    { key: "registrator", path: "registrator", label: t("registrator") },
    { key: "courier", path: "courier", label: t("courier") },
    { key: "market", path: "market", label: t("market") },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-all cursor-pointer flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <UserPlus className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
              {t("selectUserRole")}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
              Yangi foydalanuvchi turini tanlang
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Side - Role Selection */}
          <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-4 sm:p-6">
            <h2 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-200 mb-3 sm:mb-4">
              Foydalanuvchi turi
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {roles.map((role) => {
                const Icon = roleIcons[role.key];
                const colors = roleColors[role.key];
                return (
                  <NavLink
                    key={role.key}
                    end={role.path === ""}
                    to={role.path}
                    className="block"
                  >
                    {({ isActive }) => (
                      <div
                        className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer ${
                          isActive
                            ? `border-transparent bg-gradient-to-r ${colors.gradient} shadow-lg`
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md"
                        }`}
                      >
                        <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
                          <div
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center ${
                              isActive ? "bg-white/20" : colors.bg
                            }`}
                          >
                            <Icon
                              className={`w-5 h-5 sm:w-6 sm:h-6 ${
                                isActive ? "text-white" : colors.icon
                              }`}
                            />
                          </div>
                          <span
                            className={`text-xs sm:text-sm font-semibold ${
                              isActive
                                ? "text-white"
                                : "text-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {role.label}
                          </span>
                        </div>
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-4 sm:p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CreateUser);
