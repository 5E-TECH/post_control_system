import { memo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import { DatePicker } from "antd";
import { CashboxCard } from "../../components/CashCard";
import { CashboxHistory } from "../../components/paymentHistory";
import dayjs from "dayjs";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";

const { RangePicker } = DatePicker;

const CashDetailMarketCourier = () => {
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

  useEffect(() => {
    if (form.payment != "click_to_market") {
      setForm((prev) => ({ ...prev, market: "" }));
    }
  }, [form.payment]);

  const [show, setShow] = useState(true);

  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;
  const { getCashboxMyCashbox } = useCashBox();

  const { data, refetch } = getCashboxMyCashbox();

  useEffect(() => {
    if (role === "superadmin" || role === "admin") {
      refetch();
    }
  }, [id]);

  const raw = Number(data?.data?.myCashbox?.balance || 0);

  return (
    <div className="px-5 mt-5 flex gap-24">
      <div>
        <h2 className="flex items-center mb-5 text-[25px] capitalize font-bold">
          Cash box
        </h2>
        <CashboxCard
          role={"market"}
          name={data?.data?.cashbox?.user?.name}
          raw={raw}
          show={show}
          setShow={setShow}
        />
      </div>
      <div className="grid w-full">
        <div className="flex flex-row items-center gap-7">
          <h2 className="text-[20px] font-medium mb-2">Filters:</h2>
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

export default memo(CashDetailMarketCourier);
