import React, { useState } from "react";
import HistoryPopup from "./historyPopup";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
  Banknote,
  CreditCard,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("payment");
  const [showHistory, setShowHistory] = useState(false);
  const [select, setSelect] = useState("");

  const handleHistoryPopup = (id: string) => {
    setSelect(id);
    setShowHistory(true);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return {
        primary: date.toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        secondary: "Bugun"
      };
    }
    if (isYesterday) {
      return {
        primary: date.toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        secondary: "Kecha"
      };
    }
    return {
      primary: date.toLocaleDateString("uz-UZ", {
        day: "2-digit",
        month: "short",
      }),
      secondary: date.toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      })
    };
  };

  const getPaymentMethodIcon = (method: string) => {
    if (method === "cash") return <Banknote size={12} className="text-green-500" />;
    return <CreditCard size={12} className="text-blue-500" />;
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      superadmin: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400", label: "SA" },
      admin: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400", label: "AD" },
      registrator: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400", label: "RG" },
      courier: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400", label: "KR" },
      market: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400", label: "MK" },
    };
    return styles[role] || { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", label: role?.slice(0, 2).toUpperCase() };
  };

  const getSourceTypeLabel = (sourceType: string) => {
    const labels: Record<string, string> = {
      courier_payment: "Kuryer to'lovi",
      market_payment: "Market to'lovi",
      manual_expense: "Qo'lda chiqim",
      manual_income: "Qo'lda kirim",
      correction: "Tuzatish",
      salary: "Maosh",
      sell: "Sotuv",
      cancel: "Bekor qilish",
      extra_cost: "Qo'shimcha xarajat",
      bills: "To'lovlar",
    };
    return labels[sourceType] || sourceType;
  };

  return (
    <div className="w-full">
      {/* Income va Outcome Summary Cards - Modern Glass Design */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-6">
        {/* Income Card */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-3 sm:p-5 shadow-2xl shadow-emerald-500/25">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="text-xs sm:text-sm text-white/80 font-medium">
                  {t("income") || "kirim"}
                </span>
              </div>
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white/60" />
            </div>
            <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight break-all">
              +{(income ?? 0).toLocaleString("uz-UZ")}
            </p>
            <p className="text-xs sm:text-sm text-white/60 mt-0.5 sm:mt-1">UZS</p>
          </div>
        </div>

        {/* Outcome Card */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500 via-rose-500 to-pink-600 p-3 sm:p-5 shadow-2xl shadow-red-500/25">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="text-xs sm:text-sm text-white/80 font-medium">
                  {t("expense") || "chiqim"}
                </span>
              </div>
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-white/60" />
            </div>
            <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight break-all">
              -{(outcome ?? 0).toLocaleString("uz-UZ")}
            </p>
            <p className="text-xs sm:text-sm text-white/60 mt-0.5 sm:mt-1">UZS</p>
          </div>
        </div>
      </div>

      {/* History List - Modern Card Design */}
      <div className="mt-6 bg-white dark:bg-[#2A263D] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-[#312D4B] dark:to-[#2A263D]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Clock size={18} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white">
                  {t("to'lovTarixi") || "To'lov tarixi"}
                </h3>
                <p className="text-xs text-gray-400">So'nggi operatsiyalar</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Sparkles size={14} className="text-purple-500" />
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                {cashboxHistory?.length || 0} ta
              </span>
            </div>
          </div>
        </div>

        {/* History Items */}
        <div className="max-h-[520px] overflow-y-auto">
          {cashboxHistory?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Clock size={32} className="opacity-50" />
              </div>
              <p className="text-sm font-medium">{t("noHistory") || "Tarix mavjud emas"}</p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Hozircha operatsiyalar yo'q</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {cashboxHistory?.map((item: any, inx: number) => {
                const dateInfo = formatDate(Number(item?.created_at));
                const roleBadge = getRoleBadge(item?.createdByUser?.role);
                const isIncome = item?.operation_type !== "expense";

                return (
                  <div
                    onClick={() => handleHistoryPopup(item.id)}
                    key={inx}
                    className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent dark:hover:from-purple-900/10 dark:hover:to-transparent cursor-pointer transition-all duration-300 group"
                  >
                    {/* Left Side - Icon & Info */}
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Operation Icon */}
                      <div className="relative">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                            isIncome
                              ? "bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40"
                              : "bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40"
                          }`}
                        >
                          {isIncome ? (
                            <TrendingUp
                              size={22}
                              className="text-emerald-600 dark:text-emerald-400"
                            />
                          ) : (
                            <TrendingDown
                              size={22}
                              className="text-red-600 dark:text-red-400"
                            />
                          )}
                        </div>
                        {/* Role badge */}
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-md ${roleBadge.bg} flex items-center justify-center shadow-sm`}>
                          <span className={`text-[8px] font-bold ${roleBadge.text}`}>
                            {roleBadge.label}
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-800 dark:text-white truncate text-sm">
                            {item?.createdByUser?.name || "Noma'lum"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Source Type */}
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                            {getSourceTypeLabel(item?.source_type)}
                          </span>
                          {/* Payment Method */}
                          {item?.payment_method && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                              {getPaymentMethodIcon(item?.payment_method)}
                              {item?.payment_method === "cash" ? "Naqd" : "Click"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Amount & Time */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p
                          className={`font-bold text-base ${
                            isIncome
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {(item?.amount ?? 0).toLocaleString("uz-UZ")}
                          <span className="text-xs font-normal ml-0.5">so'm</span>
                        </p>
                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                          <Calendar size={10} className="text-gray-300 dark:text-gray-600" />
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {dateInfo.primary}
                          </span>
                          <span className="text-[10px] text-gray-300 dark:text-gray-600">
                            {dateInfo.secondary}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        size={18}
                        className="text-gray-200 dark:text-gray-700 group-hover:text-purple-400 group-hover:translate-x-1 transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showHistory && (
        <HistoryPopup id={select} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
};

export const CashboxHistory = React.memo(CashboxHistoryComponent);
