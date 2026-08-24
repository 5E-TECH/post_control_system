import React, { useMemo, useState } from "react";
import { useAiDashboard } from "../../shared/api/hooks/useAiDashboard";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  Sparkles,
  Loader2,
  Wallet,
  ShoppingCart,
  Bot,
  MessageSquare,
  Cpu,
  Layers,
  AlertCircle,
  DollarSign,
} from "lucide-react";

// ─── formatlar ───
const som = (n?: number) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") +
  " so'm";

const usd = (n?: number) => {
  const v = Number(n) || 0;
  return "$" + (v < 1 ? v.toFixed(4) : v.toFixed(2));
};

const int = (n?: number) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// epoch-ms -> Tashkent YYYY-MM-DD (DST yo'q, +5).
const ymd = (ms: number) =>
  new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 10);

const FEATURE_LABEL: Record<string, string> = {
  order_extract: "Buyurtma ajratish",
  order_extract_multi: "Ko'p buyurtma ajratish",
  order_district: "Tuman aniqlash",
  order_item_match: "Mahsulot moslash",
  finance_chat: "Elchin chat",
  finance_file: "Fayl tahlili",
  finance_category: "Kategoriyalash",
  finance_title: "Suhbat sarlavhasi",
  finance_report: "Xarajat hisoboti",
};

const modelShort = (m?: string) =>
  (m || "").replace(/^claude-/, "").replace(/-\d{8}$/, "");

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

const RANGES: { key: string; label: string; days: number }[] = [
  { key: "7", label: "7 kun", days: 7 },
  { key: "30", label: "30 kun", days: 30 },
  { key: "90", label: "90 kun", days: 90 },
];

interface Feature {
  feature: string;
  area: string;
  calls: number;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costUzs: number;
}
interface ModelRow {
  model: string;
  calls: number;
  costUsd: number;
  costUzs: number;
  // recharts Pie data (ChartDataInput) indeks-imzo talab qiladi.
  [k: string]: string | number;
}
interface Daily {
  day: string;
  costUsd: number;
  costUzs: number;
  calls: number;
  aiOrders: number;
}

