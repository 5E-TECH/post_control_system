import { memo, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Search from "./components/search";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";
import EmptyPage from "../../shared/components/empty-page";

const TodayOrders = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const role = useSelector((state: RootState) => state.roleSlice);

  useEffect(() => {
    if (role.role === "market") {
      navigate("order-view", { state: { market: role.id } });
    }
  }, [role]);

  const handleProps = (id: string) => {
    navigate("order-view", { state: { market: id } });
  };

  const { getMarketsNewOrder } = useMarket();
  const { data, refetch, isLoading } = getMarketsNewOrder();
  refetch()

  if (pathname.startsWith("/order/markets/new-orders/")) {
    return <Outlet />;
  }

  const markets = data?.data?.markets || [];

  return (
    <section className="flex justify-center bg-white flex-col m-5 rounded-md dark:bg-[#312d4b]">

     {!isLoading && markets.length > 0 && <Search />}
      {isLoading ? (
        <div className="flex justify-center items-center h-[200px]">
          <p className="text-gray-500 dark:text-gray-300">Loading...</p>
        </div>
      ) : markets.length > 0 ? (
        <div className="w-full">
          <table className="w-full cursor-pointer">
            <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:text-[#E7E3FCE5] dark:bg-[#3d3759]">
              <tr>
                <th>
                  <div className="flex items-center gap-10 ml-10 mr-5">
                    <span>#</span>
                  </div>
                </th>
                <th className="pr-[120px]">
                  <div className="flex items-center gap-10">
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    <span>MARKET</span>
                  </div>
                </th>
                <th className="pr-[120px]">
                  <div className="flex items-center gap-10">
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    <span>PHONE</span>
                  </div>
                </th>
                <th className="pr-[100px]">
                  <div className="flex items-center gap-10">
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    <span>TOTAL PRICE</span>
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
            <tbody className="[&>tr]:odd:bg-white  [&>tr]:odd:dark:bg-[#312d4b] [&>tr]:even:bg-[#f6f7fb6c] [&>tr]:even:dark:bg-[#3d375957] [&>tr:hover]:bg-[#f6f7fb] [&>tr:hover]:dark:bg-[#3d3759]">
              {markets.map((item: any, inx: number) => (
                <tr
                  key={item?.id}
                  className="h-[56px]"
                  onClick={() => handleProps(item?.id)}
                >
                  <td className="pl-10">{inx + 1}</td>
                  <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.name}
                  </td>
                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.phone_number}
                  </td>
                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.totalPrice}
                  </td>
                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyPage/>
      )}
    </section>
  );
};

export default memo(TodayOrders);
