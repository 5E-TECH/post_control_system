import { memo, type FC } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
    text:string
    className:string
    path:string
}

const Info:FC<Props> = ({text, className, path}) => {
  const navigate = useNavigate()
  return (
    <div className="flex  justify-between">
      <h2 className={`text-[15px] font-medium text-[#2E263DE5] ${className}`}>{text}</h2>
      <button onClick={() => navigate(path)} className="text-[15px] font-medium text-[#8C57FF]">Edit</button>
    </div>
  );
};

export default memo(Info);
