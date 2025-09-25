import { Button, Form, Input } from "antd";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { createContext, memo, useState, useMemo, useEffect } from "react";

import { useNavigate } from "react-router-dom";
import useNotification from "antd/es/notification/useNotification";
import { useMarket } from "../../../../../shared/api/hooks/useMarket/useMarket";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { debounce } from "../../../../../shared/helpers/DebounceFunc";
import TableSkeleton from "../../../components/ordersTabelSkeleton/ordersTableSkeleton";
import { useTranslation } from "react-i18next";

const Context = createContext({ name: "Default" });

const ChooseMarket = () => {
  const { t } = useTranslation("createOrder");
  // API get
  const { getMarkets } = useMarket();
  const [searchMarket, setSearchMarket] = useState<any>(null);
  const { data, isLoading } = getMarkets(true, { search: searchMarket });
  const markets = Array.isArray(data?.data?.data) ? data?.data?.data : [];

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
  const [api, contextHolder] = useNotification();

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
      api.warning({
        message: "Market tanlanmagan!",
        description: "Iltimos, davom etishdan oldin marketni tanlang.",
        placement: "topRight",
      });
      return;
    }

    localStorage.setItem("market", JSON.stringify(selectedMarket));
    navigate(`/orders/customer-info`);
  };

  const contextValue = useMemo(() => ({ name: "Ant Design" }), []);

  return (
    <Context.Provider value={contextValue}>
      {contextHolder}
      <div className="px-6 pt-6 flex items-start max-[1150px]:flex-col max-[1150px]:gap-10">
        <div className="max-[1150px]:w-full max-[1150px]:flex max-[1150px]:justify-center">
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

              <span className="font-medium text-[25px] text-[#2E263DE5]">
                03
              </span>

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
                className="h-[40px]! min-w-[350px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
              />
            </Form.Item>
          </div>
          <div className="">
            <table className="max-[901px]:w-full">
              <thead className="bg-[#F6F7FB] dark:bg-[#3D3759]">
                <tr>
                  <th className="w-[654px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                    <div className="flex items-center justify-between pr-[21px]">
                      {t("marketName")}
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="w-[654px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                    <div className="flex items-center justify-between pr-[21px]">
                      {t("phoneNumber")}
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                </tr>
              </thead>
              {isLoading ? (
                <TableSkeleton rows={5} columns={2} />
              ) : (
                <tbody>
                  {markets?.map((market: any) => (
                    <tr
                      key={market?.id}
                      onClick={() => setSelectedMarket(market)}
                      onDoubleClick={() => setSelectedMarket(null)}
                      className={`cursor-pointer ${
                        selectedMarket?.id === market.id
                          ? "bg-[#E3DCFB] dark:bg-[#524B6C]"
                          : "hover:bg-[#F6F7FB] dark:hover:bg-[#3D3759]"
                      }`}
                    >
                      <td
                        className="data-cell max-[254px]:w-full h-[56px] pl-[20px] text-left"
                        data-cell="MARKET NOMI"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-normal text-[13px] text-[#2E263DB2] dark:text-[#D5D1EB]">
                            {market?.name}
                          </span>
                        </div>
                      </td>
                      <td
                        className="data-cell max-[254px]:w-full h-[56px] pl-[20px] text-left max-[254px]:"
                        data-cell="TELEFON NOMERI"
                      >
                        <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
                          {market?.phone_number}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
            <div className="flex justify-end items-center pr-[105px] pt-4 gap-6">
              <div className="flex items-center">
                <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
                  {t("rowsPerPage")}
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
        <div className="flex gap-4 justify-end">
          <Button
            onClick={onClick}
            className="w-[91px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none! dark:border-none!"
          >
            {t("next")} <ArrowRight className="w-[13px] h-[13px]" />
          </Button>
        </div>
      </div>
    </Context.Provider>
  );
};

export default memo(ChooseMarket);
