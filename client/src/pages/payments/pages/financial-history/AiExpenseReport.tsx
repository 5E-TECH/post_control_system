import React, { useState } from "react";
import { useFinancialAI } from "../../../../shared/api/hooks/useFinancialAI";
import AiResponseRenderer from "./AiResponseRenderer";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Loader2,
  Tag,
  AlertCircle,
  Wallet,
  ChevronDown,
  ChevronRight,
  User,
  RefreshCw,
  Clock,
  Users,
  Receipt,
  ShoppingCart,
  BarChart3,
} from "lucide-react";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const som = (n?: number) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") +
  " so'm";

const fmtDate = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const PERIODS: { key: Period; label: string }[] = [
  { key: "daily", label: "Kunlik" },
  { key: "weekly", label: "Haftalik" },
  { key: "monthly", label: "Oylik" },
  { key: "yearly", label: "Yillik" },
];

const CAT_COLORS = [
  "#8B5CF6",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
  "#84CC16",
];

const cardCls =
  "rounded-2xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50 shadow-sm";

const AiExpenseReport: React.FC = () => {
  const [period, setPeriod] = useState<Period>("monthly");
  const [openCat, setOpenCat] = useState<number | null>(null);
  const { getExpenseReport, refreshExpenseReport } = useFinancialAI();
  const { data, isLoading, isError } = getExpenseReport({ period });
  const r = data?.data;

  const total = r?.totals?.total || 0;
  const kpis = r
    ? [
        {
          label: "Jami xarajat",
          value: total,
          icon: Wallet,
          box: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
          pct: null as number | null,
        },
        {
          label: "Oyliklar",
          value: r.totals?.bySource?.salary || 0,
          icon: Users,
          box: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
          pct: total ? Math.round(((r.totals?.bySource?.salary || 0) / total) * 100) : 0,
        },
        {
          label: "Kommunal / hisob",
          value: r.totals?.bySource?.bills || 0,
          icon: Receipt,
          box: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
          pct: total ? Math.round(((r.totals?.bySource?.bills || 0) / total) * 100) : 0,
        },
        {
          label: "Qo'lda chiqim",
          value: r.totals?.bySource?.manual_expense || 0,
          icon: ShoppingCart,
          box: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
          pct: total ? Math.round(((r.totals?.bySource?.manual_expense || 0) / total) * 100) : 0,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Sarlavha + davr tanlagich */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              AI xarajat hisoboti
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kategoriya, trend va statistika — sun'iy intellekt tahlili
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
                  period === p.key
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refreshExpenseReport.mutate()}
            disabled={refreshExpenseReport.isPending}
            title="Barcha davrlarni AI bilan qayta hisoblash"
            className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-5 h-5 ${refreshExpenseReport.isPending ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {r?.computedAt && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          Hisoblangan: {fmtDate(r.computedAt)}
          {r.cached === false ? " · jonli" : ""}
          {refreshExpenseReport.isPending ? " · yangilanmoqda..." : ""}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400 text-base">
          <Loader2 className="w-7 h-7 animate-spin mr-3" />
          AI xarajatlarni tahlil qilyapti...
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 p-5 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-base">
          <AlertCircle className="w-6 h-6" />
          Hisobotni yuklashda xatolik. Qayta urinib ko'ring.
        </div>
      )}

      {!isLoading && !isError && r && (
        <>
          {/* ===== KPI kartalar ===== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className={`${cardCls} p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${k.box}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    {k.pct !== null && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {k.pct}%
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {k.label}
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mt-1 tracking-tight">
                    {som(k.value)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===== AI xulosa ===== */}
          <div className={`${cardCls} p-5`}>
            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100 text-base font-semibold mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              AI xulosa · {r.from} — {r.to}
            </div>
            {r.narrative ? (
              <div className="text-[15px]">
                <AiResponseRenderer text={r.narrative} />
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {r.aiEnabled === false
                  ? "AI o'chiq (ANTHROPIC_API_KEY yo'q) — faqat raqamlar ko'rsatilmoqda."
                  : "Ushbu davr uchun xarajat topilmadi."}
              </p>
            )}
          </div>

          {/* ===== Peaklar ===== */}
          {(r.peaks?.highest || r.peaks?.lowest) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {r.peaks?.highest && (
                <div className={`${cardCls} p-5 flex items-center gap-4`}>
                  <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Eng yuqori xarajat davri
                    </div>
                    <div className="text-base font-bold text-gray-800 dark:text-white">
                      {r.peaks.highest.label}
                    </div>
                    <div className="text-sm text-red-500 font-semibold">
                      {som(r.peaks.highest.total)}
                    </div>
                  </div>
                </div>
              )}
              {r.peaks?.lowest && (
                <div className={`${cardCls} p-5 flex items-center gap-4`}>
                  <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Eng past xarajat davri
                    </div>
                    <div className="text-base font-bold text-gray-800 dark:text-white">
                      {r.peaks.lowest.label}
                    </div>
                    <div className="text-sm text-green-500 font-semibold">
                      {som(r.peaks.lowest.total)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== Trend grafigi ===== */}
          {Array.isArray(r.series) && r.series.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <div className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
                <BarChart3 className="w-5 h-5 text-purple-500" />
                Xarajat dinamikasi
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={r.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="barGradHi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#9CA3AF"
                    strokeOpacity={0.2}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: "#9CA3AF" }}
                    tickLine={false}
                    axisLine={{ stroke: "#9CA3AF", strokeOpacity: 0.3 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#9CA3AF" }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v: number) =>
                      v >= 1e6
                        ? `${(v / 1e6).toFixed(1)}M`
                        : v >= 1e3
                          ? `${Math.round(v / 1e3)}K`
                          : `${v}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "#8B5CF6", fillOpacity: 0.06 }}
                    formatter={(v: number) => [som(v), "Xarajat"]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      fontSize: 13,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    }}
                  />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={56}>
                    {r.series.map((s: any, i: number) => (
                      <Cell
                        key={i}
                        fill={
                          r.peaks?.highest && s.label === r.peaks.highest.label
                            ? "url(#barGradHi)"
                            : "url(#barGrad)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ===== Kategoriya taqsimoti ===== */}
          {Array.isArray(r.byCategory) && r.byCategory.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <div className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
                <Tag className="w-5 h-5 text-purple-500" />
                Kategoriya bo'yicha
                <span className="text-xs font-normal text-gray-400">
                  · ustiga bosib ichini ko'ring
                </span>
              </div>
              <div className="space-y-4">
                {r.byCategory.map((c: any, i: number) => {
                  const pct = total ? Math.round((c.total / total) * 100) : 0;
                  const isMembers = !!(c.members && c.members.length);
                  const detail = isMembers
                    ? c.members
                    : c.items && c.items.length
                      ? c.items
                      : null;
                  const isOpen = openCat === i;
                  const color = CAT_COLORS[i % CAT_COLORS.length];
                  return (
                    <div key={i}>
                      <div
                        onClick={() => detail && setOpenCat(isOpen ? null : i)}
                        className={`rounded-xl -mx-1 px-1 ${detail ? "cursor-pointer" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[15px] text-gray-800 dark:text-gray-100 font-medium flex items-center gap-2 min-w-0">
                            {detail &&
                              (isOpen ? (
                                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                              ))}
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate">{c.name}</span>
                            {c.count ? (
                              <span className="text-gray-400 text-xs shrink-0">
                                {c.count} ta
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[15px] text-gray-700 dark:text-gray-200 font-semibold whitespace-nowrap ml-2">
                            {som(c.total)}
                            <span className="text-gray-400 text-sm font-normal ml-1.5">
                              {pct}%
                            </span>
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                      {isOpen && detail && (
                        <div className="mt-3 ml-6 pl-3 space-y-2 border-l-2 border-gray-100 dark:border-gray-700">
                          {detail.map((d: any, j: number) => (
                            <div
                              key={j}
                              className="flex items-center justify-between text-sm gap-3"
                            >
                              <span className="text-gray-600 dark:text-gray-300 truncate flex items-center gap-1.5 min-w-0">
                                {isMembers && (
                                  <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                )}
                                <span className="truncate">
                                  {isMembers ? d.name : d.comment}
                                </span>
                                {d.count ? (
                                  <span className="text-gray-400 text-xs shrink-0">
                                    · {d.count}x
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-gray-700 dark:text-gray-200 font-medium whitespace-nowrap">
                                {som(d.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== Eng katta xarajatlar (jadval) ===== */}
          {Array.isArray(r.topExpenses) && r.topExpenses.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <div className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Eng katta xarajatlar
              </div>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2.5 px-3 font-medium">Sana</th>
                      <th className="py-2.5 px-3 font-medium">Xarajat</th>
                      <th className="py-2.5 px-3 font-medium text-right">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.topExpenses.map((t: any, i: number) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 dark:border-gray-700/40 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      >
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {t.date}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-gray-700 dark:text-gray-200 truncate">
                              {t.comment || t.source_label}
                            </span>
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
                              {t.source_label}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-red-500 font-semibold whitespace-nowrap">
                          {som(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AiExpenseReport;
