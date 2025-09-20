import { Button, Form, Input, Select } from "antd";
import { Plus, X } from "lucide-react";
import { memo, useEffect, useState, type ChangeEvent } from "react";
import { useProduct } from "../../../../shared/api/hooks/useProduct";
import { useDispatch, useSelector } from "react-redux";
import { setOrderItems } from "../../../../shared/lib/features/customer_and_market-id";
import type { RootState } from "../../../../app/store";

export interface IOrderItems {
  product_id: string | undefined;
  quantity: number | string;
}

const initialState: IOrderItems = {
  product_id: undefined,
  quantity: "",
};

const OrderItems = () => {
  const [formData, setFormData] = useState<IOrderItems>(initialState);

  const [items, setItems] = useState<number[]>(() => {
    const saved = localStorage.getItem("orderItems");
    return saved ? JSON.parse(saved) : [];
  });

  const addItem = () => {
    setItems((prev) => [...prev, prev.length + 1]);
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item !== id));
  };

  const marketId = localStorage.getItem("marketId");
  const { getProductsByMarket } = useProduct();
  const { data } = getProductsByMarket(marketId as string);
  const productNames = data?.data.map((product: any) => ({
    value: product.id,
    label: (
      <div className="flex items-center gap-5">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-10 h-10 object-cover rounded"
        />
        <span>{product.name}</span>
      </div>
    ),
  }));

  const dispatch = useDispatch();
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    dispatch(setOrderItems({ ...updated, quantity: Number(updated.quantity) }));
  };

  const handleSelectChange = (name: keyof IOrderItems, value: string) => {
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    dispatch(setOrderItems({ ...updated, quantity: Number(updated.quantity) }));
  };

  const orderItems = useSelector(
    (state: RootState) => state.setCustomerData.orderItems
  );

  useEffect(() => {
    if (orderItems && orderItems.length > 0) {
      setFormData(orderItems[0]);
    } else {
      setFormData(initialState);
    }
  }, [orderItems]);

  return (
    <div className="bg-[#ffffff] dark:bg-[#312D48] rounded-md shadow-lg">
      <div className="">
        <div className="px-5 pt-5 pb-3">
          <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#CBC7E1]">
            Order Items
          </h1>
        </div>

        <div className="scroll-order-items">
          <div className="flex px-5 relative mt-1">
            <span className="absolute -top-[9px] left-8 z-50 bg-white px-1 text-[13px] font-normal text-[#2E263DB2] dark:bg-[#312D48] dark:text-[#A9A5BF]">
              Item 1
            </span>

            <div className="flex gap-5">
              <Form.Item className="">
                <Select
                  value={formData.product_id}
                  onChange={(value) => handleSelectChange("product_id", value)}
                  placeholder="Select item 1"
                  className="!w-[639px] !h-[48px] custom-select-dropdown-bright"
                  options={productNames}
                  dropdownClassName="dark-dropdown"
                ></Select>
              </Form.Item>

              <Form.Item>
                <Input
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  type="number"
                  placeholder="Quantity"
                  className="!w-[639px] !h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
                />
              </Form.Item>
            </div>
          </div>

          {items.map((item) => (
            <div key={item} className="flex flex-col px-5 relative">
              <span className="absolute -top-[6px] left-8 z-50 bg-white px-1 text-[13px] font-normal text-[#2E263DB2] dark:bg-[#312D48] dark:text-[#A9A5BF]">
                Item {item + 1}
              </span>

              <div className="flex gap-5">
                <Form.Item className="">
                  <Select
                    value={formData.product_id}
                    onChange={(value) =>
                      handleSelectChange("product_id", value)
                    }
                    placeholder="Select item 1"
                    className="!w-[639px] !h-[48px] custom-select-dropdown-bright"
                    options={productNames}
                    dropdownClassName="dark-dropdown"
                  ></Select>
                </Form.Item>

                <Form.Item>
                  <Input
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    type="number"
                    placeholder="Quantity"
                    className="!w-[639px] !h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
                  />
                </Form.Item>
              </div>

              <X
                onClick={() => removeItem(item)}
                className="w-[14px] h-[14px] cursor-pointer text-red-500 hover:opacity-80 absolute top-[-19px] right-5"
              />
            </div>
          ))}
        </div>

        <div className="px-5 pb-5" onClick={addItem}>
          <Button className="!w-[183px] !h-[40px] !bg-[var(--color-bg-sy)] !text-[white] !font-medium !text-[15px] dark:border-none! hover:opacity-85!">
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
