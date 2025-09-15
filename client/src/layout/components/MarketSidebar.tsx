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

const MarketSidebar = () => {
  const links = [
    { to: "/", icon: <House />, label: "Dashboard", end: true },
    {
      to: "/orders/choose-market",
      icon: <ShoppingBag />,
      label: "Buyurtmalar",
    },
    { to: "/clients", icon: <MailOpen />, label: "Mijozlarim" },
    {
      to: "/order/markets/new-orders",
      icon: <History />,
      label: "Bugungi buyurtmalarim",
    },
    { to: "/products", icon: <Apple />, label: "Mahsulotlarim" },
    { to: "/payments", icon: <FileText />, label: "To'lovlar" },
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
