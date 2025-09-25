import React from "react";
import UsersStatistics from "./components/users-statistics";
import Select from "./components/select";
import SearchInput from "./components/search-input";
import Button from "./components/button";
import { Outlet, useLocation } from "react-router-dom";

const Users = () => {
  const { pathname } = useLocation();

  const isChecked = pathname.startsWith("/all-users/create-user");

  if (isChecked) return <Outlet />;

  return (
    <div className="p-6">
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

        <div
          className="flex flex-wrap items-center justify-end pl-[20px] pr-[20px] 
                max-[900px]:gap-5 w-full"
        >
          <div className="flex flex-wrap justify-end gap-4 max-[900px]:flex-col max-[900px]:items-stretch w-full">
            <SearchInput
              placeholder="Search User"
              className="max-[900px]:w-full!"
            />
            <Button text="Add New User" className="max-[650px]:w-full" />
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default React.memo(Users);
