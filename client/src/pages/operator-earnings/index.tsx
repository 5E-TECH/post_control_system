import { memo, useEffect, useState } from "react";
import { useUser } from "../../shared/api/hooks/useRegister";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  History,
  Loader2,
  EyeOff,
  Eye,
  ShoppingBag,
  XCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  Calendar,
  Percent,
  Coins,
  X,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import CountUp from "react-countup";
import CustomCalendar from "../../shared/components/customDate";
import logo from "../../shared/assets/logo.svg";

const { RangePicker } = DatePicker;

const fmt = (val: number) =>
  Number(val || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const fmtDate = (ts: string | number) => {
  if (!ts) return { primary: "—", secondary: "" };
  const date = new Date(Number(ts));
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const time = date.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (date.toDateString() === today.toDateString()) {
    return { primary: time, secondary: "Bugun" };
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return { primary: time, secondary: "Kecha" };
  }
  return {
    primary: date.toLocaleDateString("uz-UZ", {
      day: "2-digit",
      month: "short",
    }),
    secondary: time,
  };
};

type Tab = "earnings" | "payments";

const OperatorEarnings = () => {
  const { getMyEarnings } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>("earnings");
  const [showBalance, setShowBalance] = useState(true);
  const [fromDate, setFromDate] = useState<string | undefined>(undefined);
  const [toDate, setToDate] = useState<string | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { data, isLoading } = getMyEarnings({ fromDate, toDate });
  const earnings = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="w-7 h-7 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!earnings || earnings.visible === false) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-gray-400 p-6">
        <EyeOff className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-base font-medium">Daromad ma'lumotlari yashirin</p>
        <p className="text-sm mt-1 text-center">
          Market ushbu bo'limni hali yoqmagan
        </p>
      </div>
    );
  }

  const balance = earnings.balance || 0;
  const totalEarned = earnings.total_earned || 0;
  const totalPaid = earnings.total_paid || 0;
  const commission = earnings.operator;

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-screen-2xl mx-auto flex gap-8 lg:gap-16 max-lg:flex-col">
        {/* Left Section - Balance Card */}
        <div className="lg:max-w-[520px] w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                Mening daromadlarim
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Operator kassasi
              </p>
            </div>
          </div>

          {/* Gradient Balance Card */}
          <div className="w-full max-w-[500px]">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1f4e] via-[#2d1b69] to-[#6b1d5c] text-white shadow-2xl h-[180px] sm:h-[200px]">
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
                      <h1 className="font-bold text-lg tracking-wide">
                        BEEPOST
                      </h1>
                      <p className="text-xs text-white/60">Operator</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBalance((prev) => !prev)}
                    className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all duration-200 cursor-pointer"
                  >
                    {showBalance ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* Main Balance - To'lanmagan qoldiq */}
                <div className="mt-6">
                  <p className="text-sm text-white/60 mb-1 flex items-center gap-2">
                    <Wallet size={16} />
                    To'lanmagan qoldiq
                  </p>
                  <p className="text-2xl sm:text-4xl font-bold tracking-tight">
                    {showBalance ? (
                      <CountUp
                        end={balance}
                        duration={0.5}
                        separator=" "
                        suffix=" UZS"
                      />
                    ) : (
                      "●●●●●●● UZS"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Jami / To'langan — compact row */}
          <div className="mt-3 flex gap-2 max-w-[500px]">
            <div className="flex-1 bg-white dark:bg-[#2A263D] rounded-xl px-3 py-2.5 border border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={15} className="text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">Jami ishlab topildi</p>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">
                  {showBalance ? `${fmt(totalEarned)} so'm` : "●●●●"}
                </p>
              </div>
            </div>
            <div className="flex-1 bg-white dark:bg-[#2A263D] rounded-xl px-3 py-2.5 border border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <CreditCard size={15} className="text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">To'langan</p>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">
                  {showBalance ? `${fmt(totalPaid)} so'm` : "●●●●"}
                </p>
              </div>
            </div>
          </div>

          {/* Komissiya Badge */}
          {commission && (
            <div className="mt-4 bg-white dark:bg-[#2A263D] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                {commission.commission_type === "percent" ? (
                  <Percent className="w-5 h-5 text-white" />
                ) : (
                  <Coins className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  Komissiya stavkasi
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {commission.commission_type === "percent"
                    ? `Har bir sotuvdan ${commission.commission_value}%`
                    : `Har bir sotuvdan ${Number(commission.commission_value || 0).toLocaleString()} so'm`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="w-full lg:flex-1">
          {/* Date Filter */}
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-5 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Clock size={18} className="text-white" />
                </div>
                <div>
                  {!fromDate ? (
                    <>
                      <h3 className="font-bold text-gray-800 dark:text-white">Bugun</h3>
                      <p className="text-xs text-gray-400">Bugungi operatsiyalar</p>
                    </>
                  ) : fromDate === toDate ? (
                    <>
                      <h3 className="font-bold text-gray-800 dark:text-white">{fromDate}</h3>
                      <p className="text-xs text-gray-400">Kunlik operatsiyalar</p>
                    </>
                  ) : (
                    <>
                      <h3 className="font-bold text-gray-800 dark:text-white">{fromDate} — {toDate}</h3>
                      <p className="text-xs text-gray-400">Tanlangan davr</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isMobile ? (
                  <RangePicker
                    value={[
                      fromDate ? dayjs(fromDate) : null,
                      toDate ? dayjs(toDate) : null,
                    ]}
                    onChange={(dates) => {
                      setFromDate(dates?.[0] ? dates[0].format("YYYY-MM-DD") : undefined);
                      setToDate(dates?.[1] ? dates[1].format("YYYY-MM-DD") : undefined);
                    }}
                    className="w-64 dark:bg-[#342d4a]! dark:border-[#4b3b6a]! dark:[&_.ant-picker-input>input]:text-white! dark:[&_.ant-picker-input>input]:placeholder-gray-300!"
                  />
                ) : (
                  <CustomCalendar
                    from={fromDate ? dayjs(fromDate) : null}
                    to={toDate ? dayjs(toDate) : null}
                    setFrom={(date: any) => setFromDate(date ? date.format("YYYY-MM-DD") : undefined)}
                    setTo={(date: any) => setToDate(date ? date.format("YYYY-MM-DD") : undefined)}
                  />
                )}
                {(fromDate || toDate) && (
                  <button
                    onClick={() => { setFromDate(undefined); setToDate(undefined); }}
                    className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Period Summary Cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6">
            {/* Earned in period */}
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-3 sm:p-5 shadow-2xl shadow-emerald-500/25">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <span className="text-xs sm:text-sm text-white/80 font-medium">
                      {fromDate ? "Davrdagi daromad" : "Bugungi daromad"}
                    </span>
                  </div>
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white/60" />
                </div>
                <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight break-all">
                  +{(totalEarned).toLocaleString("uz-UZ")}
                </p>
                <p className="text-xs sm:text-sm text-white/60 mt-0.5 sm:mt-1">UZS</p>
              </div>
            </div>

            {/* Paid in period */}
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 p-3 sm:p-5 shadow-2xl shadow-blue-500/25">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <span className="text-xs sm:text-sm text-white/80 font-medium">
                      {fromDate ? "Davrdagi to'lov" : "Bugungi to'lov"}
                    </span>
                  </div>
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white/60" />
                </div>
                <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white tracking-tight break-all">
                  {(totalPaid).toLocaleString("uz-UZ")}
                </p>
                <p className="text-xs sm:text-sm text-white/60 mt-0.5 sm:mt-1">UZS</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
            <button
              onClick={() => setActiveTab("earnings")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === "earnings"
                  ? "bg-white dark:bg-[#2A263D] text-purple-700 dark:text-purple-300 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Buyurtma daromadlari
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === "payments"
                  ? "bg-white dark:bg-[#2A263D] text-purple-700 dark:text-purple-300 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              <History className="w-4 h-4" />
              To'lov tarixi
            </button>
          </div>

          {/* Earnings History */}
          {activeTab === "earnings" && (
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-[#312D4B] dark:to-[#2A263D]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <ShoppingBag size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-white">
                        Har bir buyurtmadan daromad
                      </h3>
                      <p className="text-xs text-gray-400">
                        So'nggi operatsiyalar
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <Sparkles size={14} className="text-purple-500" />
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      {earnings.earnings?.length || 0} ta
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="max-h-[520px] overflow-y-auto">
                {!earnings.earnings?.length ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                      <ShoppingBag size={32} className="opacity-50" />
                    </div>
                    <p className="text-sm font-medium">Hali daromad yo'q</p>
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                      Buyurtmalar sotilganda daromad ko'rinadi
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {earnings.earnings.map((e: any) => {
                      const isCancelled = e.order?.is_cancelled;
                      const dateInfo = fmtDate(e.created_at);

                      return (
                        <div
                          key={e.id}
                          className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent dark:hover:from-purple-900/10 dark:hover:to-transparent transition-all duration-300 group"
                        >
                          {/* Left Side */}
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            {/* Icon */}
                            <div className="relative">
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                                  isCancelled
                                    ? "bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40"
                                    : "bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40"
                                }`}
                              >
                                {isCancelled ? (
                                  <XCircle
                                    size={22}
                                    className="text-red-600 dark:text-red-400"
                                  />
                                ) : (
                                  <CheckCircle2
                                    size={22}
                                    className="text-emerald-600 dark:text-emerald-400"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-800 dark:text-white truncate text-sm">
                                {e.order?.customer_name || "Buyurtma"}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                {e.order && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                                    {fmt(e.order.total_price)} so'm
                                  </span>
                                )}
                                {e.order?.items?.length > 0 && (
                                  <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
                                    {e.order.items
                                      .map(
                                        (item: any) =>
                                          `${item.name} (${item.quantity})`
                                      )
                                      .join(", ")}
                                  </span>
                                )}
                                {isCancelled && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 font-medium">
                                    Bekor qilindi
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Side */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p
                                className={`font-bold text-base ${
                                  isCancelled
                                    ? "text-red-600 dark:text-red-400 line-through"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {isCancelled ? "−" : "+"}
                                {fmt(e.amount)}
                                <span className="text-xs font-normal ml-0.5">
                                  so'm
                                </span>
                              </p>
                              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                                <Calendar
                                  size={10}
                                  className="text-gray-300 dark:text-gray-600"
                                />
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
          )}

          {/* Payment History */}
          {activeTab === "payments" && (
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-[#312D4B] dark:to-[#2A263D]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <Clock size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-white">
                        To'lov tarixi
                      </h3>
                      <p className="text-xs text-gray-400">
                        Market tomonidan to'langan
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <Sparkles size={14} className="text-purple-500" />
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      {earnings.payments?.length || 0} ta
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="max-h-[520px] overflow-y-auto">
                {!earnings.payments?.length ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                      <Clock size={32} className="opacity-50" />
                    </div>
                    <p className="text-sm font-medium">
                      Hali to'lov amalga oshirilmagan
                    </p>
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                      Hozircha operatsiyalar yo'q
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {earnings.payments.map((p: any) => {
                      const dateInfo = fmtDate(p.created_at);

                      return (
                        <div
                          key={p.id}
                          className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-transparent dark:hover:from-purple-900/10 dark:hover:to-transparent transition-all duration-300 group"
                        >
                          {/* Left Side */}
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40 transition-transform group-hover:scale-110">
                              <CreditCard
                                size={22}
                                className="text-emerald-600 dark:text-emerald-400"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-800 dark:text-white text-sm">
                                To'lov qabul qilindi
                              </p>
                              {p.note && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium mt-0.5 inline-block">
                                  {p.note}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right Side */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                                +{fmt(p.amount)}
                                <span className="text-xs font-normal ml-0.5">
                                  so'm
                                </span>
                              </p>
                              <div className="flex items-center gap-1.5 justify-end mt-0.5">
                                <Calendar
                                  size={10}
                                  className="text-gray-300 dark:text-gray-600"
                                />
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
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(OperatorEarnings);
