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

const Navbar = ({ role }: { role: string }) => {
  const renderNav = () => {
    switch (role) {
      case "superadmin":
        return (
          <div className="flex justify-between px-3 fixed bottom-1.5 w-full min-[650px]:hidden">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <House />
            </NavLink>

            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <ShoppingBag />
            </NavLink>

            <NavLink
              to={buildAdminPath("all-users")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <UserRound />
            </NavLink>

            <NavLink
              to={buildAdminPath("payments")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <CreditCard />
            </NavLink>

            <NavLink
              to={buildAdminPath("m-balance")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <Scale />{" "}
            </NavLink>

            <NavLink
              to={buildAdminPath("logs")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <FileText />
            </NavLink>
          </div>
        );
      case "admin":
        return (
          <div className="flex justify-between px-3 fixed bottom-1.5 w-full min-[650px]:hidden">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <House />
            </NavLink>

            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <ShoppingBag />
            </NavLink>

            <NavLink
              to={buildAdminPath("all-users")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <UserRound />
            </NavLink>

            <NavLink
              to={buildAdminPath("payments")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <CreditCard />
            </NavLink>

            <NavLink
              to={buildAdminPath("m-balance")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <Scale />
            </NavLink>
          </div>
        );
      case "registrator":
        return (
          <div className="flex justify-between px-3 fixed bottom-1.5 w-full min-[650px]:hidden">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <House />
            </NavLink>

            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <ShoppingBag />
            </NavLink>

            <NavLink
              to={buildAdminPath("order/markets/new-orders")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <Calendar1 />
            </NavLink>

            <NavLink
              to={buildAdminPath("mails")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <MailOpen />
            </NavLink>

            <NavLink
              to={buildAdminPath("products")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <Apple />
            </NavLink>
          </div>
        );
      case "courier":
        return (
          <div className="flex justify-evenly px-3 fixed bottom-1.5 w-full min-[650px]:hidden ">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <House />
            </NavLink>

            <NavLink
              to={buildAdminPath("courier-orders/orders")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <ShoppingBag />
            </NavLink>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <NavLink
              to={buildAdminPath("scan")}
              className={`flex items-center justify-center w-17 h-17 rounded-[50%] transition-all bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] absolute bottom-2`}
            >
              <QrCode className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={buildAdminPath("courier-mails")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <MailOpen />
            </NavLink>

            <NavLink
              to={buildAdminPath("cash-box")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <CreditCard />
            </NavLink>
          </div>
        );
      case "market":
        return (
          <div className="flex justify-between px-3 fixed bottom-1.5 w-full min-[650px]:hidden">
            <NavLink
              to={buildAdminPath()}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <House />
            </NavLink>

            <NavLink
              to={buildAdminPath("orders")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <ShoppingBag />
            </NavLink>

            {/* <NavLink
              to={buildAdminPath("clients")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <MailOpen />
            </NavLink> */}

            <NavLink
              to={buildAdminPath("order/markets/new-orders")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <Calendar1 />
            </NavLink>

            <NavLink
              to={buildAdminPath("products")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <Apple />
            </NavLink>

            <NavLink
              to={buildAdminPath("cash-box")}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <CreditCard />
            </NavLink>
          </div>
        );
      default:
        return null;
    }
  };

  return <>{renderNav()}</>;
};

export default Navbar;
