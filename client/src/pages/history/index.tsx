import { memo, useMemo } from "react";
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

const Dashboard = () => {
  // Do'konlar
  const markets = [
    { name: "Market1", amount: -13000 },
    { name: "Yandex", amount: -17000 },
    { name: "Uzum", amount: -7000 },
    { name: "Asaxiy", amount: -3000 },
    { name: "Asaxiy", amount: -3000 },
    { name: "Asaxiy", amount: -3000 },
    { name: "Asaxiy", amount: -3000 },
    { name: "Asaxiy", amount: -3000 },
    { name: "Asaxiy", amount: -3000 },
    { name: "Asaxiy", amount: -3000 },
    { name: "Asaxiy", amount: -3000 },
    { name: "Asaxiy", amount: -3000 },
    { name: "Asaxiy", amount: -3000 },
  ];

  // Kurierlar + viloyatlar
  const couriers = [
    { name: "Anvarjon", amount: 30000, region: "Andijon" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 5000, region: "Surxondaryo" },
  ];

  // Hisoblash
  const totalMarket = useMemo(
    () => markets.reduce((acc, m) => acc + m.amount, 0),
    [markets]
  );
  const totalCourier = useMemo(
    () => couriers.reduce((acc, c) => acc + c.amount, 0),
    [couriers]
  );

  // Balans va Kassa
  const balans = totalMarket + totalCourier;
  const kassa = 15000;
  const bugungiHolat = balans + kassa;

  // Chart ma'lumotlari
  const chartData = [
    { name: "Balans", value: balans, fill: balans >= 0 ? "#00C49F" : "#FF4C4C" },
    { name: "Kassa", value: kassa, fill: kassa >= 0 ? "#00C49F" : "#FF4C4C" },
  ];

  const chartMin = Math.min(0, balans, kassa) - 5000;
  const chartMax = Math.max(0, balans, kassa) + 5000;

  return (
    <div className="w-full p-8 space-y-10">
      {/* Bugungi holat, chart va table yonma-yon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Chapda holat */}
        <div>
          <div className="bg-white p-6 rounded-2xl shadow text-center">
            <h2
              className={`text-3xl font-extrabold ${
                bugungiHolat >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              Bugungi holat:{" "}
              {bugungiHolat >= 0 ? `+${bugungiHolat}` : bugungiHolat}
            </h2>
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-2xl shadow mt-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[chartMin, chartMax]} />
                <Tooltip />
                <ReferenceLine y={0} stroke="#000" />
                <Bar dataKey="value">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* O'ngda bitta umumiy table */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow">
          <h3 className="text-xl font-semibold mb-6">
            Do'konlar va Kurierlar
          </h3>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full border-collapse text-lg relative">
              <thead>
                <tr className="border-b text-left bg-gray-50">
                  <th className="p-3">Do'konlar</th>
                  <th className="p-3 border-r-2 border-gray-300">Summasi</th>
                  <th className="p-3">Kurierlar</th>
                  <th className="p-3">Summasi</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({
                  length: Math.max(markets.length, couriers.length),
                }).map((_, idx) => (
                  <tr key={idx} className="border-b">
                    {/* Do'konlar */}
                    <td className="p-3">{markets[idx]?.name || ""}</td>
                    <td
                      className={`p-3 border-r-2 border-gray-300 ${
                        markets[idx]?.amount >= 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {markets[idx]
                        ? markets[idx].amount >= 0
                          ? `+${markets[idx].amount}`
                          : markets[idx].amount
                        : ""}
                    </td>

                    {/* Kurierlar */}
                    <td className="p-3">
                      {couriers[idx]?.name ? (
                        <div>
                          <div>{couriers[idx].name}</div>
                          <div className="text-sm text-gray-500">
                            {couriers[idx].region}
                          </div>
                        </div>
                      ) : (
                        ""
                      )}
                    </td>
                    <td
                      className={`p-3 ${
                        couriers[idx]?.amount >= 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {couriers[idx]
                        ? couriers[idx].amount >= 0
                          ? `+${couriers[idx].amount}`
                          : couriers[idx].amount
                        : ""}
                    </td>
                  </tr>
                ))}

                {/* Totallar */}
                <tr className="font-bold bg-white sticky bottom-12 border-t">
                  <td className="p-3">Do'konlar Total</td>
                  <td
                    className={`p-3 border-r-2 border-gray-300 ${
                      totalMarket >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {totalMarket}
                  </td>
                  <td className="p-3">Kurierlar Total</td>
                  <td
                    className={`p-3 ${
                      totalCourier >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {totalCourier}
                  </td>
                </tr>

                {/* Balans */}
                <tr className="font-bold bg-gray-100 sticky bottom-0">
                  <td colSpan={2} className="p-3 border-r-2 border-gray-300">
                    Balans
                  </td>
                  <td
                    colSpan={2}
                    className={`p-3 text-xl ${
                      balans >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {balans >= 0 ? `+${balans}` : balans}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Dashboard);
