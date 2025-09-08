import { Input, Select } from "antd";
import { Bell } from "lucide-react";
import { memo } from "react";

const CustomerInfocomp = () => {
  return (
    <div className="w-full p-5 rounded-md bg-[#ffffff] dark:bg-[#312D48] shadow-lg">
      <h1 className="mb-4 font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
        Customer Info
      </h1>
      <div className="flex flex-col gap-4">
        <Input
          placeholder="Phone Number"
          className="h-[45px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
        />

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Region</label>
            <Select
              placeholder="Viloyat tanlang"
              className="w-full h-[45px]! custom-select-dropdown-bright"
              dropdownClassName="dark-dropdown"
            ></Select>
          </div>

          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">District</label>
            <Select
              placeholder="Tuman tanlang"
              className="w-full h-[45px]! custom-select-dropdown-bright"
              dropdownClassName="dark-dropdown"
            ></Select>
          </div>
        </div>

        <Input
          placeholder="Name"
          className="h-[45px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
        />

        <Input
          placeholder="Address"
          className="h-[45px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
        />

        <div className="w-full h-[62px] rounded-md bg-[#FFF9EB] dark:bg-[#413745] flex items-center gap-4 px-4">
          <div className="p-1 rounded-md bg-[#FFB400]">
            <Bell className="text-[#ffffff]" />
          </div>
          <span
            className="font-medium text-[19px] text-[#FFB400]"
            style={{ wordSpacing: 1 }}
          >
            Confirm that you have access to johndoe@gmail.com in sender email
            settings.
          </span>
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerInfocomp);
