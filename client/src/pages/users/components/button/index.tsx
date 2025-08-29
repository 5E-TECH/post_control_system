import { memo, type FC } from "react";

interface Props {
  text: string;
}

const Button: FC<Props> = ({ text }) => {
  return (
    <div className="">
      <button className="bg-[#8C57FF] text-[#ffffff] px-[18px] py-[8px] rounded-md cursor-pointer hover:opacity-85">
        {text}
      </button>
    </div>
  );
};

export default memo(Button);
