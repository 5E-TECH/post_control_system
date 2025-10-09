import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form } from "antd";
import { CashboxCard } from "../../components/CashCard";
import { CashboxHistory } from "../../components/paymentHistory";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import Popup from "../../../../shared/ui/Popup";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  CircleMinus,
  CirclePlus,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";
import { useCourier } from "../../../../shared/api/hooks/useCourier";
import TextArea from "antd/es/input/TextArea";
import { Select, DatePicker } from "antd";
import dayjs from "dayjs";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import { useTranslation } from "react-i18next";

const { RangePicker } = DatePicker;

interface IForm {
  from: string;
  to: string;
  order: string;
  payment: string;
  summa: string;
  market: string;
  comment: string;
  search: string;
}

const initialForm: IForm = {
  from: new Date().toISOString().split("T")[0],
  to: new Date().toISOString().split("T")[0],
  order: "",
  payment: "",
  summa: "",
  market: "",
  comment: "",
  search: "",
};

const MainDetail = () => {
  const { t } = useTranslation("payment");
  const [form, setForm] = useState(initialForm);
  const [showMarket, setShowMarket] = useState(false);
  const [showCurier, setShowCurier] = useState(false);
  const [spand, setSpand] = useState(false);
  const [select, setSelect] = useState<null | string>(null);
  const [kassa, setMaosh] = useState(false);
  const [showAdminAndRegistrator, setshowAdminAndRegistrator] = useState(false);
  const { handleApiError } = useApiNotification();

  const navigate = useNavigate();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const params = {
    fromDate: form.from,
    toDate: form.to,
  };

  const [show, setShow] = useState(true);
  const { getMarkets } = useMarket();
  const { getCourier } = useCourier();
  const { getCashBoxMain, cashboxSpand, cashboxFill } = useCashBox();
  const { getAdminAndRegister } = useUser();

  const searchParam = form.search
    ? { search: form.search } // ✅ faqat search bo‘lsa qo‘shiladi
    : {};

  const { data: adminAndRegisterData } = getAdminAndRegister(
    showAdminAndRegistrator,
    { ...searchParam }
  );

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setForm((prev) => ({
        ...prev,
        search: value,
      }));
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const { data, refetch } = getCashBoxMain(params);
  const { data: marketData } = getMarkets(showMarket, { ...searchParam });
  const { data: courierData } = getCourier(showCurier, { ...searchParam });

  useEffect(() => {
    refetch();
  }, []);

  const handleNavigateProfile = () => {
    navigate(`/user-profile/${select}`);
    setSelect(null);
    setshowAdminAndRegistrator(false);
  };

  const handleNavigate = () => {
    navigate(`/payments/cash-detail/${select}`, {
      state: {
        market: data?.data || [],
        selectedMarketId: select,
      },
    });
    setSelect(null);
    setShowMarket(false);
    setShowCurier(false);
  };
  const handleSubmit = () => {
    const data = {
      amount: Number(form.summa.replace(/\D/g, "")),
      type: form.payment,
      comment: form.comment,
    };
    cashboxSpand.mutate(
      { data },
      {
        onSuccess: () => {
          refetch();
          setSpand(false);
          setForm(initialForm);
        },
        onError: (err: any) =>
          handleApiError(err, "Pul yechishda xatolik yuz berdi"),
      }
    );
  };

  const handleSalarySubmit = () => {
    const data = {
      amount: Number(form.summa.replace(/\D/g, "")),
      type: form.payment,
      comment: form.comment,
    };

    cashboxFill.mutate(
      { data },
      {
        onSuccess: () => {
          refetch();
          setMaosh(false);
          setForm(initialForm);
        },
        onError: (err: any) =>
          handleApiError(err, "Kassaga pul qo'shishda xatolik yuz berdi"),
      }
    );
  };

  const raw = Number(data?.data?.cashbox?.balance || 0);

  return (
    <div className="px-5 mt-5 flex gap-24">
      <div>
        <h2 className="flex items-center mb-5 text-[30px] font-medium capitalize">
          {t("title")}
        </h2>
        <CashboxCard
          role={"superadmin"}
          name={data?.data?.cashbox?.user?.name}
          raw={raw}
          show={show}
          setShow={setShow}
        />

        {/* === BUTTONLAR 1 QATORDA === */}
        <div className="mt-5 flex gap-3 flex-nowrap">
          <button
            title={t("kuriyerdanOlish")}
            onClick={() => setShowCurier(true)}
            className="rounded-full cursor-pointer p-3 bg-green-500 text-white hover:bg-green-600 transition flex items-center justify-center shadow-md"
          >
            <BanknoteArrowDown size={22} />
          </button>
          <button
            title={t("marketgaTo'lash")}
            onClick={() => setShowMarket(true)}
            className="rounded-full cursor-pointer p-3 bg-blue-500 text-white hover:bg-blue-600 transition flex items-center justify-center shadow-md"
          >
            <BanknoteArrowUp size={22} />
          </button>
          <button
            title={t("kassadanSarflash")}
            onClick={() => {
              setSpand(true), setMaosh(false);
            }}
            className="rounded-full cursor-pointer p-3 bg-red-500 text-white hover:bg-red-600 transition flex items-center justify-center shadow-md"
          >
            <CircleMinus size={22} />
          </button>
          <button
            title={t("kassaniTo'ldirish")}
            onClick={() => {
              setMaosh(true), setSpand(false);
            }}
            className="rounded-full cursor-pointer p-3 bg-green-500 text-white hover:bg-green-600 transition flex items-center justify-center shadow-md"
          >
            <CirclePlus size={22} />
          </button>

          <button
            title={t("maoshTo'lash")}
            onClick={() => setshowAdminAndRegistrator(true)}
            className="rounded-full cursor-pointer p-3 bg-amber-500 text-white hover:bg-amber-600 transition flex items-center justify-center shadow-md"
          >
            <Wallet size={22} />
          </button>
        </div>

        {/* === Agar kassadan sarflash bosilsa form chiqadi === */}
        {spand && (
          <div className="mt-5">
            <h2>{t("kassadanSarflash")}</h2>
            <div className="flex gap-4 items-center mt-3">
              <input
                name={t("summa")}
                value={form.summa}
                onChange={(e) => {
                  // faqat raqamlarni olish
                  const rawValue = e.target.value.replace(/\D/g, "");
                  // formatlab chiqarish (1,000 → 10,000)
                  const formatted = new Intl.NumberFormat("uz-UZ").format(
                    Number(rawValue || 0)
                  );

                  // state-ni yangilash
                  handleChange({
                    ...e,
                    target: {
                      ...e.target,
                      name: "summa",
                      value: formatted,
                    },
                  } as any);
                }}
                type="text"
                placeholder={t("summa")}
                className="border rounded-md px-2 py-0.75 border-[#d1cfd4] outline-none hover:border-blue-400 w-[150px]"
              />
              <Select
                value={form.payment}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, payment: value }))
                }
                placeholder={t("to'lovTuri")}
                className="w-[150px]"
                options={[
                  { value: "", label: "to'lov turi", disabled: true },
                  { value: "cash", label: "cash" },
                  { value: "click", label: "click" },
                ]}
              />
            </div>
            <div className="mt-5">
              <Form>
                <Form.Item
                  name={t("comment")}
                  rules={[{ required: true, message: "Izohni kiriting!" }]}
                >
                  <TextArea
                    placeholder={t("comment")}
                    autoSize
                  />
                </Form.Item>
              </Form>

              <div className="flex gap-5">
                <button
                  onClick={() => handleSubmit()}
                  className="mt-5 bg-[#9D70FF] py-1.5 px-3 rounded-md hover:bg-[#9d70ffe0] text-white"
                >
                  {t("qabulQilish")}
                </button>
                <button
                  onClick={() => setSpand(false)}
                  className="mt-5 bg-white py-1.5 px-3 rounded-md hover:text-[#9d70ffe0] text-[#9D70FF] border"
                >
                  {t("bekorQilish")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === kassani to'ldirishni bosganda === */}
        {kassa && (
          <div className="mt-5">
            <h2>{t("kassagaQo'shish")}</h2>
            <div className="flex gap-4 items-center mt-3">
              <input
                name={t("summa")}
                value={form.summa}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, "");
                  const formatted = new Intl.NumberFormat("uz-UZ").format(
                    Number(rawValue || 0)
                  );

                  handleChange({
                    ...e,
                    target: {
                      ...e.target,
                      name: "summa",
                      value: formatted,
                    },
                  } as any);
                }}
                type="text"
                placeholder="summa"
                className="border rounded-md px-2 py-0.75 border-[#d1cfd4] outline-none hover:border-blue-400 w-[150px]"
              />
              <Select
                value={form.payment}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, payment: value }))
                }
                placeholder="To'lov turi"
                className="w-[150px]"
                options={[
                  { value: "", label: "to'lov turi", disabled: true },
                  { value: "cash", label: `${t("cash")}` },
                  { value: "click", label: `${t("click")}` },
                ]}
              />
            </div>
            <div className="mt-5">
              <Form>
                <Form.Item
                  name="comment"
                  rules={[
                    { required: true, message: "Izoh kiritish majburiy!" },
                  ]}
                >
                  <TextArea placeholder={`${t("comment")}...`} autoSize />
                </Form.Item>
              </Form>

              <div className="flex gap-5">
                <button
                  onClick={() => handleSalarySubmit()}
                  className="mt-5 bg-[#9D70FF] py-1.5 px-3 rounded-md hover:bg-[#9d70ffe0] text-white"
                >
                  {t("qabulQilish")}
                </button>
                <button
                  onClick={() => setMaosh(false)}
                  className="mt-5 bg-white py-1.5 px-3 rounded-md hover:text-[#9d70ffe0] text-[#9D70FF] border"
                >
                  {t("bekorQilish")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === FILTERS & HISTORY === */}
      <div className="w-full">
        <div className="flex flex-row items-center gap-7">
          <h2 className="text-[20px] font-medium mb-2">{t("filters")}:</h2>
          <div className="w-full flex justify-between">
            <div className="flex gap-5">
              <RangePicker
                value={[
                  form.from ? dayjs(form.from) : null,
                  form.to ? dayjs(form.to) : null,
                ]}
                onChange={(dates) => {
                  setForm((prev) => ({
                    ...prev,
                    from: dates?.[0] ? dates[0].format("YYYY-MM-DD") : "",
                    to: dates?.[1] ? dates[1].format("YYYY-MM-DD") : "",
                  }));
                }}
                placeholder={["From", "To"]}
                format="YYYY-MM-DD"
                separator={
                  <span className="mx-2 text-xl flex items-center">→</span>
                }
                className="w-[340px] border border-[#E5E7EB] rounded-lg px-5 py-[6px] outline-none"
              />
            </div>
          </div>
        </div>
        <div className="">
          <CashboxHistory
            form={form}
            income={data?.data?.income}
            outcome={data?.data?.outcome}
            cashboxHistory={data?.data?.cashboxHistory}
          />
        </div>
      </div>

      {/* === POPUP MARKET === */}
      <Popup isShow={showMarket} onClose={() => setShowMarket(false)}>
        <div className="bg-white rounded-md w-[700px] h-[700px] px-6 dark:bg-[#28243d] relative">
          <button
            onClick={() => setShowMarket(false)}
            className="cursor-pointer text-red-500 p-2 absolute right-4 top-2 flex items-center justify-center"
          >
            <X size={30} />
          </button>
          <h1 className="font-bold text-left pt-10">{t("berilishiKerak")}</h1>
          <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
            <input
              defaultValue={form.search}
              onChange={handleSearchChange}
              type="text"
              placeholder={`${t("search")}...`}
              className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
            />
            <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full border-collapse border-4 border-[#f4f5fa] dark:border-[#2E263DB2] mt-4 cursor-pointer">
              <thead className="dark:bg-[#3d3759] bg-[#F6F7FB]">
                <tr>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    # ID
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    {t("marketName")}
                  </th>
                </tr>
              </thead>
              <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F]">
                {
                  // Array.isArray(marketData?.data?.items) &&
                  marketData?.data?.data?.map((item: any, inx: number) => (
                    <tr
                      key={item?.id}
                      onClick={() => setSelect(item?.id)}
                      className={`border-b-2 border-[#f4f5fa] dark:border-[#E7E3FCB2] text-[15px] font-normal ${
                        item.id == select ? "bg-gray-100" : ""
                      }`}
                    >
                      <td className="text-[#8C57FF] py-3 pl-5">{inx + 1}</td>
                      <td className="py-3 pl-5">{item?.name}salom</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          <div className="absolute bottom-4 right-4">
            <button
              disabled={!select ? true : false}
              onClick={() => handleNavigate()}
              className={`px-6 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700${
                !select ? "" : "hover:bg-blue-600"
              }  text-white rounded-md cursor-pointer ${
                !select ? "opacity-40" : ""
              }`}
            >
              {t("tanlash")}
            </button>
          </div>
        </div>
      </Popup>

      <Popup
        isShow={showAdminAndRegistrator}
        onClose={() => setshowAdminAndRegistrator(false)}
      >
        <div className="bg-white rounded-md w-[700px] h-[700px] px-6 dark:bg-[#28243d] relative pt-5">
          <button
            onClick={() => setshowAdminAndRegistrator(false)}
            className="cursor-pointer hover:bg-gray-200 text-red-500 p-2 rounded flex items-center justify-center absolute top-2 right-2"
          >
            <X size={22} />
          </button>
          <h1 className="font-bold text-left">{t("hodimniTanlang")}</h1>
          <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
            <input
              defaultValue={form.search}
              onChange={handleSearchChange}
              type="text"
              placeholder={`${t("search")}...`}
              className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
            />
            <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full border-collapse border-4 border-[#f4f5fa] dark:border-[#2E263DB2] mt-4 cursor-pointer">
              <thead className="dark:bg-[#3d3759] bg-[#F6F7FB]">
                <tr>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    #
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    {t("hodimName")}
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    {t("rol")}
                  </th>
                </tr>
              </thead>
              <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F]">
                {
                  // Array.isArray(marketData?.data?.items) &&
                  adminAndRegisterData?.data?.data?.map(
                    (item: any, inx: number) => (
                      <tr
                        key={item?.id}
                        onClick={() => setSelect(item?.id)}
                        className={`border-b-2 border-[#f4f5fa] dark:border-[#E7E3FCB2] text-[15px] font-normal ${
                          item.id == select ? "bg-gray-100" : ""
                        }`}
                      >
                        <td className="text-[#8C57FF] pl-4 py-3">{inx + 1}</td>
                        <td className="py-3 pl-4">{item?.name}</td>
                        <td className="py-3 pl-4">{item?.role}</td>
                      </tr>
                    )
                  )
                }
              </tbody>
            </table>
          </div>
          <div className="py-2 text-right">
            <button
              disabled={!select}
              onClick={() => handleNavigateProfile()}
              className={`px-3 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 absolute bottom-3 right-3 ${
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

      {/* === POPUP CURIER === */}
      <Popup isShow={showCurier} onClose={() => setShowCurier(false)}>
        <div className="bg-white rounded-md w-[700px] h-[700px] px-6 dark:bg-[#28243d] relative">
          <button
            onClick={() => setShowCurier(false)}
            className="cursor-pointer text-red-500 p-2 absolute right-4 top-2 flex items-center justify-center"
          >
            <X size={30} />
          </button>
          <h1 className="font-bold text-left pt-10">{t("olinishiKerak")}</h1>
          <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
            <input
              defaultValue={form.search}
              onChange={handleSearchChange}
              type="text"
              placeholder={`${t("search")}`}
              className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
            />
            <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full border-collapse border-4 border-[#f4f5fa] dark:border-[#2E263DB2] mt-4">
              <thead className="dark:bg-[#3d3759] bg-[#F6F7FB]">
                <tr>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    # ID
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    {t("courierName")}
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    {t("region")}
                  </th>
                </tr>
              </thead>
              <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F]">
                {courierData?.data.map((item: any, inx: number) => (
                  <tr
                    key={inx}
                    onClick={() => setSelect(item?.id)}
                    className={`border-b-2 border-[#f4f5fa] dark:border-[#E7E3FCB2] text-[15px] font-normal ${
                      item.id == select ? "bg-gray-100" : ""
                    }`}
                  >
                    <td className="text-[#8C57FF] pr-10 py-3 pl-5">{inx + 1}</td>
                    <td className="py-3 pl-5">{item?.name}</td>
                    <td className="py-3 pl-5">{item?.region?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="absolute bottom-4 right-4">
            <button
              disabled={!select ? true : false}
              onClick={() => handleNavigate()}
              className={`px-6 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700${
                !select ? "" : "hover:bg-blue-600"
              }  text-white rounded-md cursor-pointer ${
                !select ? "opacity-40" : ""
              }`}
            >
              {t("tanlash")}
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(MainDetail);
