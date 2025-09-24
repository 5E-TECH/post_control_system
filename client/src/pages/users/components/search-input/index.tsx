import { memo, type FC } from "react";

interface Props {
  placeholder: string;
  className?: string;
}

const SearchInput: FC<Props> = ({ placeholder, className }) => {
  return (
    <div className="">
      <input
        type="text"
        placeholder={placeholder}
        className={`border border-[#2E263D66] placeholder:text-[#2E263D66] py-[8px] px-[16px] rounded-md outline-none cursor-pointer dark:border-[#E7E3FC38] dark:placeholder:text-[#E7E3FC38] ${className}`}
      />
    </div>
  );
};

export default memo(SearchInput);
