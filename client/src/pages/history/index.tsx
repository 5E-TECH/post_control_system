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

// Data interfaces
// interface Market {
//   name: string;
//   amount: number;
// }

// interface Courier {
//   name: string;
//   amount: number;
//   region: string;
// }

interface ChartData {
  name: string;
  value: number;
  fill: string;
}

const Dashboard: React.FC = () => {
  // Use useEffect to hide the body's overflow, removing the global scrollbar
  useEffect(() => {
    document.body.style.overflow = "hidden";
    // Clean up the style when the component unmounts
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const { data } = useHistory().getHistory();

  // const ordersData =
  // data?.data?.markets?.data?.map((market: any) => ({
  //   nomi: market?.market?.name + ` (${market.sellingRate}%)`,
  //   buyurtmalar: market?.totalOrders,
  //   sotilgan: market?.soldOrders,
  // })) ?? [];

  // const markets = data?.data?.markets?.map((market: any) => ({
  //  name
  //   }))

  // Market data
  // const markets: Market[] = [
  //   { name: "Market1", amount: -533000 },
  //   { name: "Yandex", amount: -187000 },
  //   { name: "Uzum", amount: 700000 },
  //   { name: "Asaxiy", amount: -333000 },
  //   { name: "Asaxiy", amount: -300000 },
  //   { name: "Asaxiy", amount: -389000 },
  //   { name: "Asaxiy", amount: -389000 },
  //   { name: "Asaxiy", amount: -389000 },
  //   { name: "Asaxiy", amount: -389000 },
  //   { name: "Asaxiy", amount: -389000 },
  //   { name: "Asaxiy", amount: -389000 },
  //   { name: "Asaxiy", amount: -389000 },
  //   { name: "Asaxiy", amount: -3389000 },
  // ];

  // const markets = data?.data?.market

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
  // Courier data with regions
  // const couriers = [
  //   { name: "Anvarjon", amount: 930000, region: "Andijon" },
  //   { name: "Bekzod", amount: -501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  //   { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
  // ];
  // Balance and Cash
  // const balans = totalMarket + totalCourier;
  const balans = data?.data?.difference;
  // const kassa = 146760;
  const kassa = data?.data?.main?.balance;

  // const bugungiHolat = balans + kassa;
  const bugungiHolat = data?.data?.currentSituation;

  const chartData: ChartData[] = [
    {
      name: "Balans",
      value: balans,
      fill: balans >= 0 ? "#10B981" : "#EF4444",
    },
    { name: "Kassa", value: kassa, fill: "#10B981" },
  ];

  const maxValue = Math.max(Math.abs(balans), Math.abs(kassa));
  const chartMin = -maxValue * 1.2;
  const chartMax = maxValue * 1.2;

  return (
    <div className="w-full p-8 space-y-10 max-h-[100vh] bg-gray-50">
      {/* Current status, chart, and tables side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left side: Status and Chart */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg border text-center">
            <h2 className="text-lg font-medium text-gray-600 mb-2">
              Hozirgi holat
            </h2>
            <div
              className={`text-4xl font-bold ${
                bugungiHolat >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {Number(bugungiHolat).toLocaleString()}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border">
            <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">
              Moliyaviy holat
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
                  labelStyle={{ color: "#374151", fontWeight: 600 }}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "2px solid #E5E7EB",
                    borderRadius: "12px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                    fontSize: "14px",
                  }}
                />
                <ReferenceLine
                  y={0}
                  stroke="#1F2937"
                  strokeWidth={4}
                  strokeDasharray="none"
                />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 6, 6]}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`Cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6 pt-6 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">
                    Balans
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      balans >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {Number(balans).toLocaleString()}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">
                    Kassa
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {String(kassa).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg border">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Do'konlar va Kurierlar
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Markets Table */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4 text-center">
                  Do'konlar
                </h4>
                <div className="overflow-y-scroll max-h-[400px] custom-scrollbar">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b-2 border-gray-300">
                        <th className="p-3 text-left font-bold text-black">
                          Nomi
                        </th>
                        <th className="p-3 text-right font-bold text-black">
                          Summasi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {markets?.map((m: any, idx: number) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-200 hover:bg-white transition-colors"
                        >
                          <td className="p-3 font-semibold text-gray-600">
                            {m.name}
                          </td>
                          <td
                            className={`p-3 text-right font-bold ${
                              m.amount < 0 || m.amount == 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {m.amount > 0
                              ? `-${m.amount.toLocaleString()}`
                              : m.amount < 0
                              ? `+${Math.abs(m.amount).toLocaleString()}`
                              : m.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-gray-800 text-white z-10">
                      <tr>
                        <td className="p-3 font-bold">Jami</td>
                        <td
                          className={`p-3 text-right font-bold ${
                            totalMarket >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {Number(totalMarket).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Couriers Table */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4 text-center">
                  Kurierlar
                </h4>
                <div className="overflow-y-scroll max-h-[400px] custom-scrollbar">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b-2 border-gray-300">
                        <th className="p-3 text-left font-bold text-black">
                          Nomi
                        </th>
                        <th className="p-3 text-right font-bold text-black">
                          Summasi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {couriers?.map((c: any, idx: number) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-200 hover:bg-white transition-colors"
                        >
                          <td className="p-3">
                            <div className="font-semibold text-gray-600">
                              {c.name}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {c.region}
                            </div>
                          </td>
                          <td
                            className={`p-3 text-right font-bold ${
                              c.amount >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {Number(c.amount).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-gray-800 text-white z-10">
                      <tr>
                        <td className="p-3 font-bold">Jami</td>
                        <td
                          className={`p-3 text-right font-bold ${
                            totalCourier >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {Number(totalCourier).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
          {/* Total Balance block placed directly below the tables block */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
            <div className="text-center">
              <h4 className="text-lg font-medium text-gray-600 mb-2">
                Umumiy Balans
              </h4>
              <div
                className={`text-3xl font-bold ${
                  balans >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {Number(balans).toLocaleString()} UZS
              </div>
            </div>
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
