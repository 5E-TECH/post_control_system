import { memo } from "react";
import { House, ShoppingBag, MailOpen, FileText, History } from "lucide-react";
import SidebarLink from "./SidebarLink";

const RegistratorSidebar = () => {
  const links = [
    { to: "/", icon: <House />, label: "Dashboard", end: true },
    { to: "/orders", icon: <ShoppingBag />, label: "Buyurtmalar" },
    { to: "/history", icon: <History />, label: "Bugungi buyurtmalar" },
    { to: "/mails", icon: <MailOpen />, label: "Pochta" },
    { to: "/payments", icon: <FileText />, label: "Mahsulotlar" },
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

export default memo(RegistratorSidebar);