const AiDashboard: React.FC = () => {
  const [days, setDays] = useState(30);
  const { getDashboard, getAiOrders } = useAiDashboard();

  const range = useMemo(() => {
    const to = ymd(Date.now());
    const from = ymd(Date.now() - (days - 1) * 86400000);
    return { fromDate: from, toDate: to };
  }, [days]);

  const { data, isLoading, isError } = getDashboard(range);
  const { data: ordersData } = getAiOrders({ ...range, limit: 50 });
  const r = data?.data;
  const orders = ordersData?.data?.orders || [];

  const summary = r?.summary;
  const byFeature: Feature[] = r?.byFeature || [];
  const byModel: ModelRow[] = r?.byModel || [];
  const daily: Daily[] = r?.dailySeries || [];
  const orderSources = r?.orderSources || { ai: 0, manual: 0, bot: 0 };

  const kpis = summary
    ? [
        {
          label: "Jami AI xarajat",
          value: som(summary.totalCostUzs),
          sub: usd(summary.totalCostUsd),
          icon: Wallet,
          box: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
        },
        {
          label: "AI buyurtmalar",
          value: int(summary.aiOrderCount) + " ta",
          sub: `Qo'lda: ${int(orderSources.manual)} · Bot: ${int(
            orderSources.bot,
          )}`,
          icon: ShoppingCart,
          box: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
        },
        {
          label: "O'rtacha / AI buyurtma",
          value: som(summary.avgCostPerOrderUzs),
          sub: usd(summary.avgCostPerOrderUsd),
          icon: Bot,
          box: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
        },
        {
          label: "Elchin / prompt",
          value: som(summary.avgCostPerPromptUzs),
          sub: `${int(summary.financePrompts)} prompt · ${usd(
            summary.avgCostPerPromptUsd,
          )}`,
          icon: MessageSquare,
          box: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
        },
      ]
    : [];

  const maxFeatureCost = Math.max(1, ...byFeature.map((f) => f.costUzs));

  return (
    <div className="p-4 sm:p-6 space-y-5 text-gray-800 dark:text-[#E7E3FCE5]">
      {/* Sarlavha + oraliq */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Dashboard</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sun'iy intellekt real xarajati va buyurtma analitikasi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#2A263D] rounded-xl p-1">
          {RANGES.map((rg) => (
            <button
              key={rg.key}
              onClick={() => setDays(rg.days)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                days === rg.days
                  ? "bg-white dark:bg-[#3a3550] text-purple-600 dark:text-purple-300 shadow-sm font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              }`}
            >
              {rg.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin mr-2" /> Yuklanmoqda...
        </div>
      )}

      {isError && (
        <div className={`${cardCls} p-6 flex items-center gap-3 text-red-500`}>
          <AlertCircle /> Ma'lumotni yuklab bo'lmadi. Qayta urinib ko'ring.
        </div>
      )}

      {!isLoading && !isError && r && (
        <>
          {/* KPI kartalar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {kpis.map((k, i) => (
              <div key={i} className={`${cardCls} p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.box}`}>
                    <k.icon size={18} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {k.label}
                  </span>
                </div>
                <div className="text-lg font-bold leading-tight">{k.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Kunlik trend */}
          <div className={`${cardCls} p-4 sm:p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={18} className="text-purple-500" />
              <h2 className="font-semibold">Kunlik xarajat va AI buyurtmalar</h2>
            </div>
            {daily.length === 0 ? (
              <EmptyBox text="Bu oraliqda AI xarajati yo'q" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={daily}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#9CA3AF33"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    tickFormatter={(d: string) => d.slice(5)}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    tickFormatter={(v: number) => int(v)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 20px rgba(0,0,0,.15)",
                    }}
                    formatter={(value: number, name: string) =>
                      name === "Xarajat"
                        ? [som(value), name]
                        : [int(value) + " ta", name]
                    }
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="costUzs"
                    name="Xarajat"
                    fill="url(#costGrad)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="aiOrders"
                    name="AI buyurtma"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Feature bo'yicha */}
            <div className={`${cardCls} p-4 sm:p-5`}>
              <div className="flex items-center gap-2 mb-4">
                <Layers size={18} className="text-purple-500" />
                <h2 className="font-semibold">Amallar bo'yicha xarajat</h2>
              </div>
              {byFeature.length === 0 ? (
                <EmptyBox text="Ma'lumot yo'q" />
              ) : (
                <div className="space-y-2.5">
                  {byFeature.map((f, i) => (
                    <div key={f.feature + i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              background: CAT_COLORS[i % CAT_COLORS.length],
                            }}
                          />
                          {FEATURE_LABEL[f.feature] || f.feature}
                          <span className="text-xs text-gray-400">
                            ({int(f.calls)})
                          </span>
                        </span>
                        <span className="font-medium">{som(f.costUzs)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700/40 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(f.costUzs / maxFeatureCost) * 100}%`,
                            background: CAT_COLORS[i % CAT_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Model bo'yicha */}
            <div className={`${cardCls} p-4 sm:p-5`}>
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={18} className="text-purple-500" />
                <h2 className="font-semibold">Model bo'yicha xarajat</h2>
              </div>
              {byModel.length === 0 ? (
                <EmptyBox text="Ma'lumot yo'q" />
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={byModel}
                        dataKey="costUzs"
                        nameKey="model"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {byModel.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CAT_COLORS[i % CAT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "none" }}
                        formatter={(v: number, n: string) => [
                          som(v),
                          modelShort(n),
                        ]}
                      />
                      <Legend
                        formatter={(v: string) => modelShort(v)}
                        wrapperStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* AI buyurtmalar ro'yxati */}
          <div className={`${cardCls} p-4 sm:p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart size={18} className="text-purple-500" />
              <h2 className="font-semibold">
                AI orqali yaratilgan buyurtmalar
                <span className="text-xs text-gray-400 ml-2">
                  ({int(ordersData?.data?.total || 0)})
                </span>
              </h2>
            </div>
            {orders.length === 0 ? (
              <EmptyBox text="Bu oraliqda AI orqali yaratilgan buyurtma yo'q" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100 dark:border-gray-700/40">
                      <th className="py-2 pr-3 font-medium">№</th>
                      <th className="py-2 pr-3 font-medium">Sana</th>
                      <th className="py-2 pr-3 font-medium">Market</th>
                      <th className="py-2 pr-3 font-medium">Operator</th>
                      <th className="py-2 pr-3 font-medium text-right">Summa</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(
                      (o: {
                        id: string;
                        orderNumber: number;
                        createdAtLabel: string;
                        market: string | null;
                        operator: string | null;
                        totalPrice: number;
                        status: string;
                      }) => (
                        <tr
                          key={o.id}
                          className="border-b border-gray-50 dark:border-gray-700/20 hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                          <td className="py-2 pr-3 font-medium">
                            #{o.orderNumber}
                          </td>
                          <td className="py-2 pr-3 text-gray-500">
                            {o.createdAtLabel}
                          </td>
                          <td className="py-2 pr-3">{o.market || "—"}</td>
                          <td className="py-2 pr-3 text-gray-500">
                            {o.operator || "—"}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {som(o.totalPrice)}
                          </td>
                          <td className="py-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            Kurs: 1$ = {int(r.usdUzsRate)} so'm · Oraliq: {r.from} .. {r.to}
          </p>
        </>
      )}
    </div>
  );
};

const EmptyBox: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-12 text-center text-sm text-gray-400">{text}</div>
);

export default AiDashboard;
