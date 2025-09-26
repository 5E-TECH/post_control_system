import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import React, { useState } from "react";
import Select from "../users/components/select";
import Popup from "../../shared/ui/Popup";
import { X } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";
import { useCourier } from "../../shared/api/hooks/useCourier";
import { useCashBox } from "../../shared/api/hooks/useCashbox";
import CountUp from "react-countup";
import { useEffect } from "react";

const Payments = () => {
  const [showMarket, setShowMarket] = useState(false);
  const [showCurier, setShowCurier] = useState(false);

  const [select, setSelect] = useState(null);

  const navigate = useNavigate();

  const { getMarkets } = useMarket();
  const { getCourier } = useCourier();
  const { getCashBoxInfo } = useCashBox();

  const { data: cashBoxData, refetch } = getCashBoxInfo();

  const { data } = getMarkets(showMarket);
  const { data: courierData } = getCourier(showCurier);

  const handleNavigate = () => {
    navigate(`cash-detail/${select}`);
    setSelect(null);
    setShowMarket(false);
    setShowCurier(false);
  };

  const { pathname } = useLocation();

  const hendlerClose = ()=>{
    setShowCurier(false)
    setShowMarket(false)
    setSelect(null)

  }

  useEffect(() => {
    refetch();
  }, [pathname]);

  if (pathname.startsWith("/payments/")) {
    return <Outlet />;
  }

  return (
    <div className="mt-10">
      <div className="grid grid-cols-3 gap-14 max-[1050px]:grid-cols-2 max-[800px]:grid-cols-1 text-center text-2xl items-end mx-5 ">
        <div
          onClick={() => setShowMarket(true)}
          className="py-15 cursor-pointer rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white"
        >
          <h3>Berilishi kerak</h3>
          <strong className="block pt-3 text-4xl">
            <CountUp
              end={cashBoxData?.data?.marketCashboxTotal || 0}
              duration={1.5} // qancha sekundda sanashini belgilaydi
              separator=" " // mingliklarni bo‘lib beradi
              suffix=" UZS" // oxiriga UZS qo‘shadi
            />
          </strong>
        </div>

        <Popup isShow={showMarket} onClose={() => hendlerClose()}>
          <div className="bg-white rounded-md w-[700px] h-[700px] px-6 dark:bg-[#28243d]">
            <button
              onClick={() => setShowMarket(false)}
              className="cursor-pointer hover:bg-red-700 text-white p-2 rounded- ml-160 flex items-center justify-center shadow-md"
            >
              <X size={18} />
            </button>
            <h1 className="font-bold text-left">Choose Market</h1>
            <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
              <input
                type="text"
                placeholder="Search order..."
                className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
              />
              <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full border-collapse border-4 border-[#f4f5fa] dark:border-[#2E263DB2] mt-4 scroll-y-auto cursor-pointer">
                <thead className="dark:bg-[#3d3759] bg-[#F6F7FB]">
                  <tr>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        #
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        MARKET NAME
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        Berilishi kerak summa
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F]">
                  {data?.data?.data?.map((item: any, inx: number) => (
                    <tr
                      key={item?.id}
                      onClick={() => setSelect(item?.id)}
                      className={`border-b-1 border-b-[#444444] border-[#f4f5fa] dark:border-[#E7E3FCB2] text-[15px] font-normal ${
                        item.id == select ? "bg-gray-300 text-black" : ""
                      }`}
                    >
                      <td className="text-[#8C57FF] pr-10 py-3">{inx + 1}</td>
                      <td className="pr-26 py-3 ">{item?.name}</td>
                      <td className="pr-26 py-3">{item?.cashbox?.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end py-2">
              <button
                disabled={!select ? true : false}
                onClick={() => handleNavigate()}
                className={`px-6 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 ${
                  !select ? "" : "hover:bg-blue-600"
                }  text-white rounded-md cursor-pointer ${
                  !select ? "opacity-40" : ""
                }`}
              >
                Tanlash
              </button>
            </div>
          </div>
        </Popup>

        <div
          onClick={() =>
            navigate("main-cashbox", {
              state: {
                role: "pochta",
              },
            })
          }
          className="h-[250px] flex cursor-pointer flex-col justify-center rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white"
        >
          <h3>Kassadagi miqdor</h3>
          <strong className="block pt-3 text-4xl">
            <CountUp
              end={cashBoxData?.data?.mainCashboxTotal || 0}
              duration={1.5} // qancha sekundda sanashini belgilaydi
              separator=" " // mingliklarni bo‘lib beradi
              suffix=" UZS" // oxiriga UZS qo‘shadi
            />
          </strong>
        </div>

        <div
          onClick={() => setShowCurier(true)}
          className="py-15 cursor-pointer rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white"
        >
          <h3>Olinishi kerak</h3>
          <strong className="block pt-3 text-4xl">
            <CountUp
              end={cashBoxData?.data?.courierCashboxTotal || 0}
              duration={1.5} // qancha sekundda sanashini belgilaydi
              separator=" " // mingliklarni bo‘lib beradi
              suffix=" UZS" // oxiriga UZS qo‘shadi
            />
          </strong>
        </div>

        <Popup isShow={showCurier} onClose={() => hendlerClose()}>
          <div className="bg-white rounded-md w-[700px] h-[700px] px-6 dark:bg-[#28243d] relative">
            <button
              onClick={() => setShowCurier(false)}
              className="cursor-pointer text-red-500 p-2 absolute right-4 top-2 flex items-center justify-center"
            >
              <X size={30} />
            </button>
            <h1 className="font-bold text-left pt-10">Olinishi kerak</h1>
            <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
              <input
                type="text"
                placeholder="Search order..."
                className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
              />
              <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full border-collapse border-4 border-[#f4f5fa] dark:border-[#2E263DB2] mt-4 scroll-y-auto">
                <thead className="dark:bg-[#3d3759] bg-[#F6F7FB] sticky top-[-2px]">
                  <tr>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        #
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        CURIER NAME
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        REGION
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        Olinishi kerak summa
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F]">
                  {courierData?.data.map((item: any, inx: number) => (
                    <tr
                      key={inx}
                      onClick={() => setSelect(item?.id)}
                      className={`border-b-2 border-[#c3c5ce] dark:border-[#E7E3FCB2]  text-[15px] font-normal ${
                        item.id == select ? "bg-gray-100 text-black" : ""
                      }`}
                    >
                      <td className="text-[#8C57FF] pr-10 py-3">{inx + 1}</td>
                      <td className="pr-26 py-3">{item?.name}</td>
                      <td className="pr-10 py-3">{item?.region?.name}</td>
                      <td className="pr-10 py-3">{item?.cashbox?.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="absolute py-2 bottom-0,1 right-4">
              <button
                disabled={!select ? true : false}
                onClick={() => handleNavigate()}
                className={`px-6 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 ${
                  !select ? '' : 'hover:bg-blue-600'
                }  text-white rounded-md cursor-pointer ${
                  !select ? 'opacity-40' : ''
                }`}
              >
                Tanlash
              </button>
            </div>
          </div>
        </Popup>
      </div>

      <div className="mt-12 mx-5">
        <h1 className="text-xl font-semibold mb-3">Filters</h1>
        <div className="grid grid-cols-4 gap-6 pt-[16px] max-[1000px]:grid-cols-2 max-[750px]:grid-cols-1">
          <Select text="Operation type" />
          <Select text="Source type" />
          <Select text="Created By" />
          <Select text="Cashbox type" />
        </div>
      </div>

      <div className="mt-12 mx-5">
        <div className="shadow-lg bg-[#fff] dark:bg-[#312D4B] rounded-md">
          <div>
            <div>
              <table className="w-full border-collapse">
                <thead className="dark:bg-[#3D3759] text-[13px] bg-[#F6F7FB] border-4 border-white dark:border-[#3D3759]">
                  <tr>
                    <th className="h-[56px] font-medium  text-left pl-4">
                      <div className="flex items-center justify-between">
                        #
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-left">
                      <div className="flex items-center justify-between pr-[21px]">
                        CREATED BY
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        CASHBOX TYPE
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        OPERTAION TYPE
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        AMOUNT
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        Payment Date
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2]">
                  {cashBoxData?.data?.allCashboxHistories?.map(
                    (item: any, inx: number) => (
                      <tr
                        key={item.id}
                        className="border-t border-[#E7E3FC1F] text-[15px] font-normal"
                      >
                        <td
                          className="data-cell pl-4 py-3 text-[#8C57FF]"
                          data-cell="#"
                        >
                          {inx + 1}
                        </td>
                        <td
                          className="data-cell py-3 flex flex-col"
                          data-cell="CREATED BY"
                        >
                          {item?.createdByUser?.name}
                          <span
                            className={`text-[13px] ${
                              item?.createdByUser?.role == "superadmin"
                                ? "text-green-500"
                                : "text-blue-500"
                            }`}
                          >
                            {item?.createdByUser?.role}
                          </span>
                        </td>
                        <td
                          className="data-cell px-4 py-3"
                          data-cell="CASHBOX_TYPE"
                        >
                          <span
                            className={`
                                px-[12px] py-[2px] rounded-full text-[13px]
                                ${
                                  item?.payment_method === "click_to_market"
                                    ? "text-[#16B1FF] bg-[#16B1FF29]" // ko'k
                                    : item?.payment_method === "cash"
                                    ? "text-[#16C75F] bg-[#16C75F29]" // yashil
                                    : item?.payment_method === "click"
                                    ? "text-[#FFC107] bg-[#FFC10729]" // sariq
                                    : "text-gray-500 bg-gray-200" // default rang
                                }
                              `}
                          >
                            {item?.payment_method}
                          </span>
                        </td>
                        <td
                          className="data-cell px-4 py-3"
                          data-cell="OPERATION_TYPE"
                        >
                          <span
                            className={`
                                  px-[12px] py-[2px] rounded-full text-[13px]
                                  ${
                                    item?.operation_type === "income"
                                      ? "text-[#16C75F] bg-[#16C75F29]" // yashil
                                      : item?.operation_type === "expense"
                                      ? "text-[#FF4D4F] bg-[#FF4D4F29]" // qizil
                                      : "text-gray-500 bg-gray-200" // default rang
                                  }
                                `}
                          >
                            {item?.operation_type}
                          </span>
                        </td>
                        <td
                          className={`data-cell px-13 py-3 text-[16px] ${
                            item?.operation_type === "income"
                              ? "text-[#16C75F]" // yashil
                              : item?.operation_type === "expense"
                              ? "text-[#FF4D4F]" // qizil
                              : "text-gray-500" // default rang
                          }`}
                          data-cell="AMOUNT"
                        >
                          {item?.operation_type === "income"
                            ? "+"
                            : item?.operation_type === "expense"
                            ? "-"
                            : ""}
                          {Number(item?.amount || 0).toLocaleString("uz-UZ")}{" "}
                          UZS
                        </td>
                        <td
                          className="data-cell px-13 py-3"
                          data-cell="PAYMENT DATE"
                        >
                          {new Date(Number(item?.created_at)).toLocaleString(
                            "uz-UZ"
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              <div className="flex justify-end  pr-[105px] pt-4 gap-6 pb-[16px]">
                <div className="flex items-center">
                  <span className="font-normal dark:text-[#E7E3FCB2]">
                    Rows per page:
                  </span>
                  <select
                    className="rounded px-2 py-1  outline-none"
                    defaultValue="10"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>

                <div className="flex font-normal text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                  <span className="mr-1">1-5</span>
                  <span className="mr-1">of</span>
                  <span className="">13</span>
                </div>

                <div className="flex items-center gap-[23px]">
                  <ChevronLeft className="w-5 dark:text-[#E7E3FCE5]" />
                  <ChevronRight className="w-5 dark:text-[#E7E3FCE5]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Payments);
