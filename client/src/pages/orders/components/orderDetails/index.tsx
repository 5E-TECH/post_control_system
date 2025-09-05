import { memo } from "react";
import detail from "../../../../shared/assets/order/detail.svg";

const Details = () => {
  return (
    <div>
      <div className="flex justify-between m-5">
        <h2 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
          Order details
        </h2>
        <button className="text-[#8C57FF]">Edit</button>
      </div>
      <div>
        <div className="flex justify-between items-center gap-5 bg-[#F6F7FB] dark:bg-[#3d3759]">
          <h2 className="flex-1 font-medium p-5 text-[#2E263DE5] dark:text-[#E7E3FCE5]">PRODUCT</h2>
          <div className="h-[14px] border-l-2 border-[#2E263D1F] dark:border-[#E7E3FC1F]"></div>
          <h2 className="ml-5 mr-10 font-medium text-[#2E263DE5] dark:text-[#E7E3FCE5]">QTY</h2>
          <div className="h-[14px] border-l-2 border-[#2E263D1F] pr-5 dark:border-[#E7E3FC1F]"></div>
        </div>
        <div className="mx-5 flex flex-row gap-5 items-center my-1 border-b-2 border-[#F6F7FB] dark:border-[#474360]">
          <div className="flex flex-row gap-5 flex-1">
            <div className="w-[34px] h-[34px] my-2">
              <img src={detail} alt="" className="object-contain w-full" />
            </div>
            <div>
              <h2 className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">OnePlus 7Pro</h2>
              <h3 className="text-[13px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">OnePlus</h3>
            </div>
          </div>
          <div className="mr-[93px] text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
            <h2>1</h2>
          </div>
        </div>
        <div className="mx-5 flex flex-row gap-5 items-center my-1 border-b-2 border-[#F6F7FB] dark:border-[#474360]">
          <div className="flex flex-row gap-5 flex-1">
            <div className="w-[34px] h-[34px] my-2">
              <img src={detail} alt="" className="object-contain w-full" />
            </div>
            <div>
              <h2 className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">OnePlus 7Pro</h2>
              <h3 className="text-[13px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">OnePlus</h3>
            </div>
          </div>
          <div className="mr-[93px] text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
            <h2>1</h2>
          </div>
        </div>
        <div className="mx-5 flex flex-row gap-5 items-center my-1 border-b-2 border-[#F6F7FB] dark:border-[#474360]">
          <div className="flex flex-row gap-5 flex-1">
            <div className="w-[34px] h-[34px] my-2">
              <img src={detail} alt="" className="object-contain w-full" />
            </div>
            <div>
              <h2 className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">OnePlus 7Pro</h2>
              <h3 className="text-[13px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">OnePlus</h3>
            </div>
          </div>
          <div className="mr-[93px] text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
            <h2>1</h2>
          </div>
        </div>
        <div className="mx-5 flex flex-row gap-5 items-center my-1 border-b-2 border-[#F6F7FB] dark:border-[#474360]">
          <div className="flex flex-row gap-5 flex-1">
            <div className="w-[34px] h-[34px] my-2">
              <img src={detail} alt="" className="object-contain w-full" />
            </div>
            <div>
              <h2 className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">OnePlus 7Pro</h2>
              <h3 className="text-[13px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">OnePlus</h3>
            </div>
          </div>
          <div className="mr-[93px] text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
            <h2>1</h2>
          </div>
        </div>
      </div>
      <div className="flex justify-end mr-5 my-5">
      <div className="flex gap-[48px]">
        <div className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            <h2>Subtotal:</h2>
            <h2>Shipping fee:</h2>
            <h2>Extra cost:</h2>
            <h2>Total:</h2>
        </div>
        <div className="text-[15px] text-[#2E263DE5] font-medium dark:text-[#E7E3FCE5]">
            <h2>$2,093</h2>
            <h2>$2</h2>
            <h2>$28</h2>
            <h2>$2,113</h2>
        </div>
      </div>
      </div>
    </div>
  );
};

export default memo(Details);
