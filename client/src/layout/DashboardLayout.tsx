import { memo } from "react";
import Sidebar from "./components/Sidebar";
import { NavLink, Outlet } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useSelector } from "react-redux";
import type { RootState } from "../app/store";
import AdminSidebar from "./components/AdminSidebar";
import Courier from "./components/Courier";
import MarketSidebar from "./components/MarketSidebar";
import RegistratorSidebar from "./components/RegistratorSidebar";
import type { UserRole } from "../shared/enums/Roles";
import {
  FileText,
  History,
  House,
  ShoppingBag,
  SquareDashedMousePointer,
  UserRound,
} from "lucide-react";

const DashboardLayout = () => {
  const role = useSelector((state: RootState) => state.roleSlice.role);
  let sidebar;

  switch (role as UserRole) {
    case "superadmin":
      sidebar = <Sidebar />;
      break;
    case "admin":
      sidebar = <AdminSidebar />;
      break;
    case "courier":
      sidebar = <Courier />;
      break;
    case "market":
      sidebar = <MarketSidebar />;
      break;
    case "registrator":
      sidebar = <RegistratorSidebar />;
      break;
    default:
      sidebar = null;
  }

  return (
    <div className="h-screen grid grid-rows-[auto_1fr_auto] grid-cols-[250px_1fr] max-[650px]:grid-cols-[1fr] bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5] pr-4">
      {/* Navbar */}
      <div className="col-span-2">
        <Header />
      </div>

      {/* Sidebar */}
      <aside className="row-span-1 overflow-y-auto bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] max-[650px]:hidden">
        {sidebar}
      </aside>

      {/* Dashboard container */}
      <div className="overflow-y-auto bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] pb-8">
        <main className="w-full h-full bg-[#fff] dark:bg-[var(--color-dark-bg-py)] rounded-4xl overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Footer */}

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
          <House/>
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
          <SquareDashedMousePointer />
        </NavLink>
      </div>

      <div className="col-span-2 py-3">
        <Footer />
      </div>
    </div>
  );
};

export default memo(DashboardLayout);
