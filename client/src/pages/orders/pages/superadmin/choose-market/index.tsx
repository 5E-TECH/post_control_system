import { Button, Form, Input, Pagination, type PaginationProps } from "antd";
import { ArrowRight } from "lucide-react";
import { memo, useState, useMemo, useEffect } from "react";

import { useNavigate } from "react-router-dom";
import { useMarket } from "../../../../../shared/api/hooks/useMarket/useMarket";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { debounce } from "../../../../../shared/helpers/DebounceFunc";
import TableSkeleton from "../../../components/ordersTabelSkeleton/ordersTableSkeleton";
import { useTranslation } from "react-i18next";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useParamsHook } from "../../../../../shared/hooks/useParams";

const ChooseMarket = () => {
  const { t } = useTranslation("createOrder");
  // API get
  const { getMarkets } = useMarket();
  const [searchMarket, setSearchMarket] = useState<any>(null);

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);

  const { data, isLoading } = getMarkets(true, {
    search: searchMarket,
    page,
    limit,
  });
  const markets = Array.isArray(data?.data?.data) ? data?.data?.data : [];
  const total = data?.data?.total || 0;

  // Pagination onChange
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

  // Debounce Func for search
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchMarket(value);
      }, 800),
    []
  );

  const navigate = useNavigate();
  const { handleWarning } = useApiNotification();
  // Navigate to page based on role
  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;
  useEffect(() => {
    if (role === "market" && user.id) {
      localStorage.setItem("marketId", user.id);
      navigate("/orders/customer-info");
    }
  }, [role, user, navigate]);

  const onClick = () => {
    if (!selectedMarket) {
      handleWarning(
        "Market tanlanmagan!",
        "Iltimos, davom etishdan oldin marketni tanlang"
      );
      return;
    }

    localStorage.setItem("market", JSON.stringify(selectedMarket));
    navigate(`/orders/customer-info`);
  };

  return (
    <div className="px-6 pt-6 flex items-start max-[1150px]:flex-col max-[1150px]:gap-10">
      <div className="w-fit h-fit pr-[81px] max-[1150px]:flex max-[1150px]:flex-col">
        <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#D4D0E9]">
          {t("process")}
        </h1>

        <div className="flex items-center gap-2 mt-4">
          <div className="flex w-[18px] h-[18px] rounded-full p-[4px] border-3 border-[var(--color-bg-sy)] bg-[white] dark:bg-[var(--color-dark-bg-py)]"></div>

          <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            01
          </span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
              {t("step.one.title")}
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] whitespace-nowrap dark:text-[#AEAAC2]">
              {t("step.one.description")}
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[#E3DCFB] ml-[7px] mt-[8px] dark:bg-[#8C57FF29]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex w-[18px] h-[18px] rounded-full p-[3px] bg-white border-3 border-[#E3DCFB] dark:bg-[#312D4B] dark:border-[#382C5C]"></div>

          <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            02
          </span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
              {t("step.two.title")}
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
              {t("step.two.description")}
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[#E3DCFB] ml-[7px] mt-[8px] dark:bg-[#8C57FF29]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex w-[18px] h-[18px] rounded-full p-[3px] bg-white border-3 border-[#E3DCFB] dark:bg-[#312D4B] dark:border-[#382C5C]"></div>

          <span className="font-medium text-[25px] text-[#2E263DE5]">03</span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
              {t("step.three.title")}
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
              {t("step.three.description")}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-7 max-[900px]:w-full">
        <div className="bg-[#ffffff] shadow-lg rounded-md flex-1 pb-7 dark:bg-[#312D48]">
          <div className="flex justify-between px-5 pt-6 max-[900px]:flex-col max-[900px]:gap-3">
            <h1 className="mt-2 font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
              {t("chooseMarket")}
            </h1>

            <Form.Item>
              <Input
                onChange={(e) => debouncedSearch(e.target.value)}
                placeholder="Search..."
                className="h-[40px]! min-[900px]:max-w-[350px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
              />
            </Form.Item>
          </div>
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow overflow-hidden">
            <table className="w-full border dark:border-none border-gray-200 shadow-sm">
              <thead className="bg-[#9d70ff] min-[900px]:h-[56px] text-[16px] text-white dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
                <tr>
                  <th className="text-left pl-8 w-[60px]">#</th>
                  <th className="text-left px-8">{t("marketName")}</th>
                  {/* padding-left qo'shildi, width olib tashlandi */}
                  <th className="text-left pl-12">{t("phoneNumber")}</th>
                </tr>
              </thead>

              {isLoading ? (
                <TableSkeleton rows={5} columns={2} />
              ) : (
                <tbody>
                  {markets?.map((market: any, inx: number) => (
                    <tr
                      key={market?.id}
                      className={`h-[56px] cursor-pointer hover:bg-[#f6f7fb9f] dark:hover:bg-[#3d3759] 
            font-medium dark:text-[#d5d1eb] text-[#2E263DE5] text-[16px]
            ${
              inx % 2 === 0
                ? "bg-white dark:bg-[#2a243a]"
                : "bg-[#aa85f818] dark:bg-[#342d4a]"
            }`}
                      onClick={() => setSelectedMarket(market)}
                      onDoubleClick={() => setSelectedMarket(null)}
                    >
                      <td className="pl-8 w-[60px]">{inx + 1}</td>
                      <td className="px-8">{market?.name}</td>
                      {/* width olib tashlandi, pl-12 bilan joylashtirildi */}
                      <td className="text-left pl-12">
                        {market?.phone_number}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>

            {/* Pagination (pastki qism) */}
            <div className="flex justify-center items-center border-t border-[#E9E8EE] dark:border-[#3D3759] py-3 bg-[#FDFDFF] dark:bg-[#2A263D]">
              <Pagination
                showSizeChanger
                current={page}
                total={total}
                pageSize={limit}
                onChange={onChange}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-4 justify-end">
          <Button
            onClick={onClick}
            className="w-[110px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none! dark:border-none!"
          >
            {t("next")} <ArrowRight className="w-[13px] h-[13px]" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(ChooseMarket);
