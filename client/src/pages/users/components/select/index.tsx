import { memo, type FC } from "react";
import { Select as AntSelect } from "antd";
import { MdOutlineKeyboardArrowDown } from "react-icons/md";
import type { IUserFilter } from "../../../../shared/lib/features/user-filters";

interface Props {
  text: string;
  name: keyof IUserFilter;
  value?: string;
  options?: { value: string; label: string }[];
  onChange?: (name: keyof IUserFilter, value: string) => void;
}

const Select: FC<Props> = ({
  text,
  name,
  value = null,
  options = [],
  onChange,
}) => {
  return (
    <div className="relative inline-block border border-gray-200 rounded-md dark:border-[#E7E3FC38]">
      <AntSelect
        value={value ?? undefined}
        placeholder={text}
        suffixIcon={
          <MdOutlineKeyboardArrowDown className="dark:fill-[#E7E3FCE5] text-[20px]" />
        }
        options={options}
        className="w-full [&_.ant-select-selection-placeholder]:text-[17px]"
        style={{
          border: "none",
          boxShadow: "none",
          height: "45px",
        }}
        onChange={(val) => onChange?.(name, val)}
      />
    </div>
  );
};

export default memo(Select);
