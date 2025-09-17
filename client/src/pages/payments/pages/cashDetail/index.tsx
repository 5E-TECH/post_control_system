import { memo, useState } from "react";
// import chip from "../../../../shared/assets/payments/chip.svg";
// import { ArrowLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import logo from "../../../../shared/assets/logo.svg";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import CountUp from "react-countup";
// import { Button } from "antd";
import { useEffect } from "react";
import { Select } from "antd";
import TextArea from "antd/es/input/TextArea";

const CashDetail = () => {
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

  useEffect(() => {
    if (form.payment != "click_to_market") {
      setForm((prev) => ({ ...prev, market: "" }));
    }
  }, [form.payment]);

  const location = useLocation();
  const market = location.state;

  const [show, setShow] = useState(true);

  const { getCashBoxById, createPaymentCourier } = useCashBox();
  const { data, refetch } = getCashBoxById(market.id);

  const handleSubmit = () => {
    const data = {
      courier_id: market?.id, // yoki data?.data?.cashbox?.user?.id bo'lishi mumkin
      amount: Number(form.summa),
      payment_method: form.payment,
      payment_date: new Date().toISOString(), // hozirgi vaqt
      comment: form.comment,
      market_id: form.market || null, // click_to_market bo‘lsa keladi
    };

    createPaymentCourier.mutate(data, {
      onSuccess: () => {
        setForm({
          from: "",
          to: "",
          order: "",
          payment: "",
          summa: "",
          market: "",
          comment: "",
        });

        refetch();
      },
    });
  };

  useEffect(() => {
    refetch();
  }, []);

  const raw = Number(data?.data?.cashbox?.balance || 0);

  return (
    <div className="px-5 mt-5 flex gap-24">
      <div>
        <h2 className="text-[20px] mb-5 flex items-center">
          {market.role === "market" ? "Market" : "Courier"} <ChevronRight />{" "}
          <span className="text-[22px] font-bold">
            {data?.data?.cashbox?.user?.name}
          </span>
        </h2>

        <div className="w-[500px] h-[250px] px-6 py-6 text-2xl flex flex-col rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white justify-between relative">
          <div className="flex gap-3">
            <img src={logo} alt="" />
            <h1 className="font-medium text-[20px]">BEEPOST</h1>
          </div>

          <div className="flex flex-col">
            <div>
              <h2 className="text-[15px] text-[#ede8ff88]">Виртуалний счет</h2>
            </div>
            <div>
              <h2 className="font-bold text-[25px] text-[#ede8ff88]">
                1234 5678 8765 4321
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-[40px] font-medium w-[300px]">
              {show ? (
                <CountUp end={raw} duration={1.0} separator=" " suffix=" UZS" />
              ) : (
                "●●●●●●● UZS"
              )}
            </p>

            <button
              onClick={() => setShow((prev: boolean) => !prev)}
              className="ml-2 p-2 rounded-full hover:bg-white/10"
              aria-label={show ? "Hide balance" : "Show balance"}
              title={show ? "Hide balance" : "Show balance"}
            >
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </div>
        {market.role != "market" && (
          <div className="mt-5">
            <h2>Qabul qilish (to'lash) </h2>
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
                  { value: "click_to_market", label: "click_to_market" },
                ]}
              />
              {form.payment == "click_to_market" && (
                <Select
                  value={form.market}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, market: value }))
                  }
                  placeholder="Kassani tanlang"
                  className="w-[150px]"
                  options={[
                    { value: "", label: "Market tanlang", disabled: true },
                    ...(market?.data?.data?.map((item: any) => ({
                      value: item.id,
                      label: item.name,
                    })) || []),
                  ]}
                />
              )}
            </div>
            <div className="mt-5">
              <TextArea
                name="comment"
                value={form.comment}
                onChange={handleChange}
                placeholder="Autosize height based on content lines"
                autoSize
              />
              <button onClick={() => handleSubmit()} className="mt-5 bg-[#9D70FF] py-1.5 px-3 rounded-md hover:bg-[#9d70ffe0]">
                Qabul qilish
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-[50%]">
        <div className="flex flex-row  items-center gap-7">
          <h2 className="text-[20px] font-medium mb-2">Filters:</h2>

          <div className="w-full flex justify-between">
            <div className="flex gap-5">
              <input
                type="date"
                name="from"
                value={form.from}
                onChange={handleChange}
                placeholder="From"
                className="w-[150px] border border-[#E5E7EB] rounded-lg px-3 py-[10px] outline-none"
              />

              <input
                type="date"
                name="to"
                value={form.to}
                onChange={handleChange}
                placeholder="To"
                className="w-[180px] border border-[#E5E7EB] rounded-lg px-3 py-[10px] outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-5 mt-10 justify-between">
          <div className="bg-[#0688221A] px-6 py-5 w-[50%]">
            <strong className="text-[#068822] dark:text-green-500 text-[20px]">
              + {data?.data?.income} UZS
            </strong>
          </div>
          <div className="bg-[#B80D0D1A] px-6 py-5 w-[50%]">
            <strong className="text-[#B80D0D] dark:text-red-500 text-[20px]">
              - {data?.data?.outcome} UZS
            </strong>
          </div>
        </div>

        <div className="h-[520px] mt-5 px-8 py-4 bg-[#ede8ff] dark:bg-[#3D3759] shadow-md rounded-lg overflow-y-auto">
          {data?.data?.cashboxHistory &&
            data?.data?.cashboxHistory.map((item: any, inx: number) => (
              <div
                key={inx}
                className="flex gap-20 mb-3 border-b  border-gray-300 justify-between "
              >
                <div>
                  <h3 className="text-[25px] font-medium">
                    {data?.data?.cashbox?.user?.name}
                  </h3>
                  <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                    <p>16.01.2020</p>
                    <p>16:20</p>
                  </div>
                </div>
                <div>
                  <strong className={`text-[#068822] dark:text-green-500 text-[25px] ${item?.operation_type == "expense" ? "text-red-500" : ""}`}>
                    {item?.operation_type == "expense" ? "-" : "+"} {item?.amount}
                  </strong>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default memo(CashDetail);
