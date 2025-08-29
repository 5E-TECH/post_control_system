import { memo } from "react";
import allusers from "../../../../shared/assets/users/all-users.svg";
import markets from "../../../../shared/assets/users/markets.svg";
import employers from "../../../../shared/assets/users/employer.svg";

const UsersStati = () => {
  return (
    <div className="grid grid-cols-3 max-[1250px]:grid-cols-2 max-[950px]:grid-cols-1 gap-6">
      <div className="h-[114px] bg-[#ffffff] shadow-lg rounded-md pl-[20px] pr-[20px] flex justify-between dark:bg-[#312D4B]">
        <div className="flex items-center">
          <div className="flex flex-col gap-1">
            <p className="font-normal text-[16px] dark:text-[#E7E3FCE5]">
              Barcha Foydalanuvchilar
            </p>
            <div className="flex gap-2">
              <span className="font-medium text-2xl text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                21,459
              </span>
              <span className="font-normal text-[15px] pt-1 text-[#56CA00]">
                (+29%)
              </span>
            </div>
          </div>
        </div>

        <div className="pt-[26px]">
          <img src={allusers} alt="" />
        </div>
      </div>
      <div className="h-[114px] bg-[#ffffff] shadow-lg rounded-md pl-[20px] pr-[20px] flex justify-between dark:bg-[#312D4B]">
        <div className="flex items-center">
          <div className="flex flex-col gap-1">
            <p className="font-normal text-[16px] dark:text-[#E7E3FCE5]">
              Marketlar
            </p>
            <div className="flex gap-2">
              <span className="font-medium text-2xl text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                4,567
              </span>
              <span className="font-normal text-[15px] pt-1 text-[#56CA00]">
                (+18%)
              </span>
            </div>
          </div>
        </div>

        <div className="pt-[26px]">
          <img src={markets} alt="" />
        </div>
      </div>
      <div className="h-[114px] bg-[#ffffff] shadow-lg rounded-md pl-[20px] pr-[20px] flex justify-between dark:bg-[#312D4B]">
        <div className="flex items-center">
          <div className="flex flex-col gap-1">
            <p className="font-normal text-[16px] dark:text-[#E7E3FCE5]">
              Xodimlar
            </p>
            <div className="flex gap-2">
              <span className="font-medium text-2xl text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                19,860
              </span>
              <span className="font-normal text-[15px] pt-1 text-[#FF4C51]">
                (-14%)
              </span>
            </div>
          </div>
        </div>

        <div className="pt-[26px]">
          <img src={employers} alt="" />
        </div>
      </div>
    </div>
  );
};

export default memo(UsersStati);
