import { memo } from "react";
import { Outlet } from "react-router-dom";

// Investor bo'limi konteyneri — routed sahifalar shu yerda <Outlet /> orqali chiqadi.
const Investor = () => {
  return (
    <div className="p-4 sm:p-6">
      <Outlet />
    </div>
  );
};

export default memo(Investor);
