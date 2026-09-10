import { useState } from "react";
import {
  Banknote,
  LayoutDashboard,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Truck,
  Webhook,
} from "lucide-react";
import ProviderSubNav, {
  type SubNavItem,
} from "../providers/ProviderSubNav";
import { ElchiDashboardTab } from "./ElchiDashboardTab";
import { ElchiSettingsTab } from "./ElchiSettingsTab";
import { ElchiShipmentsTab } from "./ElchiShipmentsTab";
import { ElchiWebhookLogsTab } from "./ElchiWebhookLogsTab";
import { ElchiSettlementTab } from "./ElchiSettlementTab";
import { ElchiControlTab } from "./ElchiControlTab";

/**
 * Elchi Pochta boshqaruv paneli — 6 sub-tab.
 *
 * 1–4 va 6 LDG panelining tasdiqlangan shakli; 5 (Hisob-kitob) — yangi,
 * chunki Elchi pulni O'ZI yig'adi va bizga qo'lda o'tkazadi (M6). Busiz
 * "Elchi bizga qarz" summasi hech qachon kamaymaydi.
 */
export const ElchiCargoTab = () => {
  const [active, setActive] = useState("dashboard");

  const items: SubNavItem[] = [
    {
      key: "dashboard",
      label: "Umumiy holat",
      icon: <LayoutDashboard className="w-4 h-4" />,
      desc: "Tayyorlik va raqamlar",
      content: <ElchiDashboardTab />,
    },
    {
      key: "settings",
      label: "Sozlamalar",
      icon: <SettingsIcon className="w-4 h-4" />,
      desc: "Ulanish, kuryer, darvoza",
      content: <ElchiSettingsTab />,
    },
    {
      key: "shipments",
      label: "Jo'natmalar",
      icon: <Truck className="w-4 h-4" />,
      desc: "Posilkalar va qayta jo'natish",
      content: <ElchiShipmentsTab />,
    },
    {
      key: "webhooks",
      label: "Webhook loglar",
      icon: <Webhook className="w-4 h-4" />,
      desc: "Kelgan hodisalar",
      content: <ElchiWebhookLogsTab />,
    },
    {
      key: "settlement",
      label: "Hisob-kitob",
      icon: <Banknote className="w-4 h-4" />,
      desc: "Yig'ilgan pul va qarz",
      content: <ElchiSettlementTab />,
    },
    {
      key: "control",
      label: "Boshqaruv",
      icon: <SlidersHorizontal className="w-4 h-4" />,
      desc: "Kill-switch va jarayonlar",
      content: <ElchiControlTab />,
    },
  ];

  const activeItem = items.find((i) => i.key === active) ?? items[0];

  return (
    <div className="space-y-4">
      <ProviderSubNav items={items} active={active} onChange={setActive} />
      <div>{activeItem.content}</div>
    </div>
  );
};

export default ElchiCargoTab;
