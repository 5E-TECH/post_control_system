import { memo, type FC, type ReactNode } from "react";
import { MdOutlineKeyboardArrowDown } from "react-icons/md";

interface Props {
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder: string;
  children?: ReactNode; // options keladi
  className?: string;
}

const Select: FC<Props> = ({
  name,
  value,
  onChange,
  placeholder,
  children,
  className = "",
}) => {
  return (
    <div
      className={`relative inline-block border border-[#2E263D38] rounded-md dark:border-[#E7E3FC38] ${className}`}
    >
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="appearance-none w-full outline-none text-[#2E263DB2] pt-[10px] pl-[14px] pb-[12px] pr-[40px] dark:text-[#E7E3FCB2] cursor-pointer bg-transparent"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>

      <div className="pointer-events-none absolute right-4 top-1/2 transform -translate-y-1/2 dark:fill-[#E7E3FCE5]">
        <MdOutlineKeyboardArrowDown />
      </div>
    </div>
  );
};

export default memo(Select);
