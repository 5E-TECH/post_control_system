import { memo, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Search from "./components/search";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import EmptyPage from "../../shared/components/empty-page";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";
import { useTranslation } from "react-i18next";

const TodayOrders = () => {
  const { t } = useTranslation("todayOrderList");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const role = useSelector((state: RootState) => state.roleSlice);

  useEffect(() => {
    if (role.role === "market") {
      navigate(`${role.id}`);
    }
  }, []);

  const handleProps = (id: string) => {
    navigate(`${id}`);
  };

  const { getMarketsNewOrder } = useMarket();
  const { data, refetch, isLoading } = getMarketsNewOrder(false);

  useEffect(() => {
    if (role.role !== "market" && pathname === "/order/markets/new-orders") {
      refetch();
    }
  }, [pathname]);

  if (pathname.startsWith("/order/markets/new-orders/")) {
    return <Outlet />;
  }

  const markets = data?.data || [];

  return (
    <section className="flex items-center justify-center bg-white flex-col m-5 rounded-md dark:bg-[#312d4b]">
      {!isLoading && markets?.length > 0 && <Search />}
      {isLoading ? (
        <div className="flex justify-center items-center h-[200px]">
          <p className="text-gray-500 dark:text-gray-300">Loading...</p>
        </div>
      ) : markets.length > 0 ? (
        <div className="w-full">
          <table className=" w-full  border-gray-200 shadow-sm ">
            <thead className="bg-[#9d70ff] min-[900px]:h-[56px] text-[16px] text-white text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
              <tr>
                <th>
                  <div className="flex items-center gap-10 ml-10 mr-5">
                    <span>#</span>
                  </div>
                </th>
                <th className="pr-[120px]">
                  <div className="flex items-center gap-10">
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    <span>{t("market")}</span>
                  </div>
                </th>
                <th className="pr-[120px]">
                  <div className="flex items-center gap-10">
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    <span>{t("phone")}</span>
                  </div>
                </th>
                <th className="pr-[100px]">
                  <div className="flex items-center gap-10">
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    <span>{t("totalPrice")}</span>
                  </div>
                </th>
                <th>
                  <div className="flex items-center gap-10">
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    <span>{t("stock")}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="">
              {markets?.map((item: any, inx: number) => (
                <tr
                  key={item?.market?.id}
                  className={`h-[56px] cursor-pointer hover:bg-[#f6f7fb9f] dark:hover:bg-[#3d3759] font-medium dark:text-[#d5d1eb] text-[#2E263DE5] text-[16px]
                  ${
                    inx % 2 === 0
                      ? "bg-white dark:bg-[#2a243a]"
                      : "bg-[#aa85f818] dark:bg-[#342d4a]"
                  }`}
                  onClick={() => handleProps(item?.market?.id)}
                >
                  <td className="pl-10">{inx + 1}</td>
                  <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.market?.name}
                  </td>
                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.market?.phone_number
                      ? `${item?.market?.phone_number
                          .replace(/\D/g, "")
                          .replace(
                            /^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/,
                            "+$1 $2 $3 $4 $5"
                          )}`
                      : ""}
                  </td>
                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.orderTotalPrice}
                  </td>
                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[80vh]">
          <EmptyPage />
        </div>
      )}
    </section>
  );
};

export default memo(TodayOrders);
