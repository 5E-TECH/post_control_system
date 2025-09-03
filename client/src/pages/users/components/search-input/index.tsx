import { memo, type FC } from "react";

interface Props {
  placeholder: string;
}

const SearchInput: FC<Props> = ({ placeholder }) => {
  return (
    <div className="">
      <input
        type="text"
        placeholder={placeholder}
        className="border border-[#2E263D66] placeholder:text-[#2E263D66] py-[8px] px-[16px] rounded-md outline-none cursor-pointer dark:border-[#E7E3FC38] dark:placeholder:text-[#E7E3FC38]"
      />
    </div>
  );
};

export default memo(SearchInput);
