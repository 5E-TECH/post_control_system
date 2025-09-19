import { Check } from "lucide-react";

import { useDispatch, useSelector } from "react-redux";
import { Button } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import useNotification from "antd/es/notification/useNotification";
import { createContext, memo, useMemo } from "react";
import type { RootState } from "../../../../../app/store";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import OrderItems from "../../../components/order-items";
import ProductInfo from "../../../components/product-info";
import Discard from "../../../components/button/discard";
import {
  resetOrderItems,
  setProductInfo,
} from "../../../../../shared/lib/features/customer_and_market-id";

const Context = createContext({ name: "Default" });

const CreateOrder = () => {
  const market_id = localStorage.getItem("marketId") || "";
  const customer_id = localStorage.getItem("customerId") || "";

  const orderItems = useSelector(
    (state: RootState) => state.setOrderItems.orderItems
  );
  const productInfo = useSelector(
    (state: RootState) => state.setProductInfo.productInfo
  );
  const { createOrder } = useOrder();

  const navigate = useNavigate();

  const [api, contextHolder] = useNotification();
  const handleClick = () => {
    if (!orderItems || orderItems.length == 0) {
      api.warning({
        message: "Buyurtma malumotlari to'liq emas",
        description: "Iltimos buyurtmaning barcha maydonlarini kiriting",
        placement: "topRight",
      });
      return;
    }

    if (!productInfo?.total_price || !productInfo?.where_deliver) {
      api.warning({
        message: "Mahsulot malumotlari to'liq emas",
        description: "Iltimos mahsulotning barcha maydonlarini kiriting",
        placement: "topRight",
      });
      return;
    }

    const newOrder = {
      market_id,
      customer_id,
      order_item_info: orderItems,
      total_price: productInfo?.total_price,
      where_deliver: productInfo?.where_deliver,
      comment: productInfo?.comment,
    };
    createOrder.mutate(newOrder, {
      onSuccess: () => {
        localStorage.removeItem("customerId");
        navigate("/orders/customer-info");
      },
    });
  };

  const dispatch = useDispatch();
  const handleDiscard = () => {
    dispatch(resetOrderItems());
    dispatch(setProductInfo(null));
  };

  const { state } = useLocation();
  const customerData = state?.customerData;
  console.log(customerData);
  const contextValue = useMemo(() => ({ name: "Ant Design" }), []);

  return (
    <Context.Provider value={contextValue}>
      {contextHolder}
      <div className="flex gap-6 p-5">
        <div className="pr-[81px]">
          <div className="flex items-center gap-1">
            <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#D4D0E9]">
              Process
            </h1>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className="flex w-fit rounded-full p-[4px] bg-[var(--color-bg-sy)]">
              <Check className="w-[10px] h-[10px] text-white" />
            </div>

            <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
              01
            </span>

            <div className="flex flex-col">
              <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
                Market details
              </span>
              <span className="font-normal text-[#2E263DB2] text-[13px] whitespace-nowrap dark:text-[#AEAAC2]">
                Enter your Market Details
              </span>
            </div>
          </div>

          <div className="w-[3px] h-[40px] rounded-[20px] bg-[var(--color-bg-sy)] ml-[7px] mt-[8px]"></div>

          <div className="flex items-center gap-2 mt-2">
            <div className="flex w-fit rounded-full p-[4px] bg-[var(--color-bg-sy)]">
              <Check className="w-[10px] h-[10px] text-white" />
            </div>

            <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
              02
            </span>

            <div className="flex flex-col">
              <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
                Customer Info
              </span>
              <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
                Setup information{" "}
              </span>
            </div>
          </div>

          <div className="w-[3px] h-[40px] rounded-[20px] bg-[var(--color-bg-sy)] ml-[7px] mt-[8px]"></div>

          <div className="flex items-center gap-2 mt-2">
            <div className="flex w-[18px] h-[18px] rounded-full p-[3px] border-4 border-[var(--color-bg-sy)]"></div>

            <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
              03
            </span>

            <div className="flex flex-col">
              <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
                Order details
              </span>
              <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
                Add order details
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <OrderItems />
          </div>

          <div>
            <ProductInfo />
          </div>

          <div className="flex justify-end">
            <div className="flex gap-4">
              <Discard handleDiscard={handleDiscard} type="button">
                Discard
              </Discard>
              <Button
                onClick={handleClick}
                disabled={createOrder.isPending}
                loading={createOrder.isPending}
                htmlType="submit"
                className="w-[130px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! 
           hover:opacity-85! hover:outline-none! dark:border-none!"
              >
                Create order
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Context.Provider>
  );
};

export default memo(CreateOrder);
