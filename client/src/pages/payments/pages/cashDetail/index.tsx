import { memo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
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
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import type { AxiosError } from "axios";
import CustomCalendar from "../../../../shared/components/customDate";
import {
  ChevronLeft,
  Loader2,
  Wallet,
  Clock,
  X,
  BanknoteArrowUp,
  BanknoteArrowDown,
  Send
} from "lucide-react";

const { RangePicker } = DatePicker;

const CashDetail = () => {
  const { t } = useTranslation("payment");
  const { id } = useParams();
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

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [search, setSearch] = useState("");

  const params = {
    fromDate: form.from,
    toDate: form.to,
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "summa") {
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
  const { data: marketData } = getMarkets(form.payment == "click_to_market", {
    search,
    limit: 0,
  });

  const debouncedSearch = debounce((value: string) => {
    setSearch(value);
  }, 500);

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
        onError: (error) => {
          const err = error as AxiosError<{ error?: { message?: string } }>;
          const msg =
            err.response?.data?.error?.message || "Xatolik yuz berdi!";
          handleApiError(err, `${msg}`);
        },
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
        onError: (error) => {
          const err = error as AxiosError<{ error?: { message?: string } }>;
          const msg =
            err.response?.data?.error?.message || "Xatolik yuz berdi!";
          handleApiError(err, `${msg}`);
        },
      });
    }
  };

  useEffect(() => {
    if (role === "superadmin" || role === "admin") {
      refetch();
    }
  }, [id]);

  const raw = Number(data?.data?.cashbox?.balance || 0);
  const isMarket = data?.data?.cashbox?.user?.role === "market";

  return (
    <div className="bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] px-4 sm:px-6 py-6">
      <div className="max-w-screen-2xl mx-auto flex gap-8 lg:gap-16 max-lg:flex-col">
        {/* Left Section - Card & Payment Form */}
        <div className="lg:max-w-[520px] w-full">
          {/* Header with back button */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-[#312D4B] transition-all cursor-pointer"
            >
              <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                {data?.data?.cashbox?.user?.name || t("cashbox")}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isMarket ? "Market kassasi" : "Kuryer kassasi"}
              </p>
            </div>
          </div>

          <CashboxCard
            role={isMarket ? "market" : "courier"}
            name={data?.data?.cashbox?.user?.name}
            raw={raw}
            show={show}
            setShow={setShow}
          />

          {/* Payment Form - Modern Design */}
          {user?.role === "courier" || user?.role === "market" ? null : (
            <div className="mt-6 bg-white dark:bg-[#2A263D] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              {/* Form Header */}
              <div className={`px-5 py-4 ${isMarket
                ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                : "bg-gradient-to-r from-emerald-500 to-teal-500"
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    {isMarket ? (
                      <BanknoteArrowUp size={20} className="text-white" />
                    ) : (
                      <BanknoteArrowDown size={20} className="text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">
                      {isMarket ? t("to'lash") : t("qabulQilish")}
                    </h3>
                    <p className="text-xs text-white/70">
                      {isMarket ? "Marketga to'lov" : "Kuryerdan qabul qilish"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Body */}
              <div className="p-5 space-y-4">
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t("summa")} <span className={isMarket ? "text-blue-500" : "text-emerald-500"}>*</span>
                  </label>
                  <div className="relative">
                    <input
                      name="summa"
                      value={
                        form.summa
                          ? new Intl.NumberFormat("uz-UZ").format(Number(form.summa))
                          : ""
                      }
                      onChange={handleChange}
                      type="text"
                      placeholder="0"
                      className={`w-full px-4 py-3 pr-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] outline-none transition-all text-lg font-semibold ${
                        isMarket
                          ? "focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30"
                          : "focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/30"
                      }`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                      UZS
                    </span>
                  </div>
                </div>

                {/* Payment Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t("paymentType")} <span className={isMarket ? "text-blue-500" : "text-emerald-500"}>*</span>
                  </label>
                  <Select
                    value={form.payment || undefined}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, payment: value }))
                    }
                    placeholder={t("paymentType")}
                    className="w-full !h-12 [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-2 [&_.ant-select-selector]:!border-gray-200 dark:[&_.ant-select-selector]:!border-gray-700 [&_.ant-select-selector]:!bg-gray-50 dark:[&_.ant-select-selector]:!bg-[#312D4B]"
                    size="large"
                    options={[
                      { value: "cash", label: `💵 ${t("cash")}` },
                      { value: "click", label: `💳 ${t("click")}` },
                      ...(!isMarket
                        ? [{ value: "click_to_market", label: `🏪 ${t("click_to_market")}` }]
                        : []),
                    ]}
                  />
                </div>

                {/* Market Select (for click_to_market) */}
                {form.payment === "click_to_market" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {t("marketniTanlang")} <span className="text-emerald-500">*</span>
                    </label>
                    <Select
                      showSearch
                      filterOption={false}
                      onSearch={debouncedSearch}
                      value={form.market || undefined}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, market: value }))
                      }
                      placeholder={t("marketniTanlang")}
                      className="w-full !h-12 [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-2 [&_.ant-select-selector]:!border-gray-200 dark:[&_.ant-select-selector]:!border-gray-700 [&_.ant-select-selector]:!bg-gray-50 dark:[&_.ant-select-selector]:!bg-[#312D4B]"
                      size="large"
                      options={
                        marketData?.data?.data?.map((item: any) => ({
                          value: item.id,
                          label: item.name,
                        })) || []
                      }
                    />
                  </div>
                )}

                {/* Comment */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t("comment")}
                  </label>
                  <TextArea
                    name="comment"
                    value={form.comment}
                    onChange={handleChange}
                    placeholder={`${t("comment")}...`}
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    className="!rounded-xl !border-2 !border-gray-200 dark:!border-gray-700 !bg-gray-50 dark:!bg-[#312D4B] dark:!text-white"
                  />
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={
                    createPaymentMarket.isPending ||
                    createPaymentCourier.isPending ||
                    !form.payment ||
                    (form.payment === "click_to_market" && !form.market) ||
                    !form.summa ||
                    Number(form.summa.replace(/\s/g, "")) <= 0
                  }
                  className={`w-full py-3 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isMarket
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-blue-500/30"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/30"
                  }`}
                >
                  {createPaymentMarket.isPending || createPaymentCourier.isPending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Yuklanmoqda...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>{isMarket ? t("to'lash") : t("qabulQilish")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Section - Filters & History */}
        <div className="w-full lg:flex-1">
          {/* Modern Filter Card */}
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-5 mb-6">
            {/* Header with date info */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Clock size={18} className="text-white" />
                </div>
                <div>
                  {form.from === "" ? (
                    <>
                      <h3 className="font-bold text-gray-800 dark:text-white">{t("today")}</h3>
                      <p className="text-xs text-gray-400">Bugungi operatsiyalar</p>
                    </>
                  ) : form.from === form.to ? (
                    <>
                      <h3 className="font-bold text-gray-800 dark:text-white">{form.from}</h3>
                      <p className="text-xs text-gray-400">{t("day")} operatsiyalari</p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-bold text-gray-800 dark:text-white">
                        {form.from} - {form.to}
                      </h3>
                      <p className="text-xs text-gray-400">{t("o'tkazmalar")}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                {isMobile ? (
                  <CustomCalendar
                    from={form.from ? dayjs(form.from) : null}
                    to={form.to ? dayjs(form.to) : null}
                    setFrom={(date: any) =>
                      setForm((prev) => ({
                        ...prev,
                        from: date.format("YYYY-MM-DD"),
                      }))
                    }
                    setTo={(date: any) =>
                      setForm((prev) => ({
                        ...prev,
                        to: date.format("YYYY-MM-DD"),
                      }))
                    }
                  />
                ) : (
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
                    placeholder={[`${t("start")}`, `${t("end")}`]}
                    format="YYYY-MM-DD"
                    size="large"
                    className="w-full !rounded-xl !border-gray-200 dark:!border-gray-700 hover:!border-purple-400 focus:!border-purple-500"
                  />
                )}
              </div>
              {(form.from || form.to) && (
                <button
                  onClick={() => setForm((prev) => ({ ...prev, from: "", to: "" }))}
                  className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* History Section */}
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
