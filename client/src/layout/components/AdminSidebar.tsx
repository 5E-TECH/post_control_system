import { memo } from "react";
import {
  House,
  ShoppingBag,
  MailOpen,
  Apple,
  UserRound,
  MapPinned,
  Calendar1,
  CreditCard,
  Scale,
} from "lucide-react";
import SidebarLink from "./SidebarLink";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

const AdminSidebar = () => {
  const { t } = useTranslation(["sidebar"]);

  const links = [
    { to: "/", icon: <House />, label: t("dashboard"), end: true },
    { to: "/orders", icon: <ShoppingBag />, label: t("orders") },
    {
      to: "/order/markets/new-orders",
      icon: <Calendar1 />,
      label: t("new_orders"),
    },
    { to: "/mails", icon: <MailOpen />, label: t("mails") },
    { to: "/products", icon: <Apple />, label: t("products") },
    { to: "/all-users", icon: <UserRound />, label: t("users") },
    { to: "/payments", icon: <CreditCard />, label: t("payments") },
    { to: "/m-balance", icon: <Scale />, label: t("balance") },
    { to: "/regions", icon: <MapPinned />, label: t("region") },
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

export default memo(AdminSidebar);
