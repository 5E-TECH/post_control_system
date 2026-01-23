import { memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { useHistory } from "../../shared/api/hooks/useHistory";
import { useTranslation } from "react-i18next";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Store,
  Truck,
  Building2,
  MapPin,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import CountUp from "react-countup";

const SkeletonBox = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${className}`} />
);

const Dashboard: React.FC = () => {
  const { t } = useTranslation("history");
  const { data, isLoading } = useHistory().getHistory();

  const orders = data?.data?.markets?.allMarketCashboxes;
  const markets = orders?.map((order: any) => ({
    name: order?.user?.name,
    amount: order?.balance,
  }));

  const tableCouriers = data?.data?.couriers?.allCourierCashboxes;
  const couriers = tableCouriers?.map((courier: any) => ({
    name: courier?.user?.name,
    amount: courier?.balance,
    region: courier?.user?.region?.name,
  }));

  const totalMarket = data?.data?.markets?.marketsTotalBalans || 0;
  const totalCourier = data?.data?.couriers?.couriersTotalBalanse || 0;
  const balans = data?.data?.difference || 0;
  const kassa = data?.data?.main?.balance || 0;
  const bugungiHolat = data?.data?.currentSituation || 0;

  const isPositive = bugungiHolat >= 0;

  // Chart data - haqiqiy qiymatlar
  // Kuryer: musbat = yashil (bizning pul), manfiy = qizil (biz qarz)
  // Market: manfiy = qizil (biz qarz), musbat = yashil (bizdan qarz)
  const barChartData = [
    { name: "Kassa", value: kassa, color: "#8B5CF6" },
    { name: "Kuryerlar", value: totalCourier, color: totalCourier >= 0 ? "#10B981" : "#EF4444" },
    { name: "Marketlar", value: totalMarket, color: totalMarket >= 0 ? "#10B981" : "#EF4444" },
  ];

  const pieChartData = [
    { name: "Kassa", value: Math.abs(kassa), color: "#8B5CF6" },
    { name: "Kuryerlar", value: Math.abs(totalCourier), color: totalCourier >= 0 ? "#10B981" : "#EF4444" },
    { name: "Marketlar", value: Math.abs(totalMarket), color: totalMarket >= 0 ? "#10B981" : "#EF4444" },
  ].filter(item => item.value > 0);

  return (
    <div className="bg-gray-50 dark:bg-[#1E1B2E] min-h-screen">
      {/* Hero Section - Main Status */}
      <div className={`${isPositive ? "bg-emerald-600" : "bg-red-600"} text-white`}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left - Title & Status */}
            <div>
              <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
                <Wallet className="w-4 h-4" />
                <span>{t("title") || "Moliyaviy balans"}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                {t("current_situation") || "Hozirgi holat"}
              </h1>
              <div className="flex items-center gap-2">
                {isPositive ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-200" />
                )}
                <span className="text-white/80">
                  {isPositive ? "Ijobiy holat" : "Salbiy holat"}
                </span>
              </div>
            </div>

            {/* Right - Main Amount */}
            <div className="text-right">
              {isLoading ? (
                <SkeletonBox className="w-48 h-14 ml-auto" />
              ) : (
                <>
                  <p className="text-4xl sm:text-5xl font-bold">
                    {isPositive ? "+" : ""}
                    <CountUp end={bugungiHolat} duration={1} separator=" " />
                  </p>
                  <p className="text-white/70 text-lg">UZS</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 -mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Kassa */}
          <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t("kassa")}
                </span>
                <p className="text-xs text-purple-500">Mavjud mablag'</p>
              </div>
            </div>
            {isLoading ? (
              <SkeletonBox className="w-32 h-8" />
            ) : (
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                <CountUp end={kassa} duration={1} separator=" " /> <span className="text-base font-normal text-gray-400">UZS</span>
              </p>
            )}
          </div>

          {/* Marketlar - Qarz */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl shadow-lg p-5 border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  {t("markets")}
                </span>
                <p className="text-xs text-red-500">
                  {totalMarket < 0 ? "(-) Biz qarzmiz" : "(+) Bizdan qarz"}
                </p>
              </div>
            </div>
            {isLoading ? (
              <SkeletonBox className="w-32 h-8" />
            ) : (
              <p className={`text-2xl font-bold ${totalMarket < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                <CountUp end={totalMarket} duration={1} separator=" " /> <span className="text-base font-normal text-gray-400">UZS</span>
              </p>
            )}
          </div>

          {/* Kuryerlar - Olish kerak */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl shadow-lg p-5 border-2 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {t("couriers")}
                </span>
                <p className="text-xs text-amber-600">
                  {totalCourier > 0 ? "(+) Bizning pul" : "(-) Biz qarz"}
                </p>
              </div>
            </div>
            {isLoading ? (
              <SkeletonBox className="w-32 h-8" />
            ) : (
              <p className={`text-2xl font-bold ${totalCourier > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                <CountUp end={totalCourier} duration={1} separator=" " /> <span className="text-base font-normal text-gray-400">UZS</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Moliyaviy ko'rsatkichlar</h3>
            {isLoading ? (
              <SkeletonBox className="w-full h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6B7280" }}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString()} UZS`, ""]}
                    contentStyle={{
                      backgroundColor: "#1F2937",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff"
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-xs text-gray-500">Kassa</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${totalCourier >= 0 ? "bg-emerald-500" : "bg-red-500"}`}></div>
                <span className="text-xs text-gray-500">Kuryerlar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${totalMarket >= 0 ? "bg-emerald-500" : "bg-red-500"}`}></div>
                <span className="text-xs text-gray-500">Marketlar</span>
              </div>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Taqsimot</h3>
            {isLoading ? (
              <SkeletonBox className="w-full h-[200px]" />
            ) : (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString()} UZS`, ""]}
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Legend */}
            <div className="space-y-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              {pieChartData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">
                    {item.value.toLocaleString()} UZS
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 mt-6">
        <div className={`rounded-xl p-5 ${balans >= 0 ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              {balans >= 0 ? (
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("totalBalans")}</p>
                <p className="text-xs text-gray-400">Kassa + Kuryerlar + Marketlar</p>
              </div>
            </div>
            {isLoading ? (
              <SkeletonBox className="w-40 h-10" />
            ) : (
              <p className={`text-3xl font-bold ${balans >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {balans >= 0 ? "+" : ""}{balans.toLocaleString()} UZS
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Markets Table */}
          <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Store className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white">{t("markets")}</h3>
                  <p className="text-xs text-gray-400">Marketlar bilan hisob-kitob</p>
                </div>
              </div>
              <span className="text-sm font-medium text-gray-500">{markets?.length || 0} ta</span>
            </div>

            {/* List */}
            <div className="max-h-[350px] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <SkeletonBox key={i} className="w-full h-14" />
                  ))}
                </div>
              ) : markets?.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Store className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Marketlar yo'q</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {markets?.map((m: any, idx: number) => {
                    // Market: manfiy (-) = biz qarzmiz (qizil), musbat (+) = bizdan qarz (yashil)
                    // Haqiqiy raqamni ko'rsatamiz
                    const amount = Number(m.amount);
                    return (
                      <div
                        key={idx}
                        className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 font-semibold text-sm flex-shrink-0">
                            {idx + 1}
                          </div>
                          <span className="font-medium text-gray-700 dark:text-gray-200 truncate">
                            {m.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="font-medium text-gray-600 dark:text-gray-300">Jami</span>
              <span className={`text-lg font-bold ${totalMarket >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {Number(totalMarket).toLocaleString()} UZS
              </span>
            </div>
          </div>

          {/* Couriers Table */}
          <div className="bg-white dark:bg-[#2A263D] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-white">{t("couriers")}</h3>
                  <p className="text-xs text-gray-400">Kuryerlar bilan hisob-kitob</p>
                </div>
              </div>
              <span className="text-sm font-medium text-gray-500">{couriers?.length || 0} ta</span>
            </div>

            {/* List */}
            <div className="max-h-[350px] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <SkeletonBox key={i} className="w-full h-14" />
                  ))}
                </div>
              ) : couriers?.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>Kuryerlar yo'q</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {couriers?.map((c: any, idx: number) => {
                    // Kuryer: musbat (+) = bizning pulimiz (yashil), manfiy (-) = biz qarz (qizil)
                    // Haqiqiy raqamni ko'rsatamiz
                    const amount = Number(c.amount);
                    return (
                      <div
                        key={idx}
                        className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 font-semibold text-sm flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-700 dark:text-gray-200 truncate">
                              {c.name}
                            </p>
                            {c.region && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {c.region}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${amount > 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="font-medium text-gray-600 dark:text-gray-300">Jami</span>
              <span className={`text-lg font-bold ${totalCourier > 0 ? "text-emerald-600" : "text-red-600"}`}>
                {Number(totalCourier).toLocaleString()} UZS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Dashboard);
