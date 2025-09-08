import { memo } from "react";

const CustomerHeader = () => {
  return (
    <div className="ClientHeader">
      <div className="flex justify-between px-5 items-center">
        <div>
          <h1 className="font-medium text-[24px]">Customer ID #634759</h1>
          <p className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
            Aug 17, 2020, 5:48 (ET)
          </p>
        </div>
        <div>
          <button className="font-medium text-[15px] text-[#FF4C51] px-[18px] py-[8px] border rounded-md cursor-pointer">
            Delete Customer
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerHeader);
