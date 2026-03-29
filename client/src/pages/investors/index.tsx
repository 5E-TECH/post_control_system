import { memo } from "react";
import { useUser } from "../../shared/api/hooks/useRegister";
import {
  Landmark,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Empty } from "antd";
import { useNavigate } from "react-router-dom";
import { buildAdminPath } from "../../shared/const";

const fmt = (val: number) => Number(val || 0).toLocaleString("uz-UZ");

const Investors = () => {
  const navigate = useNavigate();
  const { getInvestors } = useUser();
  const { data, isLoading } = getInvestors();
  const investors = data?.data || [];

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <Landmark className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
            Investorlar
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {investors.length} ta investor
          </p>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : investors.length === 0 ? (
        <div className="py-16">
          <Empty description="Investorlar topilmadi" />
        </div>
      ) : (
        <div className="space-y-2">
          {investors.map((inv: any) => (
            <div
              key={inv.id}
              onClick={() => navigate(buildAdminPath(`investors/${inv.id}`))}
              className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800 transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                  {inv.name?.charAt(0)?.toUpperCase() || "I"}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {inv.name}
                  </p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${inv.is_partner ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"}`}>
                    {inv.is_partner ? "Sherik" : "Investor"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Bugungi daromad</p>
                  <p className={`text-sm font-bold ${inv.today_earned > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
                    {inv.today_earned > 0 ? `+${fmt(inv.today_earned)}` : "0"} so'm
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(Investors);
