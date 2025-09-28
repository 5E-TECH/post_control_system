import { memo, type ReactElement } from "react";
import { Select as AntSelect } from "antd";
import { MdOutlineKeyboardArrowDown } from "react-icons/md";

interface Props<T = string> {
  text: string;
  name?: T;
  value?: string | null;
  options?: { value: string; label: string }[];
  onChange?: (name: T, value: string) => void;
}

const Select = <T extends string | number = string>({
  text,
  name,
  value = null,
  options = [],
  onChange,
}: Props<T>) => {
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
        onChange={(val) => onChange?.(name as T, val)}
      />
    </div>
  );
};

export default memo(Select) as <T extends string | number = string>(
  props: Props<T>
) => ReactElement;
