import { memo, useState } from "react";
import { Button } from "antd";
import CustomerInfo from "../../orders/components/customer-info";
import OrderItems from "../../orders/components/order-items";
import ProductInfo from "../../orders/components/product-info";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/store";

const CreateOrderBot = () => {
  const customerData = useSelector(
    (state: RootState) => state.setCustomerData.customerData
  );
  const orderItems = useSelector(
    (state: RootState) => state.setCustomerData.orderItems
  );
  const productInfo = useSelector(
    (state: RootState) => state.setCustomerData.productInfo
  );

  const [showData, setShowData] = useState(false);

  const handleShowData = () => {
    setShowData(true);
  };

  return (
    <div className="bg-white p-5">
      <h2 className="text-center text-[25px] font-bold mb-5">
        Create Order
      </h2>

      <div className="flex flex-col gap-4.5 w-full">
        <CustomerInfo />
      </div>

      <div className="flex flex-col w-full gap-4.5 mt-5">
        <OrderItems />
        <ProductInfo />
      </div>

      <div className="mt-5 text-center">
        <Button
          type="primary"
          onClick={handleShowData}
          className="!w-[200px] !h-[45px] !text-[16px] font-medium"
        >
          Show Data
        </Button>
      </div>

      {/* 🔹 UI qismida ma’lumotlarni chiqarish */}
      {showData && (
        <div className="mt-5 p-4 border rounded-md bg-gray-50 dark:bg-[#3b334e] dark:text-white">
          <h3 className="font-medium text-lg mb-2">Customer Info</h3>
          <pre>{JSON.stringify(customerData, null, 2)}</pre>

          <h3 className="font-medium text-lg mt-4 mb-2">Order Items</h3>
          <pre>{JSON.stringify(orderItems, null, 2)}</pre>

          <h3 className="font-medium text-lg mt-4 mb-2">Product Info</h3>
          <pre>{JSON.stringify(productInfo, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default memo(CreateOrderBot);
