import { memo, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useHistory } from "../../shared/api/hooks/useHistory";
import { useTranslation } from "react-i18next";

interface ChartData {
  name: string;
  value: number;
  fill: string;
}

const SkeletonBox = ({ className }: { className?: string }) => (
  <div
    className={`animate-pulse bg-gray-300 dark:bg-gray-600 rounded ${className}`}
  />
);

const Dashboard: React.FC = () => {
  const { t } = useTranslation("history");
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const { data, isLoading } = useHistory().getHistory();

  const orders = data?.data?.markets?.allMarketCashboxes;
  const markets = orders?.map((order: any) => ({
    name: order?.user?.name,
    amount: order?.balance,
  }));

  const tableCouriers = data?.data?.couriers?.allCourierCashboxes;
  const couriers = tableCouriers?.map((courier: any) => ({
    name: courier?.user?.name,
    amount: courier?.balance,
    region: courier?.user?.region?.name,
  }));

  const totalMarket = data?.data?.markets?.marketsTotalBalans;
  const totalCourier = data?.data?.couriers?.couriersTotalBalanse;

  const balans = data?.data?.difference;
  const kassa = data?.data?.main?.balance;
  const bugungiHolat = data?.data?.currentSituation;

  const chartData: ChartData[] = [
    {
      name: t("balans"),
      value: balans,
      fill: balans >= 0 ? "#10B981" : "#EF4444",
    },
    { name: t("kassa"), value: kassa, fill: "#10B981" },
  ];

  const maxValue = Math.max(Math.abs(balans), Math.abs(kassa));
  const chartMin = -maxValue * 1.2;
  const chartMax = maxValue * 1.2;

  return (
    <div className="w-full p-4 sm:p-6 md:p-8 overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left side */}
        <div className="space-y-6">
          {/* Hozirgi holat */}
          <div className="p-6 rounded-2xl shadow-lg text-center dark:bg-[#312D48]">
            {isLoading ? (
              <SkeletonBox className="w-40 h-10 mx-auto" />
            ) : (
              <>
                <h2
                  className={`text-lg font-medium mb-2 ${
                    bugungiHolat >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {t("current_situation")}
                </h2>
                <div
                  className={`text-4xl font-bold ${
                    bugungiHolat >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {Number(bugungiHolat).toLocaleString()} UZS
                </div>
              </>
            )}
          </div>

          {/* Moliyaviy holat */}
          <div className="p-6 rounded-2xl shadow-lg dark:bg-[#312D48]">
            {isLoading ? (
              <SkeletonBox className="w-full h-[400px]" />
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-800 mb-6 text-center dark:text-white">
                  {t("financial_status")}
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 30, right: 30, left: 30, bottom: 30 }}
                    barCategoryGap="10%"
                    maxBarSize={120}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 14, fill: "#374151", fontWeight: 600 }}
                      axisLine={{ stroke: "#D1D5DB", strokeWidth: 2 }}
                      tickLine={{ stroke: "#D1D5DB" }}
                    />
                    <YAxis
                      domain={[chartMin, chartMax]}
                      tick={{ fontSize: 12, fill: "#6B7280", fontWeight: 500 }}
                      axisLine={{ stroke: "#D1D5DB", strokeWidth: 2 }}
                      tickLine={{ stroke: "#D1D5DB" }}
                      tickFormatter={(value) => {
                        if (value === 0) return "0";
                        return value > 0
                          ? `+${Math.abs(value).toLocaleString()}`
                          : `-${Math.abs(value).toLocaleString()}`;
                      }}
                      tickCount={8}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        value >= 0
                          ? `+${value.toLocaleString()}`
                          : value.toLocaleString(),
                        "",
                      ]}
                    />
                    <ReferenceLine y={0} stroke="#1F2937" strokeWidth={4} />
                    <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`Cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-6 pt-6 rounded-xl p-4 dark:bg-[#312D48]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-600 mb-1 dark:text-white">
                        {t("balans")}
                      </div>
                      <div
                        className={`text-2xl font-bold ${
                          balans >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {Number(balans).toLocaleString()} UZS
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-600 mb-1 dark:text-white">
                        {t("kassa")}
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {Number(kassa).toLocaleString()} UZS
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl shadow-lg dark:bg-[#312D48]">
            <h3 className="text-xl font-bold text-gray-800 mb-6 dark:text-white">
              {t("title")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Markets */}
              <div className="rounded-xl shadow-lg p-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4 text-center dark:text-white">
                  {t("markets")}
                </h4>
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <SkeletonBox key={i} className="w-full h-6 mb-2" />
                  ))
                ) : (
                  <div className="overflow-x-auto overflow-y-scroll h-[395px] custom-scrollbar">
                    <table className="w-full border-collapse relative">
                      <thead className="sticky top-0 bg-white dark:bg-[var(--color-dark-bg-py)] z-10">
                        <tr>
                          <th className="p-3 text-left font-bold text-black dark:text-white">
                            {t("name")}
                          </th>
                          <th className="p-3 text-right font-bold text-black dark:text-white">
                            {t("total")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {markets?.map((m: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-200">
                            <td
                              className="data-cell p-3 font-semibold text-gray-600 dark:text-white"
                              data-cell="NAME"
                            >
                              {m.name}
                            </td>
                            <td
                              className={`data-cell p-3 min-[901px]:text-right font-bold ${
                                m.amount < 0 || m.amount == 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                              data-cell="TOTAL"
                            >
                              {Number(m.amount).toLocaleString()} UZS
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-800 text-white sticky bottom-0">
                        <tr>
                          <td className="p-3 font-bold">{t("total")}</td>
                          <td
                            className="p-3 text-right font-bold"
                            style={{
                              color: totalMarket >= 0 ? "#22c55e" : "#ef4444", // Tailwind green-500 va red-500 ranglari
                            }}
                          >
                            {Number(totalMarket).toLocaleString()} UZS
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Couriers */}
              <div className="rounded-xl shadow-lg p-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4 text-center dark:text-white">
                  {t("couriers")}
                </h4>
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <SkeletonBox key={i} className="w-full h-6 mb-2" />
                  ))
                ) : (
                  <div className="relative h-[395px] overflow-y-scroll custom-scrollbar">
                    <table className="w-full border-collapse relative">
                      <thead className="sticky top-0 bg-white dark:bg-[var(--color-dark-bg-py)] z-10">
                        <tr>
                          <th className="p-3 text-left font-bold text-black dark:text-white">
                            {t("name")}
                          </th>
                          <th className="p-3 text-right font-bold text-black dark:text-white">
                            {t("total")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {couriers?.map((c: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-200">
                            <td className="data-cell p-3" data-cell="NAME">
                              <div className="font-semibold text-gray-600 dark:text-white">
                                {c.name}
                              </div>
                              <div className="text-sm text-gray-500 mt-1 dark:text-white">
                                {c.region}
                              </div>
                            </td>
                            <td
                              className={`data-cell p-3 min-[901px]:text-right font-bold ${
                                c.amount >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                              data-cell="TOTAL"
                            >
                              {Number(c.amount).toLocaleString()} UZS
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-800 text-white sticky bottom-0">
                        <tr>
                          <td className="p-3 font-bold">{t("total")}</td>
                          <td
                            className="p-3 text-right font-bold"
                            style={{
                              color: totalCourier >= 0 ? "#22c55e" : "#ef4444", // Tailwind green-500 va red-500 ranglari
                            }}
                          >
                            {Number(totalCourier).toLocaleString()} UZS
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Umumiy balans */}
          <div className="p-6 rounded-xl shadow-lg dark:bg-[#312D48]">
            {isLoading ? (
              <SkeletonBox className="w-40 h-10 mx-auto" />
            ) : (
              <div className="text-center">
                <h4
                  className={`text-lg font-medium mb-2 ${
                    balans >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {t("totalBalans")}
                </h4>
                <div
                  className={`text-3xl font-bold ${
                    balans >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {Number(balans).toLocaleString()} UZS
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>
        {`
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #94a3b8 #f1f5f9;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }
        `}
      </style>
    </div>
  );
};

export default memo(Dashboard);
