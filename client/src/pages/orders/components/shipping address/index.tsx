import { memo } from "react";
import Info from "../info";

const ShippingAdress = () => {
  return (
    <div>
      <div className="m-5">
        <Info text="Shipping adress" path="" className="text-[18px] dark:text-[#E7E3FCE5]" />
      </div>
      <div className="m-5 text-wrap w-[130px]">
        <h2 className="text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2] ">45 Roker Terrace Latheronwheel KW5 8NW, London UK</h2>
      </div>
    </div>
  );
};

export default memo(ShippingAdress);
