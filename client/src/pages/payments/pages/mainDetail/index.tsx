import { memo, useState } from "react";
// import chip from "../../../../shared/assets/payments/chip.svg";
// import { ArrowLeft } from "lucide-react";
import { useLocation } from "react-router-dom";

// import { Button } from "antd";
import { useEffect } from "react";
import { CashboxCard } from "../../components/CashCard";
import { CashboxHistory } from "../../components/paymentHistory";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import { Store, TruckElectric } from "lucide-react";

const MainDetail = () => {
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

  const { getCashBoxMain } = useCashBox();

  const { data, refetch } = getCashBoxMain();

  useEffect(() => {
    refetch();
  }, []);

  const raw = Number(data?.data?.cashbox?.balance || 0);

  return (
    <div className="px-5 mt-5 flex gap-24">
      <div>
        <CashboxCard
          role={market.role}
          name={data?.data?.cashbox?.user?.name}
          raw={raw}
          show={show}
          setShow={setShow}
        />
        <div className="mt-10">
          <div className="flex justify-around w-[80%]">
            <button className="">
              <TruckElectric className="w-[50px] h-[50px]" />
            </button>
            <button>
              <Store className="w-[50px] h-[50px]" />
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

export default memo(MainDetail);
