import { memo } from "react";
import ChooseUser from "./components/choose-user";
import { NavLink, Outlet } from "react-router-dom";

const CreateUser = () => {
  return (
    <div className="flex gap-[200px] max-[1500px]:flex-col dark:bg-[#312D4B]">
      <div className="">
        <h1 className="font-medium text-[18px] text-[#000000] text-center ml-13 mt-[80px] dark:text-[#ffffff] max-[1500px]:text-center">
          Foydalanuvchi rolini tanlang
        </h1>
        <div className="flex flex-col mt-[78px] mb-[45px] ml-[102px] mr-[42px] gap-[40px] max-[1500px]:flex-row">
          <NavLink
            end
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-[#ffffff]"
                  : "bg-[#ffffff] text-[#000000] border border-[#2E263D1F] dark:bg-[#312D4B] dark:text-[#ffffff]"
              }`
            }
            to={""}
          >
            <ChooseUser
              title="Admin"
              body="Expert tips & tools to improve your website or online store using blog."
            />
          </NavLink>

          <NavLink
            end
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-[#ffffff]"
                  : "bg-[#ffffff] text-[#000000] border border-[#2E263D1F] dark:bg-[#312D4B] dark:text-[#ffffff]"
              }`
            }
            to={"registrator"}
          >
            <ChooseUser
              title="Ro’yxatchi"
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
      <div className="mt-[190px] mb-[50px] max-[1500px]:pt-[50px] max-[1500px]:flex max-[1500px]:justify-center fixed top-0 right-70">
        <Outlet />
      </div>
    </div>
  );
};

export default memo(CreateUser);
