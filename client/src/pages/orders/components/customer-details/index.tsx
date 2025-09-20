import { ChevronLeft, ChevronRight } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { Spin } from "antd";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";

const CustomerDetails = () => {
  const { getOrderByMarket, getMarketsByMyNewOrders } = useOrder();
  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;

  const [loading, setLoading] = useState(true);

  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const marketId = market?.id;
  const { data } =
    role === "superadmin"
      ? getOrderByMarket(marketId)
      : getMarketsByMyNewOrders();

  const myNewOrders = data?.data?.data || [];
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="w-full flex flex-col gap-5 py-5 rounded-md bg-[#ffffff] dark:bg-[#312D48] shadow-lg">
      <h1 className="px-5 font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
        Mening buyurtmalarim
      </h1>

      <Spin spinning={loading} tip={"New orders loading..."}>
        <table>
          <thead className="bg-[#F6F7FB] dark:bg-[#3D3759]">
            <tr>
              <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  ISMI
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  TELEFON RAQAMI
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  TUMANI
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  SUMMA
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  IZOH
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
            </tr>
          </thead>
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
        </table>
      </Spin>
      <div className="flex justify-end items-center pr-[105px] pt-4 gap-6">
        <div className="flex items-center">
          <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
            Rows per page:
          </span>
          <select
            className="rounded px-2 py-1 text-[15px] outline-none"
            defaultValue="10"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>

        <div className="flex items-center font-normal text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
          <span className="mr-1">1-5</span>
          <span className="mr-1">of</span>
          <span className="">13</span>
        </div>

        <div className="flex items-center gap-[23px]">
          <ChevronLeft className="w-5 h-5 cursor-pointer text-gray-600 dark:text-[#E7E3FCE5] hover:opacity-75" />
          <ChevronRight className="w-5 h-5 cursor-pointer text-gray-600 dark:text-[#E7E3FCE5] hover:opacity-75" />
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerDetails);
