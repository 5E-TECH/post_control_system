import { memo } from "react";
import allusers from "../../../../shared/assets/users/all-users.svg";
import market from "../../../../shared/assets/users/markets.svg";
import employers from "../../../../shared/assets/users/employer.svg";
import { NavLink } from "react-router-dom";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useTranslation } from "react-i18next";
import { buildAdminPath } from "../../../../shared/const";

const UsersStatistics = () => {
  const { t } = useTranslation("users");
  const { getUser } = useUser();
  const { data: allUsers } = getUser({ limit: 0 });
  const markets = Array.isArray(allUsers?.data?.data)
    ? allUsers?.data?.data?.filter((user: any) => user.role === "market")
    : [];

  const users = Array.isArray(allUsers?.data?.data)
    ? allUsers?.data?.data?.filter((user: any) => user.role !== "market")
    : [];

  return (
    <div className="grid grid-cols-3 max-[1250px]:grid-cols-2 max-[950px]:grid-cols-1 gap-6">
      <NavLink
        end
        className={({ isActive }) =>
          `${isActive ? "border border-[var(--color-bg-sy)] rounded-md" : ""}`
        }
        to={""}
      >
        <div className="h-[114px] bg-[#ffffff] shadow-lg rounded-md pl-[20px] pr-[20px] flex justify-between dark:bg-[#312D4B]">
          <div className="flex items-center">
            <div className="flex flex-col gap-1">
              <p className="font-normal text-[16px] dark:text-[#E7E3FCE5]">
                {t("allUsers")}
              </p>
              <div className="flex gap-2">
                <span className="font-medium text-2xl text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                  {allUsers?.data?.total}
                </span>
                <span className="font-normal text-[15px] pt-1 text-[#56CA00]">
                  
                </span>
              </div>
            </div>
          </div>

          <div className="pt-[26px]">
            <img src={allusers} alt="" />
          </div>
        </div>
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `${isActive ? "border border-[var(--color-bg-sy)] rounded-md" : ""}`
        }
        to={buildAdminPath("all-users/markets")}
      >
        <div className="h-[114px] bg-[#ffffff] shadow-lg rounded-md pl-[20px] pr-[20px] flex justify-between dark:bg-[#312D4B]">
          <div className="flex items-center">
            <div className="flex flex-col gap-1">
              <p className="font-normal text-[16px] dark:text-[#E7E3FCE5]">
                {t("markets")}
              </p>
              <div className="flex gap-2">
                <span className="font-medium text-2xl text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                  {markets?.length}
                </span>
                <span className="font-normal text-[15px] pt-1 text-[#56CA00]">
                  
                </span>
              </div>
            </div>
          </div>

          <div className="pt-[26px]">
            <img src={market} alt="" />
          </div>
        </div>
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `${isActive ? "border border-[var(--color-bg-sy)] rounded-md" : ""}`
        }
        to={buildAdminPath("all-users/users")}
      >
        <div className="h-[114px] bg-[#ffffff] shadow-lg rounded-md pl-[20px] pr-[20px] flex justify-between dark:bg-[#312D4B]">
          <div className="flex items-center">
            <div className="flex flex-col gap-1">
              <p className="font-normal text-[16px] dark:text-[#E7E3FCE5]">
                {t("employees")}
              </p>
              <div className="flex gap-2">
                <span className="font-medium text-2xl text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                  {users?.length}
                </span>
                <span className="font-normal text-[15px] pt-1 text-[#FF4C51]">
                
                </span>
              </div>
            </div>
          </div>

          <div className="pt-[26px]">
            <img src={employers} alt="" />
          </div>
        </div>
      </NavLink>
    </div>
  );
};

export default memo(UsersStatistics);
