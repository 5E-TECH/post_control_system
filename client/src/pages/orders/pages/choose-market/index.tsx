import { Button, Form, Input } from "antd";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { createContext, memo, useState, useMemo } from "react";
import Discard from "../../components/button/discard";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";
import { useNavigate } from "react-router-dom";
import useNotification from "antd/es/notification/useNotification";

const Context = createContext({ name: "Default" });

const ChooseMarket = () => {
  const { getMarkets } = useMarket();
  const { data } = getMarkets();
  const markets = data?.data;

  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);

  const navigate = useNavigate();
  const [api, contextHolder] = useNotification();

  const onClick = () => {
    if (!selectedMarketId) {
      api.warning({
        message: "Market tanlanmagan!",
        description: "Iltimos, davom etishdan oldin marketni tanlang.",
        placement: "topRight",
      });
      return;
    }

    localStorage.setItem("marketId", selectedMarketId);
    navigate(`/orders/customer-info`);
  };

  const contextValue = useMemo(() => ({ name: "Ant Design" }), []);

  return (
    <Context.Provider value={contextValue}>
      {contextHolder}
      <div className="px-6 pt-6 flex items-start">
        <div className="w-fit h-fit pr-[81px]">
          <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#D4D0E9]">
            Process
          </h1>

          <div className="flex items-center gap-2 mt-4">
            <div className="flex w-[18px] h-[18px] rounded-full p-[4px] border-3 border-[var(--color-bg-sy)] bg-[white] dark:bg-[var(--color-dark-bg-py)]"></div>

            <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
              01
            </span>

            <div className="flex flex-col">
              <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
                Market details
              </span>
              <span className="font-normal text-[#2E263DB2] text-[13px] whitespace-nowrap dark:text-[#AEAAC2]">
                Enter your Market Details
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
                Customer Info
              </span>
              <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
                Setup information{" "}
              </span>
            </div>
          </div>

          <div className="w-[3px] h-[40px] rounded-[20px] bg-[#E3DCFB] ml-[7px] mt-[8px] dark:bg-[#8C57FF29]"></div>

          <div className="flex items-center gap-2 mt-2">
            <div className="flex w-[18px] h-[18px] rounded-full p-[3px] bg-white border-3 border-[#E3DCFB] dark:bg-[#312D4B] dark:border-[#382C5C]"></div>

            <span className="font-medium text-[25px] text-[#2E263DE5]">03</span>

            <div className="flex flex-col">
              <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
                Order details
              </span>
              <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
                Add order details
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-7">
          <div className="bg-[#ffffff] shadow-lg rounded-md flex-1 pb-7 dark:bg-[#312D48]">
            <div className="flex justify-between px-5 pt-6">
              <h1 className="mt-2 font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
                Marketni tanlang
              </h1>

              <Form.Item>
                <Input
                  placeholder="Search..."
                  className="h-[40px]! min-w-[350px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
                />
              </Form.Item>
            </div>
            <div className="">
              <table>
                <thead className="bg-[#F6F7FB] dark:bg-[#3D3759]">
                  <tr>
                    <th className="w-[654px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                      <div className="flex items-center justify-between pr-[21px]">
                        MARKET NOMI
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="w-[654px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                      <div className="flex items-center justify-between pr-[21px]">
                        TELEFON NOMERI
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {markets?.map((market: any) => (
                    <tr
                      key={market?.id}
                      onClick={() => setSelectedMarketId(market?.id)}
                      onDoubleClick={() => setSelectedMarketId(null)}
                      className={`cursor-pointer ${
                        selectedMarketId === market.id
                          ? "bg-[#E3DCFB] dark:bg-[#524B6C]"
                          : "hover:bg-[#F6F7FB] dark:hover:bg-[#3D3759]"
                      }`}
                    >
                      <td className="w-[254px] h-[56px] pl-[20px] text-left">
                        <div className="flex items-center gap-4">
                          <span className="font-normal text-[13px] text-[#2E263DB2] dark:text-[#D5D1EB]">
                            {market?.name}
                          </span>
                        </div>
                      </td>
                      <td className="w-[254px] h-[56px] pl-[20px] text-left">
                        <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
                          {market?.phone_number}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end items-center pr-[105px] pt-4 gap-6">
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
          </div>
          <div className="flex gap-4 justify-end">
            <Discard children="Discard" />
            <Button
              onClick={onClick}
              className="w-[91px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none! dark:border-none!"
            >
              Next <ArrowRight className="w-[13px] h-[13px]" />
            </Button>
          </div>
        </div>
      </div>
    </Context.Provider>
  );
};

export default memo(ChooseMarket);
