import { memo, useState } from "react";
// import chip from "../../../../shared/assets/payments/chip.svg";
// import { ArrowLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import logo from "../../../../shared/assets/logo.svg";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import CountUp from "react-countup";
// import { Button } from "antd";

const CashDetail = () => {
  const [form, setForm] = useState({
    from: "",
    to: "",
    order: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // const handleCheck = () => {
  //   console.log("Filter values:", form);
  //   // shu yerda API chaqirishingiz yoki filtrni ishlatishingiz mumkin
  // };

  const location = useLocation();
  const market = location.state;

  const [show, setShow] = useState(true);

  const { getCashBoxById } = useCashBox();
  const { data } = getCashBoxById(market.id);
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
                <CountUp
                  end={raw}
                  duration={1.0}
                  separator=" " 
                  suffix=" UZS" 
                />
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
          {data?.data?.cashboxHistory.map((item: any, inx: number) => (
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
                <strong className="text-[#068822] dark:text-green-500 text-[25px]">
                  + {item?.amount}
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
