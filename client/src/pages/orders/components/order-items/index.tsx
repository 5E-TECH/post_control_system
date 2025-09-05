import { Button, Form, Input, Select } from "antd";
import { Plus } from "lucide-react";
import { memo } from "react";

const OrderItems = () => {
  return (
    <div className="bg-[#ffffff] rounded-md shadow-lg">
      <div>
        <div className="p-5">
          <h1 className="font-medium text-[18px] text-[#2E263DE5]">
            Order Items
          </h1>
        </div>

        <div className="flex px-5 relative">
          <span className="absolute -top-[9px] left-8 z-50 bg-white px-1 text-[13px] font-normal text-[#2E263DB2]">
            Item 1
          </span>

          <div className="flex gap-5">
            <Form.Item className="">
              <Select
                placeholder="Select item 1"
                className="!w-[563px] !h-[48px]"
              ></Select>
            </Form.Item>

            <Form.Item>
              <Input placeholder="Quantity" className="!w-[385px] !h-[48px]" />
            </Form.Item>
          </div>
        </div>

        <div className="flex px-5 relative">
          <span className="absolute -top-[9px] left-8 z-50 bg-white px-1 text-[13px] font-normal text-[#2E263DB2]">
            Item 2
          </span>

          <div className="flex gap-5">
            <Form.Item className="">
              <Select
                placeholder="Select item 2"
                className="!w-[563px] !h-[48px]"
              ></Select>
            </Form.Item>

            <Form.Item>
              <Input placeholder="Quantity" className="!w-[385px] !h-[48px]" />
            </Form.Item>
          </div>
        </div>

        <div className="px-5 pb-5">
          <Button className="!w-[183px] !h-[40px] !bg-[var(--color-bg-sy)] !text-[white] !font-medium !text-[15px]">
            {" "}
            <Plus className="w-[17px] h-[17px]" />
            Add Another Item
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderItems);
