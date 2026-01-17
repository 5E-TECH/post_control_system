import { Eye, EyeOff, Banknote, CreditCard } from "lucide-react";
import CountUp from "react-countup";
import logo from "../../../shared/assets/logo.svg";
import { useTranslation } from "react-i18next";

type Props = {
  role: string;
  name: string;
  raw: number;
  balanceCash?: number;
  balanceCard?: number;
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
};

export const CashboxCard = ({ raw, balanceCash = 0, balanceCard = 0, show, setShow }: Props) => {
  const { t } = useTranslation("payment");

  return (
    <div>
      <div className="w-[500px] max-[550px]:w-[100%] h-[280px] px-6 py-6 text-2xl flex flex-col rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white justify-between relative">
        <div className="flex gap-3">
          <img src={logo} alt="" />
          <h1 className="font-medium text-[20px]">BEEPOST</h1>
        </div>

        {/* Umumiy balans */}
        <div className="flex items-center gap-3">
          <p className="text-[36px] font-medium max-md:text-[28px]">
            {show ? (
              <CountUp end={raw} duration={0.5} separator="," suffix=" UZS" />
            ) : (
              "●●●●●●● UZS"
            )}
          </p>

          <button
            onClick={() => setShow((prev) => !prev)}
            className="ml-2 p-2 cursor-pointer rounded-full hover:bg-white/10"
            aria-label={show ? "Hide balance" : "Show balance"}
            title={show ? "Hide balance" : "Show balance"}
          >
            {show ? <EyeOff /> : <Eye />}
          </button>
        </div>

        {/* Naqd va Karta balans */}
        <div className="flex gap-6 mt-2">
          {/* Naqd */}
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
            <Banknote size={20} className="text-green-400" />
            <div className="flex flex-col">
              <span className="text-[11px] text-[#ede8ff88]">{t("cash") || "Naqd"}</span>
              <span className="text-[16px] font-semibold">
                {show ? (
                  <CountUp end={balanceCash} duration={0.5} separator="," suffix=" UZS" />
                ) : (
                  "●●●●"
                )}
              </span>
            </div>
          </div>

          {/* Karta/Click */}
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
            <CreditCard size={20} className="text-yellow-400" />
            <div className="flex flex-col">
              <span className="text-[11px] text-[#ede8ff88]">{t("click") || "Karta"}</span>
              <span className="text-[16px] font-semibold">
                {show ? (
                  <CountUp end={balanceCard} duration={0.5} separator="," suffix=" UZS" />
                ) : (
                  "●●●●"
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
