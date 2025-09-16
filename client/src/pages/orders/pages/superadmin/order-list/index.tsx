import { memo, useEffect } from "react";
import Filter from "../../../components/filter";
import OrderView from "../../../components/order-view";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { togglePermission } from "../../../../../shared/lib/features/add-order-permission";

const OrderList = () => {
  const permission = useSelector(
    (state: RootState) => state.togglePermission.value
  );

  const dispatch = useDispatch();
  useEffect(() => {
    return () => {
      dispatch(togglePermission(false));
    };
  }, [dispatch]);

  return !permission ? (
    <div className="dark:bg-[#29253e]">
      <h2 className="text-[25px] pb-5">Order List</h2>
      <div className="bg-white p-5 rounded-md dark:bg-[#312d4b]">
        <Filter />
      </div>
      <OrderView />
    </div>
  ) : (
    <div className="flex justify-center items-center h-[65vh]">
      <div className="text-red-500 text-lg font-semibold mt-5 text-[25px]">
        Ruxsat yo‘q 🚫
      </div>
    </div>
  );
};

export default memo(OrderList);
