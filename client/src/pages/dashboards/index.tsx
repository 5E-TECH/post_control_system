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

  const couriers = data?.data?.topCouriers?.data ?? [];
  const markets = data?.data?.topMarkets?.data ?? [];

  const visibleMarkets = showAllMarkets ? ordersData : ordersData.slice(0, 10);
  const visibleCouriers = showAllCouriers
    ? couriersData
    : couriersData.slice(0, 10);

  return (
    <div className="w-full p-6 dark:bg-[#312D48] min-h-screen transition">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Dashboard
      </h1>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-col">
          <label
            htmlFor="fromDate"
            className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Boshlanish sanasi
          </label>
          <input
            id="fromDate"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 text-gray-700 dark:text-white bg-white dark:bg-[#2A263D] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition cursor-pointer"
          />
        </div>
        <div className="flex flex-col">
          <label
            htmlFor="toDate"
            className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            Tugash sanasi
          </label>
          <input
            id="toDate"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 text-gray-700 dark:text-white bg-white dark:bg-[#2A263D] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition cursor-pointer"
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white dark:bg-[#2A263D] p-6 rounded-2xl border-b-4 border-gray-400 dark:border-gray-500">
          <p className="flex items-center gap-2 text-gray-500 dark:text-gray-300">
            <ShoppingCart size={20} /> Jami buyurtmalar
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {dashboard?.acceptedCount}
          </h2>
        </div>
        <div className="bg-white dark:bg-[#2A263D] p-6 rounded-2xl border-b-4 border-green-500">
          <p className="flex items-center gap-2 text-green-500">
            <CheckCircle size={20} /> Sotilgan
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {dashboard?.soldAndPaid}
          </h2>
        </div>
        <div className="bg-white dark:bg-[#2A263D] p-6 rounded-2xl border-b-4 border-red-500">
          <p className="flex items-center gap-2 text-red-500">
            <XCircle size={20} /> Bekor qilinganlar
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {dashboard?.cancelled}
          </h2>
        </div>
        <div className="bg-white dark:bg-[#2A263D] p-6 rounded-2xl border-b-4 border-yellow-500">
          <p className="flex items-center gap-2 text-yellow-500">
            <DollarSign size={20} /> Jami daromad
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {Number(dashboard?.profit).toLocaleString()} UZS
          </h2>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Marketlar Chart */}
        <div className="bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow overflow-hidden">
          <h3 className="text-lg font-semibold mb-4 text-center text-gray-900 dark:text-white">
            Marketlar statistikasi
          </h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(visibleMarkets.length * 45, 400)}
          >
            <BarChart
              data={visibleMarkets}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 50, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#D1D5DB"
                className="dark:stroke-gray-600"
              />
              <XAxis type="number" stroke="#6B7280" />
              <YAxis
                type="category"
                dataKey="nomi"
                width={200}
                stroke="#6B7280"
                className="dark:stroke-gray-300"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                }}
              />
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
              className="px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer"
            >
              {showAllMarkets ? "Kamroq ko‘rish" : "Ko‘proq ko‘rish"}
            </button>
          </div>
        </div>

        {/* Kuriyerlar Chart */}
        <div className="bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow overflow-hidden">
          <h3 className="text-lg font-semibold mb-4 text-center text-gray-900 dark:text-white">
            Kuriyerlar statistikasi
          </h3>
          <ResponsiveContainer
            width="100%"
            height={Math.max(visibleCouriers.length * 45, 400)}
          >
            <BarChart
              data={visibleCouriers}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 50, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
              <XAxis type="number" stroke="#6B7280" />
              <YAxis
                type="category"
                dataKey="nomi"
                width={200}
                stroke="#6B7280"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                }}
              />
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
              className="px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer"
            >
              {showAllCouriers ? "Kamroq ko‘rish" : "Ko‘proq ko‘rish"}
            </button>
          </div>
        </div>
      </div>

      {/* Top 10 Jadval */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top Marketlar */}
        <div className="bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Top 10 Marketlar (Oxirgi 30 kun)
          </h3>
          <table className="w-full border border-gray-200 dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#3B3656] text-left">
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  #
                </th>
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  Nomi
                </th>
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  Buyurtmalar
                </th>
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  Sotilganlar
                </th>
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  Foiz
                </th>
              </tr>
            </thead>
            <tbody>
              {markets?.map((m: any, inx: number) => {
                let medalIcon = null;
                let rowStyle = "text-gray-700 dark:text-gray-200";
                if (inx === 0) {
                  medalIcon = <Medal className="text-yellow-500" size={20} />;
                  rowStyle = "text-yellow-500 font-bold";
                } else if (inx === 1) {
                  medalIcon = <Medal className="text-gray-400" size={20} />;
                  rowStyle = "text-gray-500 dark:text-gray-300 font-bold";
                } else if (inx === 2) {
                  medalIcon = <Medal className="text-amber-700" size={20} />;
                  rowStyle = "text-amber-700 font-bold";
                }
                return (
                  <tr
                    key={m.id ?? inx}
                    className={`hover:bg-gray-50 dark:hover:bg-[#3B3656] transition ${rowStyle}`}
                  >
                    <td className="p-2 border border-gray-200 dark:border-gray-700 text-center">
                      {medalIcon ? medalIcon : inx + 1}
                    </td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700">
                      {m.market_name}
                    </td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700">
                      {m.total_orders}
                    </td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700">
                      {m.successful_orders}
                    </td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700">
                      {m.success_rate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Top Kuriyerlar */}
        <div className="bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Top 10 Kuriyerlar (Oxirgi 30 kun)
          </h3>
          <table className="w-full border border-gray-200 dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#3B3656] text-left">
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  #
                </th>
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  Ism
                </th>
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  Buyurtmalar
                </th>
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  Sotilganlar
                </th>
                <th className="p-2 border border-gray-200 dark:border-gray-700">
                  Foiz
                </th>
              </tr>
            </thead>
            <tbody>
              {couriers?.map((c: any, inx: number) => {
                let medalIcon = null;
                let rowStyle = "text-gray-700 dark:text-gray-200";
                if (inx === 0) {
                  medalIcon = <Medal className="text-yellow-500" size={20} />;
                  rowStyle = "text-yellow-500 font-bold";
                } else if (inx === 1) {
                  medalIcon = <Medal className="text-gray-400" size={20} />;
                  rowStyle = "text-gray-500 dark:text-gray-300 font-bold";
                } else if (inx === 2) {
                  medalIcon = <Medal className="text-amber-700" size={20} />;
                  rowStyle = "text-amber-700 font-bold";
                }
                return (
                  <tr
                    key={c.courier_id ?? inx}
                    className={`hover:bg-gray-50 dark:hover:bg-[#3B3656] transition ${rowStyle}`}
                  >
                    <td className="p-2 border border-gray-200 dark:border-gray-700 text-center">
                      {medalIcon ? medalIcon : inx + 1}
                    </td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700">
                      {c.courier_name}
                    </td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700">
                      {c.total_orders}
                    </td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700">
                      {c.successful_orders}
                    </td>
                    <td className="p-2 border border-gray-200 dark:border-gray-700">
                      {c.success_rate}%
                    </td>
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
