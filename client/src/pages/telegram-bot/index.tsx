import { memo } from "react";
import OrderItems from "../orders/components/order-items";
import ProductInfo from "../orders/components/product-info";
import CustomerInfo from "../orders/components/customer-info";

export interface ICustomer {
  phone_number: string;
  extra_number?: string;
  region_id?: string | null;
  district_id?: string | null;
  name: string;
  address?: string;
}

export const initialState: ICustomer = {
  phone_number: "+998 ",
  extra_number: "",
  region_id: null,
  district_id: null,
  name: "",
  address: "",
};

const TelegramBot = () => {
  return (
    <div className="bg-white">
      <h2 className="text-center text-[25px] font-bold">Create Order</h2>
       <div className="flex flex-col gap-4.5 w-full">
              <CustomerInfo />
            </div>
      <div className="flex flex-col  w-full">
        <OrderItems />

        <ProductInfo />

        <div className="flex justify-end">
          <div className="flex gap-4">
            {/* <Discard handleDiscard={handleDiscard} type="button">
              {t("discard")}
            </Discard> */}
            {/* <Button
              onClick={handleClick}
              disabled={createOrder.isPending}
              loading={createOrder.isPending}
              htmlType="submit"
              className="w-[130px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! 
           hover:opacity-85! hover:outline-none! dark:border-none!"
            >
              {t("createOrder")}
            </Button> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(TelegramBot);
