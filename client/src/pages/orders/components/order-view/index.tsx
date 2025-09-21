import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import type { RootState } from "../../../../app/store";
import { useSelector } from "react-redux";
import TableSkeleton from "../ordersTabelSkeleton/ordersTableSkeleton";
import { Pagination, type PaginationProps } from "antd";
import { useParamsHook } from "../../../../shared/hooks/useParams";

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

  const { getOrders, getMarketsByMyNewOrders } = useOrder();
  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;
  let query;

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);

  switch (role) {
    case "superadmin":
      query = getOrders({ page, limit });
      break;
    case "market":
      query = getMarketsByMyNewOrders({ page, limit });
      break;
    default:
      query = { data: { data: [] } };
  }

  const { data, isLoading } = query;
  const myNewOrders = Array.isArray(data?.data?.data) ? data?.data?.data : [];

  const total = data?.data?.total || 0;

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
    <div className="w-full bg-white py-1 dark:bg-[#312d4b]">
      <table className="w-full">
        <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
          <tr>
            <th>
              <div className="flex items-center ml-10">
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
        {isLoading ? (
          <TableSkeleton rows={10} columns={8} />
        ) : (
          <tbody>
            {myNewOrders?.map((item: any, inx: number) => (
              <tr
                key={item.id}
                className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759] cursor-pointer"
                onClick={() => navigate(`order-detail/${item.id}`)}
              >
                <td className="pl-10">{inx + 1}</td>
                <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#d5d1eb]">
                  {item?.customer?.name}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                  {item?.customer?.phone_number}
                </td>
                <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#d5d1eb]">
                  {item?.customer?.phone_number}
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
                  <span>
                    {new Intl.NumberFormat("uz-UZ").format(item?.total_price)}{" "}
                  </span>
                </td>
                <td className="pl-15 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                  {item?.items.length}
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
      <div className="flex justify-center mt-3">
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

export default memo(OrderView);
