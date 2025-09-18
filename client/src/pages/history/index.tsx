import { memo, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts"

// Ma'lumotlar uchun interfeyslar (Types)
interface Market {
  name: string
  amount: number
}

interface Courier {
  name: string
  amount: number
  region: string
}

interface ChartData {
  name: string
  value: number
  fill: string
}

const Dashboard = () => {
  // Do'konlar
  const markets: Market[] = [
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
    { name: "Asaxiy", amount: -3389000 },
  ]

  // Kurierlar + viloyatlar
  const couriers: Courier[] = [
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
  ]

  // Hisoblash
  const totalMarket = useMemo(() => markets.reduce((acc, m) => acc + m.amount, 0), [markets])
  const totalCourier = useMemo(() => couriers.reduce((acc, c) => acc + c.amount, 0), [couriers])

  // Balans va Kassa
  const balans = totalMarket + totalCourier
  const kassa = 146760
  const bugungiHolat = balans + kassa

  const chartData: ChartData[] = [
    { name: "Balans", value: balans, fill: balans >= 0 ? "#10B981" : "#EF4444" },
    { name: "Kassa", value: kassa, fill: "#10B981" },
  ]

  const maxValue = Math.max(Math.abs(balans), Math.abs(kassa))
  const chartMin = -maxValue * 1.2
  const chartMax = maxValue * 1.2

  return (
    <div className="w-full p-8 space-y-10 bg-gray-50 min-h-screen">
      {/* Bugungi holat, chart va table yonma-yon */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Chapda holat */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-lg border text-center">
            <h2 className="text-lg font-medium text-gray-600 mb-2">Hozirgi holat</h2>
            <div className={`text-4xl font-bold ${bugungiHolat >= 0 ? "text-green-600" : "text-red-600"}`}>
              {bugungiHolat >= 0 ? `+${bugungiHolat.toLocaleString()}` : bugungiHolat.toLocaleString()}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border">
            <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">Moliyaviy holat</h3>
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
                    if (value === 0) return "0"
                    return value > 0 ? `+${Math.abs(value).toLocaleString()}` : `-${Math.abs(value).toLocaleString()}`
                  }}
                  tickCount={8}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value: number) => [
                    value >= 0 ? `+${value.toLocaleString()}` : value.toLocaleString(),
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
                <Bar dataKey="value" radius={[6, 6, 6, 6]} stroke="#ffffff" strokeWidth={2}>
                  {chartData.map((entry, index) => (
                    <Cell key={`Cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6 pt-6 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Kassa</div>
                  <div className="text-2xl font-bold text-green-600">{kassa.toLocaleString()}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Balans</div>
                  <div className={`text-2xl font-bold ${balans >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {balans >= 0 ? `+${Math.abs(balans).toLocaleString()}` : `-${Math.abs(balans).toLocaleString()}`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Do'konlar va Kurierlar</h3>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Do'konlar jadvali */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <h4 className="text-lg font-bold text-gray-800 mb-4 text-center">Do'konlar</h4>
              <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0">
                    <tr className="bg-white border-b-2 border-gray-300">
                      <th className="p-3 text-left font-bold text-black">Nomi</th>
                      <th className="p-3 text-right font-bold text-black">Summasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((m, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-white transition-colors">
                        <td className="p-3 font-semibold text-gray-600">{m.name}</td>
                        <td className="p-3 text-right font-bold text-gray-600">{m.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0">
                    <tr className="bg-gray-800 text-white">
                      <td className="p-3 font-bold">Jami</td>
                      <td className="p-3 text-right font-bold">{totalMarket.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Kurierlar jadvali */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <h4 className="text-lg font-bold text-gray-800 mb-4 text-center">Kurierlar</h4>
              <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0">
                    <tr className="bg-white border-b-2 border-gray-300">
                      <th className="p-3 text-left font-bold text-black">Nomi</th>
                      <th className="p-3 text-right font-bold text-black">Summasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couriers.map((c, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-white transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-gray-600">{c.name}</div>
                          <div className="text-sm text-gray-500 mt-1">{c.region}</div>
                        </td>
                        <td className="p-3 text-right font-bold text-gray-600">+{c.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0">
                    <tr className="bg-gray-800 text-white">
                      <td className="p-3 font-bold">Jami</td>
                      <td className="p-3 text-right font-bold">+{totalCourier.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
            <div className="text-center">
              <h4 className="text-lg font-medium text-gray-600 mb-2">Umumiy Balans</h4>
              <div className={`text-3xl font-bold ${balans >= 0 ? "text-green-600" : "text-red-600"}`}>
                {balans >= 0 ? `+${balans.toLocaleString()}` : balans.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  )
}

export default memo(Dashboard)