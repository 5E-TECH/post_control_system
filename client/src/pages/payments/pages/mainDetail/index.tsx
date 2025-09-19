import { memo, useState } from "react";
// import chip from "../../../../shared/assets/payments/chip.svg";
// import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

// import { Button } from "antd";
import { useEffect } from "react";
import { CashboxCard } from "../../components/CashCard";
import { CashboxHistory } from "../../components/paymentHistory";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import Popup from "../../../../shared/ui/Popup";
import { Search, X } from "lucide-react";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";
import { useCourier } from "../../../../shared/api/hooks/useCourier";
import TextArea from "antd/es/input/TextArea";
import { Select } from "antd";

const MainDetail = () => {
  const [showMarket, setShowMarket] = useState(false);
  const [showCurier, setShowCurier] = useState(false);
  const [spand, setSpand] = useState(false);
  const [select, setSelect] = useState(null);

  const navigate = useNavigate();

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

  // const handleCheck = () => {
  //   console.log("Filter values:", form);
  //   // shu yerda API chaqirishingiz yoki filtrni ishlatishingiz mumkin
  // };

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
  
  const handleNavigate = () => {
    navigate(`/payments/cash-detail/${select}`, {
      state: {
        market: data?.data || [],
        selectedMarketId: select,
      },
    });
    setSelect(null);
    setShowMarket(false);
    select;
    setShowCurier(false);
  };
  
  
  const handleSubmit = () => {
    const data = {
      amount:Number(form.summa),
      type:form.payment,
      comment:form.comment
    }
    cashboxSpand.mutate({ data }, {
      onSuccess: () => {
        refetch()
      }
    })

  };

  const raw = Number(data?.data?.cashbox?.balance || 0);

  return (
    <div className="px-5 mt-5 flex gap-24">
      <div>
        <CashboxCard
          role={"superadmin"}
          name={data?.data?.cashbox?.user?.name}
          raw={raw}
          show={show}
          setShow={setShow}
        />
        <div className="mt-10">
          <div className="flex justify-around w-[80%]">
            <button
              onClick={() => setShowCurier(true)}
              className="border py-2 px-3 rounded-md text-white bg-[#9d70ff]"
            >
              Kuriyerdan olish
            </button>
            <button
              onClick={() => setShowMarket(true)}
              className="border py-2 px-3 rounded-md text-white bg-[#9d70ff]"
            >
              Marketga to'lash
            </button>
          </div>
          <div>
            <button
              onClick={() => setShowCurier(true)}
              className="border py-2 px-3 rounded-md text-white bg-[#9d70ff]"
            >
              Kuriyerdan olish
            </button>
            <button
              onClick={() => setShowMarket(true)}
              className="border py-2 px-3 rounded-md text-white bg-[#9d70ff]"
            >
              Marketga to'lash
            </button>
            <button
              onClick={() => setSpand(true)}
              className="border py-2 px-3 rounded-md text-white bg-[#9d70ff]"
            >
              Kassadan sarflash
            </button>
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
                      ...(data?.data?.cashbox?.user?.role === "market"
                        ? []
                        : [
                            {
                              value: "click_to_market",
                              label: "click_to_market",
                            },
                          ]),
                    ]}
                  />
                </div>
                <div className="mt-5">
                  <TextArea
                    name="comment"
                    value={form.comment}
                    onChange={handleChange}
                    placeholder="Autosize height based on content lines"
                    autoSize
                  />
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
          </div>
        </div>
      </div>
      <CashboxHistory
        form={form}
        handleChange={handleChange}
        income={data?.data?.income}
        outcome={data?.data?.outcome}
        cashboxHistory={data?.data?.cashboxHistory}
      />
      <Popup isShow={showMarket} onClose={() => setShowMarket(false)}>
        <div className="bg-white rounded-md w-[500px] h-[700px] px-6 dark:bg-[#28243d]">
          <button
            onClick={() => setShowMarket(false)}
            className="cursor-pointer hover:bg-red-700 text-white p-2 rounded- ml-111 flex items-center justify-center shadow-md"
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
                      # ID
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    <div className="flex items-center justify-between pr-[21px]">
                      MARKET NAME
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F]">
                {marketData?.data?.map((item: any, inx: number) => (
                  <tr
                    key={item?.id}
                    onClick={() => setSelect(item?.id)}
                    className={`border-b-2 border-[#f4f5fa] dark:border-[#E7E3FCB2] text-[15px] font-normal ${
                      item.id == select ? "bg-gray-100" : ""
                    }`}
                  >
                    <td className="text-[#8C57FF] pr-10 py-3">{inx + 1}</td>
                    <td className="pr-26 py-3">{item?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pl-89 py-2">
            <button
              disabled={!select ? true : false}
              onClick={() => handleNavigate()}
              className={`px-3 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 ${
                !select ? "" : "hover:bg-blue-600"
              }  text-white rounded-md cursor-pointer ${
                !select ? "opacity-40" : ""
              }`}
            >
              Selected
            </button>
          </div>
        </div>
      </Popup>
      <Popup isShow={showCurier} onClose={() => setShowCurier(false)}>
        <div className="bg-white rounded-md w-[500px] h-[700px] px-6 dark:bg-[#28243d]">
          <button
            onClick={() => setShowCurier(false)}
            className="cursor-pointer bg-red-600 hover:bg-red-700 text-white p-2 rounded- ml-111 flex items-center justify-center shadow-md"
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
            <table className="w-full border-collapse border-4 border-[#f4f5fa] dark:border-[#2E263DB2] mt-4 scroll-y-auto">
              <thead className="dark:bg-[#3d3759] bg-[#F6F7FB]">
                <tr>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    <div className="flex items-center justify-between pr-[21px]">
                      # ID
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
                    <td className="pr-26 py-3">{item?.name}</td>
                    <td className="pr-10 py-3">{item?.region?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pl-89 py-2">
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
