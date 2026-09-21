import { useEffect, useMemo, useState } from "react";
import { Segmented, Spin } from "antd";
import {
  Banknote,
  Settings as SettingsIcon,
  ShieldAlert,
} from "lucide-react";
import ProviderSubNav, { type SubNavItem } from "../providers/ProviderSubNav";
import { MarketplaceSettingsTab } from "./MarketplaceSettingsTab";
import { MarketplaceSettlementTab } from "./MarketplaceSettlementTab";
import { MarketplaceReconcileTab } from "./MarketplaceReconcileTab";
import { useMarketplaceConfig } from "../../../../shared/api/hooks/useMarketplaceConfig";

/**
 * Marketplace paneli.
 *
 * ⚠️ Yetkazuvchilardan (LDG/Elchi) FARQLI rol: marketplace bizga buyurtma
 * BERADI (SOURCE), biz unga pochta bermaymiz. Shu bois u "Yetkazuvchilar"
 * registriga qo'shilmadi — u yerdagi har bir yozuv `users.external_provider`
 * qiymati bo'lishi kerak, marketplace esa oddiy market sifatida yashaydi.
 *
 * ⚠️ ULANISH TANLOVI SHU YERDA. Uch tab ham bir xil ulanish haqida
 * gapiradi — tanlov har tabda alohida bo'lsa, admin sozlamani bir
 * ulanishda ko'rib, to'lovni boshqasiga qilib yuborishi mumkin edi.
 */
export const MarketplaceRoot = () => {
  const [active, setActive] = useState("settings");
  const [slug, setSlug] = useState<string | undefined>();

  const { list } = useMarketplaceConfig();
  const rows = useMemo(() => list.data ?? [], [list.data]);

  // Birinchi ulanishni avtomatik tanlaymiz — odatda bitta bo'ladi.
  useEffect(() => {
    if (!slug && rows.length) setSlug(rows[0].slug);
  }, [rows, slug]);

  const items: SubNavItem[] = [
    {
      key: "settings",
      label: "Sozlamalar",
      icon: <SettingsIcon className="w-4 h-4" />,
      desc: "Ulanish, kalitlar, tarif",
      content: (
        <MarketplaceSettingsTab
          slug={slug}
          onCreated={(s) => {
            setSlug(s);
            list.refetch();
          }}
        />
      ),
    },
    {
      key: "settlement",
      label: "Hisob-kitob",
      icon: <Banknote className="w-4 h-4" />,
      desc: "Sotuvchilar qoldig'i va to'lov",
      content: <MarketplaceSettlementTab slug={slug} />,
    },
    {
      key: "reconcile",
      label: "Solishtiruv",
      icon: <ShieldAlert className="w-4 h-4" />,
      desc: "Nomuvofiqliklar va daftar",
      content: <MarketplaceReconcileTab slug={slug} />,
    },
  ];

  const activeItem = items.find((i) => i.key === active) ?? items[0];

  if (list.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.length > 1 && (
        <Segmented
          value={slug}
          onChange={(v) => setSlug(String(v))}
          options={rows.map((r) => ({ label: r.name, value: r.slug }))}
        />
      )}
      <ProviderSubNav items={items} active={active} onChange={setActive} />
      <div>{activeItem.content}</div>
    </div>
  );
};

export default MarketplaceRoot;
