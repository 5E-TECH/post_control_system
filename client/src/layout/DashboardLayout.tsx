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
    <div className="grid h-screen grid-rows-[auto_1fr_auto] grid-cols-[250px_1fr] dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5]">
      {/* Navbar */}
      <div className="col-span-2 sticky top-0 z-10">
        <Header />
      </div>

      {/* Sidebar */}
      <aside className="row-span-1 overflow-y-auto bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)]">{sidebar}</aside>

      {/* Dashboard container */}
      <div className=" overflow-y-auto pr-6 bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)]">
        <main className="w-full h-full p-6 rounded-lg shadow-md bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="col-span-2 sticky bottom-0 z-10">
        <Footer />
      </footer>
    </div>
  );
};

export default memo(DashboardLayout);
