import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import OrderList from "./pages/superadmin/order-list";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

const Orders = () => {
  const { pathname } = useLocation();
  const role = useSelector((state: RootState) => state.roleSlice.role);
  const base =
    import.meta.env.BASE_URL?.replace(/\/$/, "") === "/"
      ? ""
      : import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  // Normalize pathname to work both with and without basename (BASE_URL)
  const normalizedPathname =
    base && pathname.startsWith(base)
      ? pathname.slice(base.length) || "/"
      : pathname;

  const isOrdersChild = normalizedPathname.startsWith("/orders/");

  if (role === "superadmin" || role === "admin" || role === "market" || role === "registrator") {
    if (isOrdersChild) {
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
