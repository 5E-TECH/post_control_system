import { memo } from "react";
import Details from "../../../components/orderDetails";
// import ShippingActivity from "../../../components/shipping activity";
import ShippingAddress from "../../../components/shipping address";
import CustomerDetail from "../../../components/customer detail";

const OrderDetails = () => {
  return (
    <div className="p-6 bg-white min-h-screen dark:bg-[#28243D]">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow p-6 dark:bg-[#312D4B]">
            <Details />
          </div>

          {/* <div className="bg-white rounded-xl shadow p-6 dark:bg-[#312D4B]">
            <ShippingActivity/>
          </div> */}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow p-6 dark:bg-[#312D4B]">
            <CustomerDetail />
          </div>

          <div className="bg-white rounded-xl shadow p-6 dark:bg-[#312D4B]">
            <ShippingAddress />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderDetails);
