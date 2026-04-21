import React, { useState, useRef, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  BarChart3,
  History,
  ChevronDown,
  Scale,
  Zap,
  Building2,
  Store,
  Truck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  Tag,
  User,
  FileText,
  Clock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import { useHistory } from "../../../../shared/api/hooks/useHistory";
import { Pagination } from "antd";
import CountUp from "react-countup";
import dayjs from "dayjs";
import CustomCalendar from "../../../../shared/components/customDate";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

const financialSourceLabels: Record<string, string> = {
  sell_profit: "Pochta foydasi",
  manual_expense: "Qo'lda chiqim",
  manual_income: "Qo'lda kirim",
  salary: "Maosh",
  correction: "Tuzatish (rollback)",
  bills: "Hisob-fakturalar",
};

const financialSourceColors: Record<string, string> = {
  sell_profit: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  manual_expense: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  manual_income: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  salary: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  correction: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  bills: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

const SkeletonBox = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
);

type Tab = "overview" | "history" | "analytics";

// ==================== DETAIL POPUP ====================
const DetailPopup = ({ item, onClose }: { item: any; onClose: () => void }) => {
  const amt = Number(item.amount);
  const isPositive = amt >= 0;

  const formatNum = (n: any) => {
    const v = Number(n);
    return isNaN(v) ? "0" : v.toLocaleString("uz-UZ");
  };
  const formatDt = (ts: any) => {
    const v = Number(ts);
    if (!v || isNaN(v)) return "—";
    const d = new Date(v);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-5 ${isPositive ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-gradient-to-r from-red-500 to-rose-600"} text-white`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${isPositive ? "bg-white/20" : "bg-white/20"}`}>
              {financialSourceLabels[item.source_type] || item.source_type}
            </span>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              {isPositive ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
            </div>
            <div>
              <p className="text-3xl font-bold">
                {isPositive ? "+" : ""}{formatNum(item.amount)} so'm
              </p>
              <p className="text-white/70 text-sm">Moliyaviy taroziga ta'sir</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Balans o'zgarishi */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Balans o'zgarishi</p>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <p className="text-xs text-gray-400">Oldin</p>
                <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{formatNum(item.balance_before)}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${isPositive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                {isPositive ? "+" : ""}{formatNum(item.amount)}
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">Keyin</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatNum(item.balance_after)}</p>
              </div>
            </div>
          </div>

          {/* Tafsilotlar */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Sana</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatDt(item.created_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Tag size={16} className="text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Manba turi</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {financialSourceLabels[item.source_type] || item.source_type}
                </p>
              </div>
            </div>

            {item.related_user && (
              <div className="flex items-center gap-3">
                <User size={16} className="text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Bog'liq foydalanuvchi</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {item.related_user.name}
                    {item.related_user.role && (
                      <span className="ml-2 text-xs text-gray-400">({item.related_user.role})</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {item.created_by && (
              <div className="flex items-center gap-3">
                <User size={16} className="text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Kim tomonidan</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.created_by.name}</p>
                </div>
              </div>
            )}

            {item.order && (
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Buyurtma</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    #{item.order.id?.slice(0, 8)} — {formatNum(item.order.total_price)} so'm
                  </p>
                </div>
              </div>
            )}

            {item.comment && (
              <div className="flex items-start gap-3">
                <FileText size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400">Izoh</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{item.comment}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
const FinancialHistory: React.FC = () => {
  const { t: th } = useTranslation("history");
  const { getFinancialBalanceHistory, getFinancialBalanceAnalytics, getFinancialBalanceTopImpacts } = useCashBox();
  const { data: balanceData, isLoading: balanceLoading } = useHistory().getHistory();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [page, setPage] = useState(1);
  const [topImpactPage, setTopImpactPage] = useState(1);
  const today = dayjs().format("YYYY-MM-DD");
  const [filters, setFilters] = useState<{ fromDate?: string; toDate?: string; sourceType?: string }>({ fromDate: today, toDate: today });
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown tashqariga bosganda yopilishi
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSourceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setTopImpactPage(1);
  }, [filters.fromDate, filters.toDate]);

  const { data: historyData, isLoading: historyLoading } = getFinancialBalanceHistory({ ...filters, page, limit: 20 });
  const { data: analyticsData, isLoading: analyticsLoading } = getFinancialBalanceAnalytics({ fromDate: filters.fromDate, toDate: filters.toDate });
  const { data: topImpactsData, isLoading: topImpactsLoading } = getFinancialBalanceTopImpacts({
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    page: topImpactPage,
    limit: 20,
  });

  const history = historyData?.data;
  const analytics = analyticsData?.data;
  const topImpacts = topImpactsData?.data;

  const bd = balanceData?.data;
  const markets = bd?.markets?.allMarketCashboxes?.map((o: any) => ({ name: o?.user?.name, amount: o?.balance }));
  const couriers = bd?.couriers?.allCourierCashboxes?.map((c: any) => ({ name: c?.user?.name, amount: c?.balance, region: c?.user?.region?.name }));
  const totalMarket = bd?.markets?.marketsTotalBalans || 0;
  const totalCourier = bd?.couriers?.couriersTotalBalanse || 0;
  const kassa = bd?.main?.balance || 0;
  const currentSituation = bd?.currentSituation || 0;
  const isPositive = currentSituation >= 0;

  const barChartData = [
    { name: "Kassa", value: kassa, color: "#8B5CF6" },
    { name: "Kuryerlar", value: totalCourier, color: totalCourier >= 0 ? "#10B981" : "#EF4444" },
    { name: "Marketlar", value: totalMarket, color: totalMarket >= 0 ? "#10B981" : "#EF4444" },
  ];
  const pieChartData = [
    { name: "Kassa", value: Math.abs(kassa), color: "#8B5CF6" },
    { name: "Kuryerlar", value: Math.abs(totalCourier), color: totalCourier >= 0 ? "#10B981" : "#EF4444" },
    { name: "Marketlar", value: Math.abs(totalMarket), color: totalMarket >= 0 ? "#10B981" : "#EF4444" },
  ].filter((i) => i.value > 0);

  const formatNumber = (num: number | string) => {
    const n = Number(num);
    return isNaN(n) ? "0" : n.toLocaleString("uz-UZ");
  };
  const formatDate = (timestamp: any) => {
    const ts = Number(timestamp);
    if (!ts || isNaN(ts)) return "—";
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Umumiy ko'rinish", icon: <Scale size={16} /> },
    { key: "history", label: "Tarix", icon: <History size={16} /> },
    { key: "analytics", label: "Tahlil", icon: <BarChart3 size={16} /> },
  ];

  return (
    <div className="min-h-screen">
      {/* Detail Popup */}
      {selectedItem && <DetailPopup item={selectedItem} onClose={() => setSelectedItem(null)} />}

      {/* ========== HERO ========== */}
      <div className={`${isPositive ? "bg-gradient-to-r from-emerald-600 to-emerald-700" : "bg-gradient-to-r from-red-600 to-red-700"} text-white`}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
                <Scale className="w-4 h-4" />
                <span>Moliyaviy balans</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-1">Moliyaviy tarozi</h1>
              <div className="flex items-center gap-2">
                {isPositive ? <CheckCircle2 className="w-5 h-5 text-emerald-200" /> : <AlertCircle className="w-5 h-5 text-red-200" />}
                <span className="text-white/80 text-sm">{isPositive ? "Ijobiy holat — balans musbat" : "Salbiy holat — balans manfiy"}</span>
              </div>
            </div>
            <div className="text-right">
              {balanceLoading ? <SkeletonBox className="w-48 h-14 ml-auto" /> : (
                <>
                  <p className="text-4xl sm:text-5xl font-bold">{isPositive ? "+" : ""}<CountUp end={currentSituation} duration={1} separator=" " /></p>
                  <p className="text-white/70 text-sm">main + kuryerlar - marketlar = tarozi</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========== 3 KARTA ========== */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 -mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><Building2 className="w-5 h-5 text-purple-600" /></div>
              <div><span className="text-sm font-medium text-gray-500">{th("kassa")}</span><p className="text-xs text-purple-500">Mavjud mablag'</p></div>
            </div>
            {balanceLoading ? <SkeletonBox className="w-32 h-8" /> : <p className="text-2xl font-bold text-purple-600"><CountUp end={kassa} duration={1} separator=" " /> <span className="text-base font-normal text-gray-400">UZS</span></p>}
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl shadow-lg p-5 border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center"><Store className="w-5 h-5 text-white" /></div>
              <div><span className="text-sm font-medium text-red-700 dark:text-red-400">{th("markets")}</span><p className="text-xs text-red-500">{totalMarket < 0 ? "(-) Biz qarzmiz" : "(+) Bizdan qarz"}</p></div>
            </div>
            {balanceLoading ? <SkeletonBox className="w-32 h-8" /> : <p className={`text-2xl font-bold ${totalMarket < 0 ? "text-red-600" : "text-emerald-600"}`}><CountUp end={totalMarket} duration={1} separator=" " /> <span className="text-base font-normal text-gray-400">UZS</span></p>}
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl shadow-lg p-5 border-2 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center"><Truck className="w-5 h-5 text-white" /></div>
              <div><span className="text-sm font-medium text-amber-700 dark:text-amber-400">{th("couriers")}</span><p className="text-xs text-amber-600">{totalCourier > 0 ? "(+) Bizning pul" : "(-) Biz qarz"}</p></div>
            </div>
            {balanceLoading ? <SkeletonBox className="w-32 h-8" /> : <p className={`text-2xl font-bold ${totalCourier > 0 ? "text-emerald-600" : "text-red-600"}`}><CountUp end={totalCourier} duration={1} separator=" " /> <span className="text-base font-normal text-gray-400">UZS</span></p>}
          </div>
        </div>
      </div>

      {/* ========== TABS ========== */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 mt-6">
        <div className="grid grid-cols-3 bg-gray-100 dark:bg-[#1E1B2E] rounded-2xl p-1.5 gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-white dark:bg-[#2A263D] text-indigo-600 dark:text-indigo-400 shadow-md"
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === "overview" && (
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Moliyaviy ko'rsatkichlar</h3>
              {balanceLoading ? <SkeletonBox className="w-full h-[200px]" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6B7280" }} width={100} />
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString()} UZS`, ""]} contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: "8px", color: "#fff" }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>{barChartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Taqsimot</h3>
              {balanceLoading ? <SkeletonBox className="w-full h-[200px]" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={pieChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">{pieChartData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={(v: number) => [`${v.toLocaleString()} UZS`, ""]} contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: "8px", color: "#fff" }} /></PieChart>
                </ResponsiveContainer>
              )}
              <div className="space-y-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                {pieChartData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-sm text-gray-600 dark:text-gray-300">{item.name}</span></div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">{item.value.toLocaleString()} UZS</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"><Store className="w-4 h-4 text-purple-600" /></div><div><h3 className="font-semibold text-gray-800 dark:text-white">{th("markets")}</h3><p className="text-xs text-gray-400">Marketlar bilan hisob-kitob</p></div></div>
                <span className="text-sm font-medium text-gray-500">{markets?.length || 0} ta</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {balanceLoading ? <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <SkeletonBox key={i} className="w-full h-12" />)}</div> : markets?.length ? markets.map((m: any, idx: number) => (
                  <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0"><div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 font-semibold text-sm flex-shrink-0">{idx + 1}</div><span className="font-medium text-gray-700 dark:text-gray-200 truncate">{m.name}</span></div>
                    <span className={`font-semibold ${Number(m.amount) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(m.amount).toLocaleString()}</span>
                  </div>
                )) : <div className="p-8 text-center text-gray-400"><Store className="w-10 h-10 mx-auto mb-2 opacity-50" /><p>Marketlar yo'q</p></div>}
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="font-medium text-gray-600 dark:text-gray-300">Jami</span>
                <span className={`text-lg font-bold ${totalMarket >= 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(totalMarket).toLocaleString()} UZS</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Truck className="w-4 h-4 text-blue-600" /></div><div><h3 className="font-semibold text-gray-800 dark:text-white">{th("couriers")}</h3><p className="text-xs text-gray-400">Kuryerlar bilan hisob-kitob</p></div></div>
                <span className="text-sm font-medium text-gray-500">{couriers?.length || 0} ta</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {balanceLoading ? <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <SkeletonBox key={i} className="w-full h-12" />)}</div> : couriers?.length ? couriers.map((c: any, idx: number) => (
                  <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0"><div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 font-semibold text-sm flex-shrink-0">{idx + 1}</div><div className="min-w-0"><p className="font-medium text-gray-700 dark:text-gray-200 truncate">{c.name}</p>{c.region && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.region}</p>}</div></div>
                    <span className={`font-semibold ${Number(c.amount) > 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(c.amount).toLocaleString()}</span>
                  </div>
                )) : <div className="p-8 text-center text-gray-400"><Truck className="w-10 h-10 mx-auto mb-2 opacity-50" /><p>Kuryerlar yo'q</p></div>}
              </div>
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="font-medium text-gray-600 dark:text-gray-300">Jami</span>
                <span className={`text-lg font-bold ${totalCourier > 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(totalCourier).toLocaleString()} UZS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== HISTORY TAB ========== */}
      {activeTab === "history" && (
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[280px] max-w-[400px]">
              <CustomCalendar
                from={filters.fromDate ? dayjs(filters.fromDate) : null}
                to={filters.toDate ? dayjs(filters.toDate) : null}
                setFrom={(date: any) => setFilters((p) => ({ ...p, fromDate: date?.format("YYYY-MM-DD") || undefined }))}
                setTo={(date: any) => setFilters((p) => ({ ...p, toDate: date?.format("YYYY-MM-DD") || undefined }))}
              />
            </div>

            {/* Bugun tugmasi */}
            {(filters.fromDate !== today || filters.toDate !== today) && (
              <button
                onClick={() => setFilters((p) => ({ ...p, fromDate: today, toDate: today }))}
                className="h-10 px-4 rounded-xl text-sm font-medium border bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 hover:bg-indigo-700 transition-all"
              >
                Bugun
              </button>
            )}

            {/* Source dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
                className={`flex items-center gap-1.5 h-10 px-3 rounded-xl border shadow-sm text-sm transition-colors ${
                  filters.sourceType
                    ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                    : "bg-white dark:bg-[#28243D] border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                }`}
              >
                <Tag size={14} />
                {filters.sourceType ? financialSourceLabels[filters.sourceType] : "Manba turi"}
                <ChevronDown size={14} className={`transition-transform ${sourceDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {sourceDropdownOpen && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-[#28243D] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[220px]">
                  <button
                    onClick={() => { setFilters((p) => { const n = { ...p }; delete n.sourceType; return n; }); setSourceDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!filters.sourceType ? "text-indigo-600 font-medium bg-indigo-50 dark:bg-indigo-900/20" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    Barchasi
                  </button>
                  {Object.entries(financialSourceLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setFilters((p) => ({ ...p, sourceType: key })); setSourceDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${filters.sourceType === key ? "text-indigo-600 font-medium bg-indigo-50 dark:bg-indigo-900/20" : "text-gray-700 dark:text-gray-300"}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${financialSourceColors[key]?.split(" ")[0] || "bg-gray-300"}`} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filters.sourceType && (
              <button onClick={() => setFilters((p) => { const n = { ...p }; delete n.sourceType; return n; })} className="flex items-center gap-1 h-10 px-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 text-sm hover:bg-red-100 transition-colors">
                <X size={14} />
                Tozalash
              </button>
            )}
          </div>

          {/* History Table */}
          {historyLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
          ) : !history?.history?.length ? (
            <div className="text-center py-16 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">Ma'lumot topilmadi</p>
              <p className="text-sm mt-1">Hozircha moliyaviy taroziga ta'sir qilgan hodisalar yo'q</p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="hidden md:grid grid-cols-6 gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-500 uppercase">
                  <span>Sana</span><span>Manba</span><span>O'zgarish</span><span>Oldingi balans</span><span>Keyingi balans</span><span>Izoh</span>
                </div>
                {history.history.map((item: any) => {
                  const amt = Number(item.amount);
                  const pos = amt >= 0;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="grid grid-cols-1 md:grid-cols-6 gap-2 md:gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-700/50 hover:bg-indigo-50/50 dark:hover:bg-gray-800/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${pos ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                          {pos ? <ArrowUpRight size={14} className="text-green-600" /> : <ArrowDownLeft size={14} className="text-red-600" />}
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(item.created_at)}</span>
                      </div>
                      <div className="flex items-center">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${financialSourceColors[item.source_type] || "bg-gray-100 text-gray-700"}`}>
                          {financialSourceLabels[item.source_type] || item.source_type}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className={`text-sm font-bold ${pos ? "text-green-600" : "text-red-600"}`}>
                          {pos ? "+" : ""}{formatNumber(item.amount)} so'm
                        </span>
                      </div>
                      <div className="flex items-center"><span className="text-sm text-gray-500">{formatNumber(item.balance_before)}</span></div>
                      <div className="flex items-center"><span className="text-sm font-medium text-gray-900 dark:text-white">{formatNumber(item.balance_after)}</span></div>
                      <div className="flex items-center overflow-hidden">
                        <span className="text-xs text-gray-400 truncate">
                          {item.related_user?.name ? `${item.related_user.name}` : item.comment ? item.comment.slice(0, 30) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {history.pagination && (
                <div className="flex justify-center">
                  <Pagination current={history.pagination.page} total={history.pagination.total} pageSize={history.pagination.limit} onChange={(p) => setPage(p)} showSizeChanger={false} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========== ANALYTICS TAB ========== */}
      {activeTab === "analytics" && (
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[280px] max-w-[400px]">
              <CustomCalendar
                from={filters.fromDate ? dayjs(filters.fromDate) : null}
                to={filters.toDate ? dayjs(filters.toDate) : null}
                setFrom={(date: any) => setFilters((p) => ({ ...p, fromDate: date?.format("YYYY-MM-DD") || undefined }))}
                setTo={(date: any) => setFilters((p) => ({ ...p, toDate: date?.format("YYYY-MM-DD") || undefined }))}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: "Bugun", from: dayjs(), to: dayjs() },
                { label: "Hafta", from: dayjs().subtract(7, "day"), to: dayjs() },
                { label: "Oy", from: dayjs().subtract(1, "month"), to: dayjs() },
                { label: "Yillik", from: dayjs().subtract(1, "year"), to: dayjs() },
              ].map((preset) => {
                const isActive = filters.fromDate === preset.from.format("YYYY-MM-DD") && filters.toDate === preset.to.format("YYYY-MM-DD");
                return (
                  <button
                    key={preset.label}
                    onClick={() => setFilters((p) => ({ ...p, fromDate: preset.from.format("YYYY-MM-DD"), toDate: preset.to.format("YYYY-MM-DD") }))}
                    className={`h-10 px-4 rounded-xl text-sm font-medium border transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-indigo-900/40"
                        : "bg-white dark:bg-[#28243D] border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
          ) : !analytics ? (
            <div className="text-center py-16 text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">Tahlil uchun ma'lumot yo'q</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><TrendingUp size={20} className="text-green-600" /></div><span className="text-sm text-gray-500">Musbat ta'sir (+)</span></div>
                  <div className="text-xl font-bold text-green-600">+<CountUp end={analytics.summary?.totalPositive || 0} separator="," duration={1} /> so'm</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center"><TrendingDown size={20} className="text-red-600" /></div><span className="text-sm text-gray-500">Manfiy ta'sir (-)</span></div>
                  <div className="text-xl font-bold text-red-600">-<CountUp end={analytics.summary?.totalNegative || 0} separator="," duration={1} /> so'm</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3"><div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"><Zap size={20} className="text-blue-600" /></div><span className="text-sm text-gray-500">Sof o'zgarish</span></div>
                  <div className={`text-xl font-bold ${(analytics.summary?.netChange || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>{(analytics.summary?.netChange || 0) >= 0 ? "+" : ""}<CountUp end={analytics.summary?.netChange || 0} separator="," duration={1} /> so'm</div>
                  <div className="text-xs text-gray-400 mt-1">{analytics.summary?.totalCount || 0} ta tranzaksiya</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-green-500" />Musbatga tortuvchi manbalar</h3>
                  {analytics.positiveImpact?.length ? analytics.positiveImpact.map((item: any, idx: number) => (
                    <div key={idx} className="space-y-1 mb-3">
                      <div className="flex items-center justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">{financialSourceLabels[item.source_type] || item.source_type}</span><div className="flex items-center gap-2"><span className="font-semibold text-green-600">+{formatNumber(item.total_amount)} so'm</span><span className="text-xs text-gray-400 w-12 text-right">{item.percentage}%</span></div></div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{ width: `${item.percentage}%` }} /></div>
                    </div>
                  )) : <p className="text-sm text-gray-400">Ma'lumot yo'q</p>}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><TrendingDown size={16} className="text-red-500" />Manfiyga tortuvchi manbalar</h3>
                  {analytics.negativeImpact?.length ? analytics.negativeImpact.map((item: any, idx: number) => (
                    <div key={idx} className="space-y-1 mb-3">
                      <div className="flex items-center justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">{financialSourceLabels[item.source_type] || item.source_type}</span><div className="flex items-center gap-2"><span className="font-semibold text-red-600">-{formatNumber(item.total_amount)} so'm</span><span className="text-xs text-gray-400 w-12 text-right">{item.percentage}%</span></div></div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2"><div className="bg-red-500 h-2 rounded-full transition-all duration-500" style={{ width: `${item.percentage}%` }} /></div>
                    </div>
                  )) : <p className="text-sm text-gray-400">Ma'lumot yo'q</p>}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" />
                    Eng katta ta'sir ko'rsatgan tranzaksiyalar
                  </h3>
                  {topImpacts?.pagination?.total > 0 && (
                    <span className="text-xs text-gray-400">
                      {topImpacts.pagination.total} ta jami
                    </span>
                  )}
                </div>
                {topImpactsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <SkeletonBox key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !topImpacts?.items?.length ? (
                  <div className="py-10 text-center text-sm text-gray-400">
                    Ma'lumot topilmadi
                  </div>
                ) : (
                  <>
                    {topImpacts.items.map((item: any, idx: number) => {
                      const amt = Number(item.amount);
                      const pos = amt >= 0;
                      const rank =
                        (topImpacts.pagination.page - 1) * topImpacts.pagination.limit + idx + 1;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className="w-full flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg px-2 -mx-2 transition-colors text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold text-gray-400 w-7 flex-shrink-0">
                              #{rank}
                            </span>
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                pos ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
                              }`}
                            >
                              {pos ? (
                                <ArrowUpRight size={14} className="text-green-600 dark:text-green-400" />
                              ) : (
                                <ArrowDownLeft size={14} className="text-red-600 dark:text-red-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    financialSourceColors[item.source_type] || "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {financialSourceLabels[item.source_type] || item.source_type}
                                </span>
                                {item.related_user && (
                                  <span className="text-xs text-gray-400 truncate">
                                    {item.related_user.name}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-400 block mt-0.5">
                                {formatDate(item.created_at)}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`text-sm font-bold flex-shrink-0 ml-2 ${
                              pos ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {pos ? "+" : ""}
                            {formatNumber(item.amount)} so'm
                          </span>
                        </button>
                      );
                    })}
                    {topImpacts.pagination.totalPages > 1 && (
                      <div className="flex justify-center mt-4">
                        <Pagination
                          current={topImpacts.pagination.page}
                          total={topImpacts.pagination.total}
                          pageSize={topImpacts.pagination.limit}
                          onChange={(p) => setTopImpactPage(p)}
                          showSizeChanger={false}
                          size="small"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FinancialHistory;
