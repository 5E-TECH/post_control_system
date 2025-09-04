import { Input, Select } from "antd";
import { Option } from "antd/es/mentions";
import { Bell } from "lucide-react";
import { memo } from "react";

const CustomerInfo = () => {
  return (
    <div className="w-full p-5 rounded-md bg-[#ffffff] shadow-lg">
      <h1 className="mb-4 font-medium text-[#2E263DE5] text-[18px]">
        Customer Info
      </h1>
      <div className="flex flex-col gap-4">
        <Input placeholder="Phone Number" className="h-[45px]" />

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Region</label>
            <Select placeholder="Viloyat tanlang" className="w-full h-[45px]!">
              <Option value="tashkent">Tashkent</Option>
              <Option value="samarkand">Samarkand</Option>
            </Select>
          </div>

          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">District</label>
            <Select placeholder="Tuman tanlang" className="w-full h-[45px]!">
              <Option value="chilonzor">Chilonzor</Option>
              <Option value="yakkasaroy">Yakkasaroy</Option>
            </Select>
          </div>
        </div>

        <Input placeholder="Name" className="h-[45px]!" />

        <Input placeholder="Address" className="h-[45px]!" />

        <div className="w-full h-[62px] rounded-md bg-[#FFF9EB] flex items-center gap-4 px-4">
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

export default memo(CustomerInfo);
