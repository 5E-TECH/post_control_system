import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  Truck,
  Webhook,
  SlidersHorizontal,
} from "lucide-react";
import { LdgDashboardTab } from "./LdgDashboardTab";
import { LdgSettingsTab } from "./LdgSettingsTab";
import { LdgShipmentsTab } from "./LdgShipmentsTab";
import { LdgWebhookLogsTab } from "./LdgWebhookLogsTab";
import { LdgControlTab } from "./LdgControlTab";

interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
  desc: string;
  content: ReactNode;
}

/**
 * LDG Cargo boshqaruv paneli. Ichki navigatsiya — dasturchi/adminlarga mos,
 * ikonka + tavsifli pill nav.
 */
export const LdgCargoTab = () => {
  const [active, setActive] = useState("dashboard");

  const items: NavItem[] = [
    {
      key: "dashboard",
      label: "Umumiy holat",
      icon: <LayoutDashboard className="w-4 h-4" />,
      desc: "Holat, statistika va test",
      content: <LdgDashboardTab />,
    },
    {
      key: "settings",
      label: "Sozlamalar",
      icon: <SettingsIcon className="w-4 h-4" />,
      desc: "Ulanish, sender, kuryer",
      content: <LdgSettingsTab />,
    },
    {
      key: "shipments",
      label: "Jo'natmalar",
      icon: <Truck className="w-4 h-4" />,
      desc: "Buyurtmalar va qayta jo'natish",
      content: <LdgShipmentsTab />,
    },
    {
      key: "webhooks",
      label: "Webhook loglar",
      icon: <Webhook className="w-4 h-4" />,
      desc: "Kelgan eventlar va payload",
      content: <LdgWebhookLogsTab />,
    },
    {
      key: "control",
      label: "Boshqaruv",
      icon: <SlidersHorizontal className="w-4 h-4" />,
      desc: "Fon jarayonlari yoqish/o'chirish",
      content: <LdgControlTab />,
    },
  ];

  const activeItem = items.find((i) => i.key === active) ?? items[0];

  return (
    <div className="space-y-4">
      {/* Pill navigatsiya */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {items.map((it) => {
          const on = it.key === active;
          return (
            <button
              key={it.key}
              onClick={() => setActive(it.key)}
              className={`group flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all cursor-pointer ${
                on
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-900/25 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-violet-300 dark:hover:border-violet-700"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  on
                    ? "bg-violet-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 group-hover:text-violet-600"
                }`}
              >
                {it.icon}
              </span>
              <span className="hidden sm:block">
                <span
                  className={`block text-sm font-semibold leading-tight ${
                    on
                      ? "text-violet-700 dark:text-violet-300"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {it.label}
                </span>
                <span className="block text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                  {it.desc}
                </span>
              </span>
              <span
                className={`text-sm font-semibold sm:hidden ${
                  on ? "text-violet-700 dark:text-violet-300" : "text-gray-700 dark:text-gray-200"
                }`}
              >
                {it.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab kontenti */}
      <div>{activeItem.content}</div>
    </div>
  );
};
