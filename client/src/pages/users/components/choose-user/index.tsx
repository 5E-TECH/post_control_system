import { memo, type FC } from "react";
import admin from "../../../../shared/assets/users/choose-admin.svg";

interface Props {
  className?: string;
  title: string;
  body?: string;
}

const ChooseUser: FC<Props> = ({ title, body }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-[6px] select-none`}
    >
      <div>
        <img src={admin} alt="" />
      </div>
      <div className="flex flex-col items-center justify-center">
        <h1 className="py-[12px] font-medium">{title}</h1>
        <p className="text-center font-normal">{body}</p>
      </div>
    </div>
  );
};

export default memo(ChooseUser);
