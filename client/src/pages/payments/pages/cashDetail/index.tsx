import { memo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import { ChevronRight } from "lucide-react";
import { Select, DatePicker } from "antd";
import TextArea from "antd/es/input/TextArea";
import { CashboxCard } from "../../components/CashCard";
import { CashboxHistory } from "../../components/paymentHistory";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";
import dayjs from "dayjs";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { useTranslation } from "react-i18next";

const { RangePicker } = DatePicker;

const CashDetail = () => {
  const { t } = useTranslation("payment");
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

  const params = {
    fromDate: form.from,
    toDate: form.to,
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "summa") {
      // faqat raqamlarni qoldiramiz
      const numericValue = value.replace(/\D/g, "");
      setForm((prev) => ({ ...prev, summa: numericValue }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  useEffect(() => {
    if (form.payment != "click_to_market") {
      setForm((prev) => ({ ...prev, market: "" }));
    }
  }, [form.payment]);

  const [show, setShow] = useState(true);

  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;
  const { getCashBoxById, createPaymentMarket, createPaymentCourier } =
    useCashBox();
  const { getMarkets } = useMarket();

  const { data, refetch } = getCashBoxById(
    id,
    role === "superadmin" || role === "admin",
    params
  );
  const { data: marketData } = getMarkets(
    form.payment == "click_to_market" ? true : false
  );

  const { handleApiError } = useApiNotification();
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
        onError: (err) =>
          handleApiError(err, "To'lov yaratishda xatolik yuz berdi"),
      });
    } else {
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
        onError: (err) =>
          handleApiError(err, "To'lov yaratishda xatolik yuz berdi"),
      });
    }
  };

  useEffect(() => {
    if (role === "superadmin" || role === "admin") {
      refetch();
    }
  }, [id]);

  const raw = Number(data?.data?.cashbox?.balance || 0);

  return (
    <div className="px-5 mt-5 flex gap-24">
      <div>
        <h2 className="flex items-center mb-5 text-[20px] capitalize">
          {t(`${data?.data?.cashbox?.user?.role}`)} <ChevronRight />
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
        {user?.role === "courier" || user?.role === "market" ? null : (
          <div className="mt-5">
            <h2>
              {data?.data?.cashbox?.user?.role === "market"
                ? `${t("to'lash")}`
                : `${t("qabulQilish")}`}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] w-full gap-4 items-center mt-3">
              <input
                name="summa"
                value={
                  form.summa
                    ? new Intl.NumberFormat("uz-UZ").format(Number(form.summa))
                    : ""
                }
                onChange={handleChange}
                className="border rounded-md px-2 py-2 border-[#d1cfd4] outline-none hover:border-blue-400"
                type="text"
                placeholder={t("summa")}
              />
              <Select
                value={form.payment}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, payment: value }))
                }
                placeholder={t("to'lovTuri")}
                className="mySelect "
                size="large"
                options={[
                  {
                    value: "",
                    label: (
                      <span style={{ color: "#a0a0a0" }}>
                        {t("paymentType")}
                      </span>
                    ),
                    disabled: true,
                  },
                  { value: "cash", label: `${t("cash")}` },
                  { value: "click", label: `${t("click")}` },
                  ...(data?.data?.cashbox?.user?.role === "market"
                    ? []
                    : [
                        {
                          value: "click_to_market",
                          label: `${t("click_to_market")}`,
                        },
                      ]),
                ]}
              />
              {form.payment == "click_to_market" && (
                <Select
                  value={form.market}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, market: value }))
                  }
                  placeholder={t("marketniTanlang")}
                  className="w-[150px]"
                  options={[
                    { value: "", label: "Market tanlang", disabled: true },
                    ...(marketData?.data?.data?.map((item: any) => ({
                      value: item.id,
                      label: item.name,
                    })) || []),
                  ]}
                />
              )}
            </div>
            <div className="mt-5">
              <TextArea
                className="myTextArea"
                name="comment"
                size="large"
                value={form.comment}
                onChange={handleChange}
                placeholder={t("comment")}
                autoSize
              />
              <button
                onClick={() => handleSubmit()}
                disabled={
                  !form.payment ||
                  !form.summa ||
                  Number(form.summa.replace(/\s/g, "")) <= 0
                }
                className={`mt-5 py-1.5 px-3 rounded-md transition-colors ${
                  !form.payment ||
                  !form.summa ||
                  Number(form.summa.replace(/\s/g, "")) <= 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#9D70FF] hover:bg-[#9d70ffe0] text-white"
                }`}
              >
                {t("qabulQilish")}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="grid w-full">
        <div className="flex flex-row items-center gap-7">
          <h2 className="text-[20px] font-medium mb-2">{t("filters")}:</h2>
          <div className="w-full flex justify-between">
            <div className="flex gap-5">
              {/* RangePicker bilan custom */}
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
                size="large"
                className="w-[340px] toFROM border border-[#E5E7EB] rounded-lg px-3 py-[6px] outline-none"
              />
            </div>
          </div>
        </div>
        <div>
          <CashboxHistory
            form={form}
            income={data?.data?.income}
            outcome={data?.data?.outcome}
            cashboxHistory={data?.data?.cashboxHistory}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(CashDetail);
