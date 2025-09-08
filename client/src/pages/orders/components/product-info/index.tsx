import { Form, Input, Select } from "antd";
import { memo } from "react";

const ProductInfo = () => {
  return (
    <div className="bg-[#ffffff] shadow-lg rounded-md dark:bg-[#312D48] ">
      <div className="">
        <div className="p-5">
          <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#CBC7E1]">
            Product Information
          </h1>
        </div>

        <div className="flex gap-5 px-5">
          <Form.Item>
            <Input
              placeholder="Total Price"
              className="!w-[615px] !h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            />
          </Form.Item>

          <Form.Item className="">
            <Select
              placeholder="Center"
              className="!w-[615px] !h-[48px] custom-select-dropdown-bright"
              dropdownClassName="dark-dropdown"
            ></Select>
          </Form.Item>
        </div>

        <div className="px-5 pb-1.5">
          <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
            Comment (Optional)
          </span>
          <Form.Item className="!mt-1">
            <Input.TextArea
              className="!flex-1 !pb-[200px] !pt-5 !pl-5 dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#A9A5C0]! dark:text-[#E7E3FC66]!"
              placeholder="Keep your account secure with authentication step"
            />
          </Form.Item>
        </div>
      </div>
    </div>
  );
};

export default memo(ProductInfo);
