import { memo, useEffect } from "react";
import Filter from "../../../components/filter";
import OrderView from "../../../components/order-view";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { togglePermission } from "../../../../../shared/lib/features/add-order-permission";
import { useTranslation } from "react-i18next";

const OrderList = () => {
  const { t } = useTranslation("orderList");
  const permission = useSelector(
    (state: RootState) => state.togglePermission.value
  );

  const dispatch = useDispatch();
  useEffect(() => {
    return () => {
      dispatch(togglePermission(false));
    };
  }, [dispatch]);

  useEffect(() => {
    return () => {
      localStorage.removeItem("market");
      localStorage.removeItem("customer");
    };
  }, []);

  return !permission ? (
    <div className="dark:bg-[#29253e]">
      <h2 className="text-[25px] pb-2 pt-2 bg-[#ffffff] font-bold dark:bg-[var(--color-dark-bg-py)]">
        {t("title")}
      </h2>
      <div className="bg-white pb-5 rounded-md dark:bg-[#312d4b]">
        <Filter />
      </div>
      <OrderView />
    </div>
  ) : (
    <div className="flex justify-center items-center h-[65vh]">
      <div className="text-red-500 text-lg font-semibold mt-5 text-[25px]">
        {t("noPermission")}
      </div>
    </div>
  );
};

export default memo(OrderList);
