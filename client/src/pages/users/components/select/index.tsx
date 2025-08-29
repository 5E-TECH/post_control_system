import { memo, type FC } from "react";
import { MdOutlineKeyboardArrowDown } from "react-icons/md";

interface Props {
  value?: string;
  text: string;
}

const Select: FC<Props> = ({ value = "", text }) => {
  return (
    <div className="relative inline-block border border-[#2E263D38] rounded-md dark:border-[#E7E3FC38]">
      <select className="appearance-none w-full outline-none text-[#2E263DB2] pt-[10px] pl-[14px] pb-[12px] pr-[40px] dark:text-[#E7E3FCB2] cursor-pointer">
        <option value={value}>{text}</option>
      </select>

      <div className="pointer-events-none absolute right-4 top-1/2 transform -translate-y-1/2 dark:fill-[#E7E3FCE5]">
        <MdOutlineKeyboardArrowDown />
      </div>
    </div>
  );
};

export default memo(Select);
