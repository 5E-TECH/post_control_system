import { Eye, EyeOff, Banknote, CreditCard, Wallet } from "lucide-react";
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
  isMainCashbox?: boolean; // Faqat asosiy kassa uchun Naqd/Karta ko'rsatiladi
};

export const CashboxCard = ({
  raw,
  name,
  balanceCash = 0,
  balanceCard = 0,
  show,
  setShow,
  isMainCashbox = false,
}: Props) => {
  const { t } = useTranslation("payment");

  return (
    <div className="w-full max-w-[500px]">
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1f4e] via-[#2d1b69] to-[#6b1d5c] text-white shadow-2xl ${
          isMainCashbox ? "h-auto min-h-[240px] sm:min-h-[280px]" : "h-[180px] sm:h-[200px]"
        }`}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative p-4 sm:p-6 flex flex-col h-full justify-between">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <img src={logo} alt="logo" className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-wide">BEEPOST</h1>
                {name && (
                  <p className="text-xs text-white/60 truncate max-w-[150px]">
                    {name}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShow((prev) => !prev)}
              className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all duration-200 cursor-pointer"
              aria-label={show ? "Hide balance" : "Show balance"}
            >
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Main Balance */}
          <div className="mt-6">
            <p className="text-sm text-white/60 mb-1 flex items-center gap-2">
              <Wallet size={16} />
              {t("umumiyBalans") || "Umumiy balans"}
            </p>
            <p className="text-2xl sm:text-4xl font-bold tracking-tight">
              {show ? (
                <CountUp
                  end={raw}
                  duration={0.5}
                  separator=" "
                  suffix=" UZS"
                />
              ) : (
                "●●●●●●● UZS"
              )}
            </p>
          </div>

          {/* Naqd va Karta - faqat asosiy kassa uchun */}
          {isMainCashbox && (
            <div className="flex gap-2 sm:gap-4 mt-4 sm:mt-6">
              {/* Naqd */}
              <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Banknote size={16} className="text-green-400 sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <span className="text-[10px] sm:text-xs text-white/60 uppercase tracking-wide">
                    {t("cash") || "Naqd"}
                  </span>
                </div>
                <p className="text-base sm:text-xl font-bold">
                  {show ? (
                    <CountUp
                      end={balanceCash}
                      duration={0.5}
                      separator=" "
                      suffix=" UZS"
                    />
                  ) : (
                    "●●●●"
                  )}
                </p>
              </div>

              {/* Karta/Click */}
              <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <CreditCard size={16} className="text-yellow-400 sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <span className="text-[10px] sm:text-xs text-white/60 uppercase tracking-wide">
                    {t("click") || "Karta"}
                  </span>
                </div>
                <p className="text-base sm:text-xl font-bold">
                  {show ? (
                    <CountUp
                      end={balanceCard}
                      duration={0.5}
                      separator=" "
                      suffix=" UZS"
                    />
                  ) : (
                    "●●●●"
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
