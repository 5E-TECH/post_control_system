import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import OrderList from "./pages/superadmin/order-list";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import CourierOrder from "./pages/courier";

const Orders = () => {
  const { pathname } = useLocation();
  const role = useSelector((state: RootState) => state.roleSlice.role);

  if (role === "superadmin") {
    if (pathname.startsWith("/orders/")) {
      return <Outlet />;
    }
    return (
      <div className="bg-[#f4f5fa] m-5">
        <OrderList />
      </div>
    );
  }

  if (role === "courier") {
    return <CourierOrder />;
  }
};

export default React.memo(Orders);
