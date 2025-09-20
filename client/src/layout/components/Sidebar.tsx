import { memo } from "react";
import {
  House,
  ShoppingBag,
  CarFront,
  MailOpen,
  Apple,
  UserRound,
  FileText,
  History,
  SquareDashedMousePointer,
} from "lucide-react";
import SidebarLink from "./SidebarLink";

const Sidebar = () => {
  const links = [
    { to: "/", icon: <House />, label: "Dashboard", end: true },
    { to: "/orders", icon: <ShoppingBag />, label: "Buyurtmalar" },
    {
      to: "/order/markets/new-orders",
      icon: <CarFront />,
      label: "Bugungi buyurtmalar",
    },
    { to: "/mails", icon: <MailOpen />, label: "Pochta" },
    { to: "/products", icon: <Apple />, label: "Mahsulotlar" },
    { to: "/all-users", icon: <UserRound />, label: "Foydalanuvchilar" },
    { to: "/payments", icon: <FileText />, label: "To'lovlar" },
    { to: "/m-balance", icon: <History />, label: "Moliyaviy balans" },
    { to: "/logs", icon: <SquareDashedMousePointer />, label: "Loglar" },
  ];

  return (
    <div className="bg-[var(--color-bg-py)] pt-6 dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5]">
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

export default memo(Sidebar);
