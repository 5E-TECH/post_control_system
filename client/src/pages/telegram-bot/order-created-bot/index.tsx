import { memo } from "react";
import CustomerInfo from "../../orders/components/customer-info";
import OrderItems from "../../orders/components/order-items";
import ProductInfo from "../../orders/components/product-info";


const CreateOrderBot = () => {
  
  return (
    <div className="bg-white">
      <h2 className="text-center text-[25px] font-bold">
        Create Order
      </h2>
      <div className="flex flex-col gap-4.5 w-full">
        <CustomerInfo />
      </div>
      <div className="flex flex-col w-full">
        <OrderItems />
        <ProductInfo />
      </div>
    </div>
  );
};

export default memo(CreateOrderBot);
