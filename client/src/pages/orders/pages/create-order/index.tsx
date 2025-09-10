import { Check } from "lucide-react";
import { memo } from "react";
import OrderItems from "../../components/order-items";
import ProductInfo from "../../components/product-info";
import Discard from "../../components/button/discard";
import Success from "../../components/button/success";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";

const CreateOrder = () => {
  const customer_id = useSelector((state:RootState)=> state.setCustomerMarketId.customerId)
  console.log(customer_id)
 
  return (
    <div className="flex gap-6 p-5">
      <div className="pr-[81px]">
        <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#D4D0E9]">
          Process
        </h1>

        <div className="flex items-center gap-2 mt-4">
          <div className="flex w-fit rounded-full p-[4px] bg-[var(--color-bg-sy)]">
            <Check className="w-[10px] h-[10px] text-white" />
          </div>

          <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            01
          </span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
              Market details
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] whitespace-nowrap dark:text-[#AEAAC2]">
              Enter your Market Details
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[var(--color-bg-sy)] ml-[7px] mt-[8px]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex w-fit rounded-full p-[4px] bg-[var(--color-bg-sy)]">
            <Check className="w-[10px] h-[10px] text-white" />
          </div>

          <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            02
          </span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
              Customer Info
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
              Setup information{" "}
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[var(--color-bg-sy)] ml-[7px] mt-[8px]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex w-[18px] h-[18px] rounded-full p-[3px] border-4 border-[var(--color-bg-sy)]"></div>

          <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            03
          </span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
              Order details
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
              Add order details
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 gap-6">
        <div>
          <OrderItems />
        </div>
        <div>
          <ProductInfo />
        </div>

        <div className="flex justify-end">
          <div className="flex gap-4">
            <Discard children="Discard" />
            <Success
              path="#"
              text="Create order"
              className="w-[130px]!"
            ></Success>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CreateOrder);
