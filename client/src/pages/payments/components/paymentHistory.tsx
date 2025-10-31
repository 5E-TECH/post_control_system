import React, { useState } from "react";
import HistoryPopup from "./historyPopup";

type Props = {
  form: { from: string; to: string };
  income: number;
  outcome: number;
  cashboxHistory: any[];
};

const CashboxHistoryComponent: React.FC<Props> = ({
  income,
  outcome,
  cashboxHistory,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [select, setSelect] = useState("");

  const handleHistoryPopup = (id: string) => {
    setSelect(id);
    setShowHistory(true);
  };
  return (
    <div className="max-md:w-[100%]">
      {/* Filter qismi */}

      {/* Income va Outcome qismlari */}
      <div className="grid grid-cols-2 gap-5 mt-10 justify-between max-sm:w-[100%] max-[1400px]:grid-cols-1">
        <div className="bg-[#0688221A] px-6 py-5 w-[100%] max-sm:w-[100%]">
          <strong className="text-[#068822] dark:text-green-500 text-[20px] max-sm:text-[15px]">
            + {(income ?? 0).toLocaleString("uz-UZ")} UZS
          </strong>
        </div>
        <div className="bg-[#B80D0D1A] px-6 py-5 w-[100%] max-sm:w-[100%]">
          <strong className="text-[#B80D0D] dark:text-red-500 line-clamp-1 text-[20px] max-sm:text-[15px]">
            - {(outcome ?? 0).toLocaleString("uz-UZ")} UZS
          </strong>
        </div>
      </div>

      {/* Tarix ro‘yxati */}
      <div className="h-[520px] w-full mt-5 px-8 py-4 bg-[#ede8ff] dark:bg-[#3D3759] shadow-md rounded-lg overflow-y-auto max-sm:px-2">
        {cashboxHistory?.map((item: any, inx: number) => (
          <div
            onClick={() => handleHistoryPopup(item.id)}
            key={inx}
            className="flex cursor-pointer gap-20 mb-3 border-b border-gray-300 justify-between"
          >
            <div>
              <h3 className="text-[25px] font-medium max-sm:text-[15px]">
                {item?.createdByUser?.name}
                <span className="text-gray-400 text-[15px] pl-0.5 max-sm:text-[13px]">
                  ({item?.createdByUser?.role})
                </span>
              </h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400 max-sm:text-[15px]">
                <p>
                  {new Date(Number(item?.created_at)).toLocaleString("uz-UZ")}
                </p>
              </div>
            </div>
            <div>
              <strong
                className={` text-[25px] max-sm:text-[15px] text-nowrap ${
                  item?.operation_type == "expense"
                    ? "text-red-500"
                    : "text-[#068822] dark:text-green-500"
                }`}
              >
                {item?.operation_type == "expense" ? "-" : "+"}{" "}
                {(item?.amount ?? 100).toLocaleString("uz-UZ")} UZS <br />
                <span className="text-[15px] text-gray-400 flex justify-end items-center max-sm:text-[13px]">
                  {item?.payment_method}
                </span>
              </strong>
            </div>
          </div>
        ))}
      </div>
      {showHistory && (
        <HistoryPopup id={select} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
};

export const CashboxHistory = React.memo(CashboxHistoryComponent);
