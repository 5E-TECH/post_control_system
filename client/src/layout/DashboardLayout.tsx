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
    <div className="h-screen bg-[#F4F5FA] grid grid-rows-[auto_1fr_auto] grid-cols-[250px_1fr] dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5] pr-4">
      {/* Navbar */}
      <div className="col-span-2">
        <Header />
      </div>

      {/* Sidebar */}
      <aside className="row-span-1 overflow-y-auto bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)]">
        {sidebar}
      </aside>

      {/* Dashboard container */}
      <div className="overflow-y-auto bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] pb-8">
        <main className="w-full h-full bg-[#fff] rounded-4xl overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <div className="col-span-2">
        <Footer />
      </div>
    </div>
  );
};

export default memo(DashboardLayout);
