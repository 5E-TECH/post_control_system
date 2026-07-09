import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Empty, Spin } from "antd";
import {
  Bot,
  Wallet,
  Tag as TagIcon,
  Power,
  ArrowDownCircle,
  ArrowUpCircle,
  RotateCcw,
  Info,
} from "lucide-react";
import { api } from "../../shared/api";

const som = (n?: number | null) =>
  (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const formatDateTime = (ts?: number | null) => {
  if (!ts) return "—";
  const d = new Date(Number(ts));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
};

interface AiState {
  enabled: boolean;
  balance: number;
  price: number;
}
interface AiTx {
  id: string;
  type: "topup" | "usage" | "refund";
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: number;
}

const txMeta = {
  topup: {
    label: "To'ldirildi",
    sign: "+",
    icon: ArrowUpCircle,
    cls: "text-green-600 dark:text-green-400",
    badge:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  usage: {
    label: "Ishlatildi",
    sign: "−",
    icon: ArrowDownCircle,
    cls: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  refund: {
    label: "Qaytarildi",
    sign: "+",
    icon: RotateCcw,
    cls: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
} as const;

const MarketAiBalance = () => {
  const stateQ = useQuery({
    queryKey: ["ai-balance-me"],
    queryFn: () =>
      api.get("ai-balance/me").then((r) => r.data.data as AiState | null),
  });
  const historyQ = useQuery({
    queryKey: ["ai-balance-me-history"],
    queryFn: () =>
      api
        .get("ai-balance/me/history", { params: { limit: 100 } })
        .then((r) => (r.data.data as AiTx[]) || []),
  });

  const s = stateQ.data;
  const history = Array.isArray(historyQ.data) ? historyQ.data : [];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">
              AI balansi
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AI orqali buyurtma yaratish uchun balans va sarflar tarixi
            </p>
          </div>
        </div>

        {stateQ.isLoading ? (
          <div className="py-16 text-center">
            <Spin />
          </div>
        ) : (
          <>
            {/* Balance cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl shadow-sm p-5 text-white">
                <div className="flex items-center gap-2 text-purple-100 text-sm mb-1">
                  <Wallet className="w-4 h-4" /> Joriy balans
                </div>
                <div className="text-3xl font-bold">
                  {som(s?.balance)}{" "}
                  <span className="text-lg font-medium text-purple-200">
                    so'm
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                  <TagIcon className="w-4 h-4" /> Bir buyurtma narxi
                </div>
                <div className="text-2xl font-bold text-gray-800 dark:text-white">
                  {som(s?.price)}{" "}
                  <span className="text-sm font-medium text-gray-400">so'm</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                  <Power className="w-4 h-4" /> Holat
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold ${
                    s?.enabled
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {s?.enabled ? "AI yoqilgan" : "AI o'chirilgan"}
                </span>
              </div>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 rounded-xl bg-sky-50 dark:bg-sky-900/15 border border-sky-100 dark:border-sky-900/30 p-3 text-sm text-sky-700 dark:text-sky-300">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Har yaratilgan buyurtmadan{" "}
                <b>{som(s?.price)} so'm</b> yechiladi. Balansni to'ldirish uchun
                administrator bilan bog'laning.
              </span>
            </div>

            {/* History */}
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-3">
                Sarflar tarixi
              </h2>
              {historyQ.isLoading ? (
                <div className="py-10 text-center">
                  <Spin />
                </div>
              ) : history.length === 0 ? (
                <div className="bg-white dark:bg-[#2A2640] rounded-xl shadow-sm py-12">
                  <Empty description="Hali harakat yo'q" />
                </div>
              ) : (
                <div className="bg-white dark:bg-[#2A2640] rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                          <th className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                            Sana
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">
                            Turi
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap">
                            Miqdor
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap">
                            Qoldiq
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold">
                            Izoh
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {history.map((tx) => {
                          const m = txMeta[tx.type] ?? txMeta.usage;
                          const Icon = m.icon;
                          return (
                            <tr
                              key={tx.id}
                              className="hover:bg-purple-50 dark:hover:bg-[#3d3759] transition-colors"
                            >
                              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {formatDateTime(tx.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${m.badge}`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {m.label}
                                </span>
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${m.cls}`}
                              >
                                {m.sign}
                                {som(tx.amount)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                {som(tx.balance_after)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-[240px] truncate">
                                {tx.note || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(MarketAiBalance);
