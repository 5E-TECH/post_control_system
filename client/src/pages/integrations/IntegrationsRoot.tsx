import { Tabs } from "antd";
import { Truck, Globe } from "lucide-react";
import IntegrationsPage from "./index";
import { LdgCargoTab } from "./components/LdgCargoTab";

/**
 * Integratsiyalar root — 2 ta tab:
 *   1. Tashqi saytlar (mavjud external-integration boshqaruvi)
 *   2. LDG Cargo (yetkazib berish provayderi sozlamalari)
 *
 * Settings parent ichida render qilinadi — shuning uchun outer wrapper
 * (background, padding) tashqaridan keladi.
 */
export default function IntegrationsRoot() {
  return (
    <Tabs
      defaultActiveKey="external"
      size="large"
      items={[
        {
          key: "external",
          label: (
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Tashqi saytlar
            </span>
          ),
          children: <IntegrationsPage />,
        },
        {
          key: "ldg",
          label: (
            <span className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              LDG Cargo
            </span>
          ),
          children: <LdgCargoTab />,
        },
      ]}
    />
  );
}
