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
    { name: "Market1", amount: -533000 },
    { name: "Yandex", amount: -187000 },
    { name: "Uzum", amount: -700000 },
    { name: "Asaxiy", amount: -333000 },
    { name: "Asaxiy", amount: -300000 },
    { name: "Asaxiy", amount: -389000 },
    { name: "Asaxiy", amount: -389000 },
    { name: "Asaxiy", amount: -389000 },
    { name: "Asaxiy", amount: -389000 },
    { name: "Asaxiy", amount: -389000 },
    { name: "Asaxiy", amount: -389000 },
    { name: "Asaxiy", amount: -389000 },
    { name: "Asaxiy", amount: -389000 },
    { name: "Asaxiy", amount: -3389000 },

  ];

  // Kurierlar + viloyatlar
  const couriers = [
    { name: "Anvarjon", amount: 930000, region: "Andijon" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
    { name: "Bekzod", amount: 501000, region: "Surxondaryo" },
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
              Hozirgi holat:{" "}
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
                    <Cell key={`Cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* O'ngda bitta umumiy table */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl">
  <h3 className="text-xl font-semibold mb-6">Do'konlar va Kurierlar</h3>

  <div className="grid md:grid-cols-2 gap-6">
    {/* Do'konlar jadvali */}
    <div className="bg-white rounded-xl border p-4 flex flex-col">
      <h4 className="text-lg font-semibold mb-3">Do'konlar</h4>
      <div className="overflow-y-auto max-h-[400px]">
        <table className="w-full border-collapse text-lg">
          <thead>
            <tr className="border-b text-left bg-gray-50">
              <th className="p-3">Nomi</th>
              <th className="p-3">Summasi</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m, idx) => (
              <tr key={idx} className="border-b">
                <td className="p-3">{m.name}</td>
                <td
                  className={`p-3 ${
                    m.amount >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {m.amount >= 0 ? `+${m.amount}` : m.amount}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Total */}
          <tfoot>
            <tr className="font-bold bg-gray-100 sticky bottom-0">
              <td className="p-3">Total</td>
              <td
                className={`p-3 ${
                  totalMarket >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {totalMarket}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    {/* Kurierlar jadvali */}
    <div className="bg-white rounded-xl border p-4 flex flex-col">
      <h4 className="text-lg font-semibold mb-3">Kurierlar</h4>
      <div className="overflow-y-auto max-h-[400px]">
        <table className="w-full border-collapse text-lg">
          <thead>
            <tr className="border-b text-left bg-gray-50">
              <th className="p-3">Nomi</th>
              <th className="p-3">Summasi</th>
            </tr>
          </thead>
          <tbody>
            {couriers.map((c, idx) => (
              <tr key={idx} className="border-b">
                <td className="p-3">
                  <div>{c.name}</div>
                  <div className="text-sm text-gray-500">{c.region}</div>
                </td>
                <td
                  className={`p-3 ${
                    c.amount >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {c.amount >= 0 ? `+${c.amount}` : c.amount}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Total */}
          <tfoot>
            <tr className="font-bold bg-gray-100 sticky bottom-0">
              <td className="p-3">Total</td>
              <td
                className={`p-3 ${
                  totalCourier >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {totalCourier}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>

  {/* Balans umumiy */}
  <div className="mt-6 bg-gray-50 p-4 rounded-xl font-bold text-xl text-center sticky bottom-0"> Balans: 
    <span className={balans >= 0 ? "text-green-700" : "text-red-700"}>
      {balans >= 0 ? `+${balans}` : balans}
    </span>
  </div>
</div>
      </div>
    </div>
  );
};

export default memo(Dashboard);
