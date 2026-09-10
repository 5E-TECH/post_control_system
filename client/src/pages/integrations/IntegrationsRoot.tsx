import { Tabs } from "antd";
import { Truck, Globe } from "lucide-react";
import IntegrationsPage from "./index";
import { ProvidersTab } from "./components/providers/ProvidersTab";

/**
 * Integratsiyalar root — 2 ta tab:
 *   1. Tashqi saytlar — buyurtma MANBALARI (do'kon/market ulanishlari)
 *   2. Yetkazuvchilar — cargo provayderlari (LDG, Elchi, ...)
 *
 * Ikkinchi tab avval "LDG Cargo" deb atalgan va faqat LDG'ni ko'rsatardi.
 * Endi u provayder tanlovi bilan keladi: LDG paneli o'zgarmagan holda ichida
 * qoldi, Elchi ikkinchi variant bo'lib qo'shildi.
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
          key: "providers",
          label: (
            <span className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Yetkazuvchilar
            </span>
          ),
          children: <ProvidersTab />,
        },
      ]}
    />
  );
}
