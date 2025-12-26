import { memo, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { buildAdminPath } from "../../../../shared/const";

interface Props {
  text: string;
  className?: string;
}

const Button: FC<Props> = ({ text, className }) => {
  const navigate = useNavigate();

  return (
    <div onClick={() => navigate(buildAdminPath("all-users/create-user"))}>
      <button
        className={`bg-[#8C57FF] text-[#ffffff] px-[18px] py-[8px] rounded-md cursor-pointer hover:opacity-85 ${className}`}
      >
        {text}
      </button>
    </div>
  );
};

export default memo(Button);
