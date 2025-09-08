// import { ArrowRight } from "lucide-react";
import { memo } from "react";
// import Success from "../../components/button/success";
import Filter from "../../components/filter";
import OrderView from "../../components/order-view";

const OrderList = () => {
  return (
    <div>
      <h2 className="text-[25px] mb-5">Order List</h2>
      <div className="bg-white p-5 rounded-md">
          <Filter />
      </div>
          <OrderView/>
    </div>
  );
};

export default memo(OrderList);
