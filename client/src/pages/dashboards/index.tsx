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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const Dashboards = () => {
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Dummy data (serverdan fetch qilinishi mumkin)
  const ordersData = [
    { name: "Yanvar", buyurtmalar: 100, tugatilgan: 80 },
    { name: "Fevral", buyurtmalar: 140, tugatilgan: 100 },
    { name: "Mart", buyurtmalar: 160, tugatilgan: 120 },
    { name: "Aprel", buyurtmalar: 180, tugatilgan: 150 },
    { name: "May", buyurtmalar: 190, tugatilgan: 160 },
    { name: "Iyun", buyurtmalar: 200, tugatilgan: 170 },
  ];

  const statusData = [
    { name: "Yangi", value: 43 },
    { name: "Jarayonda", value: 38 },
    { name: "Tugatilgan", value: 40 },
    { name: "Bekor qilingan", value: 15 },
  ];

  const COLORS = ["#0088FE", "#FFBB28", "#00C49F", "#FF8042"];

  const revenueData = [
    { name: "Dush", daromad: 4200 },
    { name: "Sesh", daromad: 3800 },
    { name: "Chor", daromad: 4000 },
    { name: "Pay", daromad: 4600 },
    { name: "Juma", daromad: 4700 },
    { name: "Shan", daromad: 4400 },
    { name: "Yak", daromad: 4100 },
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
          <h3 className="text-lg font-semibold mb-4">Buyurtmalar statistikasi</h3>
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
        <div className="bg-white p-4 rounded-2xl shadow">
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
        </div>
      </div>

      {/* Line Chart */}
      <div className="bg-white p-4 rounded-2xl shadow">
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
      </div>
    </div>
  );
};

export default memo(Dashboards);
