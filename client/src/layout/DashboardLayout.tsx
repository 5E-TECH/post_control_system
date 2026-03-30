import { memo, Suspense, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import { Outlet, useLocation } from "react-router-dom";
import Suspensee from "../shared/ui/Suspensee";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useSelector } from "react-redux";
import type { RootState } from "../app/store";
import AdminSidebar from "./components/AdminSidebar";
import Courier from "./components/Courier";
import MarketSidebar from "./components/MarketSidebar";
import RegistratorSidebar from "./components/RegistratorSidebar";
import LogistSidebar from "./components/LogistSidebar";
import OperatorSidebar from "./components/OperatorSidebar";
// import InvestorSidebar from "./components/InvestorSidebar";
import type { UserRole } from "../shared/enums/Roles";
import RenderMediaSidebar from "../shared/components/render-media-sidebar/RenderMediaSidebar";

const DashboardLayout = () => {
  const role = useSelector((state: RootState) => state.roleSlice.role);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

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
    case "logist":
      sidebar = <LogistSidebar />;
      break;
    case "operator":
      sidebar = <OperatorSidebar />;
      break;
    // case "investor":
    //   sidebar = <InvestorSidebar />;
    //   break;
    default:
      sidebar = null;
  }

    const sidebarRedux = useSelector((state: RootState) => state.sidebar);

  return (
    <div className={`h-screen grid grid-rows-[auto_1fr_auto] max-[650px]:grid-cols-[1fr] bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5] pr-4 relative transition-all duration-300 ease-in-out ${!sidebarRedux.isOpen ? "grid-cols-[60px_1fr]" : "grid-cols-[250px_1fr]" }`}>
      {/* Navbar */}
      <div className="col-span-2">
        <Header />
      </div>

      {/* Sidebar */}
      <aside className="row-span-1 overflow-y-auto bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] max-[650px]:hidden">
        {sidebar}
      </aside>

      {/* Dashboard container */}
      <div className="overflow-y-auto bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)] pl-4 pb-8 max-[650px]:pb-24">
        <main ref={mainRef} className="w-full h-full bg-[#fff] dark:bg-[#312d48] rounded-4xl overflow-y-auto">
          <Suspense fallback={<Suspensee />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <RenderMediaSidebar role={role as string} />
      {/* Footer - hidden on mobile since bottom nav is there */}
      <div className="col-span-2 py-3 max-[650px]:hidden">
        <Footer />
      </div>
    </div>
  );
};

export default memo(DashboardLayout);
