import { memo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { useChart } from "../../shared/api/hooks/useChart";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import {
  CheckCircle,
  DollarSign,
  Medal,
  ShoppingCart,
  XCircle,
} from "lucide-react";

const SkeletonBox = ({ className }: { className?: string }) => (
  <div
    className={`animate-pulse bg-gray-300 dark:bg-gray-600 rounded ${className}`}
  />
);

const Dashboards = () => {
  // default bugungi kun sanasi
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState<string>();
  const [toDate, setToDate] = useState<string>();

  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [showAllCouriers, setShowAllCouriers] = useState(false);

  const role = useSelector((state: RootState) => state.roleSlice.role);

  const { data, isLoading } = useChart().getChart({
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

  let titleText = "📊 Bugungi statistika";
  if (fromDate && toDate && fromDate !== toDate) {
    titleText = `📊 ${fromDate} - ${toDate} statistikasi`;
  } else if (fromDate && !toDate) {
    titleText = `📊 ${fromDate} dan boshlab statistikasi`;
  } else if (!fromDate && toDate) {
    titleText = `📊 ${toDate} gacha statistikasi`;
  }

  return (
    <div className="w-full p-6 dark:bg-[#312D48] min-h-screen transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative">
        <div className="flex flex-wrap gap-6">
          {isLoading ? (
            <>
              <SkeletonBox className="w-40 h-10" />
              <SkeletonBox className="w-40 h-10" />
            </>
          ) : (
            <>
              <div className="flex flex-col">
                <label htmlFor="fromDate" className="mb-1 text-sm font-medium">
                  Boshlanish sanasi
                </label>
                <input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border rounded-md px-4 py-2 bg-white dark:bg-[#2A263D]"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="toDate" className="mb-1 text-sm font-medium">
                  Tugash sanasi
                </label>
                <input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border rounded-md px-4 py-2 bg-white dark:bg-[#2A263D]"
                />
              </div>
            </>
          )}
        </div>
        <h2 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-bold">
          {titleText}
        </h2>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#2A263D] p-6 rounded-2xl">
              <SkeletonBox className="w-24 h-4 mb-3" />
              <SkeletonBox className="w-16 h-6" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              icon={<ShoppingCart size={20} />}
              label="Jami buyurtmalar"
              value={dashboard?.acceptedCount}
              borderColor="border-gray-400"
            />
            <StatCard
              icon={<CheckCircle size={20} />}
              label="Sotilgan"
              value={dashboard?.soldAndPaid}
              borderColor="border-green-500"
              textColor="text-green-500"
            />
            <StatCard
              icon={<XCircle size={20} />}
              label="Bekor qilinganlar"
              value={dashboard?.cancelled}
              borderColor="border-red-500"
              textColor="text-red-500"
            />
            <StatCard
              icon={<DollarSign size={20} />}
              label="Jami daromad"
              value={`${Number(dashboard?.profit).toLocaleString()} UZS`}
              borderColor="border-yellow-500"
              textColor="text-yellow-500"
            />
          </>
        )}
      </div>

      {/* Role-based Rendering */}
      {(role === "superadmin" ||
        role === "admin" ||
        role === "registrator") && (
        <>
          <div className="grid grid-cols-2 gap-6 mb-6">
            {renderMarketsChart(
              visibleMarkets,
              showAllMarkets,
              setShowAllMarkets
            )}
            {renderCouriersChart(
              visibleCouriers,
              showAllCouriers,
              setShowAllCouriers
            )}
          </div>
          <div className="grid grid-cols-2 gap-6">
            {renderMarketsTable(markets)}
            {renderCouriersTable(couriers)}
          </div>
        </>
      )}

      {role === "market" && (
        <>
          {renderMarketsChart(
            visibleMarkets,
            showAllMarkets,
            setShowAllMarkets
          )}
          {renderMarketsTable(markets)}
        </>
      )}

      {role === "courier" && (
        <>
          {renderCouriersChart(
            visibleCouriers,
            showAllCouriers,
            setShowAllCouriers
          )}
          {renderCouriersTable(couriers)}
        </>
      )}
    </div>
  );
};

// 🔹 Stat Card Component
const StatCard = ({
  icon,
  label,
  value,
  borderColor,
  textColor,
}: {
  icon: any;
  label: string;
  value: any;
  borderColor: string;
  textColor?: string;
}) => (
  <div
    className={`bg-white dark:bg-[#2A263D] p-6 rounded-2xl border-b-4 ${borderColor}`}
  >
    <p className={`flex items-center gap-2 ${textColor ?? "text-gray-500"}`}>
      {icon} {label}
    </p>
    <h2 className="text-2xl font-bold">{value}</h2>
  </div>
);

// 🔹 Helper Components (Charts & Tables)
const renderMarketsChart = (
  visibleMarkets: any[],
  showAllMarkets: boolean,
  setShowAllMarkets: (v: boolean) => void
) => (
  <ChartWrapper
    title="Marketlar statistikasi"
    data={visibleMarkets}
    showAll={showAllMarkets}
    setShowAll={setShowAllMarkets}
  />
);

const renderCouriersChart = (
  visibleCouriers: any[],
  showAllCouriers: boolean,
  setShowAllCouriers: (v: boolean) => void
) => (
  <ChartWrapper
    title="Kuriyerlar statistikasi"
    data={visibleCouriers}
    showAll={showAllCouriers}
    setShowAll={setShowAllCouriers}
  />
);

const ChartWrapper = ({
  title,
  data,
  showAll,
  setShowAll,
}: {
  title: string;
  data: any[];
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}) => (
  <div className="bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow overflow-hidden">
    <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
    <ResponsiveContainer width="100%" height={Math.max(data.length * 45, 400)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 20, right: 30, left: 50, bottom: 20 }}
        barCategoryGap={20}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis type="category" dataKey="nomi" width={200} />
        <Tooltip
          contentStyle={{ backgroundColor: "#000", color: "#fff" }}
          cursor={{ fill: "rgba(0,0,0,0.1)" }}
        />
        <Legend
          wrapperStyle={{ color: "black" }}
          formatter={(value) => (
            <span style={{ color: "inherit", fontWeight: "bold" }}>
              {value}
            </span>
          )}
        />

        {/* 🔹 Ustma-ust barlar */}
        <Bar
          dataKey="buyurtmalar"
          name="Buyurtmalar"
          fill="#66B2FF"
          stackId="a"
        />
        <Bar dataKey="sotilgan" name="Sotilgan" fill="#0047AB" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
    <div className="flex justify-center mt-4">
      <button
        onClick={() => setShowAll(!showAll)}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg"
      >
        {showAll ? "Kamroq ko‘rish" : "Ko‘proq ko‘rish"}
      </button>
    </div>
  </div>
);


// 🔹 Top Markets Table
const renderMarketsTable = (markets: any[]) => (
  <TableWrapper
    title="Top 10 Marketlar (Oxirgi 30 kun)"
    data={markets}
    nameKey="market_name"
    ordersKey="total_orders"
    soldKey="successful_orders"
    rateKey="success_rate"
  />
);

// 🔹 Top Couriers Table
const renderCouriersTable = (couriers: any[]) => (
  <TableWrapper
    title="Top 10 Kuriyerlar (Oxirgi 30 kun)"
    data={couriers}
    nameKey="courier_name"
    ordersKey="total_orders"
    soldKey="successful_orders"
    rateKey="success_rate"
  />
);

const TableWrapper = ({
  title,
  data,
  nameKey,
  ordersKey,
  soldKey,
  rateKey,
}: {
  title: string;
  data: any[];
  nameKey: string;
  ordersKey: string;
  soldKey: string;
  rateKey: string;
}) => (
  <div className="bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow">
    <h3 className="text-lg font-semibold mb-4">{title}</h3>
    <table className="w-full border">
      <thead>
        <tr className="bg-gray-100 dark:bg-[#3B3656] text-left">
          <th className="p-2 border">#</th>
          <th className="p-2 border">Nomi</th>
          <th className="p-2 border">Buyurtmalar</th>
          <th className="p-2 border">Sotilganlar</th>
          <th className="p-2 border">Foiz</th>
        </tr>
      </thead>
      <tbody>
        {data?.map((item: any, inx: number) => {
          let medalIcon = null;
          let rowStyle = "";
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
            <tr key={item.id ?? inx} className={`hover:bg-gray-50 ${rowStyle}`}>
              <td className="p-2 border text-center">{medalIcon ?? inx + 1}</td>
              <td className="p-2 border">{item[nameKey]}</td>
              <td className="p-2 border">{item[ordersKey]}</td>
              <td className="p-2 border">{item[soldKey]}</td>
              <td className="p-2 border">{item[rateKey]}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default memo(Dashboards);
