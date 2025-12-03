import { memo } from "react";
import { Button } from "antd";
import CustomerInfo from "../../orders/components/customer-info";
import OrderItems from "../../orders/components/order-items";
import ProductInfo from "../../orders/components/product-info";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../app/store";
import { useOrder } from "../../../shared/api/hooks/useOrder";
import {
  resetOrderItems,
  setCustomerData,
  setProductInfo,
} from "../../../shared/lib/features/customer_and_market-id";
import { useApiNotification } from "../../../shared/hooks/useApiNotification";

const CreateOrderBot = () => {
  const { createOrderBot } = useOrder();
  const customerData = useSelector(
    (state: RootState) => state.setCustomerData.customerData
  );
  const orderItems = useSelector(
    (state: RootState) => state.setCustomerData.orderItems
  );
  const productInfo = useSelector(
    (state: RootState) => state.setCustomerData.productInfo
  );
  const dispatch = useDispatch();
  const { handleSuccess } = useApiNotification();

  const handleShowData = () => {
    const data = {
      name: customerData?.name,
      phone_number: customerData?.phone_number,
      district_id: customerData?.district_id,
      extra_number: customerData?.extra_number,
      address: customerData?.address,

      order_item_info: (orderItems || []).map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
      total_price: productInfo?.total_price,
      where_deliver: productInfo?.where_deliver,
      comment: productInfo?.comment,
      operator: productInfo?.operator,
    };

    createOrderBot.mutate(data, {
      onSuccess: () => {
        handleSuccess("Buyurtma muvaffaqiyatli qo'shildi");
        dispatch(setCustomerData(null));
        dispatch(resetOrderItems());
        dispatch(setProductInfo(null));
      },
    });
  };

  return (
    <div className="bg-white">
      <div className="flex flex-col gap-4.5 w-full">
        <h2 className="text-center text-[25px] font-bold">Create Order</h2>
        <CustomerInfo />
      </div>

      <div className="flex flex-col w-full">
        <OrderItems />
        <ProductInfo />
      </div>

      <div className="mt-5 text-center mb-5">
        <Button
          onClick={handleShowData}
          className="!w-[200px] !h-[45px] !text-[16px] !font-bold !text-white !bg-[#9069fe]"
        >
          Create Order
        </Button>
      </div>
    </div>
  );
};

export default memo(CreateOrderBot);
