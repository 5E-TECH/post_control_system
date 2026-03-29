import { memo, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "../../shared/api/hooks/useRegister";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Loader2,
  EyeOff,
  Eye,
  Percent,
  Calendar,
  Undo2,
  CheckCircle2,
  ArrowDownLeft,
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
  if (!ts) return "—";
  const date = new Date(Number(ts));
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = date.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `${time} bugun`;
  if (date.toDateString() === yesterday.toDateString()) return `${time} kecha`;
  return date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }) + " " + time;
};

/**
 * Investor hisob-kitobi:
 *
 * balans = jami_ishlab_topilgan - jami_to'langan
 *   > 0 → investorga qarzdormiz (to'lashimiz kerak)
 *   < 0 → investor bizga qarzda (ko'p to'lab bergammiz, yangi sotuvlar qarzni yopadi)
 *   = 0 → hisob teng
 *
 * Har bir sotuv → investor_earning yaratiladi → balans oshadi
 * Har bir to'lov → investor_payout yaratiladi → balans kamayadi
 */
const InvestorDashboard = () => {
  const location = useLocation();
  const isAccountsPage = location.pathname.includes("my-investments");

  const { getMyInvestorDashboard } = useUser();
  const [showBalance, setShowBalance] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const today = dayjs().format("YYYY-MM-DD");
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    h();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const { data, isLoading } = getMyInvestorDashboard({
    fromDate: isAccountsPage ? fromDate : undefined,
    toDate: isAccountsPage ? toDate : undefined,
  });
  const d = data?.data;

  if (isLoading) {
    return <div className="flex items-center justify-center h-60"><Loader2 className="w-7 h-7 animate-spin text-purple-500" /></div>;
  }
  if (!d) return null;

  const inv = d.investor;
  const totalEarned = d.total_earned || 0;
  const totalPaid = d.total_paid || 0;
  const balance = d.balance ?? (totalEarned - totalPaid); // server qaytaradi
  const committed = inv?.committed_amount || 0;
  const deposited = inv?.deposited_amount || 0;
  const effectivePercent = inv?.effective_percent || 0;
  const sharePercent = inv?.share_percent || 0;
  const progressPercent = committed > 0 ? Math.min((deposited / committed) * 100, 100) : 100;
  const todayProfit = d.today_total_profit || 0;
  const todayShare = d.today_investor_share || 0;
  const isDebt = balance < 0;

  // ==================== DASHBOARD (/) ====================
  if (!isAccountsPage) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{inv?.name} • {committed === 0 ? "Sherik" : "Investor"}</p>
            </div>
          </div>

          {/* ===== BALANS KARTA ===== */}
          <div className={`relative overflow-hidden rounded-2xl text-white shadow-2xl h-[200px] sm:h-[220px] mb-4 ${
            isDebt
              ? "bg-gradient-to-br from-[#4a1a1a] via-[#6b1d1d] to-[#8b2525]"
              : "bg-gradient-to-br from-[#1a1f4e] via-[#2d1b69] to-[#6b1d5c]"
          }`}>
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
            </div>
            <div className="relative p-4 sm:p-6 flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <img src={logo} alt="logo" className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="font-bold text-lg tracking-wide">BEEPOST</h1>
                    <p className="text-xs text-white/60">{committed === 0 ? "Sherik" : "Investor"}</p>
                  </div>
                </div>
                <button onClick={() => setShowBalance((p) => !p)} className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer">
                  {showBalance ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div>
                <p className="text-sm text-white/60 mb-1 flex items-center gap-2">
                  <Wallet size={16} /> Balans
                  {isDebt && <span className="text-xs bg-red-500/30 px-2 py-0.5 rounded-full">Qarz</span>}
                </p>
                <p className="text-2xl sm:text-4xl font-bold tracking-tight">
                  {showBalance ? <CountUp end={balance} duration={0.5} separator=" " suffix=" UZS" /> : "●●●●●●● UZS"}
                </p>
              </div>
            </div>
          </div>

          {/* ===== HISOB TAFSILOTI ===== */}
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><TrendingUp size={14} className="text-emerald-500" /></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Jami ishlab topilgan</span>
                </div>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{showBalance ? `+${fmt(totalEarned)} so'm` : "●●●●"}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><CreditCard size={14} className="text-blue-500" /></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Jami to'langan</span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{showBalance ? `-${fmt(totalPaid)} so'm` : "●●●●"}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"><Percent size={14} className="text-amber-500" /></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Foiz ulushi</span>
                </div>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{effectivePercent.toFixed(1)}%{effectivePercent < sharePercent ? ` / ${sharePercent}%` : ""}</span>
              </div>
            </div>
          </div>

          {/* Investitsiya progressi */}
          {committed > 0 && (
            <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Investitsiya progressi</p>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Kiritilgan: {fmt(deposited)} so'm</span>
                <span>Majburiyat: {fmt(committed)} so'm</span>
              </div>
            </div>
          )}

          {/* ===== BUGUNGI SHAFFOF HISOB ===== */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-800/30">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Bugungi daromad (real vaqt)</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-emerald-200/50 dark:border-emerald-800/30">
                <span className="text-sm text-gray-600 dark:text-gray-400">Pochta umumiy foydasi</span>
                <span className="text-base font-bold text-gray-800 dark:text-white">{showBalance ? `${fmt(todayProfit)} so'm` : "●●●●"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-emerald-200/50 dark:border-emerald-800/30">
                <span className="text-sm text-gray-600 dark:text-gray-400">Sizning ulushingiz</span>
                <span className="text-base font-bold text-purple-600 dark:text-purple-400">{effectivePercent.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between py-2 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-xl px-3 -mx-1">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {fmt(todayProfit)} × {effectivePercent.toFixed(1)}% =
                </span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {showBalance ? `+${fmt(todayShare)} so'm` : "●●●●"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== HISOBLARIM (/my-investments) ====================
  const isToday = fromDate === today && toDate === today;
  const isSameDay = fromDate === toDate;
  const dateLabel = isToday
    ? "Bugun"
    : isSameDay
      ? dayjs(fromDate).format("DD.MM.YYYY")
      : `${dayjs(fromDate).format("DD.MM.YYYY")} — ${dayjs(toDate).format("DD.MM.YYYY")}`;

  const allItems: any[] = [];
  (d.payouts || []).forEach((p: any) => allItems.push({ ...p, _type: "payout" }));
  (d.deposits || []).forEach((dep: any) => allItems.push({ ...dep, _type: "deposit" }));
  allItems.sort((a, b) => Number(b.created_at) - Number(a.created_at));

  const periodEarned = d.period_earned || 0;
  const periodPaid = d.period_paid || 0;

  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Hisoblarim</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{inv?.name} • Olgan va qo'shgan summalar</p>
          </div>
        </div>

        {/* Balans */}
        <div className={`rounded-2xl p-4 mb-4 border ${
          isDebt
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30"
            : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Joriy balans</span>
            <span className={`text-lg font-bold ${isDebt ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {showBalance ? `${fmt(balance)} so'm` : "●●●●"}
              {isDebt && <span className="text-xs font-normal ml-1">(qarz)</span>}
            </span>
          </div>
        </div>

        {/* Kalendar */}
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-white">{dateLabel}</span>
            </div>
            {!isMobile ? (
              <RangePicker
                value={[dayjs(fromDate), dayjs(toDate)]}
                onChange={(dates) => {
                  if (dates?.[0] && dates?.[1]) {
                    setFromDate(dates[0].format("YYYY-MM-DD"));
                    setToDate(dates[1].format("YYYY-MM-DD"));
                  } else {
                    setFromDate(today);
                    setToDate(today);
                  }
                }}
                allowClear
                className="w-64"
              />
            ) : (
              <CustomCalendar
                from={dayjs(fromDate)}
                to={dayjs(toDate)}
                setFrom={(d: any) => setFromDate(d ? d.format("YYYY-MM-DD") : today)}
                setTo={(d: any) => setToDate(d ? d.format("YYYY-MM-DD") : today)}
              />
            )}
          </div>
        </div>

        {/* Davr statistikasi */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4">
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-3 sm:p-5 shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="text-xs sm:text-sm text-white/80 font-medium">Daromad</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-white tracking-tight">+{fmt(periodEarned)}</p>
              <p className="text-xs text-white/60 mt-0.5">so'm</p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 p-3 sm:p-5 shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="text-xs sm:text-sm text-white/80 font-medium">To'lov</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-white tracking-tight">{fmt(periodPaid)}</p>
              <p className="text-xs text-white/60 mt-0.5">so'm</p>
            </div>
          </div>
        </div>

        {/* Operatsiyalar */}
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-gray-800 dark:text-white text-sm">Operatsiyalar tarixi</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {allItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Wallet size={32} className="opacity-30 mb-4" />
                <p className="text-sm font-medium">Operatsiya topilmadi</p>
              </div>
            ) : allItems.map((item, idx) => {
              if (item._type === "payout") {
                return (
                  <div key={`p-${item.id || idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white">To'lov olindi</p>
                        {item.note && <p className="text-[10px] text-gray-400">{item.note}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{fmt(item.amount)} so'm</p>
                      <p className="text-[10px] text-gray-400">{fmtDate(item.created_at)}</p>
                    </div>
                  </div>
                );
              }
              const isNeg = Number(item.amount) < 0;
              return (
                <div key={`d-${item.id || idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isNeg ? "bg-red-100 dark:bg-red-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}>
                      {isNeg ? <Undo2 className="w-5 h-5 text-red-500" /> : <TrendingUp className="w-5 h-5 text-purple-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{isNeg ? "Qaytarildi" : "Depozit qo'shildi"}</p>
                      {item.note && <p className="text-[10px] text-gray-400">{item.note}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${isNeg ? "text-red-500" : "text-purple-600 dark:text-purple-400"}`}>
                      {Number(item.amount) > 0 ? "+" : ""}{fmt(item.amount)} so'm
                    </p>
                    <p className="text-[10px] text-gray-400">{fmtDate(item.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(InvestorDashboard);
