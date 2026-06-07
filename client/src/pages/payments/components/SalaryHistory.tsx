import React from "react";
import {
  Clock,
  Banknote,
  CreditCard,
  Calendar,
  Wallet,
  Loader2,
} from "lucide-react";
import { useCashBox } from "../../../shared/api/hooks/useCashbox";

type Props = {
  /** Admin uchun — ishchining ID si. Berilmasa, "mine" rejimida ishchining o'zi tarixi olinadi. */
  userId?: string;
  /** true bo'lsa — ishchining o'z tarixi (cashbox/salary/my-history) */
  mine?: boolean;
  /** komponentni faqat kerak bo'lganda yuklash uchun */
  enabled?: boolean;
};

const formatDate = (timestamp: number) => {
  const date = new Date(Number(timestamp));
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return { primary: time, secondary: "Bugun" };
  if (isYesterday) return { primary: time, secondary: "Kecha" };
  return {
    primary: date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short", year: "2-digit" }),
    secondary: time,
  };
};

const SalaryHistoryComponent: React.FC<Props> = ({ userId, mine = false, enabled = true }) => {
  const { getSalaryHistory, getMySalaryHistory } = useCashBox();

  // Ikkala hook ham doim chaqiriladi (Rules of Hooks), faqat biri faollashtiriladi
  const adminQuery = getSalaryHistory(userId, { limit: 50 }, enabled && !mine);
  const myQuery = getMySalaryHistory({ limit: 50 }, enabled && mine);

  const query = mine ? myQuery : adminQuery;
  const data = query?.data?.data;
  const history: any[] = data?.history || [];
  const totalPaid: number = data?.totalPaid || 0;

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-[#312D4B] dark:to-[#2A263D]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Clock size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white">Maosh to'lovlari tarixi</h3>
              <p className="text-xs text-gray-400">
                Jami to'langan:{" "}
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {totalPaid.toLocaleString("uz-UZ")} so'm
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Wallet size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {history.length} ta
            </span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto">
        {query?.isLoading ? (
          <div className="flex items-center justify-center py-12 text-amber-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Clock size={28} className="opacity-50" />
            </div>
            <p className="text-sm font-medium">Hali maosh to'lovlari yo'q</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.map((item: any) => {
              const dateInfo = formatDate(item?.created_at);
              const isCash = item?.payment_method === "cash";
              return (
                <div
                  key={item?.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 flex items-center justify-center flex-shrink-0">
                      <Wallet size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                        {item?.comment || "Oylik maosh"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          {isCash ? (
                            <Banknote size={11} className="text-green-500" />
                          ) : (
                            <CreditCard size={11} className="text-blue-500" />
                          )}
                          {isCash ? "Naqd" : "Karta"}
                        </span>
                        {item?.paid_by?.name && (
                          <span className="text-[10px] text-gray-400">
                            To'lovchi: {item.paid_by.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-base text-red-600 dark:text-red-400">
                      -{(item?.amount ?? 0).toLocaleString("uz-UZ")}
                      <span className="text-xs font-normal ml-0.5">so'm</span>
                    </p>
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      <Calendar size={10} className="text-gray-300 dark:text-gray-600" />
                      <span className="text-[10px] text-gray-400">{dateInfo.primary}</span>
                      <span className="text-[10px] text-gray-300 dark:text-gray-600">
                        {dateInfo.secondary}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const SalaryHistory = React.memo(SalaryHistoryComponent);
