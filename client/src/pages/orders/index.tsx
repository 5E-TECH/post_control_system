import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import OrderList from "./pages/superadmin/order-list";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { buildAdminPath } from "../../shared/const";

const Orders = () => {
  const { pathname } = useLocation();
  const role = useSelector((state: RootState) => state.roleSlice.role);

  if (role === "superadmin" || role === "admin" || role === "market" || role === "registrator") {
    if (pathname.startsWith(buildAdminPath("orders/", { absolute: true }))) {
      return <Outlet />;
    }
    return (
      <div className="bg-[#f4f5fa] m-5">
        <OrderList />
      </div>
    );
  }

  if (role === "courier") {
    return <Outlet />;
  }
};

export default React.memo(Orders);
