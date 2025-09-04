import { Button, Input, Select } from "antd";
import { Option } from "antd/es/mentions";
import { ArrowRight, Bell, Check } from "lucide-react";
import React from "react";

import user from "../../shared/assets/users/table-user.svg";
import cart from "../../shared/assets/order/cart.svg";

const Orders = () => {
  return (
    <div className="flex gap-6 px-6 pt-6 bg-[#F4F5FA] h-[91vh]">
      <div className="w-fit h-fit pr-[81px]">
        <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#D4D0E9]">
          Process
        </h1>

        <div className="flex items-center gap-2 mt-4">
          <div className="flex w-fit rounded-full p-[4px] bg-[var(--color-bg-sy)]">
            <Check className="w-[10px] h-[10px] text-white" />
          </div>

          <span className="font-medium text-[22px] text-[#2E263DE5]">01</span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px]">
              Market details
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] whitespace-nowrap">
              Enter your Market Details
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[var(--color-bg-sy)] ml-[7px] mt-[8px]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex w-[18px] h-[18px] rounded-full p-[3px] border-4 border-[var(--color-bg-sy)]"></div>

          <span className="font-medium text-[22px] text-[#2E263DE5]">02</span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px]">
              Customer Info
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px]">
              Setup information{" "}
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[#E3DCFB] ml-[7px] mt-[8px]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex  w-[18px] h-[18px] rounded-full p-[3px] bg-white border-3 border-[#E3DCFB]">
            <Check className="w-[10px] h-[10px] text-white" />
          </div>

          <span className="font-medium text-[22px] text-[#2E263DE5]">03</span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px]">
              Order details
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px]">
              Add order details
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full">
        <div className="w-full p-5 rounded-md bg-[#ffffff] shadow-lg">
          <h1 className="mb-4 font-medium text-[#2E263DE5] text-[18px]">
            Customer Info
          </h1>
          <div className="flex flex-col gap-4">
            <Input placeholder="Phone Number" className="h-[45px]" />

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  Region
                </label>
                <Select
                  placeholder="Viloyat tanlang"
                  className="w-full h-[45px]!"
                >
                  <Option value="tashkent">Tashkent</Option>
                  <Option value="samarkand">Samarkand</Option>
                </Select>
              </div>

              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">
                  District
                </label>
                <Select
                  placeholder="Tuman tanlang"
                  className="w-full h-[45px]!"
                >
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
                Confirm that you have access to johndoe@gmail.com in sender
                email settings.
              </span>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col gap-5 p-5 rounded-md bg-[#ffffff] shadow-lg">
          <h1 className="font-medium text-[#2E263DE5] text-[18px]">
            Customer details
          </h1>

          <div className="flex items-center gap-3">
            <div>
              <img className="w-[40px] h-[40px]" src={user} alt="" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-[15px] text-[#2E263DE5]">
                Shamus Tuttle
              </span>
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                Customer ID: <span>#47389</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#E4F6D6] w-fit px-2 py-2 rounded-full">
              <img src={cart} alt="" />
            </div>
            <span>12 Orders</span>
          </div>
          <div>
            <h1 className="font-medium text-[15px] text-[#2E263DE5]">
              Contact info
            </h1>
            <p className="font-normal text-[15px] text-[#2E263DB2]">
              Email: <span>Sheldon88@yahoo.com</span>
            </p>
            <p className="font-normal text-[15px] text-[#2E263DB2]">
              Mobile: <span>+1 (609) 972-22-22</span>
            </p>
          </div>
        </div>
        <div className="flex gap-4 justify-end">
          <Button className="w-[91px]! h-[38px]! bg-[#F4F5FA]! border! border-[#8A8D93]! text-[#8A8D93]! hover:opacity-80!">
            Discard
          </Button>
          <Button className="w-[91px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none!">
            Next <ArrowRight className="w-[13px] h-[13px]" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Orders);
