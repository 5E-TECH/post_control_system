import { Eraser, Search } from "lucide-react";
import React, { useCallback, useState } from "react";
import Select from "../users/components/select";
import Popup from "../../shared/ui/Popup";
import { X } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";
import { useCourier } from "../../shared/api/hooks/useCourier";
import { useCashBox } from "../../shared/api/hooks/useCashbox";
import CountUp from "react-countup";
import { useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { Button, Pagination, type PaginationProps } from "antd";
import { useParamsHook } from "../../shared/hooks/useParams";
import HistoryPopup from "./components/historyPopup";
import { debounce } from "../../shared/helpers/DebounceFunc";
import { useTranslation } from "react-i18next";

export interface IPaymentFilter {
  operationType?: string | null;
  sourceType?: string | null;
  createdBy?: string | null;
  cashboxType?: string | null;
}

const initialState: IPaymentFilter = {
  operationType: null,
  sourceType: null,
  createdBy: null,
  cashboxType: null,
};

const Payments = () => {
  const { t } = useTranslation("payment");
  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;
  const id = user.id;
  useEffect(() => {
    if (role === "courier" || role === "market") {
      navigate(`cash-detail/${id}`);
    }
  }, [user, role]);

  const [showMarket, setShowMarket] = useState(false);
  const [showCurier, setShowCurier] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [select, setSelect] = useState<null | string>(null);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] =
    useState<IPaymentFilter>(initialState);

  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { getMarkets } = useMarket();
  const { getCourier } = useCourier();
  const { getCashBoxInfo } = useCashBox();
  const searchParam = search
    ? { search: search } // ✅ faqat search bo‘lsa qo‘shiladi
    : {};

  // Pagination start
  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);
  const { data: cashBoxData, refetch } = getCashBoxInfo(
    role === "superadmin" || role === "admin",
    {
      operationType: paymentFilter.operationType,
      sourceType: paymentFilter.sourceType,
      createdBy: paymentFilter.createdBy,
      cashboxType: paymentFilter.cashboxType,
      page,
      limit,
    }
  );
  const { data } = getMarkets(showMarket, { ...searchParam, limit: 0 });
  const { data: courierData } = getCourier(showCurier, { ...searchParam });
  const total = cashBoxData?.data?.pagination?.total || 0;
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
  // Pagination end

  const handleNavigate = () => {
    navigate(`cash-detail/${select}`);
    setSelect(null);
    setShowMarket(false);
    setShowCurier(false);
  };

  const hendlerClose = () => {
    setShowCurier(false);
    setShowMarket(false);
    setSelect(null);
  };

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const operationType = ["income", "expense"];
  const operationOptions = operationType.map((role: string) => ({
    value: role,
    label: t(`${role}`),
  }));

  const sourceType = [
    "courier_payment",
    "market_payment",
    "manual_expense",
    "manual_income",
    "correction",
    "salary",
    "sell",
    "cancel",
    "extra_cost",
    "bills",
  ];
  const sourceOptions = sourceType.map((status: string) => ({
    value: status,
    label: t(`sourceTypes.${status}`),
  }));

  const createdByOptions = cashBoxData?.data?.allCashboxHistories
    ?.map((item: any) => ({
      value: item?.createdByUser?.id,
      label: item?.createdByUser?.role,
    }))
    .filter(
      (option: any, index: any, self: any) =>
        index === self.findIndex((o: any) => o.value === option.value)
    );

  const cashboxType = ["market", "courier", "main"];
  const cashboxOptions = cashboxType.map((status: string) => ({
    value: status,
    label: t(`${status}`),
  }));

  useEffect(() => {
    if (role === "admin" || role === "superadmin") {
      refetch();
    }
  }, [pathname, paymentFilter]);

  if (pathname.startsWith("/payments/")) {
    return <Outlet />;
  }

  const handleHistoryPopup = (id: string) => {
    setSelect(id);
    setShowHistory(true);
  };

  const handleChange = (name: keyof IPaymentFilter, value: string) => {
    setPaymentFilter((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="mt-10">
      <div className="grid grid-cols-3 gap-14 max-[1050px]:grid-cols-2 max-[800px]:grid-cols-1 text-center text-2xl items-end mx-5 ">
        <div
          onClick={() => setShowMarket(true)}
          className="py-15 cursor-pointer rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white"
        >
          <h3>{t("berilishiKerak")}</h3>
          <strong className="block pt-3 text-4xl">
            <CountUp
              end={cashBoxData?.data?.marketCashboxTotal || 0}
              duration={1.5} // qancha sekundda sanashini belgilaydi
              separator=" " // mingliklarni bo‘lib beradi
              suffix=" UZS" // oxiriga UZS qo‘sha  const { t } = useTranslation("product");
            />
          </strong>
        </div>

        <Popup isShow={showMarket} onClose={() => hendlerClose()}>
          <div className="bg-white rounded-md w-[700px] h-[700px] px-6 dark:bg-[#28243d] relative max-md:w-[400px] max-md:h-[700px]">
            <button
              onClick={() => setShowMarket(false)}
              className="cursor-pointer text-red-500 p-2 absolute right-4 top-2 flex items-center justify-center"
            >
              <X size={30} />
            </button>

            <h1 className="font-bold text-left pt-10">{t("berilishiKerak")}</h1>

            {/* qidiruv */}
            <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
              <input
                defaultValue={search}
                onChange={handleSearchChange}
                type="text"
                placeholder={`${t("search")}...`}
                className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
              />
              <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
            </div>

            {/* jadval qismi */}
            <div className="mt-4 rounded-md border border-[#9d70ff1f] dark:border-[#2E263DB2] overflow-hidden">
              {/* jadval headeri (qotib turadigan qism) */}
              <div className="overflow-hidden">
                <table className="w-full border-collapse cursor-pointer">
                  <thead className="dark:bg-[#3d3759] bg-[#9d70ff]">
                    <tr>
                      <th className="h-[56px] font-medium text-[13px] text-left px-4">
                        <div className="flex items-center justify-between pr-[21px]">
                          #
                          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                        </div>
                      </th>
                      <th className="h-[56px] font-medium text-[13px] text-left px-4">
                        <div className="flex items-center justify-between pr-[21px]">
                          {t("marketName")}
                          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                        </div>
                      </th>
                      <th className="h-[56px] font-medium text-[13px] text-left px-4">
                        <div className="flex items-center justify-between pr-[21px]">
                          {t("berilishiKerakSumma")}
                        </div>
                      </th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* scroll bo‘luvchi tbody qismi */}
              <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-[#555] dark:scrollbar-track-[#2E263D]">
                <table className="w-full border-collapse cursor-pointer">
                  <tbody className="text-[16px] text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F] font-medium">
                    {data?.data?.data?.map((item: any, inx: number) => (
                      <tr
                        key={item?.id}
                        onClick={() => setSelect(item?.id)}
                        className={`border-b-1 border-b-[#444444] border-[#f4f5fa] dark:border-[#E7E3FCB2] font-medium text-[16px] text-[#2E263DB2] dark:text-white ${
                          item.id == select ? "bg-gray-300 text-black" : ""
                        }`}
                      >
                        <td className="text-[#8C57FF] pr-10 py-3">{inx + 1}</td>
                        <td className="pr-26 py-3">{item?.name}</td>
                        <td className="pr-26 py-3">{item?.cashbox?.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* tanlash tugmasi */}
            <div className="flex justify-end py-2">
              <button
                disabled={!select ? true : false}
                onClick={() => handleNavigate()}
                className={`px-6 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 absolute bottom-2 right-4 ${
                  !select ? "" : "hover:bg-blue-600"
                } text-white rounded-md cursor-pointer ${
                  !select ? "opacity-40" : ""
                }`}
              >
                {t("tanlash")}
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
          <h3>{t("kassadagiMiqdor")}</h3>
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
          <h3>{t("olinishiKerak")}</h3>
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
          <div className="bg-white rounded-md w-[1000px] h-[700px] px-6 dark:bg-[#28243d] relative max-md:w-[400px] max-md:h-[700px]">
            {/* Yopish tugmasi */}
            <button
              onClick={() => setShowCurier(false)}
              className="cursor-pointer text-red-500 p-2 absolute right-4 top-2 flex items-center justify-center"
            >
              <X size={30} />
            </button>

            {/* Sarlavha */}
            <h1 className="font-bold text-left pt-10">{t("olinishiKerak")}</h1>

            {/* Qidiruv */}
            <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
              <input
                defaultValue={search}
                onChange={handleSearchChange}
                type="text"
                placeholder={`${t("search")}...`}
                className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
              />
              <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
            </div>

            {/* Jadval qismi */}
            <div className="mt-4 rounded-md border border-[#9d70ff1f] dark:border-[#2E263DB2] overflow-hidden">
              {/* jadval headeri (qotib turadigan qism) */}
              <div className="overflow-hidden">
                <table className="w-full border-collapse cursor-pointer">
                  <thead className="dark:bg-[#3d3759] bg-[#9d70ff]">
                    <tr>
                      <th className="h-[56px] font-medium text-[13px] text-left px-4">
                        <div className="flex items-center justify-between pr-[21px]">
                          #
                          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                        </div>
                      </th>
                      <th className="h-[56px] font-medium text-[13px] text-left px-4">
                        <div className="flex items-center justify-between pr-[21px]">
                          {t("courierName")}
                          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                        </div>
                      </th>
                      <th className="h-[56px] font-medium text-[13px] text-left px-4">
                        <div className="flex items-center justify-between pr-[21px]">
                          {t("region")}
                          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                        </div>
                      </th>
                      <th className="h-[56px] font-medium text-[13px] text-left px-4">
                        <div className="flex items-center justify-between pr-[21px]">
                          {t("olinishiKerakSumma")}
                        </div>
                      </th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* scroll bo‘luvchi tbody qismi */}
              <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-[#555] dark:scrollbar-track-[#2E263D]">
                <table className="w-full border-collapse cursor-pointer">
                  <tbody className="text-[16px] text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F] font-medium">
                    {courierData?.data?.map((item: any, inx: number) => (
                      <tr
                        key={item?.id}
                        onClick={() => setSelect(item?.id)}
                        className={`border-b-1 border-b-[#444444] border-[#f4f5fa] dark:border-[#E7E3FCB2] font-medium text-[16px] text-[#2E263DB2] dark:text-white ${
                          item.id == select ? "bg-gray-300 text-black" : ""
                        }`}
                      >
                        <td className="text-[#8C57FF] pr-10 py-3">{inx + 1}</td>
                        <td className="pr-26 py-3">{item?.name}</td>
                        <td className="pr-26 py-3">{item?.region?.name}</td>
                        <td className="pr-26 py-3">{item?.cashbox?.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tanlash tugmasi */}
            <div className="flex justify-end py-2">
              <button
                disabled={!select ? true : false}
                onClick={() => handleNavigate()}
                className={`px-6 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 absolute bottom-2 right-4 ${
                  !select ? "" : "hover:bg-blue-600"
                } text-white rounded-md cursor-pointer ${
                  !select ? "opacity-40" : ""
                }`}
              >
                {t("tanlash")}
              </button>
            </div>
          </div>
        </Popup>
      </div>

      <div className="mt-12 mx-5">
        <h1 className="text-xl font-semibold mb-3">{t("filter")}</h1>
        <div className="grid grid-cols-5 gap-6 pt-[16px] max-[1000px]:grid-cols-3 max-[750px]:grid-cols-2 max-[450px]:grid-cols-1 capitalize">
          <Select
            value={paymentFilter.operationType}
            onChange={handleChange}
            options={operationOptions}
            text={t("operationType")}
            name="operationType"
          />
          <Select
            value={paymentFilter.sourceType}
            onChange={handleChange}
            options={sourceOptions}
            text={t("sourceType")}
            name="sourceType"
          />
          <Select
            value={paymentFilter.createdBy}
            onChange={handleChange}
            options={createdByOptions}
            text={t("createdBy")}
            name="createdBy"
          />
          <Select
            value={paymentFilter.cashboxType}
            onChange={handleChange}
            options={cashboxOptions}
            text={t("cashboxtype")}
            name="cashboxType"
          />
          <div className="flex min-[900px]:justify-end">
            <Button
              className="w-[150px]! max-[651px]:w-full! h-[45px]!"
              onClick={() => setPaymentFilter(initialState)}
            >
              <Eraser className="w-4 h-4 mr-2" />
              {t("tozalash")}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-12 mx-5">
        <div className="shadow-lg bg-[#fff] dark:bg-[#312D4B] rounded-md">
          <div>
            <div>
              <table className="w-full border-collapse">
                <thead className="dark:bg-[#3D3759] text-[13px] bg-[#F6F7FB] border-4 border-white dark:border-[#3D3759] uppercase">
                  <tr>
                    <th className="h-[56px] font-medium  text-left pl-4">
                      <div className="flex items-center justify-between">
                        #
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-left">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t("createdBy")}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t("cashboxtype")}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t("operationType")}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px] pl-9">
                        {t("amount")}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px] pl-9">
                        {t("paymentDate")}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2] capitalize">
                  {cashBoxData?.data?.allCashboxHistories?.map(
                    (item: any, inx: number) => (
                      <tr
                        onClick={() => handleHistoryPopup(item.id)}
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
                            {t(item?.payment_method)}
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
                            {t(item?.operation_type)}
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
              <div className="flex justify-center py-2">
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
        </div>
      </div>
      {showHistory && (
        <HistoryPopup id={select} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
};

export default React.memo(Payments);
