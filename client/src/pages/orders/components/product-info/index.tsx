import { Form, Input, Select } from "antd";
import { memo, useEffect, useState, type ChangeEvent } from "react";
import { setProductInfo } from "../../../../shared/lib/features/customer_and_market-id";
import { useDispatch } from "react-redux";

export interface IProductInfo {
  total_price: number | string;
  where_deliver: string | undefined;
  comment?: string;
}

const initialState: IProductInfo = {
  total_price: "",
  where_deliver: undefined,
  comment: "",
};

const ProductInfo = () => {
  const [formData, setFormData] = useState<IProductInfo>(initialState);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof IProductInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const dispatch = useDispatch();
  useEffect(() => {
    const productInfo = {
      ...formData,
      total_price: Number(formData.total_price),
    };

    if (productInfo) {
      dispatch(setProductInfo(productInfo));
    }
  }, [formData]);

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
              name="total_price"
              value={formData.total_price}
              onChange={handleChange}
              type="number"
              placeholder="Total Price"
              className="!w-[615px] !h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            />
          </Form.Item>

          <Form.Item className="">
            <Select
              value={formData.where_deliver}
              onChange={(value) => handleSelectChange("where_deliver", value)}
              placeholder="Select delivery place"
              className="!w-[615px] !h-[48px] custom-select-dropdown-bright"
              dropdownClassName="dark-dropdown"
            >
              <Select.Option value="center">center</Select.Option>
              <Select.Option value="address">address</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <div className="px-5 pb-1.5">
          <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
            Comment (Optional)
          </span>
          <Form.Item className="!mt-1">
            <Input.TextArea
              name="comment"
              value={formData.comment}
              onChange={handleChange}
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
