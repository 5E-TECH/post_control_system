import React from "react";
import UsersStatistics from "./components/users-statistics";
import Select from "./components/select";
import SearchInput from "./components/search-input";
import Button from "./components/button";
import { Button as AntButton } from "antd";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  resetUserFilter,
  setUserFilter,
  type IUserFilter,
} from "../../shared/lib/features/user-filters";
import type { RootState } from "../../app/store";

const Users = () => {
  const { t } = useTranslation("users");
  const { pathname } = useLocation();
  const dispatch = useDispatch();
  const form = useSelector((state: RootState) => state.setUserFilter);

  const isChecked = pathname.startsWith("/all-users/create-user");

  if (isChecked) return <Outlet />;

  const roles = ["superadmin", "admin", "registrator", "market", "courier"];
  const roleOptions = roles.map((role: string) => ({
    value: role,
    label: role,
  }));

  const status = ["active", "inactive"];
  const statusOptions = status.map((status: string) => ({
    value: status,
    label: status,
  }));

  const handleFilterChange = (name: keyof IUserFilter, value: string) => {
    dispatch(setUserFilter({ name, value }));
  };
  const handleClear = () => {
    dispatch(resetUserFilter());
  };

  return (
    <div className="p-6">
      <UsersStatistics />
      <div className="rounded-md mt-6 bg-[#FFFFFF] shadow-lg flex flex-col dark:bg-[#312D4B] pt-[20px]">
        <div className="pl-[20px] pr-[20px]">
          <span className="text-[18px]">{t("filters")}</span>
        </div>

        <div className="grid grid-cols-3 gap-5 pt-[16px] pl-[20px] pr-[20px] max-[750px]:grid-cols-1">
          <Select<keyof IUserFilter>
            name="role"
            value={form.role}
            text={t("selectRole")}
            options={roleOptions}
            onChange={handleFilterChange}
          />

          <Select<keyof IUserFilter>
            name="status"
            value={form.status}
            text={t("selectStatus")}
            options={statusOptions}
            onChange={handleFilterChange}
          />

          <div className="flex min-[900px]:justify-end">
            <AntButton
              className="w-[150px]! max-[651px]:w-full! h-[45px]!"
              onClick={handleClear}
            >
              Tozalash
            </AntButton>
          </div>
        </div>

        <div className="w-full border border-[#E9E8EA] my-[20px] dark:border-[#E7E3FC38]"></div>

        <div
          className="flex flex-wrap items-center justify-end pl-[20px] pr-[20px] 
                max-[900px]:gap-5 w-full"
        >
          <div className="flex flex-wrap justify-end gap-4 max-[900px]:flex-col max-[900px]:items-stretch w-full">
            <SearchInput
              placeholder={t("searchUser")}
              className="max-[900px]:w-full!"
            />
            <Button text={t("addNewUser")} className="max-[650px]:w-full" />
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default React.memo(Users);
