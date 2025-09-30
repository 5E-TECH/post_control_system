import { Button } from "antd";
import { AlertCircle } from "lucide-react";
import { memo, type FC } from "react";

interface Props {
  data: any[];
}

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

const OrderTableComp: FC<Props> = ({ data }) => {
  return (
    <div>
      <table className="w-full">
        <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
          <tr>
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
            <th>
              <div className="flex items-center justify-center gap-30">
                <span>ACTIONS</span>
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {data?.map((item: any, inx: number) => (
            <tr
              key={item?.id}
              className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759] cursor-pointer"
            >
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
                  className={`py-2 px-3 rounded-2xl text-[13px] text-white ${
                    statusColors[item.status] || "bg-slate-400"
                  }`}
                >
                  {item.status.toUpperCase()}
                </span>
              </td>
              <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                {new Intl.NumberFormat("uz-UZ").format(item?.total_price)}
              </td>
              <td className="pl-15 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                {item?.items.length}
              </td>
              <td className="text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                {item?.status === "sold" || item?.status === "cancelled" ? (
                  <Button>
                    <AlertCircle />
                  </Button>
                ) : (
                  <div className="flex gap-3">
                    <Button className="bg-[var(--color-bg-sy)]! text-[#ffffff]! border-none! hover:opacity-80">
                      Sotish
                    </Button>
                    <Button className="bg-red-500! text-[#ffffff]! border-none! hover:opacity-80">
                      Bekor qilish
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default memo(OrderTableComp);
