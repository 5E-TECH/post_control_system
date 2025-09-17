import { memo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useChart } from "../../shared/api/hooks/useChart";
import {
  CheckCircle,
  DollarSign,
  Medal,
  ShoppingCart,
  XCircle,
} from "lucide-react";

const Dashboards = () => {
  const [fromDate, setFromDate] = useState<string>("");
const [toDate, setToDate] = useState<string>("");

const [showAllMarkets, setShowAllMarkets] = useState(false);
const [showAllCouriers, setShowAllCouriers] = useState(false);

const { data } = useChart().getChart({
  startDate: fromDate,
  endDate: toDate,
});

const dashboard = data?.data?.orders?.data;

// const ordersData = [
//     { nomi: "Market1 (75%)", buyurtmalar: 533, tugatilgan: 400 },
//     { nomi: "Yandex (65%)", buyurtmalar: 320, tugatilgan: 210 },
//     { nomi: "Uzum (60%)", buyurtmalar: 700, tugatilgan: 420 },
//     { nomi: "Asaxiy (80%)", buyurtmalar: 333, tugatilgan: 280 },
//     { nomi: "AliExpress (70%)", buyurtmalar: 420, tugatilgan: 290 },
//     { nomi: "Darvoza (55%)", buyurtmalar: 280, tugatilgan: 150 },
//     { nomi: "Amazon (85%)", buyurtmalar: 600, tugatilgan: 510 },
//     { nomi: "eBay (50%)", buyurtmalar: 200, tugatilgan: 100 },
//     { nomi: "Olcha (77%)", buyurtmalar: 310, tugatilgan: 240 },
//     { nomi: "ZoodMall (68%)", buyurtmalar: 350, tugatilgan: 238 },
//     { nomi: "Market1 (75%)", buyurtmalar: 533, tugatilgan: 400 },
//     { nomi: "Yandex (65%)", buyurtmalar: 320, tugatilgan: 210 },
//     { nomi: "Uzum (60%)", buyurtmalar: 700, tugatilgan: 420 },
//     { nomi: "Asaxiy (80%)", buyurtmalar: 333, tugatilgan: 280 },
//     { nomi: "AliExpress (70%)", buyurtmalar: 420, tugatilgan: 290 },
//     { nomi: "Darvoza (55%)", buyurtmalar: 280, tugatilgan: 150 },
//     { nomi: "Amazon (85%)", buyurtmalar: 600, tugatilgan: 510 },
//     { nomi: "eBay (50%)", buyurtmalar: 200, tugatilgan: 100 },
//     { nomi: "Olcha (77%)", buyurtmalar: 310, tugatilgan: 240 },
//     { nomi: "ZoodMall (68%)", buyurtmalar: 350, tugatilgan: 238 },
//   ];

  // Mock Kuriyerlar
  // const couriersData = [
  //   { nomi: "Ali (90%)", buyurtmalar: 520, tugatilgan: 468 },
  //   { nomi: "Vali (85%)", buyurtmalar: 450, tugatilgan: 382 },
  //   { nomi: "Hasan (78%)", buyurtmalar: 600, tugatilgan: 468 },
  //   { nomi: "Husan (80%)", buyurtmalar: 300, tugatilgan: 240 },
  //   { nomi: "Jasur (88%)", buyurtmalar: 350, tugatilgan: 308 },
  //   { nomi: "Bekzod (82%)", buyurtmalar: 400, tugatilgan: 328 },
  //   { nomi: "Sherzod (76%)", buyurtmalar: 250, tugatilgan: 190 },
  //   { nomi: "Umid (84%)", buyurtmalar: 280, tugatilgan: 236 },
  //   { nomi: "Jamshid (79%)", buyurtmalar: 330, tugatilgan: 260 },
  //   { nomi: "Anvar (87%)", buyurtmalar: 310, tugatilgan: 270 },
  //   { nomi: "Market1 (75%)", buyurtmalar: 533, tugatilgan: 400 },
  //   { nomi: "Yandex (65%)", buyurtmalar: 320, tugatilgan: 210 },
  //   { nomi: "Uzum (60%)", buyurtmalar: 700, tugatilgan: 420 },
  //   { nomi: "Asaxiy (80%)", buyurtmalar: 333, tugatilgan: 280 },
  //   { nomi: "AliExpress (70%)", buyurtmalar: 420, tugatilgan: 290 },
  //   { nomi: "Darvoza (55%)", buyurtmalar: 280, tugatilgan: 150 },
  //   { nomi: "Amazon (85%)", buyurtmalar: 600, tugatilgan: 510 },
  //   { nomi: "eBay (50%)", buyurtmalar: 200, tugatilgan: 100 },
  //   { nomi: "Olcha (77%)", buyurtmalar: 310, tugatilgan: 240 },
  //   { nomi: "ZoodMall (68%)", buyurtmalar: 350, tugatilgan: 238 },
  // ];

// Har doim array qaytishi uchun `?? []` qo‘shamiz
const ordersData =
  data?.data?.markets?.data?.map((market: any) => ({
    nomi: market?.market?.name + ` (${market.sellingRate}%)`,
    buyurtmalar: market?.totalOrders,
    sotilgan: market?.soldOrders,
  })) ?? [];

const couriersData =
  data?.data?.couriers?.data?.map((courier: any) => ({
    nomi: courier?.courier?.name + ` (${courier.successRate}%)`,
    buyurtmalar: courier?.totalOrders,
    sotilgan: courier?.deliveredOrders,
  })) ?? [];

// Top 10 from API (ham default bo‘lishi kerak)
const couriers = data?.data?.topCouriers?.data ?? [];
const markets = data?.data?.topMarkets?.data ?? [];

// slice endi xavfsiz ishlaydi
const visibleMarkets = showAllMarkets
  ? ordersData
  : ordersData.slice(0, 10);

const visibleCouriers = showAllCouriers
  ? couriersData
  : couriersData.slice(0, 10);


  return (
    <div className="w-full p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Date Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl border-b-4 border-gray-400">
          <p className="flex items-center gap-2 text-gray-500">
            <ShoppingCart size={20} /> Jami buyurtmalar
          </p>
          <h2 className="text-2xl font-bold">{dashboard?.acceptedCount}</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl border-b-4 border-green-500">
          <p className="flex items-center gap-2 text-green-500">
            <CheckCircle size={20} /> Tugatilgan
          </p>
          <h2 className="text-2xl font-bold">{dashboard?.soldAndPaid}</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl border-b-4 border-red-500">
          <p className="flex items-center gap-2 text-red-500">
            <XCircle size={20} /> Bekor qilinganlar
          </p>
          <h2 className="text-2xl font-bold">{dashboard?.cancelled}</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl border-b-4 border-yellow-500">
          <p className="flex items-center gap-2 text-yellow-500">
            <DollarSign size={20} /> Jami daromad
          </p>
          <h2 className="text-2xl font-bold">
            {Number(dashboard?.profit).toLocaleString()} UZS
          </h2>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Marketlar Chart */}
        <div className="bg-white p-4 rounded-2xl shadow overflow-hidden">
          <h3 className="text-lg font-semibold mb-4 text-center">Marketlar statistikasi</h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(visibleMarkets.length * 45, 400)}
          >
            <BarChart
              data={visibleMarkets}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 50, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="nomi" width={200} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sotilgan" stackId="a" fill="#0047AB" />
              <Bar
                dataKey={(d: any) => d.buyurtmalar - d.sotilgan}
                stackId="a"
                fill="#66B2FF"
                name="buyurtmalar"
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowAllMarkets(!showAllMarkets)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              {showAllMarkets ? "Kamroq ko‘rish" : "Ko‘proq ko‘rish"}
            </button>
          </div>
        </div>

        {/* Kuriyerlar Chart */}
        <div className="bg-white p-4 rounded-2xl shadow overflow-hidden">
          <h3 className="text-lg font-semibold mb-4 text-center">Kuriyerlar statistikasi</h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(visibleCouriers.length * 45, 400)}
          >
            <BarChart
              data={visibleCouriers}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 50, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="nomi" width={200} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sotilgan" stackId="a" fill="#0047AB" />
              <Bar
                dataKey={(d: any) => d.buyurtmalar - d.sotilgan}
                stackId="a"
                fill="#66B2FF"
                name="buyurtmalar"
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowAllCouriers(!showAllCouriers)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              {showAllCouriers ? "Kamroq ko‘rish" : "Ko‘proq ko‘rish"}
            </button>
          </div>
        </div>
      </div>

      {/* Top 10 Jadval */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top Marketlar */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4">
            Top 10 Marketlar (Oxirgi 30 kun)
          </h3>
          <table className="w-full border border-gray-200">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border border-gray-200">#</th>
                <th className="p-2 border border-gray-200">Nomi</th>
                <th className="p-2 border border-gray-200">Buyurtmalar</th>
                <th className="p-2 border border-gray-200">Sotilganlar</th>
                <th className="p-2 border border-gray-200">Foiz</th>
              </tr>
            </thead>
            <tbody>
              {markets?.map((m: any, inx: number) => {
                let medalIcon = null;
                let rowStyle = "text-gray-700";
                if (inx === 0) {
                  medalIcon = <Medal className="text-yellow-500" size={20} />;
                  rowStyle = "text-yellow-500 font-bold";
                } else if (inx === 1) {
                  medalIcon = <Medal className="text-gray-400" size={20} />;
                  rowStyle = "text-gray-500 font-bold";
                } else if (inx === 2) {
                  medalIcon = <Medal className="text-amber-700" size={20} />;
                  rowStyle = "text-amber-700 font-bold";
                }
                return (
                  <tr
                    key={m.id ?? inx}
                    className={`hover:bg-gray-50 transition ${rowStyle}`}
                  >
                    <td className="p-2 border border-gray-200 text-center">
                      {medalIcon ? medalIcon : inx + 1}
                    </td>
                    <td className="p-2 border border-gray-200">{m.market_name}</td>
                    <td className="p-2 border border-gray-200">{m.total_orders}</td>
                    <td className="p-2 border border-gray-200">{m.successful_orders}</td>
                    <td className="p-2 border border-gray-200">{m.success_rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Top Kuriyerlar */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4">
            Top 10 Kuriyerlar (Oxirgi 30 kun)
          </h3>
          <table className="w-full border border-gray-200">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border border-gray-200">#</th>
                <th className="p-2 border border-gray-200">Ism</th>
                <th className="p-2 border border-gray-200">Buyurtmalar</th>
                <th className="p-2 border border-gray-200">Sotilganlar</th>
                <th className="p-2 border border-gray-200">Foiz</th>
              </tr>
            </thead>
            <tbody>
              {couriers?.map((c: any, inx: number) => {
                let medalIcon = null;
                let rowStyle = "text-gray-700";
                if (inx === 0) {
                  medalIcon = <Medal className="text-yellow-500" size={20} />;
                  rowStyle = "text-yellow-500 font-bold";
                } else if (inx === 1) {
                  medalIcon = <Medal className="text-gray-400" size={20} />;
                  rowStyle = "text-gray-500 font-bold";
                } else if (inx === 2) {
                  medalIcon = <Medal className="text-amber-700" size={20} />;
                  rowStyle = "text-amber-700 font-bold";
                }
                return (
                  <tr
                    key={c.courier_id ?? inx}
                    className={`hover:bg-gray-50 transition ${rowStyle}`}
                  >
                    <td className="p-2 border border-gray-200 text-center">
                      {medalIcon ? medalIcon : inx + 1}
                    </td>
                    <td className="p-2 border border-gray-200">{c.courier_name}</td>
                    <td className="p-2 border border-gray-200">{c.total_orders}</td>
                    <td className="p-2 border border-gray-200">{c.successful_orders}</td>
                    <td className="p-2 border border-gray-200">{c.success_rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default memo(Dashboards);
