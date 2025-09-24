import { memo } from "react";
import { House, ShoppingBag, MailOpen, FileText, History } from "lucide-react";
import SidebarLink from "./SidebarLink";
import { useTranslation } from "react-i18next";

const RegistratorSidebar = () => {
  const { t } = useTranslation(["sidebar"]);

  const links = [
    { to: "/", icon: <House />, label: t("dashboard"), end: true },
    { to: "/orders", icon: <ShoppingBag />, label: t("orders") },
    { to: "/history", icon: <History />, label: t("new_orders") },
    { to: "/mails", icon: <MailOpen />, label: t("mails") },
    { to: "/payments", icon: <FileText />, label: t("products") },
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
