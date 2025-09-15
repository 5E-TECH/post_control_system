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
  // PieChart,
  // Pie,
  // Cell,
  // LineChart,
  // Line,
} from "recharts";
import { useChart } from "../../shared/api/hooks/useChart";

const Dashboards = () => {
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const {data} = useChart().getChart()

  console.log(data)

  // Dummy data (serverdan fetch qilinishi mumkin)
  const ordersData = [
    { name: "Uzum", buyurtmalar: 100, tugatilgan: 80 },
    { name: "Apelsin", buyurtmalar: 140, tugatilgan: 100 },
    { name: "Malika", buyurtmalar: 160, tugatilgan: 120 },
    { name: "Abu", buyurtmalar: 180, tugatilgan: 150 },
    { name: "Ipodrom", buyurtmalar: 190, tugatilgan: 160 },
    { name: "E", buyurtmalar: 200, tugatilgan: 170 },
  ];

  // const statusData = [
  //   { name: "Yangi", value: 43 },
  //   { name: "Jarayonda", value: 38 },
  //   { name: "Tugatilgan", value: 40 },
  //   { name: "Bekor qilingan", value: 15 },
  // ];

  // const COLORS = ["#0088FE", "#FFBB28", "#00C49F", "#FF8042"];

  // const revenueData = [
  //   { name: "Dush", daromad: 4200 },
  //   { name: "Sesh", daromad: 3800 },
  //   { name: "Chor", daromad: 4000 },
  //   { name: "Pay", daromad: 4600 },
  //   { name: "Juma", daromad: 4700 },
  //   { name: "Shan", daromad: 4400 },
  //   { name: "Yak", daromad: 4100 },
  // ];

  // Dummy Top 10 Couriers
  const couriers = [
    { id: 1, name: "Kuriyer 1", orders: 250 },
    { id: 2, name: "Kuriyer 2", orders: 230 },
    { id: 3, name: "Kuriyer 3", orders: 220 },
    { id: 4, name: "Kuriyer 4", orders: 210 },
    { id: 5, name: "Kuriyer 5", orders: 200 },
    { id: 6, name: "Kuriyer 6", orders: 190 },
    { id: 7, name: "Kuriyer 7", orders: 185 },
    { id: 8, name: "Kuriyer 8", orders: 170 },
    { id: 9, name: "Kuriyer 9", orders: 160 },
    { id: 10, name: "Kuriyer 10", orders: 150 },
  ];

  // Dummy Top 10 Markets
  const markets = [
    { id: 1, name: "Market 1", orders: 300 },
    { id: 2, name: "Market 2", orders: 280 },
    { id: 3, name: "Market 3", orders: 270 },
    { id: 4, name: "Market 4", orders: 250 },
    { id: 5, name: "Market 5", orders: 240 },
    { id: 6, name: "Market 6", orders: 230 },
    { id: 7, name: "Market 7", orders: 220 },
    { id: 8, name: "Market 8", orders: 210 },
    { id: 9, name: "Market 9", orders: 200 },
    { id: 10, name: "Market 10", orders: 190 },
  ];

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
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Jami buyurtmalar</p>
          <h2 className="text-2xl font-bold">1,234</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Tugatilgan</p>
          <h2 className="text-2xl font-bold">987</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Jarayonda</p>
          <h2 className="text-2xl font-bold">247</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Jami daromad</p>
          <h2 className="text-2xl font-bold">945,231</h2>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Bar Chart */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4">Marketlar statistikasi</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ordersData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="buyurtmalar" fill="#0088FE" />
              <Bar dataKey="tugatilgan" fill="#FF8042" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4">Kuriyerlar statistikasi</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ordersData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="buyurtmalar" fill="#0088FE" />
              <Bar dataKey="tugatilgan" fill="#FF8042" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        {/* <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4">Buyurtma holatlari</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label
              >
                {statusData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div> */}
      </div>

      {/* Line Chart */}
      {/* <div className="bg-white p-4 rounded-2xl shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">Haftalik daromad</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="daromad" stroke="#00C49F" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div> */}

      {/* Top 10 Tables */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top Couriers */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4">
            Top 10 Kuriyerlar (Oxirgi 30 kun)
          </h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">#</th>
                <th className="p-2">Ism</th>
                <th className="p-2">Buyurtmalar</th>
              </tr>
            </thead>
            <tbody>
              {couriers.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{c.id}</td>
                  <td className="p-2">{c.name}</td>
                  <td className="p-2">{c.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Markets */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4">
            Top 10 Marketlar (Oxirgi 30 kun)
          </h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">#</th>
                <th className="p-2">Nomi</th>
                <th className="p-2">Buyurtmalar</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{m.id}</td>
                  <td className="p-2">{m.name}</td>
                  <td className="p-2">{m.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default memo(Dashboards);
