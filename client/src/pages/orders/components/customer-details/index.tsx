import { memo } from "react";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { Pagination, type PaginationProps } from "antd";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import { useParamsHook } from "../../../../shared/hooks/useParams";
import TableSkeleton from "../ordersTabelSkeleton/ordersTableSkeleton";
import { useTranslation } from "react-i18next";

const CustomerDetails = () => {
  const { t } = useTranslation("createOrder");
  const { getOrderByMarket, getMarketsByMyNewOrders } = useOrder();
  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;

  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const marketId = market?.id;

  // URL’dan page olish
  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);
  const { data, isLoading } =
    role === "superadmin"
      ? getOrderByMarket(marketId, { page, limit })
      : getMarketsByMyNewOrders({ page, limit });

  const myNewOrders = data?.data?.data || [];
  const total = data?.data?.total || 0;

  // Pagination onChange
  const onChange: PaginationProps["onChange"] = (newPage, limit) => {
    if (newPage === 1) {
      removeParam("page");
    } else {
      setParam("page", newPage);
    }

    if (limit === 10) {
      removeParam("limit");
    } else {
      setParam("limit", limit);
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 py-5 rounded-md bg-[#ffffff] dark:bg-[#312D48] shadow-lg">
      <h1 className="px-5 font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
        {t("customerDetails.title")}
      </h1>

      <table>
        <thead className="bg-[#F6F7FB] dark:bg-[#3D3759]">
          <tr>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("customerDetails.table.customerName")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("customerDetails.table.phoneNumber")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("customerDetails.table.district")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("customerDetails.table.total")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("customerDetails.table.comment")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
          </tr>
        </thead>
        {isLoading ? (
          <TableSkeleton rows={10} columns={5} />
        ) : (
          <tbody>
            {myNewOrders?.map((order: any) => (
              <tr key={order?.id}>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                      {order?.customer?.name}
                    </span>
                  </div>
                </td>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
                    {order?.customer?.phone_number}
                  </span>
                </td>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <span className="font-normal text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                    {order?.customer?.district?.name}
                  </span>
                </td>

                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <span className="font-normal text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                    {new Intl.NumberFormat("uz-UZ").format(order?.total_price)}{" "}
                    uzs
                  </span>
                </td>

                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <span className="font-normal text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                    {order?.comment ? order?.comment : "Izoh mavjud emas"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>

      <div className="flex justify-center">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default memo(CustomerDetails);
