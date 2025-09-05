import { ArrowRight } from "lucide-react";
import { memo } from "react";
import Success from "../../components/button/success";

const OrderList = () => {
  return (
    <div className="bg-white p-5 rounded-md">
      <div className="flex items-center justify-between">
        <h2>Order List</h2>
        <Success
          text="Add Order"
          icon={<ArrowRight className="h-[13px] w-[13px]" />}
          path="/orders/customer-info"
        />
      </div>
    </div>
  );
};

export default memo(OrderList);
