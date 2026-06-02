import { useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Settings as SettingsIcon,
  Plug,
  MapPin,
  Map,
  UserCog,
  ShieldCheck,
  FileText,
  Lock,
} from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

/**
 * Sozlamalar sahifa parent — chap tomonda guruhlangan nav, o'ng tomonda
 * nested route content. Bo'limlar rol bo'yicha filtrlanadi: ayrimlari faqat
 * superadmin uchun (Lock belgisi bilan ko'rsatiladi).
 */

// Har bir accent uchun to'liq (statik) Tailwind klasslari — dinamik
// generatsiya purge'ga tushmasligi uchun.
const ACCENTS: Record<
  string,
  { icon: string; activeWrap: string; activeText: string }
> = {
  blue: {
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
    activeWrap:
      "bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-200 dark:ring-blue-800/60",
    activeText: "text-blue-700 dark:text-blue-300",
  },
  cyan: {
    icon: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300",
    activeWrap:
      "bg-cyan-50 dark:bg-cyan-950/40 ring-1 ring-cyan-200 dark:ring-cyan-800/60",
    activeText: "text-cyan-700 dark:text-cyan-300",
  },
  teal: {
    icon: "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300",
    activeWrap:
      "bg-teal-50 dark:bg-teal-950/40 ring-1 ring-teal-200 dark:ring-teal-800/60",
    activeText: "text-teal-700 dark:text-teal-300",
  },
  emerald: {
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    activeWrap:
      "bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-800/60",
    activeText: "text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    activeWrap:
      "bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-800/60",
    activeText: "text-amber-700 dark:text-amber-300",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300",
    activeWrap:
      "bg-slate-100 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700",
    activeText: "text-slate-700 dark:text-slate-200",
  },
};

interface NavItem {
  to: string;
  icon: typeof Plug;
  label: string;
  description: string;
  accent: keyof typeof ACCENTS;
  roles: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    title: "Integratsiya",
    items: [
      {
        to: "/settings/integrations",
        icon: Plug,
        label: "Integratsiyalar",
        description: "Tashqi sayt va provayderlar",
        accent: "blue",
        roles: ["admin", "superadmin"],
      },
    ],
  },
  {
    title: "Geografiya",
    items: [
      {
        to: "/settings/logist-assignment",
        icon: UserCog,
        label: "Logist biriktirish",
        description: "Viloyatlarga logist tayinlash",
        accent: "cyan",
        roles: ["admin", "superadmin"],
      },
      {
        to: "/settings/districts",
        icon: Map,
        label: "Tumanlar",
        description: "Tuman ro'yxati va boshqaruvi",
        accent: "teal",
        roles: ["superadmin"],
      },
      {
        to: "/settings/sato-management",
        icon: MapPin,
        label: "SATO kodlari",
        description: "Viloyat/tuman SATO kodlari",
        accent: "emerald",
        roles: ["superadmin"],
      },
    ],
  },
  {
    title: "Xavfsizlik va tizim",
    items: [
      {
        to: "/settings/roles-permissions",
        icon: ShieldCheck,
        label: "Rollar va ruxsatlar",
        description: "Foydalanuvchi rollari",
        accent: "amber",
        roles: ["superadmin"],
      },
      {
        to: "/settings/logs",
        icon: FileText,
        label: "Tizim jurnallari",
        description: "Audit va tizim loglari",
        accent: "slate",
        roles: ["admin", "superadmin"],
      },
    ],
  },
];

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const role =
    useSelector((s: RootState) => s.roleSlice.role) ||
    localStorage.getItem("role") ||
    "";

  // /settings ga to'g'ridan-to'g'ri kelsa, /settings/integrations ga yo'naltiramiz
  useEffect(() => {
    if (location.pathname === "/settings" || location.pathname === "/settings/") {
      navigate("/settings/integrations", { replace: true });
    }
  }, [location.pathname, navigate]);

  // Rol bo'yicha filtr — bo'sh guruhlarni tashlab yuboramiz
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => it.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 sm:mb-6">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            Sozlamalar
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Tizim konfiguratsiyasi va boshqaruvi
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar nav */}
        <aside className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-200 dark:border-gray-700/50 p-3 h-fit lg:sticky lg:top-4 shadow-sm">
          <nav className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.title}>
                <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {group.title}
                </div>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const accent = ACCENTS[item.accent];
                    const superadminOnly =
                      item.roles.length === 1 && item.roles[0] === "superadmin";
                    const Icon = item.icon;
                    return (
                      <NavLink key={item.to} to={item.to} className="block">
                        {({ isActive }) => (
                          <div
                            className={`flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all ${
                              isActive
                                ? accent.activeWrap
                                : "hover:bg-gray-50 dark:hover:bg-[#352F4A]"
                            }`}
                          >
                            <span
                              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent.icon}`}
                            >
                              <Icon className="w-[18px] h-[18px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-semibold text-sm truncate ${
                                    isActive
                                      ? accent.activeText
                                      : "text-gray-800 dark:text-gray-100"
                                  }`}
                                >
                                  {item.label}
                                </span>
                                {superadminOnly && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-bold flex-shrink-0"
                                    title="Faqat superadmin"
                                  >
                                    <Lock className="w-2.5 h-2.5" />
                                    SA
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {item.description}
                              </div>
                            </div>
                          </div>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content — padding shu yerda (bolalar yalang'och) */}
        <main className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-200 dark:border-gray-700/50 p-4 sm:p-6 min-h-[60vh] shadow-sm">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
