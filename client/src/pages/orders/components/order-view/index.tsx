import { memo } from "react";
import { OrderData } from "../../../../shared/static/order";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const navigate = useNavigate();
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
            <tr
              key={item.id}
              className="h-[56px] hover:bg-[#f6f7fb]"
              onClick={() => navigate("/orders/order-detail")}
            >
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
  );
};

export default memo(OrderView);
