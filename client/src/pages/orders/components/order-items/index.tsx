import { Button, Form, Input, Select } from "antd";
import { Plus, X } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useProduct } from "../../../../shared/api/hooks/useProduct";
import { useDispatch, useSelector } from "react-redux";
import { setOrderItems } from "../../../../shared/lib/features/customer_and_market-id";
import type { RootState } from "../../../../app/store";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import { useTranslation } from "react-i18next";

export interface IOrderItems {
  product_id: string | undefined;
  quantity: number | string;
  search?: string;
}

const createInitialState = (): IOrderItems => ({
  product_id: undefined,
  quantity: "",
  search: "",
});

const OrderItems = () => {
  const { t } = useTranslation("createOrder");
  const [formDataList, setFormDataList] = useState<IOrderItems[]>([
    createInitialState(),
  ]);

  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const marketId = market?.id;
  const { getProductsByMarket, getProducts } = useProduct();
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

  const debouncedSearch = useMemo(
    () =>
      debounce((callback: (val: string) => void, value: string) => {
        callback(value);
      }, 500),
    []
  );

  const { data: products } = getProducts({
    search: formDataList.find((item) => item.search)?.search,
    marketId,
  });
  const allProducts = products?.data?.items;
  const searchedProducts = allProducts?.map((product: any) => ({
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

  const handleChange = (index: number, name: string, value: string) => {
    const updatedList = [...formDataList];
    updatedList[index] = { ...updatedList[index], [name]: value };
    setFormDataList(updatedList);
    dispatch(
      setOrderItems(
        updatedList.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
        }))
      )
    );
  };

  const handleSelectChange = (
    index: number,
    name: keyof IOrderItems,
    value: string
  ) => {
    const updatedList = [...formDataList];
    updatedList[index] = { ...updatedList[index], [name]: value, search: "" };
    setFormDataList(updatedList);
    dispatch(
      setOrderItems(
        updatedList.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
        }))
      )
    );
  };

  const addItem = () => {
    setFormDataList((prev) => [...prev, createInitialState()]);
  };

  const removeItem = (index: number) => {
    const updatedList = formDataList.filter((_, i) => i !== index);
    setFormDataList(updatedList);
    dispatch(
      setOrderItems(
        updatedList.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
        }))
      )
    );
  };

  const orderItems = useSelector(
    (state: RootState) => state.setCustomerData.orderItems
  );

  useEffect(() => {
    if (orderItems && orderItems.length > 0) {
      setFormDataList(orderItems);
    }
  }, []);

  return (
    <div className="bg-[#ffffff] dark:bg-[#312D48] rounded-md shadow-lg">
      <div>
        <div className="px-5 pt-5 pb-3">
          <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#CBC7E1]">
            {t("orderItems.title")}
          </h1>
        </div>

        <div className="scroll-order-items">
          {formDataList.map((formData, index) => (
            <div key={index} className="flex flex-col px-5 relative mt-3">
              <span className="absolute -top-[9px] left-8 z-50 bg-white px-1 text-[13px] font-normal text-[#2E263DB2] dark:bg-[#312D48] dark:text-[#A9A5BF]">
                {t("orderItems.item")} {index + 1}
              </span>

              <div className="flex gap-5">
                <Form.Item className="w-1/2">
                  <Select
                    value={formData.product_id ?? undefined}
                    onSearch={(value) =>
                      debouncedSearch((searchValue: string) => {
                        const updatedList = [...formDataList];
                        updatedList[index] = {
                          ...updatedList[index],
                          search: searchValue,
                        };
                        setFormDataList(updatedList);
                      }, value)
                    }
                    onChange={(value) =>
                      handleSelectChange(index, "product_id", value)
                    }
                    placeholder={t("orderItems.selectProduct")}
                    className="!h-[48px] custom-select-dropdown-bright"
                    options={formData.search ? searchedProducts : productNames}
                    dropdownClassName="dark-dropdown"
                    showSearch
                    filterOption={false}

                  />
                </Form.Item>

                <Form.Item className="w-1/2">
                  <Input
                    name="quantity"
                    value={formData.quantity}
                    onChange={(e) => {
                      let value = Number(e.target.value);
                      if (value >= 99) value = 99;
                      if (value < 0) value = 0;
                      handleChange(index, "quantity", value.toString());
                    }}
                    type="number"
                    placeholder={t("orderItems.quantity")}
                    className=" !h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
                  />
                </Form.Item>
              </div>

              {index > 0 && (
                <X
                  onClick={() => removeItem(index)}
                  className="w-[14px] h-[14px] cursor-pointer text-red-500 hover:opacity-80 absolute top-[-19px] right-5"
                />
              )}
            </div>
          ))}
        </div>

        <div className="px-5 pb-5" >
          <Button onClick={addItem} className="!w-[183px] !h-[40px] !bg-[var(--color-bg-sy)] !text-[white] !font-medium !text-[15px] dark:border-none! hover:opacity-85!">
            <Plus className="w-[17px] h-[17px]" />
            {t("orderItems.addAnotherItem")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderItems);
