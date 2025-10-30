import { NavLink } from "react-router-dom";
import {
  Apple,
  CarFront,
  CreditCard,
  FileText,
  History,
  House,
  MailOpen,
  QrCode,
  Scale,
  ShoppingBag,
  UserRound,
} from "lucide-react";

const Navbar = ({ role }: { role: string }) => {
  const renderNav = () => {
    switch (role) {
      case "superadmin":
        return (
          <div className="flex justify-between px-3 fixed bottom-1.5 w-full min-[650px]:hidden">
            <NavLink
              to={"/"}
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
              to={"/orders"}
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
              to={"/all-users"}
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
              to={"/payments"}
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
              to={"/m-balance"}
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
              to={"/logs"}
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
              to={"/"}
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
              to={"/orders"}
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
              to={"/all-users"}
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
              to={"/payments"}
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

            <NavLink
              to={"/m-balance"}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <History />
            </NavLink>
          </div>
        );
      case "registrator":
        return (
          <div className="flex justify-center px-3 fixed bottom-1.5 w-full min-[650px]:hidden">
            <NavLink
              to={"/"}
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
              to={"/orders"}
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
              to={"/order/markets/new-orders"}
              className={({ isActive }) =>
                `flex items-center justify-center w-15 h-11 rounded-[3px] transition-all 
       ${
         isActive
           ? "bg-gradient-to-r from-[#ccb5ff] to-[#8247ff]"
           : "text-gray-500"
       }`
              }
            >
              <CarFront />
            </NavLink>

            <NavLink
              to={"/mails"}
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
              to={"/products"}
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
      case "courier":
        return (
          <div className="flex justify-evenly px-3 fixed bottom-1.5 w-full min-[650px]:hidden ">
            <NavLink
              to={"/"}
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
              to={"/courier-orders/orders"}
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
              to={"/scan"}
              className={`flex items-center justify-center w-17 h-17 rounded-[50%] transition-all bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] absolute bottom-2`}
            >
              <QrCode className="w-5 h-5" />
            </NavLink>
            <NavLink
              to={"/courier-mails"}
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
              to={"/cash-box"}
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
      case "market":
        return (
          <div className="flex justify-between px-3 fixed bottom-1.5 w-full min-[650px]:hidden">
            <NavLink
              to={"/"}
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
              to={"/orders"}
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
              to={"/clients"}
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
              to={"/order/markets/new-orders"}
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
              to={"/products"}
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
              to={"/payments"}
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
      default:
        return null;
    }
  };

  return <>{renderNav()}</>;
};

export default Navbar;
