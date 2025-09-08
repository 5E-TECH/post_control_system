import { ArrowRight, Check } from "lucide-react";
import { memo } from "react";
import CustomerDetails from "../../components/customer-details";
import Discard from "../../components/button/discard";
import Success from "../../components/button/success";
import { Outlet, useLocation } from "react-router-dom";
import CustomerInfo from "../../components/customer-info";

const CustomerInfoOrder = () => {
  const { pathname } = useLocation();

  if (pathname.startsWith("/orders/confirm")) {
    return <Outlet />;
  }
  return (
    <div className="flex gap-6 px-6 pt-6 bg-[#F4F5FA] dark:bg-[var(--color-dark-bg-py)]">
      <div className="w-fit h-fit pr-[81px]">
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
          <div className="flex w-[18px] h-[18px] rounded-full p-[3px] border-4 border-[var(--color-bg-sy)]"></div>

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

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[#E3DCFB] ml-[7px] mt-[8px] dark:bg-[#8C57FF29]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex  w-[18px] h-[18px] rounded-full p-[3px] bg-white border-3 border-[#E3DCFB] dark:bg-[#312D4B] dark:border-[#382C5C]"></div>

          <span className="font-medium text-[25px] text-[#2E263DE5]">03</span>

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

      <div className="flex flex-col gap-6 w-full">
        <CustomerInfo />
        <CustomerDetails />
        <div className="flex gap-4 justify-end">
          <Discard children="Discard"/>
          <Success
            path="confirm"
            text="Next"
            icon={<ArrowRight className="h-[13px] w-[13px]" />}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerInfoOrder);
