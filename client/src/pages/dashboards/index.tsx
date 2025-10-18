import { memo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
import { useTranslation } from "react-i18next";
import { t } from "i18next";
import { useCourierStatCard } from "../../shared/api/hooks/useCourierStatCard";
import { useMarketStatCard } from "../../shared/api/hooks/useMarketStatCard";

import { DatePicker } from "antd";

import dayjs from "dayjs";

const { RangePicker } = DatePicker;

const SkeletonBox = ({ className }: { className?: string }) => (
  <div
    className={`animate-pulse bg-gray-300 dark:bg-gray-600 rounded ${className}`}
  />
);

const Dashboards = () => {
  const { t } = useTranslation(["dashboard"]);
  const [fromDate, setFromDate] = useState<string | undefined>(undefined);
  const [toDate, setToDate] = useState<string | undefined>(undefined);
  const [showAllMarkets, setShowAllMarkets] = useState(false);
  const [showAllCouriers, setShowAllCouriers] = useState(false);

  // Redux'dan role olish
  const role = useSelector((state: RootState) => state.roleSlice.role);

  let data: any;
  let isLoading: boolean = false;

  if (role === "superadmin" || role === "admin") {
    ({ data, isLoading } = useChart().getChart({
      startDate: fromDate,
      endDate: toDate,
    }));
  } else if (role === "courier") {
    ({ data, isLoading } = useCourierStatCard().getChart({
      startDate: fromDate,
      endDate: toDate,
    }));
  } else if (role === "market") {
    ({ data, isLoading } = useMarketStatCard().getChart({
      startDate: fromDate,
      endDate: toDate,
    }));
  }

  const dashboard = data?.data?.orders?.data;
  const aboutCourier = data?.data?.myStat?.data;
  const aboutMarket = data?.data?.myStat?.data;

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
      sotilgan: courier?.soldOrders,
    })) ?? [];

  const couriers = data?.data?.topCouriers?.data ?? [];
  const markets = data?.data?.topMarkets?.data ?? [];

  const visibleMarkets = showAllMarkets ? ordersData : ordersData.slice(0, 10);
  const visibleCouriers = showAllCouriers
    ? couriersData
    : couriersData.slice(0, 10);

 let titleText = `📊 ${t("title")}`;

 if (fromDate && toDate && fromDate === toDate) {
   titleText = `📊 ${fromDate} sanadagi statistika`;
 } else if (fromDate && toDate && fromDate !== toDate) {
   titleText = `📊 ${fromDate} dan - ${toDate} gacha statistikasi`;
 } else if (fromDate && !toDate) {
   titleText = `📊 ${fromDate} dan boshlab statistikasi`;
 } else if (!fromDate && toDate) {
   titleText = `📊 ${toDate} gacha statistikasi`;
 }


  return (
    <div className="w-full p-6 dark:bg-[#312D48] min-h-screen transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-[1550px]:flex-col-reverse max-[1550px]:gap-5">
        <div className="flex flex-wrap gap-6">
          {isLoading ? (
            <>
              <SkeletonBox className="w-40 h-10" />
              <SkeletonBox className="w-40 h-10" />
            </>
          ) : (
            <div className="flex gap-6">
              <div className="flex flex-col">
                <label className="mb-1 text-sm font-medium">
                  {t("dateRange")}
                </label>
                <RangePicker
                  value={[
                    fromDate ? dayjs(fromDate) : null,
                    toDate ? dayjs(toDate) : null,
                  ]}
                  onChange={(dates) => {
                    setFromDate(
                      dates?.[0] ? dates[0].format("YYYY-MM-DD") : undefined
                    );
                    setToDate(
                      dates?.[1] ? dates[1].format("YYYY-MM-DD") : undefined
                    );
                  }}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* O‘rtada title */}
        <h2 className="text-xl font-bold mr-170 max-[1550px]:mr-0">
          {titleText}
        </h2>
      </div>
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6 max-xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#2A263D] p-6 rounded-2xl">
              <SkeletonBox className="w-24 h-4 mb-3" />
              <SkeletonBox className="w-16 h-6" />
            </div>
          ))
        ) : (
          <>
            {role === "courier" && (
              <>
                <StatCard
                  icon={<ShoppingCart size={20} />}
                  label={t("totalOrders")}
                  value={aboutCourier?.totalOrders || 0}
                  borderColor="border-gray-400"
                />
                <StatCard
                  icon={<CheckCircle size={20} />}
                  label={t("solded")}
                  value={aboutCourier?.soldOrders || 0}
                  borderColor="border-green-500"
                  textColor="text-green-500"
                />
                <StatCard
                  icon={<XCircle size={20} />}
                  label={t("cancelled")}
                  value={aboutCourier?.canceledOrders || 0}
                  borderColor="border-red-500"
                  textColor="text-red-500"
                />
                <StatCard
                  icon={<DollarSign size={20} />}
                  label={t("profit")}
                  value={`${Number(
                    aboutCourier?.profit || 0
                  ).toLocaleString()} UZS`}
                  borderColor="border-yellow-500"
                  textColor="text-yellow-500"
                />
              </>
            )}

            {role === "market" && (
              <>
                <StatCard
                  icon={<ShoppingCart size={20} />}
                  label={t("totalOrders")}
                  value={aboutMarket?.totalOrders || 0}
                  borderColor="border-gray-400"
                />
                <StatCard
                  icon={<CheckCircle size={20} />}
                  label={t("solded")}
                  value={aboutMarket?.soldOrders || 0}
                  borderColor="border-green-500"
                  textColor="text-green-500"
                />
                <StatCard
                  icon={<XCircle size={20} />}
                  label={t("cancelled")}
                  value={aboutMarket?.canceledOrders || 0}
                  borderColor="border-red-500"
                  textColor="text-red-500"
                />
                <StatCard
                  icon={<DollarSign size={20} />}
                  label={t("profit")}
                  value={`${Number(
                    aboutMarket?.profit || 0
                  ).toLocaleString()} UZS`}
                  borderColor="border-yellow-500"
                  textColor="text-yellow-500"
                />
              </>
            )}

            {(role === "superadmin" ||
              role === "admin" ) && (
              <>
                <StatCard
                  icon={<ShoppingCart size={20} />}
                  label={t("totalOrders")}
                  value={dashboard?.acceptedCount || 0}
                  borderColor="border-gray-400"
                />
                <StatCard
                  icon={<CheckCircle size={20} />}
                  label={t("solded")}
                  value={dashboard?.soldAndPaid || 0}
                  borderColor="border-green-500"
                  textColor="text-green-500"
                />
                <StatCard
                  icon={<XCircle size={20} />}
                  label={t("cancelled")}
                  value={dashboard?.cancelled || 0}
                  borderColor="border-red-500"
                  textColor="text-red-500"
                />
                <StatCard
                  icon={<DollarSign size={20} />}
                  label={t("profit")}
                  value={`${Number(
                    dashboard?.profit || 0
                  ).toLocaleString()} UZS`}
                  borderColor="border-yellow-500"
                  textColor="text-yellow-500"
                />
              </>
            )}
          </>
        )}
      </div>
      {/* Role-based Rendering */}
      {(role === "superadmin" ||
        role === "admin" ||
        role === "registrator") && (
        <>
          <div className="grid grid-cols-2 gap-6 mb-6 max-[1250px]:grid-cols-1">
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
          <div className="grid grid-cols-2 gap-6 max-[1050px]:grid-cols-1">
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

// 🔹 Custom Bar for Buyurtmalar + Sotilgan
const CustomBar = (props: any) => {
  const { x, y, width, height, payload } = props;
  const buyurtmalar = payload.buyurtmalar;
  const sotilgan = payload.sotilgan;

  const soldWidth = buyurtmalar ? (sotilgan / buyurtmalar) * width : 0;

  return (
    <g>
      {/* Fon - Buyurtmalar */}
      <rect x={x} y={y} width={width} height={height} fill="#66B2FF" />
      {/* Ustiga - Sotilgan */}
      <rect x={x} y={y} width={soldWidth} height={height} fill="#0047AB" />
    </g>
  );
};

// 🔹 Helper Components (Charts & Tables)
const renderMarketsChart = (
  visibleMarkets: any[],
  showAllMarkets: boolean,
  setShowAllMarkets: (v: boolean) => void
) => (
  <ChartWrapper
    title={t("marketStatistics")}
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
    title={t("courierStatistics")}
    data={visibleCouriers}
    showAll={showAllCouriers}
    setShowAll={setShowAllCouriers}
  />
);


//Charts
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
    <ResponsiveContainer width="100%" height={Math.max(data.length * 60, 400)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 20, right: 30, left: 50, bottom: 20 }}
        barCategoryGap="10%" // ✅ barlar orasidagi masofa nisbiy
        barSize={75}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />

        {/* 🔹 YAxis custom tick */}
        <YAxis
          type="category"
          dataKey="nomi"
          width={20}
          tick={({ x, y, payload }) => (
            <text
              x={x - 5}
              y={y}
              dy={4}
              textAnchor="end"
              className="fill-gray-800 dark:fill-gray-100"
            >
              {payload.value.length > 4
                ? payload.value.slice(0, 4) + "..."
                : payload.value}
            </text>
          )}
        />

        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.05)" }}
          content={({ payload }) => {
            if (!payload || !payload.length) return null;
            const item = payload[0].payload;
            return (
              <div className="p-2 bg-black text-white rounded text-sm">
                <p>{item.nomi}</p>
                <p>
                  {t("orders")}: {item.buyurtmalar}
                </p>
                <p>
                  {t("solded")}: {item.sotilgan}
                </p>
              </div>
            );
          }}
        />

        {/* 🔹 Custom bar */}
        <Bar dataKey="buyurtmalar" name="Buyurtmalar" shape={<CustomBar />} />
      </BarChart>
    </ResponsiveContainer>

    {/* 🔹 Legend qo'lda */}
    <div className="flex justify-center gap-6 mt-3">
      <div className="flex items-center gap-2">
        <span
          className="w-4 h-4 rounded-sm"
          style={{ background: "#66B2FF" }}
        />
        <span>{t("orders")}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-4 h-4 rounded-sm"
          style={{ background: "#0047AB" }}
        />
        <span>{t("solded")}</span>
      </div>
    </div>

    <div className="flex justify-center mt-4">
      <button
        onClick={() => setShowAll(!showAll)}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer"
      >
        {showAll ? t("showLess") : t("showMore")}
      </button>
    </div>
  </div>
);


// 🔹 Top Markets Table
const renderMarketsTable = (markets: any[]) => (
  <TableWrapper
    title={t("topMarkets")}
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
    title={t("topCouriers")}
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
    <table className="w-full min-[900px]:border">
      <thead>
        <tr className="bg-gray-100 dark:bg-[#3B3656] text-left">
          <th className="p-2 border">#</th>
          <th className="p-2 border">{t("name")}</th>
          <th className="p-2 border">{t("orders")}</th>
          <th className="p-2 border">{t("solded")}</th>
          <th className="p-2 border">{t("rate")}</th>
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
              <td className="data-cell p-2 min-[900px]:border text-center" data-cell="#">{medalIcon ?? inx + 1}</td>
              <td className="data-cell p-2 min-[900px]:border" data-cell="Name">{item[nameKey]}</td>
              <td className="data-cell p-2 min-[900px]:border" data-cell="Orders">{item[ordersKey]}</td>
              <td className="data-cell p-2 min-[900px]:border" data-cell="Sold">{item[soldKey]}</td>
              <td className="data-cell p-2 min-[900px]:border" data-cell="Rate">{item[rateKey]}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default memo(Dashboards);
