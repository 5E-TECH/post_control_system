import { memo } from "react";
import Sidebar from "./components/Sidebar";
import { Outlet } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useSelector } from "react-redux";
import type { RootState } from "../app/store";
import AdminSidebar from "./components/AdminSidebar";
import Courier from "./components/Courier";
import MarketSidebar from "./components/MarketSidebar";
import RegistratorSidebar from "./components/RegistratorSidebar";
import type { UserRole } from "../shared/enums/Roles";
// import Courier from "./components/Courier";

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
    <div className="flex h-screen dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5]">
      {sidebar}
      <div className="flex-1 overflow-y-scroll scrollbar-hide">
        <Header />
        <main className="rounded-md">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default memo(DashboardLayout);
