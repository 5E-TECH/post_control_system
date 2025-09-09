import { memo } from "react";
import { NavLink } from "react-router-dom";

const ChooseMail = () => {
  return (
    <div className="grid grid-cols-3 gap-18 h-[60px]">
      <NavLink
        end
        to={""}
        className={({ isActive }) =>
          `${
            isActive ? "bg-[var(--color-bg-sy)] text-[#ffffff]" : ""
          } flex items-center justify-center shadow-lg rounded-md text-[20px]`
        }
      >
        Bugungi pochtalar
      </NavLink>
      <NavLink
        to={"refused"}
        className={({ isActive }) =>
          `${
            isActive ? "bg-[var(--color-bg-sy)] text-[#ffffff]" : ""
          } flex items-center justify-center shadow-lg rounded-md text-[20px]`
        }
      >
        Qaytgan pochtalar
      </NavLink>
      <NavLink
        to={"old"}
        className={({ isActive }) =>
          `${
            isActive ? "bg-[var(--color-bg-sy)] text-[#ffffff]" : ""
          } flex items-center justify-center shadow-lg rounded-md text-[20px]`
        }
      >
        Eski pochtalar
      </NavLink>
    </div>
  );
};

export default memo(ChooseMail);
