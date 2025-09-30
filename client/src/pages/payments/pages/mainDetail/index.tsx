import { memo, useEffect, useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../shared/api";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";

const { RangePicker } = DatePicker;

const MainDetail = () => {
  const [showMarket, setShowMarket] = useState(false);
  const [showCurier, setShowCurier] = useState(false);
  const [spand, setSpand] = useState(false);
  const [select, setSelect] = useState(null);
  const [kassa, setMaosh] = useState(false);

  const navigate = useNavigate();
  const client = useQueryClient();

  const [form, setForm] = useState({
    from: "",
    to: "",
    order: "",
    payment: "",
    summa: "",
    market: "",
    comment: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const [show, setShow] = useState(true);
  const { getMarkets } = useMarket();
  const { getCourier } = useCourier();
  const { getCashBoxMain, cashboxSpand } = useCashBox();

  const { data, refetch } = getCashBoxMain();
  const { data: marketData } = getMarkets(showMarket);
  const { data: courierData } = getCourier(showCurier);

  useEffect(() => {
    refetch();
  }, []);

  const cashboxFill = useMutation({
    mutationFn: ({ data }: { data: any }) => api.patch(`cashbox/fill`, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["cashbox"] });
    },
  });

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
  const { handleApiError } = useApiNotification();
  const handleSubmit = () => {
    const data = {
      amount: Number(form.summa),
      type: form.payment,
      comment: form.comment,
    };
    cashboxSpand.mutate(
      { data },
      {
        onSuccess: () => {
          refetch();
        },
        onError: (err: any) =>
          handleApiError(
            err,
            "Pul yechishda xatolik yuz berdi"
          ),
      }
    );
  };

  const handleSalarySubmit = () => {
    const data = {
      amount: Number(form.summa),
      type: form.payment,
      comment: form.comment,
    };

    cashboxFill.mutate(
      { data },
      {
        onSuccess: () => {
          refetch();
          setMaosh(false);
          setForm({
            from: "",
            to: "",
            order: "",
            payment: "",
            summa: "",
            market: "",
            comment: "",
          });
        },
        onError: (err: any) =>
          handleApiError(
            err,
            "Kassaga pul qo'shishda xatolik yuz berdi"
          ),
      }
    );
  };

  const raw = Number(data?.data?.cashbox?.balance || 0);

  return (
    <div className="px-5 mt-5 flex gap-24">
      <div>
        <h2 className="flex items-center mb-5 text-[30px] font-medium capitalize">
          Asosiy kassa
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
            title="Kuriyerdan olish"
            onClick={() => setShowCurier(true)}
            className="rounded-full cursor-pointer p-3 bg-green-500 text-white hover:bg-green-600 transition flex items-center justify-center shadow-md"
          >
            <BanknoteArrowDown size={22} />
          </button>
          <button
            title="Marketga to'lash"
            onClick={() => setShowMarket(true)}
            className="rounded-full cursor-pointer p-3 bg-blue-500 text-white hover:bg-blue-600 transition flex items-center justify-center shadow-md"
          >
            <BanknoteArrowUp size={22} />
          </button>
          <button
            title="Kassadan sarflash"
            onClick={() => setSpand(true)}
            className="rounded-full cursor-pointer p-3 bg-red-500 text-white hover:bg-red-600 transition flex items-center justify-center shadow-md"
          >
            <CircleMinus size={22} />
          </button>
          <button
            title="Kassani to'ldirish"
            onClick={() => setMaosh(true)}
            className="rounded-full cursor-pointer p-3 bg-green-500 text-white hover:bg-green-600 transition flex items-center justify-center shadow-md"
          >
            <CirclePlus size={22} />
          </button>

          <button
            title="Maosh to'lash"
            onClick={() => setShowCurier(true)}
            className="rounded-full cursor-pointer p-3 bg-amber-500 text-white hover:bg-amber-600 transition flex items-center justify-center shadow-md"
          >
            <Wallet size={22} />
          </button>
        </div>

        {/* === Agar kassadan sarflash bosilsa form chiqadi === */}
        {spand && (
          <div className="mt-5">
            <h2>Kassadan Sarflash</h2>
            <div className="flex gap-4 items-center mt-3">
              <input
                name="summa"
                value={form.summa}
                onChange={handleChange}
                className="border rounded-md px-2 py-0.75 border-[#d1cfd4] outline-none hover:border-blue-400 w-[150px]"
                type="number"
                placeholder="summa"
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
                  { value: "cash", label: "cash" },
                  { value: "click", label: "click" },
                ]}
              />
            </div>
            <div className="mt-5">
              <Form.Item
                name="comment"
                rules={[{ required: true, message: "Izohni kiriting!" }]}
              >
                <TextArea
                  placeholder="Autosize height based on content lines"
                  autoSize
                />
              </Form.Item>

              <div className="flex gap-5">
                <button
                  onClick={() => handleSubmit()}
                  className="mt-5 bg-[#9D70FF] py-1.5 px-3 rounded-md hover:bg-[#9d70ffe0] text-white"
                >
                  Qabul qilish
                </button>
                <button
                  onClick={() => setSpand(false)}
                  className="mt-5 bg-white py-1.5 px-3 rounded-md hover:text-[#9d70ffe0] text-[#9D70FF] border"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === kassani to'ldirishni bosganda === */}
        {kassa && (
          <div className="mt-5">
            <h2>Maosh to'lash</h2>
            <div className="flex gap-4 items-center mt-3">
              <input
                name="summa"
                value={form.summa}
                onChange={handleChange}
                className="border rounded-md px-2 py-0.75 border-[#d1cfd4] outline-none hover:border-blue-400 w-[150px]"
                type="number"
                placeholder="summa"
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
                  { value: "cash", label: "cash" },
                  { value: "click", label: "click" },
                ]}
              />
            </div>
            <div className="mt-5">
              <Form.Item
                name="comment"
                rules={[{ required: true, message: "Izoh kiritish majburiy!" }]}
              >
                <TextArea placeholder="Izoh..." autoSize />
              </Form.Item>

              <div className="flex gap-5">
                <button
                  onClick={() => handleSalarySubmit()}
                  className="mt-5 bg-[#9D70FF] py-1.5 px-3 rounded-md hover:bg-[#9d70ffe0] text-white"
                >
                  Qabul qilish
                </button>
                <button
                  onClick={() => setMaosh(false)}
                  className="mt-5 bg-white py-1.5 px-3 rounded-md hover:text-[#9d70ffe0] text-[#9D70FF] border"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === FILTERS & HISTORY === */}
      <div className="w-full">
        <div className="flex flex-row items-center gap-7">
          <h2 className="text-[20px] font-medium mb-2">Filters:</h2>
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
        <div className="bg-white rounded-md w-[700px] h-[700px] px-6 dark:bg-[#28243d]">
          <button
            onClick={() => setShowMarket(false)}
            className="cursor-pointer hover:bg-red-700 text-white p-2 rounded flex items-center justify-center shadow-md"
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
            <table className="w-full border-collapse border-4 border-[#f4f5fa] dark:border-[#2E263DB2] mt-4 cursor-pointer">
              <thead className="dark:bg-[#3d3759] bg-[#F6F7FB]">
                <tr>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    # ID
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    MARKET NAME
                  </th>
                </tr>
              </thead>
              <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F]">
                {Array.isArray(marketData?.data?.items) &&
                  marketData.data.items.map((item: any, inx: number) => (
                    <tr
                      key={item?.id}
                      onClick={() => setSelect(item?.id)}
                      className={`border-b-2 border-[#f4f5fa] dark:border-[#E7E3FCB2] text-[15px] font-normal ${
                        item.id == select ? "bg-gray-100" : ""
                      }`}
                    >
                      <td className="text-[#8C57FF] pr-10 py-3">{inx + 1}</td>
                      <td className="py-3">{item?.name}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="py-2 text-right">
            <button
              disabled={!select}
              onClick={() => handleNavigate()}
              className={`px-3 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 ${
                !select ? "" : "hover:bg-blue-600"
              } text-white rounded-md cursor-pointer ${
                !select ? "opacity-40" : ""
              }`}
            >
              Selected
            </button>
          </div>
        </div>
      </Popup>

      {/* === POPUP CURIER === */}
      <Popup isShow={showCurier} onClose={() => setShowCurier(false)}>
        <div className="bg-white rounded-md w-[700px] h-[700px] px-6 dark:bg-[#28243d]">
          <button
            onClick={() => setShowCurier(false)}
            className="cursor-pointer bg-red-600 hover:bg-red-700 text-white p-2 rounded flex items-center justify-center shadow-md"
          >
            <X size={18} />
          </button>
          <h1 className="font-bold text-left">Olinishi kerak</h1>
          <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
            <input
              type="text"
              placeholder="Search order..."
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
                    COURIER NAME
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    REGION
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
                    <td className="text-[#8C57FF] pr-10 py-3">{inx + 1}</td>
                    <td className="py-3">{item?.name}</td>
                    <td className="py-3">{item?.region?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="py-2 text-right">
            <button
              onClick={() => handleNavigate()}
              className="px-3 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 hover:bg-blue-600 text-white rounded-md cursor-pointer"
            >
              Selected
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(MainDetail);
