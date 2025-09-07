import { memo } from "react";

const CashDetail = () => {
  return (
    <div className="px-5 mt-5">
      <div className="w-[500px] h-[250px] text-center text-2xl flex flex-col justify-center rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white">
        <h3>Kassadagi miqdor</h3>
        <strong className="block pt-3">40 000 000 UZS</strong>
      </div>
      <div>
        <div className="flex items-center">
          <div>
            <input
              type="date"
              className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
            />
          </div>
          <div>
            <input
              type="date"
              className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CashDetail);
