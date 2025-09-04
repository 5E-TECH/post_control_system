import { Check } from "lucide-react";
import { memo } from "react";

const CreateOrder = () => {
  return (
    <div className="flex gap-6 px-6 pt-6 bg-[#F4F5FA] h-[91vh]">
      <div className="w-fit h-fit pr-[81px]">
        <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#D4D0E9]">
          Process
        </h1>

        <div className="flex items-center gap-2 mt-4">
          <div className="flex w-fit rounded-full p-[4px] bg-[var(--color-bg-sy)]">
            <Check className="w-[10px] h-[10px] text-white" />
          </div>

          <span className="font-medium text-[22px] text-[#2E263DE5]">01</span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px]">
              Market details
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] whitespace-nowrap">
              Enter your Market Details
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[var(--color-bg-sy)] ml-[7px] mt-[8px]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex w-[18px] h-[18px] rounded-full p-[3px] border-4 border-[var(--color-bg-sy)]"></div>

          <span className="font-medium text-[22px] text-[#2E263DE5]">02</span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px]">
              Customer Info
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px]">
              Setup information{" "}
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[#E3DCFB] ml-[7px] mt-[8px]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex  w-[18px] h-[18px] rounded-full p-[3px] bg-white border-3 border-[#E3DCFB]">
            <Check className="w-[10px] h-[10px] text-white" />
          </div>

          <span className="font-medium text-[22px] text-[#2E263DE5]">03</span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px]">
              Order details
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px]">
              Add order details
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CreateOrder);
