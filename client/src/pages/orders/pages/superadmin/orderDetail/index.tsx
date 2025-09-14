import { memo } from "react";
import CustomerProfile from "./customer-profile";
import CustomerHeader from "./customer-header";
import CustomerTable from "./customer-table";

const OrderDetail = () => {
  return (
    <div className="bg-[#F4F5FA] dark:bg-[#28243D]">
      <div>
        <CustomerHeader />
      </div>
      <div className="flex gap-[24px] mt-[24px] px-5">
        <CustomerProfile />
        <CustomerTable/>
      </div>
    </div>
  );
};

export default memo(OrderDetail);
