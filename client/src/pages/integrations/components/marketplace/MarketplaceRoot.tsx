import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Segmented, Spin } from "antd";
import {
  Banknote,
  RefreshCcwDot,
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

  /**
   * ⚠️ XATO HOLATI BO'SH HOLAT EMAS.
   *
   * Avval bu shox yo'q edi: so'rov yiqilsa `list.data` undefined bo'lib,
   * `rows` bo'sh massivga aylanardi, `slug` esa hech qachon o'rnatilmasdi.
   * Natijada sozlash tabi «Marketplace ulanishi hali yaratilmagan» deb
   * YOLG'ON aytardi — bazada ulanish bor bo'lsa ham. Admin uchun bu
   * «sekret kiritadigan joy umuman yo'q» bo'lib ko'rinardi.
   *
   * Eng ko'p uchraydigan sabab — `SECRET_ENC_KEY` almashgani: shunda
   * sekret ustunlari deshifrlanmaydi va endpoint 500 beradi.
   */
  if (list.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Marketplace ulanishlarini olib bo'lmadi"
        description={
          <div className="space-y-2">
            <div>
              {(list.error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ??
                "Server javob bermadi. Bu ro'yxat bo'sh degani EMAS — mavjud ulanishlar ham ko'rinmayapti."}
            </div>
            <div className="text-xs text-gray-500">
              Tez-tez uchraydigan sabab: serverda `SECRET_ENC_KEY` o'rnatilmagan
              yoki almashgan — u holda sekretlar deshifrlanmaydi.
            </div>
            <Button
              size="small"
              icon={<RefreshCcwDot className="w-4 h-4" />}
              loading={list.isFetching}
              onClick={() => list.refetch()}
            >
              Qayta urinish
            </Button>
          </div>
        }
      />
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
