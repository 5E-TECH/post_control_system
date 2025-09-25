import { Form, Input, Select } from "antd";
import { memo, useEffect, useState, type ChangeEvent } from "react";
import { setProductInfo } from "../../../../shared/lib/features/customer_and_market-id";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import { useTranslation } from "react-i18next";

export interface IProductInfo {
  total_price: number | string;
  where_deliver: string;
  comment?: string;
}

const initialState: IProductInfo = {
  total_price: "",
  where_deliver: "center",
  comment: "",
};

const ProductInfo = () => {
  const { t } = useTranslation("createOrder");
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
  const productInfo = useSelector(
    (state: RootState) => state.setCustomerData.productInfo
  );

  useEffect(() => {
    const cleanedPrice = Number(
      String(formData.total_price).split(",").join("")
    );
    const data = {
      ...formData,
      total_price: Number(cleanedPrice) || 0,
    };
    dispatch(setProductInfo(data));
  }, [formData, dispatch]);

  useEffect(() => {
    if (productInfo === null) {
      setFormData(initialState);
    }
  }, [productInfo]);

  return (
    <div className="bg-[#ffffff] shadow-lg rounded-md dark:bg-[#312D48] ">
      <div className="">
        <div className="px-5 pt-6 pb-3">
          <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#CBC7E1]">
            {t("productInfo.title")}
          </h1>
        </div>

        <div className="flex gap-5 px-5">
          <div className="flex flex-col w-1/2">
            <span className="font-normal text-[14px] text-[#2E263DB2] dark:text-[#B1ADC7]">
              {t("productInfo.totalPrice")}
            </span>
            <Form.Item className="!mt-1">
              <Input
                name="total_price"
                value={formData.total_price}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, "");
                  const formatted = new Intl.NumberFormat("uz-UZ").format(
                    Number(rawValue || 0)
                  );

                  handleChange({
                    ...e,
                    target: {
                      ...e.target,
                      name: "total_price",
                      value: formatted,
                    },
                  } as any);
                }}
                type="text"
                placeholder={t("productInfo.totalPricePlaceholder")}
                className="!h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! 
         dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
              />
            </Form.Item>
          </div>

          <div className="flex flex-col w-1/2">
            <span className="font-normal text-[14px] text-[#2E263DB2] dark:text-[#B1ADC7]">
              {t("productInfo.whereDeliver")}
            </span>
            <Form.Item className="!mt-1">
              <Select
                value={formData.where_deliver}
                onChange={(value) => handleSelectChange("where_deliver", value)}
                placeholder={t("productInfo.whereDeliverPlaceholder")}
                className="!h-[48px] custom-select-dropdown-bright"
                defaultValue={"center"}
                dropdownClassName="dark-dropdown"
              >
                <Select.Option value="center">{t("productInfo.whereDeliverCenter")}</Select.Option>
                <Select.Option value="address">{t("productInfo.whereDeliverAddress")}</Select.Option>
              </Select>
            </Form.Item>
          </div>
        </div>

        <div className="px-5 pb-1.5">
          <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
            {t("productInfo.comment")}
          </span>
          <Form.Item className="!mt-1">
            <Input.TextArea
              name="comment"
              value={formData.comment}
              onChange={handleChange}
              className="!pb-[150px] !pt-3 !pl-4 dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#A9A5C0]! dark:text-[#E7E3FC66]!"
              placeholder={t("productInfo.commentPlaceholder")}
            />
          </Form.Item>
        </div>
      </div>
    </div>
  );
};

export default memo(ProductInfo);
