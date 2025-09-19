import { Eye, EyeOff } from "lucide-react";
import CountUp from "react-countup";
import logo from "../../../shared/assets/logo.svg";


type Props = {
  role: string;
  name: string;
  raw: number;
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
};

export const CashboxCard = ({ raw, show, setShow }: Props) => {
  return (
    <div>
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
              <CountUp end={raw} duration={0.5} separator="," suffix=" UZS" />
            ) : (
              "●●●●●●● UZS"
            )}
          </p>

          <button
            onClick={() => setShow((prev) => !prev)}
            className="ml-2 p-2 rounded-full hover:bg-white/10"
            aria-label={show ? "Hide balance" : "Show balance"}
            title={show ? "Hide balance" : "Show balance"}
          >
            {show ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </div>
    </div>
  );
};
