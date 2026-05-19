import { useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, Plug } from "lucide-react";

/**
 * Sozlamalar sahifa parent — chap tomonda nav, o'ng tomonda nested route content.
 * Kelajakda boshqa sozlamalar bo'limlari (xavfsizlik, telegram, va h.k.) shu yerga
 * qo'shiladi.
 */
export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // /settings ga to'g'ridan-to'g'ri kelsa, /settings/integrations ga yo'naltiramiz
  useEffect(() => {
    if (location.pathname === "/settings" || location.pathname === "/settings/") {
      navigate("/settings/integrations", { replace: true });
    }
  }, [location.pathname, navigate]);

  const navItems = [
    {
      to: "/settings/integrations",
      icon: <Plug className="w-4 h-4" />,
      label: "Integratsiyalar",
      description: "Tashqi sayt va yetkazib berish provayderlari",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            Sozlamalar
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tizim sozlamalari va integratsiyalar
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar nav */}
        <aside className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-200 dark:border-gray-700/50 p-2 h-fit lg:sticky lg:top-4">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300"
                      : "hover:bg-gray-50 dark:hover:bg-[#352F4A] text-gray-700 dark:text-gray-300"
                  }`
                }
              >
                <span className="mt-0.5">{item.icon}</span>
                <div>
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {item.description}
                  </div>
                </div>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-200 dark:border-gray-700/50 p-4 sm:p-6 min-h-[60vh]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
