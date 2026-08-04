import { memo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { formatMoney, formatMoneyShort } from "./format";

export interface RevenuePoint {
  label: string;
  revenue: number;
  ordersCount: number;
}

interface Props {
  data: RevenuePoint[];
  loading?: boolean;
  title?: string;
}

// Investor daromad trendi (recharts AreaChart, data-as-prop).
// Mavjud RevenueChart o'zi dashboard/revenue'dan fetch qilgani (investorga ruxsat
// yo'q) sababli reuse o'rniga data-prop variant.
const InvestorRevenueChart = ({ data, loading, title }: Props) => {
  return (
    <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-6 rounded-2xl shadow-lg">
      {title && (
        <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-4">
          {title}
        </h3>
      )}
      {loading ? (
        <div className="h-72 flex items-center justify-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
          Ma'lumot yo'q
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={288}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="investorRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8247ff" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#8247ff" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#8884aa22" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis
              tickFormatter={(v) => formatMoneyShort(v)}
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              width={48}
            />
            <Tooltip
              formatter={(value: any, name: string) =>
                name === "revenue"
                  ? [formatMoney(value), "Foyda"]
                  : [value, "Buyurtma"]
              }
              contentStyle={{
                borderRadius: 12,
                border: "none",
                background: "#2A263D",
                color: "#fff",
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#8247ff"
              strokeWidth={2}
              fill="url(#investorRevenueFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default memo(InvestorRevenueChart);
