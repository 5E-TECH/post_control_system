import { memo } from "react";
import user from "../../../../../shared/assets/order/user.png";
import shop from "../../../../../shared/assets/order/shop.svg";
import usd from "../../../../../shared/assets/order/usd.svg";

const CustomerProfile = () => {
  return (
    <div className="w-[25%]">
      <div className="shadow-lg bg-[#fff] dark:bg-[#312D4B] rounded-md p-[35px]">
        <div className="flex flex-col items-center mt-[48px]">
          <div>
            <img src={user} alt="" width={150} className="rounded-md" />
          </div>
          <div className="flex flex-col items-center mt-[16px]">
            <h4 className="font-medium text-[18px] dark:text-[#E7E3FCE5]">
              Seth Hallam
            </h4>
            <p className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
              Customer ID #634759
            </p>
          </div>
        </div>
        <div className="flex gap-[60px] mt-[24px]">
          <div className="flex gap-[16px]">
            <div>
              <img
                src={shop}
                alt=""
                className="w-[40px] h-[40px] rounded-md bg-[#8C57FF29] dark:bg-[#8C57FF29] p-[8px]"
              />
            </div>
            <div>
              <strong>184</strong>
              <p className="text-[#2E263DB2] dark:text-[#E7E3FCB2]">Order</p>
            </div>
          </div>
          <div className="flex gap-[16px]">
            <div>
              <img
                src={usd}
                alt=""
                className="w-[40px] h-[40px] rounded-md bg-[#8C57FF29] dark:bg-[#8C57FF29] p-[8px]"
              />
            </div>
            <div>
              <strong className="text-[18px] font-medium">$8456</strong>
              <p className="text-[#2E263DB2] dark:text-[#E7E3FCB2]">Spent</p>
            </div>
          </div>
        </div>
        <div className="mt-[24px]">
          <div>
            <h4 className="font-medium text-[18px] dark:text-[#E7E3FCE5]">
              Details
            </h4>
            <div className="border-b-[1px] border-[#E7E3FC1F] pt-[16px]"></div>
          </div>
          <div className="mt-[16px] space-y-[8px]">
            <p className="text-[15px] font-medium">
              Username:{" "}
              <span className="text-[13px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2]">
                shal.lamb
              </span>
            </p>
            <p className="text-[15px] font-medium">
              Status:{" "}
              <span className="text-[13px] font-normal text-[#56CA00] px-[12px] py-[2px] rounded-2xl bg-[#56CA0029] dark:bg-[#56CA0029]">
                Active
              </span>
            </p>
            <p className="text-[15px] font-medium">
              Country:{" "}
              <span className="text-[13px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2]">
                Peru
              </span>
            </p>
            <p className="text-[15px] font-medium">
              Contact:{" "}
              <span className="text-[13px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2]">
                +1 (234) 464-0600
              </span>
            </p>
          </div>
        </div>
        <div className="mt-[24px]">
          <button className="text-white bg-[#8C57FF] rounded-md text-[15px] font-medium w-full py-[8px] flex justify-center items-center cursor-pointer">
            Edit Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerProfile);
