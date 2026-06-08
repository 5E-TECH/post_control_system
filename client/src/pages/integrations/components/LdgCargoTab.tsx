import { Tabs } from "antd";
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

/**
 * LDG Cargo boshqaruv paneli — 4 ta ichki tab:
 *   1. Umumiy holat — health checklist, statistika, test ulanish
 *   2. Sozlamalar   — config formasi + kuryer boshqaruvi
 *   3. Jo'natmalar  — shipmentlar jadvali + qayta jo'natish
 *   4. Webhook loglar — loglar + payload ko'rish + qayta ishlash
 */
export const LdgCargoTab = () => {
  return (
    <Tabs
      defaultActiveKey="dashboard"
      items={[
        {
          key: "dashboard",
          label: (
            <span className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Umumiy holat
            </span>
          ),
          children: <LdgDashboardTab />,
        },
        {
          key: "settings",
          label: (
            <span className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Sozlamalar
            </span>
          ),
          children: <LdgSettingsTab />,
        },
        {
          key: "shipments",
          label: (
            <span className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Jo'natmalar
            </span>
          ),
          children: <LdgShipmentsTab />,
        },
        {
          key: "webhooks",
          label: (
            <span className="flex items-center gap-2">
              <Webhook className="w-4 h-4" />
              Webhook loglar
            </span>
          ),
          children: <LdgWebhookLogsTab />,
        },
        {
          key: "control",
          label: (
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Boshqaruv
            </span>
          ),
          children: <LdgControlTab />,
        },
      ]}
    />
  );
};
