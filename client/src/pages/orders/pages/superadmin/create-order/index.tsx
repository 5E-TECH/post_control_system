import { Check } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";
import { memo } from "react";
import type { RootState } from "../../../../../app/store";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import OrderItems from "../../../components/order-items";
import ProductInfo from "../../../components/product-info";
import Discard from "../../../components/button/discard";
import {
  resetOrderItems,
  setCustomerData,
  setProductInfo,
} from "../../../../../shared/lib/features/customer_and_market-id";
import { useTranslation } from "react-i18next";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";

const CreateOrder = () => {
  const { t } = useTranslation("createOrder");
  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const customer = JSON.parse(localStorage.getItem("customer") ?? "null");

  const market_id = market?.id;
  const customer_id = customer?.id;

  const orderItems = useSelector(
    (state: RootState) => state.setOrderItems.orderItems
  );
  const productInfo = useSelector(
    (state: RootState) => state.setProductInfo.productInfo
  );
  const { createOrder } = useOrder();

  const navigate = useNavigate();

  const { handleApiError, handleWarning } = useApiNotification();
  const handleClick = () => {
    if (
      !orderItems ||
      orderItems.length === 0 ||
      orderItems.some((item) => !item.quantity || item.quantity === 0)
    ) {
      handleWarning(
        t("orderForm.incompleteOrderData"),
        t("orderForm.fillAllFields")
      );
      return;
    }
    if (
      productInfo?.total_price === null ||
      productInfo?.total_price === undefined ||
      !productInfo?.where_deliver
    ) {
      handleWarning(
        t("productForm.incompleteProductData"),
        t("productForm.fillAllFields")
      );
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
        dispatch(setCustomerData(null));
        dispatch(resetOrderItems());
        dispatch(setProductInfo(null));
        navigate("/orders/customer-info");
      },
      onError: (err: any) =>
        handleApiError(
          err,
          "Buyurtma yaratishda xatolik yuz berdi"
        ),
    });
  };

  const dispatch = useDispatch();
  const handleDiscard = () => {
    dispatch(resetOrderItems());
    dispatch(setProductInfo(null));
  };

  return (
    <div className="flex gap-6 px-6 pt-6 max-[1150px]:flex-col">
      <div className="pr-[81px]">
        <div className="flex items-center gap-1">
          <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#D4D0E9]">
            {t("process")}
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
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5] capitalize">
              {market?.name}
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] whitespace-nowrap dark:text-[#AEAAC2]">
              {market?.phone_number}
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
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5] capitalize">
              {customer?.name}
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
              {customer?.phone_number.split(" ")}
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
              {t("step.three.title")}
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
              {t("step.three.description")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full">
        <OrderItems />

        <ProductInfo />

        <div className="flex justify-end">
          <div className="flex gap-4">
            <Discard handleDiscard={handleDiscard} type="button">
              {t("discard")}
            </Discard>
            <Button
              onClick={handleClick}
              disabled={createOrder.isPending}
              loading={createOrder.isPending}
              htmlType="submit"
              className="w-[130px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! 
           hover:opacity-85! hover:outline-none! dark:border-none!"
            >
              {t("createOrder")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CreateOrder);
