import React, { useState } from "react";
import { useFinancialAI } from "../../../../shared/api/hooks/useFinancialAI";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Loader2,
  Tag,
  AlertCircle,
  Wallet,
} from "lucide-react";

type Period = "daily" | "weekly" | "monthly" | "yearly";

const som = (n?: number) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") +
  " so'm";

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

const AiExpenseReport: React.FC = () => {
  const [period, setPeriod] = useState<Period>("monthly");
  const { getExpenseReport } = useFinancialAI();
  const { data, isLoading, isError } = getExpenseReport({ period });
  const r = data?.data;

  return (
    <div className="space-y-4">
      {/* Sarlavha + davr tanlagich */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">
              AI xarajat hisoboti
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Kategoriya, trend va statistika — sun'iy intellekt tahlili
            </p>
          </div>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                period === p.key
                  ? "bg-purple-600 text-white shadow"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          AI xarajatlarni tahlil qilyapti...
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5" />
          Hisobotni yuklashda xatolik. Qayta urinib ko'ring.
        </div>
      )}

      {!isLoading && !isError && r && (
        <>
          {/* Hero: jami xarajat + AI narrativ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl p-5 bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
              <div className="flex items-center gap-2 text-purple-100 text-sm mb-1">
                <Wallet className="w-4 h-4" /> Jami xarajat ({r.from} — {r.to})
              </div>
              <div className="text-2xl font-bold">{som(r.totals?.total)}</div>
              <div className="mt-3 space-y-1 text-sm text-purple-100">
                <div className="flex justify-between">
                  <span>Oyliklar</span>
                  <span>{som(r.totals?.bySource?.salary)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kommunal/hisob</span>
                  <span>{som(r.totals?.bySource?.bills)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Qo'lda chiqim</span>
                  <span>{som(r.totals?.bySource?.manual_expense)}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 rounded-2xl p-5 bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                <Sparkles className="w-4 h-4 text-purple-500" /> AI xulosa
              </div>
              {r.narrative ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {r.narrative}
                </p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {r.aiEnabled === false
                    ? "AI o'chiq (ANTHROPIC_API_KEY yo'q) — faqat raqamlar ko'rsatilmoqda."
                    : "Ushbu davr uchun xarajat topilmadi."}
                </p>
              )}
            </div>
          </div>

          {/* Peaklar */}
          {(r.peaks?.highest || r.peaks?.lowest) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {r.peaks?.highest && (
                <div className="rounded-2xl p-4 bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Eng yuqori xarajat davri
                    </div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-white">
                      {r.peaks.highest.label} · {som(r.peaks.highest.total)}
                    </div>
                  </div>
                </div>
              )}
              {r.peaks?.lowest && (
                <div className="rounded-2xl p-4 bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Eng past xarajat davri
                    </div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-white">
                      {r.peaks.lowest.label} · {som(r.peaks.lowest.total)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trend grafigi */}
          {Array.isArray(r.series) && r.series.length > 0 && (
            <div className="rounded-2xl p-5 bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                Xarajat dinamikasi
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={r.series}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    tickFormatter={(v: number) =>
                      v >= 1e6
                        ? `${(v / 1e6).toFixed(1)}M`
                        : v >= 1e3
                          ? `${Math.round(v / 1e3)}K`
                          : `${v}`
                    }
                  />
                  <Tooltip
                    formatter={(v: number) => som(v)}
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {r.series.map((s: any, i: number) => (
                      <Cell
                        key={i}
                        fill={
                          r.peaks?.highest &&
                          s.label === r.peaks.highest.label
                            ? "#EF4444"
                            : "#8B5CF6"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Kategoriya taqsimoti (AI klasterlash) */}
          {Array.isArray(r.byCategory) && r.byCategory.length > 0 && (
            <div className="rounded-2xl p-5 bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                <Tag className="w-4 h-4 text-purple-500" /> Kategoriya bo'yicha
                (AI)
              </div>
              <div className="space-y-3">
                {r.byCategory.map((c: any, i: number) => {
                  const pct = r.totals?.total
                    ? Math.round((c.total / r.totals.total) * 100)
                    : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700 dark:text-gray-200 font-medium">
                          {c.name}
                          {c.count ? (
                            <span className="text-gray-400 ml-1 text-xs">
                              ({c.count})
                            </span>
                          ) : null}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300">
                          {som(c.total)} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
                          }}
                        />
                      </div>
                      {Array.isArray(c.examples) && c.examples.length > 0 && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                          {c.examples.join(" · ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Eng katta xarajatlar */}
          {Array.isArray(r.topExpenses) && r.topExpenses.length > 0 && (
            <div className="rounded-2xl p-5 bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700/50">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                Eng katta xarajatlar
              </div>
              <div className="space-y-2">
                {r.topExpenses.map((t: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                  >
                    <div className="min-w-0">
                      <span className="text-gray-700 dark:text-gray-200 truncate">
                        {t.comment || t.source_label}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">
                        {t.date} · {t.source_label}
                      </span>
                    </div>
                    <span className="text-red-500 font-medium whitespace-nowrap">
                      {som(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AiExpenseReport;
