import { memo } from "react";
import { House, ShoppingBag, Apple, Calendar1, CreditCard, Users, Bot, Receipt, PackageCheck } from "lucide-react";
import SidebarLink from "./SidebarLink";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { useExtraCost } from "../../shared/api/hooks/useExtraCost";
import { useMarketHandover } from "../../shared/api/hooks/useMarketHandover";

const MarketSidebar = () => {
  const { t } = useTranslation(['sidebar'])

  // ⚠️ Qo'shimcha xarajat so'rovlari — market javob bermasa pul avtomatik
  // tasdiqlanadi, shuning uchun raqam yon menyuda DOIM ko'rinib turadi.
  // Bu komponent faqat market roli uchun render bo'ladi.
  const { getMarketCounts } = useExtraCost();
  const { data: extraCostCounts } = getMarketCounts();

  // ⚠️ Markazda turgan bekor posilkalar — market ruxsat bermasa ular
  // OMBORDA QOLADI (avto-yopish yo'q). Shuning uchun raqam menyuda doim
  // ko'rinib turadi, aks holda market "mendan nima kutilyapti" ni bilmaydi.
  const { getMyReturnCounts } = useMarketHandover();
  const { data: returnCounts } = getMyReturnCounts();

  const links = [
    { to: "/", icon: <House />, label: t("dashboard"), end: true },
    {
      to: "/orders",
      icon: <ShoppingBag />,
      label: t("orders"),
    },
    // { to: "/clients", icon: <MailOpen />, label: t("clients") },
    {
      to: "/order/markets/new-orders",
      icon: <Calendar1 />,
      label: t("new_orders"),
    },
    { to: "/products", icon: <Apple />, label: t("products") },
    { to: "/cash-box", icon: <CreditCard />, label: t("payments") },
    {
      to: "/extra-cost",
      icon: <Receipt />,
      label: t("extra_cost"),
      badge: Number(extraCostCounts?.open ?? 0),
    },
    {
      to: "/market-returns",
      icon: <PackageCheck />,
      label: t("market_returns"),
      badge: Number(returnCounts?.awaiting ?? 0),
    },
    { to: "/market-operators", icon: <Users />, label: t("market_operators") },
    { to: "/ai-balance", icon: <Bot />, label: t("ai_balance") },
  ];
      const sidebarRedux = useSelector((state: RootState) => state.sidebar);

  return (
    <div className="bg-[var(--color-bg-py)] pt-6 dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5] h-full">
      <ul className={`flex flex-col gap-1.5 mr-4 ${!sidebarRedux.isOpen ? "w-[60px] transition-all duration-300 ease-in-out" : "w-61"}`}>
        {links.map((link, i) => (
          <li key={i}>
            <SidebarLink {...link} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default memo(MarketSidebar);
