import { memo, useEffect, useState } from "react";
import { useChart } from "../../shared/api/hooks/useChart";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import {
  CheckCircle,
  DollarSign,
  ShoppingCart,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCourierStatCard } from "../../shared/api/hooks/useCourierStatCard";
import { useMarketStatCard } from "../../shared/api/hooks/useMarketStatCard";

import { DatePicker } from "antd";

import dayjs from "dayjs";
import CustomCalendar from "../../shared/components/customDate";
import Leaderboard from "../../shared/components/Leaderboard";
import SalesChart from "../../shared/components/SalesChart";
import RevenueChart from "../../shared/components/RevenueChart";

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

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Success rate hisoblash
  const totalOrders = dashboard?.acceptedCount || 0;
  const soldOrders = dashboard?.soldAndPaid || 0;
  const successRate = totalOrders > 0 ? ((soldOrders / totalOrders) * 100).toFixed(1) : 0;

  let titleText = `${t("title")}`;

  if (fromDate && toDate && fromDate === toDate) {
    titleText = `${fromDate} - ${t("title")}`;
  } else if (fromDate && toDate && fromDate !== toDate) {
    titleText = `${fromDate} - ${toDate}`;
  } else if (fromDate && !toDate) {
    titleText = `${fromDate} dan boshlab`;
  } else if (!fromDate && toDate) {
    titleText = `${toDate} gacha`;
  }

  return (
    <div className="w-full p-3 sm:p-6 dark:bg-[#312D48] min-h-screen transition">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
              {titleText}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {t("dateRange")}
            </p>
          </div>
        </div>

        {/* Date Picker */}
        <div className="w-full sm:w-auto">
          {isLoading ? (
            <SkeletonBox className="w-full sm:w-64 h-10" />
          ) : (
            <>
              {!isMobile ? (
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
                  className="w-full sm:w-64
                    dark:bg-[#342d4a]!
                    dark:border-[#4b3b6a]!
                    dark:[&_.ant-picker-input>input]:text-white!
                    dark:[&_.ant-picker-input>input]:placeholder-gray-300!"
                />
              ) : (
                <CustomCalendar
                  from={fromDate ? dayjs(fromDate) : null}
                  to={toDate ? dayjs(toDate) : null}
                  setFrom={(date: any) =>
                    setFromDate(date ? date.format("YYYY-MM-DD") : undefined)
                  }
                  setTo={(date: any) =>
                    setToDate(date ? date.format("YYYY-MM-DD") : undefined)
                  }
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#2A263D] p-4 sm:p-6 rounded-2xl">
              <SkeletonBox className="w-20 h-4 mb-3" />
              <SkeletonBox className="w-16 h-8" />
            </div>
          ))
        ) : (
          <>
            {role === "courier" && (
              <>
                <StatCard
                  icon={<ShoppingCart className="w-5 h-5" />}
                  label={t("totalOrders")}
                  value={aboutCourier?.totalOrders || 0}
                  gradient="from-blue-500 to-cyan-500"
                />
                <StatCard
                  icon={<CheckCircle className="w-5 h-5" />}
                  label={t("solded")}
                  value={aboutCourier?.soldOrders || 0}
                  gradient="from-green-500 to-emerald-500"
                />
                <StatCard
                  icon={<XCircle className="w-5 h-5" />}
                  label={t("cancelled")}
                  value={aboutCourier?.canceledOrders || 0}
                  gradient="from-red-500 to-rose-500"
                />
                <StatCard
                  icon={<DollarSign className="w-5 h-5" />}
                  label={t("profit")}
                  value={`${Number(aboutCourier?.profit || 0).toLocaleString()}`}
                  suffix="UZS"
                  gradient="from-amber-500 to-yellow-500"
                />
              </>
            )}

            {role === "market" && (
              <>
                <StatCard
                  icon={<ShoppingCart className="w-5 h-5" />}
                  label={t("totalOrders")}
                  value={aboutMarket?.totalOrders || 0}
                  gradient="from-blue-500 to-cyan-500"
                />
                <StatCard
                  icon={<CheckCircle className="w-5 h-5" />}
                  label={t("solded")}
                  value={aboutMarket?.soldOrders || 0}
                  gradient="from-green-500 to-emerald-500"
                />
                <StatCard
                  icon={<XCircle className="w-5 h-5" />}
                  label={t("cancelled")}
                  value={aboutMarket?.canceledOrders || 0}
                  gradient="from-red-500 to-rose-500"
                />
                <StatCard
                  icon={<DollarSign className="w-5 h-5" />}
                  label={t("profit")}
                  value={`${Number(aboutMarket?.profit || 0).toLocaleString()}`}
                  suffix="UZS"
                  gradient="from-amber-500 to-yellow-500"
                />
              </>
            )}

            {(role === "superadmin" || role === "admin") && (
              <>
                <StatCard
                  icon={<ShoppingCart className="w-5 h-5" />}
                  label={t("totalOrders")}
                  value={dashboard?.acceptedCount || 0}
                  gradient="from-blue-500 to-cyan-500"
                />
                <StatCard
                  icon={<CheckCircle className="w-5 h-5" />}
                  label={t("solded")}
                  value={dashboard?.soldAndPaid || 0}
                  gradient="from-green-500 to-emerald-500"
                  badge={`${successRate}%`}
                />
                <StatCard
                  icon={<XCircle className="w-5 h-5" />}
                  label={t("cancelled")}
                  value={dashboard?.cancelled || 0}
                  gradient="from-red-500 to-rose-500"
                />
                <StatCard
                  icon={<DollarSign className="w-5 h-5" />}
                  label={t("profit")}
                  value={`${Number(dashboard?.profit || 0).toLocaleString()}`}
                  suffix="UZS"
                  gradient="from-amber-500 to-yellow-500"
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Role-based Rendering */}
      {(role === "superadmin" || role === "admin" || role === "registrator") && (
        <>
          {/* Revenue Chart - Full Width */}
          <div className="mb-6">
            <RevenueChart startDate={fromDate} endDate={toDate} />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <SalesChart
              title={t("marketStatistics")}
              data={visibleMarkets}
              type="markets"
              showAll={showAllMarkets}
              setShowAll={setShowAllMarkets}
            />
            <SalesChart
              title={t("courierStatistics")}
              data={visibleCouriers}
              type="couriers"
              showAll={showAllCouriers}
              setShowAll={setShowAllCouriers}
            />
          </div>

          {/* Leaderboards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Leaderboard
              title={t("topMarkets")}
              data={markets}
              type="markets"
            />
            <Leaderboard
              title={t("topCouriers")}
              data={couriers}
              type="couriers"
            />
          </div>
        </>
      )}

      {/* Market faqat marketlar reytingi va o'z statistikasini ko'radi */}
      {role === "market" && (
        <div className="space-y-4 sm:space-y-6">
          <Leaderboard
            title={t("topMarkets")}
            data={markets}
            type="markets"
          />
        </div>
      )}

      {/* Courier faqat kuryerlar reytingi va o'z statistikasini ko'radi */}
      {role === "courier" && (
        <div className="space-y-4 sm:space-y-6">
          <Leaderboard
            title={t("topCouriers")}
            data={couriers}
            type="couriers"
          />
        </div>
      )}
    </div>
  );
};

// Stat Card Component - Redesigned
const StatCard = ({
  icon,
  label,
  value,
  gradient,
  suffix,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  gradient: string;
  suffix?: string;
  badge?: string;
}) => (
  <div className="relative bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
    {/* Gradient accent */}
    <div
      className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradient}`}
    />

    {/* Icon */}
    <div
      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-3 shadow-lg group-hover:scale-105 transition-transform`}
    >
      {icon}
    </div>

    {/* Label */}
    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1 truncate">
      {label}
    </p>

    {/* Value */}
    <div className="flex items-baseline gap-1">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white truncate">
        {value}
      </h2>
      {suffix && (
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {suffix}
        </span>
      )}
    </div>

    {/* Badge */}
    {badge && (
      <div className="absolute top-3 right-3 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-semibold rounded-full">
        {badge}
      </div>
    )}
  </div>
);

export default memo(Dashboards);
