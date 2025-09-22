import { memo } from "react";
import ChooseUser from "./components/choose-user";
import { NavLink, Outlet } from "react-router-dom";

const CreateUser = () => {
  return (
    <div className="flex max-[1500px]:flex-col dark:bg-[#312D4B]">
      <div className="w-[50%] px-[60px] py-[40px] overflow-y-auto max-h-screen max-[1500px]:w-full max-[1500px]:max-h-none max-[1500px]:overflow-visible">
        <h1 className="font-medium text-[24px] text-[#000000] text-center mt-[20px] dark:text-[#ffffff] max-[1500px]:text-center max-lg:text-[20px]">
          Foydalanuvchi rolini tanlang
        </h1>

        <div className="flex flex-col items-center gap-[30px] mt-[60px] max-[1500px]:flex-row max-[1500px]:flex-wrap max-[1500px]:justify-center">
          <NavLink
            end
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-white"
                  : "bg-white text-black border border-[#2E263D1F] dark:bg-[#312D4B] dark:text-white"
              } rounded-xl shadow-md p-[20px] w-[300px] hover:scale-[1.02] transition-all duration-300`
            }
            to={""}
          >
            <ChooseUser title="Admin" />
          </NavLink>

          <NavLink
            end
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-white"
                  : "bg-white text-black border border-[#2E263D1F] dark:bg-[#312D4B] dark:text-white"
              } rounded-xl shadow-md p-[20px] w-[300px] hover:scale-[1.02] transition-all duration-300`
            }
            to={"registrator"}
          >
            <ChooseUser title="Ro’yxatchi" />
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-white"
                  : "bg-white text-black border border-[#2E263D1F] dark:bg-[#312D4B] dark:text-white"
              } rounded-xl shadow-md p-[20px] w-[300px] hover:scale-[1.02] transition-all duration-300`
            }
            to={"courier"}
          >
            <ChooseUser title="Kurier" />
          </NavLink>

          <NavLink
            className={({ isActive }) =>
              `${
                isActive
                  ? "bg-gradient-to-r from-[#CDB5FF] via-[#A378FF] to-[#8146FF] text-white"
                  : "bg-white text-black border border-[#2E263D1F] dark:bg-[#312D4B] dark:text-white"
              } rounded-xl shadow-md p-[20px] w-[300px] hover:scale-[1.02] transition-all duration-300`
            }
            to={"market"}
          >
            <ChooseUser title="Market" />
          </NavLink>
        </div>
      </div>

      <div className="w-[50%] px-[60px] py-[180px] sticky top-0 max-h-screen overflow-y-auto max-[1500px]:w-full max-[1500px]:top-auto max-[1500px]:py-[40px]">
        <Outlet />
      </div>
    </div>
  );
};

export default memo(CreateUser);
