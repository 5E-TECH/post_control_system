import { memo } from "react";
import { OrderData } from "../../../../shared/static/order";

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  received: "bg-green-500",
  on_the_road: "bg-yellow-500",
  waiting: "bg-orange-500",
  sold: "bg-purple-500",
  cancelled: "bg-red-500",
  paid: "bg-cyan-500",
  partly_paid: "bg-pink-500",
  cancelled_sent: "bg-gray-500",
  closed: "bg-black",
};

const OrderView = () => {
  return (
    <div className="w-full bg-white py-5">
      <table className="w-full">
        <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center">
          <th>
            <div className="flex items-center gap-10 ml-10">
              <span>#</span>
              {/* <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div> */}
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
        </thead>
        <tbody>
          {OrderData?.map((item: any) => (
            <tr className="h-[56px]">
              <td className="pl-10">{item.id}</td>
              <td className="pl-10 text-[#2E263DE5] text-[15px]">
                {item.customer}
              </td>
              <td className="pl-10 text-[#2E263DB2] text-[15px]">
                {item.phone}
              </td>
              <td className="pl-10 text-[#2E263DE5] text-[15px]">
                {item.address}
              </td>
              <td className="pl-10 text-[#2E263DB2] text-[15px]">
                {item.market}
              </td>
              <td className="pl-10">
                <span
                  className={`py-2 px-3 rounded-2xl text-[13px] text-white ${
                    statusColors[item.status] || "bg-slate-400"
                  }`}
                >
                  {item.status.toUpperCase()}
                </span>
              </td>
              <td className="pl-10 text-[#2E263DB2] text-[15px]">
                {item.price}
              </td>
              <td className="pl-10 text-[#2E263DB2] text-[15px]">
                {item.stock}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default memo(OrderView);
