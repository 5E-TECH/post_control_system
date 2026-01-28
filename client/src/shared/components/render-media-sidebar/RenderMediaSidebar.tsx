import { NavLink } from "react-router-dom";
import {
  Apple,
  Calendar1,
  CreditCard,
  FileText,
  House,
  MailOpen,
  QrCode,
  Scale,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { buildAdminPath } from "../../const";

// Umumiy nav container stili - barcha rollar uchun
const navContainerClass = `
  fixed bottom-0 left-0 right-0 w-full min-[650px]:hidden z-50
  bg-[#1e1e2d]/95 backdrop-blur-md
  border-t border-gray-800/50
  pb-[env(safe-area-inset-bottom,0px)]
`;

// Nav item uchun umumiy stil
const getNavItemClass = (isActive: boolean) => `
  flex items-center justify-center w-12 h-11 rounded-xl transition-all duration-200
  ${isActive
    ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] text-white shadow-lg shadow-purple-500/30"
    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
  }
`;

const Navbar = ({ role }: { role: string }) => {
  const renderNav = () => {
    switch (role) {
      case "superadmin":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("all-users")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <UserRound className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("payments")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <CreditCard className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("m-balance")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Scale className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("logs")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <FileText className="w-5 h-5" />
            </NavLink>
            </div>
          </div>
        );
      case "admin":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("all-users")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <UserRound className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("payments")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <CreditCard className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("m-balance")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Scale className="w-5 h-5" />
            </NavLink>
            </div>
          </div>
        );
      case "registrator":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("order/markets/new-orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Calendar1 className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("mails")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <MailOpen className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("products")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Apple className="w-5 h-5" />
            </NavLink>
            </div>
          </div>
        );
      case "courier":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2 relative">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("courier-orders/orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-5 h-5" />
            </NavLink>

            {/* QR Scanner - Markazda va yuqoriga chiqib turadi */}
            <NavLink
              to={buildAdminPath("scan")}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] text-white shadow-lg shadow-purple-500/40 -mt-8 border-4 border-[#1e1e2d]"
            >
              <QrCode className="w-6 h-6" />
            </NavLink>

            <NavLink
              to={buildAdminPath("courier-mails")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <MailOpen className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("cash-box")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <CreditCard className="w-5 h-5" />
            </NavLink>
            </div>
          </div>
        );
      case "market":
        return (
          <div className={navContainerClass}>
            <div className="flex justify-between items-center px-4 py-2">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <House className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <ShoppingBag className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("order/markets/new-orders")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Calendar1 className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("products")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <Apple className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("cash-box")}
              className={({ isActive }) => getNavItemClass(isActive)}
            >
              <CreditCard className="w-5 h-5" />
            </NavLink>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return <>{renderNav()}</>;
};

export default Navbar;
