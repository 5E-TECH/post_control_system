import { memo, type FC } from "react";

interface Props {
    text:string
    className:string
}

const Info:FC<Props> = ({text, className}) => {
  return (
    <div className="flex  justify-between">
      <h2 className={`text-[15px] font-medium text-[#2E263DE5] ${className}`}>{text}</h2>
      <h2 className="text-[15px] font-medium text-[#8C57FF]">Edit</h2>
    </div>
  );
};

export default memo(Info);
