import { memo, type FC } from "react";
import { LuSquareArrowOutUpRight } from "react-icons/lu";

interface Props {
  text: string;
}

const Export: FC<Props> = ({ text }) => {
  return (
    <div className="flex items-center gap-2 border border-[#8A8D93] px-[18px] py-[8px] rounded-md cursor-pointer hover:opacity-80">
      <LuSquareArrowOutUpRight className="text-[#8A8D93]" />
      <span className="text-[#8A8D93]">{text}</span>
    </div>
  );
};

export default memo(Export);
