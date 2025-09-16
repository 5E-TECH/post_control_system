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
import { CheckCircle, DollarSign, Medal, ShoppingCart, XCircle } from "lucide-react";

const Dashboards = () => {
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const { data } = useChart().getChart({
    startDate: fromDate,
    endDate: toDate,
  });

  const dashboard = data?.data?.orders?.data;

  const ordersData = data?.data?.markets?.data?.map((market: any) => ({
    nomi: market?.market?.name + ` (${market.sellingRate}%)`,
    buyurtmalar: market?.totalOrders,
    tugatilgan: market?.soldOrders,
  }));

  const couriersData = data?.data?.couriers?.data?.map((courier: any) => ({
    nomi: courier?.courier?.name + ` (${courier.successRate}%)`,
    buyurtmalar: courier?.totalOrders,
    tugatilgan: courier?.deliveredOrders,
  }));

  // Dummy Top 10 Couriers
  const couriers = data?.data?.topCouriers?.data;


  // Dummy Top 10 Markets
  const markets = data?.data?.topMarkets?.data;

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
        <ShoppingCart size={20} />
        Jami buyurtmalar
      </p>
      <h2 className="text-2xl font-bold">{dashboard?.acceptedCount}</h2>
    </div>

    <div className="bg-white p-6 rounded-2xl border-b-4 border-green-500">
      <p className="flex items-center gap-2 text-green-500">
        <CheckCircle size={20} />
        Tugatilgan
      </p>
      <h2 className="text-2xl font-bold">{dashboard?.soldAndPaid}</h2>
    </div>

    <div className="bg-white p-6 rounded-2xl border-b-4 border-red-500">
      <p className="flex items-center gap-2 text-red-500">
        <XCircle size={20} />
        Bekor qilinganlar
      </p>
      <h2 className="text-2xl font-bold">{dashboard?.cancelled}</h2>
    </div>

    <div className="bg-white p-6 rounded-2xl border-b-4 border-yellow-500">
      <p className="flex items-center gap-2 text-yellow-500">
        <DollarSign size={20} />
        Jami daromad
      </p>
      <h2 className="text-2xl font-bold">
        {Number(dashboard?.profit).toLocaleString()} UZS
      </h2>
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
              <XAxis dataKey="nomi" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="buyurtmalar" fill="#0088FE" />
              <Bar dataKey="tugatilgan" fill="#FF8042" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4">
            Kuriyerlar statistikasi
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={couriersData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nomi" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="buyurtmalar" fill="#0088FE" />
              <Bar dataKey="tugatilgan" fill="#FF8042" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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
                <th className="p-2 border border-gray-200">Sotilgan foizi</th>
              </tr>
            </thead>
            <tbody>
              {markets?.map((m: any, inx: number) => {
                let medalIcon = null;
                let rowStyle = "text-gray-700"; // default rang
              
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
                <th className="p-2 border border-gray-200">Sotilgan foizi</th>
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
