import { memo, type FC } from "react";
import admin from "../../../../shared/assets/users/choose-admin.svg";

interface Props {
  className?: string;
  title: string;
  body: string;
}

const ChooseUser: FC<Props> = ({ className = "", title, body }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center w-[364px] h-[194px] rounded-[6px] ${className} bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-[#ffffff] cursor-pointer`}
    >
      <div>
        <img src={admin} alt="" />
      </div>
      <h1 className="py-[12px] font-medium text-[#E8DDFF]">{title}</h1>
      <p className="text-center font-normal text-[#E8DDFF]">{body}</p>
    </div>
  );
};

export default memo(ChooseUser);
