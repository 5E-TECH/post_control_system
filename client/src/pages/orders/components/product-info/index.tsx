import { Button, Form, Input, Select } from "antd";
import { memo } from "react";
import Discard from "../button/discard";

const ProductInfo = () => {
  return (
    <>
      <div className="bg-[#ffffff] shadow-lg rounded-md">
        <div className="">
          <div className="p-5">
            <h1 className="font-medium text-[18px] text-[#2E263DE5]">
              Product Information
            </h1>
          </div>

          <div className="flex gap-5 px-5">
            <Form.Item>
              <Input
                placeholder="Total Price"
                className="!w-[476px] !h-[48px]"
              />
            </Form.Item>

            <Form.Item className="">
              <Select
                placeholder="Select item 1"
                className="!w-[476px] !h-[48px]"
              ></Select>
            </Form.Item>
          </div>

          <div className="px-5 pb-1.5">
            <span className="font-normal text-[15px] text-[#2E263DB2]">
              Comment (Optional)
            </span>
            <Form.Item className="!mt-1">
              <Input.TextArea
                className="!w-[973px] !pb-[200px] !pt-5 !pl-5"
                placeholder="Keep your account secure with authentication step"
              />
            </Form.Item>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <div className="flex gap-4">
          <Discard children="Discard" />
          <Button className="!w-[138px] !h-[38px] !bg-[var(--color-bg-sy)] !text-[#ffffff]">Create Order</Button>
        </div>
      </div>
    </>
  );
};

export default memo(ProductInfo);
