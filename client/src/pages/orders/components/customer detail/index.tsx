import { memo } from "react";
import avatar from "../../../../shared/assets/order/avatar.png";
import cart from "../../../../shared/assets/order/cart.svg"
import Info from "../info";

const CustomerDetail = () => {
  return (
    <div>
      <div className="m-5">
        <h2 className="dark:text-[#E7E3FC66]">CustomerDetail</h2>
      </div>
      <div className="mx-5 flex items-center gap-3 mb-6">
        <div>
            <img src={avatar} alt="" />
        </div>
        <div>
            <h2 className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">Shamus Tuttle</h2>
            <h2 className="text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">Customer ID: #47389</h2>
        </div>
      </div>
      <div className="mx-5 flex items-center gap-3 mb-6">
        <div>
            <img src={cart} alt="" />
        </div>
        <div>
            <h2 className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">12 Orders</h2>
        </div>
      </div>
      <div className="mx-5 mb-6 flex gap-3 flex-col text-[15px] text-[#E7E3FCB2] dark:text-[#E7E3FCE5]">
        <Info text={"Contact info"} className={"text-[15px] dark:text-[#E7E3FCE5]"}/>
        <div>
            <h2>Phone Number: +998913607434</h2>
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerDetail);
