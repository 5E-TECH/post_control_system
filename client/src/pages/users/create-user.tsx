import { memo } from "react";
import ChooseUser from "./components/choose-user";
import { NavLink, Outlet } from "react-router-dom";

const CreateUser = () => {
  return (
    <div className="flex dark:bg-[#312D4B]">
      <div className="">
        <h1 className="font-medium text-[18px] text-[#000000] pl-[90px] pt-[40px] dark:text-[#ffffff]">
          Foydalanuvchi rolini tanlang
        </h1>
        <div className="flex flex-col pt-[78px] pb-[78px] pl-[22px] pr-[22px] gap-[40px]">
          <NavLink
            end
            to={""}
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-[#ffffff]"
                  : "bg-[#ffffff] text-[#000000] border border-[#2E263D1F] dark:bg-[#312D4B] dark:text-[#ffffff]"
              }`
            }
          >
            <ChooseUser
              title="Admin & Ro’yxatchi"
              body="Expert tips & tools to improve your website or online store using blog."
            />
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-[#ffffff]"
                  : "bg-[#ffffff] text-[#000000] border border-[#2E263D1F] dark:bg-[#312D4B] dark:text-[#ffffff]"
              }`
            }
            to={"courier"}
          >
            <ChooseUser
              title="Kurier"
              body="Expert tips & tools to improve your website or online store using blog."
            />
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-[#ffffff]"
                  : "bg-[#ffffff] text-[#000000] border border-[#2E263D1F] dark:bg-[#312D4B] dark:text-[#ffffff]"
              }`
            }
            to={"market"}
          >
            <ChooseUser
              title="Market"
              body="Expert tips & tools to improve your website or online store using blog."
            />
          </NavLink>
        </div>
      </div>
      <div className="pt-[165px] pl-[165px]">
        <Outlet />
      </div>
    </div>
  );
};

export default memo(CreateUser);
