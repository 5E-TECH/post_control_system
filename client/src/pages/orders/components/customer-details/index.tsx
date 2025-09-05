import { memo } from "react";
import user from "../../../../shared/assets/users/table-user.svg";
import cart from "../../../../shared/assets/order/cart.svg";

const CustomerDetails = () => {
  return (
    <div className="w-full flex flex-col gap-5 p-5 rounded-md bg-[#ffffff] shadow-lg">
      <h1 className="font-medium text-[#2E263DE5] text-[18px]">
        Customer details
      </h1>

      <div className="flex items-center gap-3">
        <div>
          <img className="w-[40px] h-[40px]" src={user} alt="" />
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-[15px] text-[#2E263DE5]">
            Shamus Tuttle
          </span>
          <span className="font-normal text-[15px] text-[#2E263DB2]">
            Customer ID: <span>#47389</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="bg-[#E4F6D6] w-fit px-2 py-2 rounded-full">
          <img src={cart} alt="" />
        </div>
        <span>12 Orders</span>
      </div>
      <div>
        <h1 className="font-medium text-[15px] text-[#2E263DE5]">
          Contact info
        </h1>
        <p className="font-normal text-[15px] text-[#2E263DB2]">
          Email: <span>Sheldon88@yahoo.com</span>
        </p>
        <p className="font-normal text-[15px] text-[#2E263DB2]">
          Mobile: <span>+1 (609) 972-22-22</span>
        </p>
      </div>
    </div>
  );
};

export default memo(CustomerDetails);
