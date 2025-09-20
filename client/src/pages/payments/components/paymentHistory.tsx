import React from "react";

type Props = {
  form: { from: string; to: string };
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  income: number;
  outcome: number;
  cashboxHistory: any[];
};

const CashboxHistoryComponent: React.FC<Props> = ({
  form,
  handleChange,
  income,
  outcome,
  cashboxHistory,
}) => {
  return (
    <div className="w-[50%]">
      {/* Filter qismi */}
      <div className="flex flex-row items-center gap-7">
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

      {/* Income va Outcome qismlari */}
      <div className="flex gap-5 mt-10 justify-between">
        <div className="bg-[#0688221A] px-6 py-5 w-[50%]">
          <strong className="text-[#068822] dark:text-green-500 text-[20px]">
            + {(income ?? 100).toLocaleString("uz-UZ")} UZS
          </strong>
        </div>
        <div className="bg-[#B80D0D1A] px-6 py-5 w-[50%]">
          <strong className="text-[#B80D0D] dark:text-red-500 text-[20px]">
            - {(outcome ?? 100).toLocaleString("uz-UZ")} UZS
          </strong>
        </div>
      </div>

      {/* Tarix ro‘yxati */}
      <div className="h-[520px] mt-5 px-8 py-4 bg-[#ede8ff] dark:bg-[#3D3759] shadow-md rounded-lg overflow-y-auto">
        {cashboxHistory?.map((item: any, inx: number) => (
          <div
            key={inx}
            className="flex gap-20 mb-3 border-b border-gray-300 justify-between"
          >
            <div>
              <h3 className="text-[25px] font-medium">
                {item?.createdByUser?.name}
                <span className="text-gray-400 text-[15px]">
                  ({item?.createdByUser?.role})
                </span>
              </h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>
                  {new Date(Number(item?.created_at)).toLocaleString("uz-UZ")}
                </p>
              </div>
            </div>
            <div>
              <strong
                className={`text-[#068822] dark:text-green-500 text-[25px] ${
                  item?.operation_type == "expense" ? "text-red-500" : ""
                }`}
              >
                {item?.operation_type == "expense" ? "-" : "+"}{" "}
                {(item?.amount ?? 100).toLocaleString("uz-UZ")} UZS <br />
                <span className="text-[15px] text-gray-400 flex justify-end items-center">
                  {item?.payment_method}
                </span>
              </strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// memo bilan o‘rab export qilish
export const CashboxHistory = React.memo(CashboxHistoryComponent);
