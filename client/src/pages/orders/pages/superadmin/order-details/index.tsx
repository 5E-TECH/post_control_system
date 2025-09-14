import { memo } from "react";
import Details from "../order-details";
import ShippingActivity from "../../../components/shipping activity";
import CustomerDetail from "../../../components/customer detail";
import ShippingAddress from "../../../components/shipping address";

const OrderDetails = () => {
  return (
    <div className="bg-[#f4f5fa] pt-6 dark:bg-[#28243d]">
      <div className="ml-6 flex  items-center justify-between mr-6">
        <div>
          <div className="flex flex-row gap-2.5 items-center">
            <h2 className="text-[18px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
              Order #32543
            </h2>
            <div className="bg-[#56CA0029] px-4 py-0.5 rounded-2xl">
              <h2 className="text-[#56CA00] text-[13px]">Paid</h2>
            </div>
            <div className="bg-[#16B1FF29] px-4 py-0.5 rounded-2xl">
              <h2 className="text-[#16B1FF] text-[13px]">Ready to Pickup</h2>
            </div>
          </div>
          <div>
            <h2 className="text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
              Aug 17, 2020, 5:48 (ET)
            </h2>
          </div>
        </div>
        <div>
          <button className="border px-[18px] py-[8px] rounded-md border-[#FF4C51] text-[#FF4C51] text-[15px]">
            Delete Order
          </button>
        </div>
      </div>
      <div className="flex gap-4 p-6">
        <div className="flex flex-col gap-4 flex-[2]">
          <div className=" rounded-md bg-white shadow-md dark:bg-[#312d4b]">
            <Details />
          </div>
          <div className=" rounded-md bg-white shadow-md dark:bg-[#312d4b]">
            <ShippingActivity />
          </div>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          <div className=" rounded-md bg-white shadow-md dark:bg-[#312d4b]">
            <CustomerDetail />
          </div>
          <div className=" rounded-md bg-white shadow-md dark:bg-[#312d4b]">
            <ShippingAddress />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderDetails);
