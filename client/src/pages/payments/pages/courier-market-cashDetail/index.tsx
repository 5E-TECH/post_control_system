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
    <div className="px-5 mt-5 flex gap-24 max-md:flex-col">
      <div>
        <h2 className="flex items-center mb-5 text-[25px] capitalize font-bold max-[640px]:mb-0">
          {t("cashbox")}
        </h2>
        <CashboxCard
          role={"market"}
          name={data?.data?.cashbox?.user?.name}
          raw={raw}
          show={show}
          setShow={setShow}
        />
      </div>
      <div className="grid w-full max-[550px]:w-[100%]">
        {form.from == "" && (
          <h2 className="mb-5 text-[20px] font-medium">Bugungi o'tkazmalar</h2>
        )}

        {form.from !== "" && form.from === form.to && (
          <h2 className="mb-5 text-[20px] font-medium">
            {form.from} kungi o'tkazmalar
          </h2>
        )}

        {form.from !== "" && form.from !== form.to && (
          <h2 className="mb-5 text-[20px] font-medium">
            {form.from} <span className="text-[15px]">dan ,</span> {form.to}{" "}
            <span className="text-[15px]">gacha</span> o'tkazmalar
          </h2>
        )}
        <div className="flex flex-row items-center gap-7 max-[550px]:w-[100%] max-[640px]:flex-col max-[640px]:gap-0">
          <h2 className="text-[20px] font-medium mb-2">{t("filters")}:</h2>
          <div className="w-full flex justify-between">
            <div className="flex gap-5 max-[640px]:gap-0  w-full">
              {isMobile ? (
                // Mobile uchun custom date inputs (faqat text input + popup)
                <div className="flex flex-col gap-2 w-full">
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
                </div>
              ) : (
                // Desktop uchun Antd RangePicker
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
                  className="w-[340px] max-md:w-[100%] border border-[#E5E7EB] rounded-lg px-3 py-[6px] outline-none"
                />
              )}
            </div>
          </div>
        </div>
        <div className="max-md:mb-5">
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
