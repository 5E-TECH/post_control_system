import React from "react";
import UsersStatistics from "./components/users-statistics";
import Select from "./components/select";
import Export from "./components/export";
import SearchInput from "./components/search-input";
import Button from "./components/button";
import { Outlet, useLocation } from "react-router-dom";

const Users = () => {
  const { pathname } = useLocation();

  const isChecked = pathname.startsWith("/all-users/create-user");

  if (isChecked) return <Outlet />;

  return (
    <div className="p-6 h-[91vh] bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)]">
      <UsersStatistics />
      <div className="rounded-md mt-6 bg-[#FFFFFF] shadow-lg flex flex-col dark:bg-[#312D4B] pt-[20px]">
        <div className="pl-[20px] pr-[20px]">
          <span className="text-[18px]">Filters</span>
        </div>

        <div className="grid grid-cols-3 gap-5 pt-[16px] pl-[20px] pr-[20px] max-[1000px]:grid-cols-2 max-[750px]:grid-cols-1">
          <Select text="Select Role" />
          <Select text="Select Location" />
          <Select text="Select Status" />
        </div>

        <div className="w-full border border-[#E9E8EA] my-[20px] dark:border-[#E7E3FC38]"></div>

        <div className="flex flex-wrap items-center justify-between pl-[20px] pr-[20px] max-[900px]:gap-5">
          <div>
            <Export text="Export" />
          </div>

          <div className="flex gap-4 flex-wrap">
            <SearchInput placeholder="Search User" />
            <Button text="Add New User" />
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default React.memo(Users);
