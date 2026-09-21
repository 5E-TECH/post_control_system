import { memo } from "react";
import { House, ShoppingBag, Apple, Calendar1, CreditCard, Users, Bot, Receipt } from "lucide-react";
import SidebarLink from "./SidebarLink";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { useExtraCost } from "../../shared/api/hooks/useExtraCost";

const MarketSidebar = () => {
  const { t } = useTranslation(['sidebar'])

  // ⚠️ Qo'shimcha xarajat so'rovlari — market javob bermasa pul avtomatik
  // tasdiqlanadi, shuning uchun raqam yon menyuda DOIM ko'rinib turadi.
  // Bu komponent faqat market roli uchun render bo'ladi.
  const { getMarketCounts } = useExtraCost();
  const { data: extraCostCounts } = getMarketCounts();

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
      label: "Qo'shimcha xarajat",
      badge: Number(extraCostCounts?.open ?? 0),
    },
    { to: "/market-operators", icon: <Users />, label: "Operatorlar" },
    { to: "/ai-balance", icon: <Bot />, label: "AI balans" },
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
