import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import OrderList from "./pages/order-list";

const Orders = () => {
  const { pathname } = useLocation();

  if (pathname.startsWith("/orders/")) {
    return <Outlet />;
  }
  return (
    <div className="bg-[#f4f5fa] m-5">
      <OrderList />
    </div>
  );
};

export default React.memo(Orders);
