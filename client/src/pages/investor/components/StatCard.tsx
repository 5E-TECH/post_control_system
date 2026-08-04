import { memo, type ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  gradient: string; // masalan "from-blue-500 to-cyan-500"
  suffix?: string;
  badge?: string;
}

// Dashboards ichidagi inline StatCard'ning investor uchun mustaqil nusxasi
// (mavjud dark-mode kart uslubiga mos).
const StatCard = ({ icon, label, value, gradient, suffix, badge }: StatCardProps) => {
  return (
    <div className="relative bg-white dark:bg-[#2A263D] p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-md`}
        >
          {icon}
        </div>
        {badge && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#3B3656] text-gray-600 dark:text-gray-300">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-lg sm:text-2xl font-bold text-gray-800 dark:text-white break-words">
        {typeof value === "number" ? value.toLocaleString("uz-UZ") : value}
        {suffix && (
          <span className="ml-1 text-xs font-medium text-gray-400">{suffix}</span>
        )}
      </p>
    </div>
  );
};

export default memo(StatCard);
