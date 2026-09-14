import { useState } from "react";
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
import ProviderSubNav, {
  type SubNavItem,
} from "./providers/ProviderSubNav";

/**
 * LDG Cargo boshqaruv paneli. Ichki navigatsiya — dasturchi/adminlarga mos,
 * ikonka + tavsifli pill nav.
 */
export const LdgCargoTab = () => {
  const [active, setActive] = useState("dashboard");

  const items: SubNavItem[] = [
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
      <ProviderSubNav items={items} active={active} onChange={setActive} />

      {/* Tab kontenti */}
      <div>{activeItem.content}</div>
    </div>
  );
};
