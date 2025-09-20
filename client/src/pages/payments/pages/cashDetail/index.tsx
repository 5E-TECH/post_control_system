import { memo, useState } from "react";
import { useParams } from "react-router-dom";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import { ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { Select } from "antd";
import TextArea from "antd/es/input/TextArea";
import { CashboxCard } from "../../components/CashCard";
import { CashboxHistory } from "../../components/paymentHistory";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";

const CashDetail = () => {
  const { id } = useParams();

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

  const [show, setShow] = useState(true);

  const { getCashBoxById, createPaymentMarket, createPaymentCourier } =
    useCashBox();

  const { getMarkets } = useMarket();

  const { data, refetch } = getCashBoxById(id);
  const { data: marketData } = getMarkets(form.payment == "click_to_market" ? true : false);

  const handleSubmit = () => {
    const dataCourier = {
      courier_id: id,
      amount: Number(form.summa),
      payment_method: form.payment,
      payment_date: new Date().toISOString(),
      comment: form.comment,
      market_id: form.market || null,
    };
    const dataMarket = {
      market_id: id,
      amount: Number(form.summa),
      payment_method: form.payment,
      payment_date: new Date().toISOString(),
      comment: form.comment,
    };
    if (data?.data?.cashbox?.user?.role === "market") {
      createPaymentMarket.mutate(dataMarket, {
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
        onError: (err) => {
          console.log(err);
        },
      });
    } else {
      // Courier bo‘lsa
      createPaymentCourier.mutate(dataCourier, {
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
    }
  };

  useEffect(() => {
    refetch();
  }, [id]);

  const raw = Number(data?.data?.cashbox?.balance || 0);

  return (
    <div className="px-5 mt-5 flex gap-24">
      <div>
        <h2 className="flex items-center mb-5 text-[20px] capitalize">
          {data?.data?.cashbox?.user?.role} <ChevronRight />
          <span className="text-[22px] font-bold">
            {data?.data?.cashbox?.user?.name}
          </span>
        </h2>
        <CashboxCard
          role={"market"}
          name={data?.data?.cashbox?.user?.name}
          raw={raw}
          show={show}
          setShow={setShow}
        />
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
                ...(data?.data?.cashbox?.user?.role === "market"
                  ? []
                  : [{ value: "click_to_market", label: "click_to_market" }]),
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
                  ...(marketData?.data?.map((item: any) => ({
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
            <button
              onClick={() => handleSubmit()}
              className="mt-5 bg-[#9D70FF] py-1.5 px-3 rounded-md hover:bg-[#9d70ffe0]"
            >
              Qabul qilish
            </button>
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
    </div>
  );
};

export default memo(CashDetail);
