import { memo } from "react";
import {
  House,
  ShoppingBag,
  MailOpen,
  FileText,
  History,
  Apple,
} from "lucide-react";
import SidebarLink from "./SidebarLink";
import { useTranslation } from "react-i18next";

const MarketSidebar = () => {
  const { t } = useTranslation(['sidebar'])

  const links = [
    { to: "/", icon: <House />, label: t("dashboard"), end: true },
    {
      to: "/orders",
      icon: <ShoppingBag />,
      label: t("orders"),
    },
    { to: "/clients", icon: <MailOpen />, label: t("clients") },
    {
      to: "/order/markets/new-orders",
      icon: <History />,
      label: t("new_orders"),
    },
    { to: "/products", icon: <Apple />, label: t("products") },
    { to: "/payments", icon: <FileText />, label: t("payments") },
  ];

  return (
    <div className="bg-[var(--color-bg-py)] pt-6 dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5] h-full">
      <ul className="w-61 flex flex-col gap-1.5 mr-4">
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
