import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import React from "react";
import { useOrder } from "../../shared/api/hooks/useOrder";
import { Button } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const Orders = () => {
  const { getOrders } = useOrder();
  const { data } = getOrders();
  const orders = data?.data;

  const navigate = useNavigate();

  const { pathname } = useLocation();

  if (pathname.startsWith("/orders/")) {
    return <Outlet />;
  }
  return (
    <div className="p-7 pt-[21px]">
      <div className="rounded-md shadow-lg bg-[#ffffff]">
        <div className="flex items-center justify-between px-5 pt-[25px]">
          <h1 className="font-medium text-[18px] text-[#2E263DE5]">
            Orders list
          </h1>
          <Button
            onClick={() => navigate("/orders/customer-info")}
            className="bg-[#8C57FF]! text-[#ffffff]! w-[131px]! h-[38px]! hover:opacity-85"
          >
            Add Order <ArrowRight className="w-[15px] h-[15px]" />
          </Button>
        </div>
        <table className="overflow-hidden rounded-md mt-5">
          <thead className="bg-[#F6F7FB] dark:bg-[#3D3759]">
            <tr>
              <th className="w-[265px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  #
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[265px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  CUSTOMER
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[265px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  NUMBER
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[265px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  STATUS
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[265px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  PRICE
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[265px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  ITEMS
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((order: any) => (
              <tr key={order?.id}>
                <td className="p-[20px] flex items-center">#{order?.id}</td>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                        {order?.name}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
                    {order?.phone_number}
                  </span>
                </td>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <div className="flex items-center">
                    <span className="font-normal text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                      {order?.role?.charAt(0).toUpperCase() +
                        order?.role?.slice(1)}
                    </span>
                  </div>
                </td>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                    {order?.status}
                  </span>
                </td>
                <td className="flex items-center text-[#2E263DB2] dark:text-[#B1ADC7]">
                  {order?.total_price}
                </td>
                <td className="flex items-center text-[#2E263DB2] dark:text-[#B1ADC7]">
                  {order?.product_quantity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end items-center pr-[105px] pt-4 gap-6 pb-[16px]">
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
    </div>
  );
};

export default React.memo(Orders);
