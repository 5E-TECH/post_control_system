import React from "react";
import { NavLink } from "react-router-dom";

const Mails = () => {
  return (
    <div className="h-[800px] p-5">
      <div className="grid grid-cols-3 gap-18 h-[60px]">
        <NavLink to={""} className={"flex items-center justify-center shadow-lg rounded-md bg-[#ffffff] text-[20px]"}>
          Bugungi pochtalar
        </NavLink>
        <NavLink to={""} className={"flex items-center justify-center shadow-lg rounded-md bg-[#ffffff] text-[20px]"}>
          Qaytgan pochtalar
        </NavLink>
        <NavLink to={""} className={"flex items-center justify-center shadow-lg rounded-md bg-[#ffffff] text-[20px]"}>
          Eski pochtalar
        </NavLink>
      </div>
      <div></div>
    </div>
  );
};

export default React.memo(Mails);
