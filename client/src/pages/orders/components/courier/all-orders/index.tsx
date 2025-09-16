import { memo } from "react";
// import OrderTableComp from ".."
import { useOrder } from "../../../../../shared/api/hooks/useOrder";

const AllOrders = () => {
  const {} = useOrder()


  return (
    <div>AllOrders</div>
    // <OrderTableComp data={}/>
  );
};

export default memo(AllOrders);
