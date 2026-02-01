import { memo, type FC } from "react";
import { useCashBox } from "../../../shared/api/hooks/useCashbox";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  CreditCard,
  X,
  ShoppingCart,
  Phone,
  User,
  Banknote,
  MapPin,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Wallet,
  BadgeCheck,
  Receipt,
} from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../app/store";

interface IProps {
  id: string | null;
  onClose: () => void;
}

const HistoryPopup: FC<IProps> = ({ id, onClose }) => {
  const { t } = useTranslation("payment");
  const { t: ts } = useTranslation("status");
  const { getCashBoxHistoryById } = useCashBox();
  const { data, isLoading } = getCashBoxHistoryById(id);
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.roleSlice);

  if (!id) return null;

  const info = data?.data;
  const isIncome = info?.operation_type === "income";

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    // Remove any existing + sign first, then format
    const cleanPhone = phone.replace(/^\+/, "");
    return cleanPhone.replace(/(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})/, "+$1 $2 $3 $4 $5");
  };

  const formatDate = (timestamp: string | number) => {
    return new Date(Number(timestamp)).toLocaleString("uz-UZ");
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      superadmin: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
      admin: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
      registrator: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
      market: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
      courier: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    };
    return colors[role] || "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300";
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 pt-4 pb-16 sm:pb-4 sm:items-center overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#2A263D] w-full max-w-md max-h-[calc(100vh-80px)] sm:max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`relative px-4 py-4 sm:px-5 sm:py-5 ${
            isIncome
              ? "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600"
              : "bg-gradient-to-br from-red-500 via-rose-500 to-pink-600"
          }`}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-30"></div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center ${
                isIncome ? "bg-white/20" : "bg-white/20"
              } backdrop-blur-sm`}>
                {isIncome ? (
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                ) : (
                  <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {isIncome ? t("income") : t("expense")}
                </h2>
                <p className="text-sm text-white/80 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  {t("to'lovTarixi")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all duration-200 cursor-pointer hover:scale-105"
            >
              <X size={18} />
            </button>
          </div>

          {/* Amount Display in Header */}
          <div className="relative mt-4 pt-4 border-t border-white/20">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-white/70 mb-1">{t("amount")}</p>
                <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {isIncome ? "+" : "-"}
                  {info?.amount?.toLocaleString()}
                  <span className="text-lg font-normal text-white/80 ml-1">UZS</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">{t("afterBalance")}</p>
                <p className="text-sm font-semibold text-white">
                  {info?.balance_after?.toLocaleString()} UZS
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 overflow-y-auto max-h-[calc(100vh-250px)] sm:max-h-[calc(85vh-180px)]">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800/50"
                >
                  <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 w-4/5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Comment Card - Most Prominent */}
              {info?.comment && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-700/50">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1.5">
                        {t("comment")}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed break-words">
                        {info?.comment}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Source/Destination Card - Shows where money came from or went to */}
              <div className={`p-4 rounded-xl border ${
                isIncome
                  ? "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200/50 dark:border-blue-700/50"
                  : "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200/50 dark:border-orange-700/50"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isIncome
                      ? "bg-gradient-to-br from-blue-400 to-cyan-500"
                      : "bg-gradient-to-br from-orange-400 to-red-500"
                  }`}>
                    {isIncome ? (
                      <TrendingUp className="w-5 h-5 text-white" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${
                      isIncome
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-orange-600 dark:text-orange-400"
                    }`}>
                      {isIncome ? "Qayerdan" : "Qayerga"}
                    </p>
                    <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
                      {/* sourceUser - kuryer/market to'lovlari uchun */}
                      {info?.sourceUser?.name ||
                       info?.cashbox?.user?.name ||
                       "Asosiy kassa"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {info?.sourceUser?.role === "courier" && "Kuryer"}
                      {info?.sourceUser?.role === "market" && "Do'kon"}
                      {!info?.sourceUser && info?.cashbox?.cashbox_type === "main" && "Pochta kassasi"}
                      {!info?.sourceUser && info?.cashbox?.cashbox_type === "for_courier" && "Kuryer kassasi"}
                      {!info?.sourceUser && info?.cashbox?.cashbox_type === "for_market" && "Do'kon kassasi"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Source Type */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      {t("sourceType")}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white capitalize truncate">
                    {t(`sourceTypes.${info?.source_type}`)}
                  </p>
                </div>

                {/* Payment Method */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Wallet className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      To'lov turi
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                    {info?.payment_method === "cash" && "Naqd"}
                    {info?.payment_method === "click" && "Click"}
                    {info?.payment_method === "click_to_market" && "Click (Market)"}
                    {!["cash", "click", "click_to_market"].includes(info?.payment_method) && (info?.payment_method || "—")}
                  </p>
                </div>

                {/* Date */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      {t("paymentDate")}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                    {formatDate(info?.created_at)}
                  </p>
                </div>

                {/* User Info */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      {t("foydalanuvchi")}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                    {info?.createdByUser?.name}
                  </p>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium capitalize ${getRoleBadgeColor(info?.createdByUser?.role)}`}
                  >
                    {info?.createdByUser?.role}
                  </span>
                </div>
              </div>

              {/* Phone Number */}
              {info?.createdByUser?.phone_number && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      {t("phone")}
                    </p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {formatPhone(info?.createdByUser?.phone_number)}
                    </p>
                  </div>
                </div>
              )}

              {/* Order Info */}
              {info?.order && (
                <div
                  onClick={() =>
                    navigate(`/orders/order-detail/${info?.order?.id}`)
                  }
                  className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/50 dark:border-emerald-700/50 cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <ShoppingCart className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          {t("buyurtma")}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {info?.order?.market?.name}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-emerald-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {t("tuman")}
                      </span>
                      <span className="text-xs font-medium text-gray-800 dark:text-white">
                        {info?.order?.customer?.district?.name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {t("telefon_nomer")}
                      </span>
                      <span className="text-xs font-medium text-gray-800 dark:text-white">
                        {formatPhone(info?.order?.customer?.phone_number)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-emerald-200/50 dark:border-emerald-700/50">
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5" />
                        {t("umumiyNarx")}
                      </span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {info?.order?.total_price?.toLocaleString()} UZS
                      </span>
                    </div>

                    {user?.role !== "courier" && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t("to'lanishiKerak")}
                          </span>
                          <span className="text-xs text-gray-800 dark:text-white">
                            {info?.order?.to_be_paid?.toLocaleString()} UZS
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t("to'langan")}
                          </span>
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                            {info?.order?.paid_amount?.toLocaleString()} UZS
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-emerald-200/50 dark:border-emerald-700/50">
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <BadgeCheck className="w-3.5 h-3.5" />
                        {t("status")}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          info?.order?.status === "sold"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        }`}
                      >
                        {ts(`${info?.order?.status}`)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(HistoryPopup);
