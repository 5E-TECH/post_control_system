import { memo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import { DatePicker } from "antd";
import { CashboxCard } from "../../components/CashCard";
import { CashboxHistory } from "../../components/paymentHistory";
import dayjs from "dayjs";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import { useTranslation } from "react-i18next";
import CustomCalendar from "../../../../shared/components/customDate";
import { Wallet, Clock, X } from "lucide-react";

const { RangePicker } = DatePicker;

const CashDetailMarketCourier = () => {
  const { t } = useTranslation("payment");
  const { id } = useParams();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  useEffect(() => {
    if (form.payment != "click_to_market") {
      setForm((prev) => ({ ...prev, market: "" }));
    }
  }, [form.payment]);

  const [show, setShow] = useState(true);

  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;
  const { getCashboxMyCashbox } = useCashBox();

  const { data, refetch } = getCashboxMyCashbox(params);

  useEffect(() => {
    if (role === "superadmin" || role === "admin") {
      refetch();
    }
  }, [id]);

  const raw = Number(data?.data?.myCashbox?.balance || 0);

  return (
    <div className="bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] px-4 sm:px-6 py-6">
      <div className="max-w-screen-2xl mx-auto flex gap-8 lg:gap-16 max-lg:flex-col">
        {/* Left Section - Card */}
        <div className="lg:max-w-[520px] w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                {t("cashbox")}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {role === "market" ? "Market kassasi" : "Kuryer kassasi"}
              </p>
            </div>
          </div>

          <CashboxCard
            role={role === "market" ? "market" : "courier"}
            name={data?.data?.myCashbox?.user?.name}
            raw={raw}
            show={show}
            setShow={setShow}
          />
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

export default memo(CashDetailMarketCourier);
