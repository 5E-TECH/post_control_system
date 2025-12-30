import { memo, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
// import Search from "./components/search";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import EmptyPage from "../../shared/components/empty-page";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";
import { useTranslation } from "react-i18next";
import { debounce } from "../../shared/helpers/DebounceFunc";
import Skeleton from "./components/search/skeleton";
import { buildAdminPath } from "../../shared/const";

const TodayOrders = () => {
  const { t } = useTranslation("todayOrderList");
  const navigate = useNavigate();
  const [searchData, setSearch] = useState<any>(null);
  const base =
    import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/"
      ? import.meta.env.BASE_URL.replace(/\/$/, "")
      : "";

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearch(value);
      }, 500),
    []
  );


  const { pathname } = useLocation();
  const role = useSelector((state: RootState) => state.roleSlice);
  useEffect(() => {
    if (role.role === "market") {
      navigate(`${role.id}`);
    }
  }, [pathname]);

  const handleProps = (id: string) => {
    navigate(`${id}`);
  };
  const enabled = role.role !== "market";


  const { getMarketsNewOrder } = useMarket();
  const { data, isLoading,refetch } = getMarketsNewOrder(enabled, searchData ? {search:searchData} : "");
  useEffect(() => {
  if (enabled) {
    refetch();
  }
}, [pathname]);

  const normalizedPathname =
    base && pathname.startsWith(base)
      ? pathname.slice(base.length) || "/"
      : pathname;

  if (normalizedPathname.startsWith("/order/markets/new-orders/")) {
    return <Outlet />;
  }

  const markets = data?.data || [];

  return (
    <section className="flex items-center justify-center bg-white flex-col m-5 rounded-md dark:bg-[#312d48]">
      {/* {!isLoading && markets?.length > 0 && ( */}
      <div className="flex justify-between w-full items-center p-10 max-[650px]:flex-col ">
        <h2 className="text-[20px] font-medium text-[#2E263DE5] dark:text-[#E7E3FCE5]">
          {t("title")}
        </h2>
        <form action="">
          <div className="border border-[#d1cfd4] rounded-md max-[650px]:mt-3">
            <input
              onChange={(e) => debouncedSearch(e.target.value)}
              className="outline-none px-4 py-3"
              type="text"
              placeholder={t("placeholder.search")}
            />
          </div>
        </form>
      </div>
      {/* )} */}
      {isLoading ? (
          <Skeleton/>
      ) : (
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
              {markets.length > 0 ? (
                markets?.map((item: any, inx: number) => (
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
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="h-[60vh] flex justify-center items-center">
                      <EmptyPage />
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default memo(TodayOrders);
