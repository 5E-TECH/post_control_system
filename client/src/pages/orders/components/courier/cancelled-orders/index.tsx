import { ChevronLeft, ChevronRight } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import { Button } from "antd";

const CancelledOrders = () => {
  const { getCourierOrders } = useOrder();
  const { data } = getCourierOrders();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (data?.data) {
      setSelectedIds(data.data.map((item: any) => item.id));
    }
  }, [data]);
  return (
    <div>
      <table className="w-full">
        <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
          <tr>
            <th className="p-[20px] flex items-center">
              <input
                type="checkbox"
                className="w-[18px] h-[18px] rounded-sm"
                checked={
                  !!data?.data && selectedIds.length === data?.data?.length
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(data?.data.map((item: any) => item.id));
                  } else {
                    setSelectedIds([]);
                  }
                }}
              />
            </th>
            <th>
              <div className="flex items-center gap-10 ml-10">
                <span>#</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>CUSTOMER</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>PHONE</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>ADDRESS</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>MARKET</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>STATUS</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>PRICE</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>STOCK</span>
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.map((item: any, inx: number) => (
            <tr
              key={item?.id}
              className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759] cursor-pointer"
            >
              <td className="p-[20px] flex items-center">
                {" "}
                <input
                  type="checkbox"
                  className="w-[18px] h-[18px] rounded-sm"
                  checked={item?.id ? selectedIds.includes(item?.id) : false}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds([...selectedIds, item?.id]);
                    } else {
                      setSelectedIds(
                        selectedIds.filter((id) => id !== item?.id)
                      );
                    }
                  }}
                />
              </td>
              <td className="pl-10">{inx + 1}</td>
              <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#d5d1eb]">
                {item?.customer?.name}
              </td>
              <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                {item?.customer?.phone_number}
              </td>
              <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#d5d1eb]">
                {item?.customer?.district?.name}
              </td>
              <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                {item?.market?.name}
              </td>
              <td className="pl-10">
                <span
                  className={`py-2 px-3 rounded-2xl text-[13px] text-white bg-orange-500`}
                >
                  {item.status.toUpperCase()}
                </span>
              </td>
              <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                {new Intl.NumberFormat("uz-UZ").format(item?.total_price)}
              </td>
              <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                {item?.items.length}
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

      <div className="flex justify-end px-5">
        <Button className="w-[180px]! h-[37px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! text-[15px]! border-none! hover:opacity-85!">
          Buyurtmalarni yuborish
        </Button>
      </div>
    </div>
  );
};

export default memo(CancelledOrders);
