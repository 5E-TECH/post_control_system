import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Trophy,
  Medal,
  Crown,
  Flame,
  TrendingUp,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface LeaderboardItem {
  id?: string;
  name: string;
  totalOrders: number;
  successfulOrders: number;
  successRate: number;
}

interface LeaderboardProps {
  title: string;
  data: LeaderboardItem[];
  type: "markets" | "couriers";
  showPodium?: boolean;
}

// Podium ranglari
const PODIUM_COLORS = {
  gold: {
    bg: "from-yellow-400 via-yellow-500 to-amber-600",
    glow: "shadow-yellow-500/50",
    text: "text-yellow-900",
    border: "border-yellow-400",
    light: "bg-yellow-50 dark:bg-yellow-900/20",
  },
  silver: {
    bg: "from-gray-300 via-gray-400 to-gray-500",
    glow: "shadow-gray-400/50",
    text: "text-gray-800",
    border: "border-gray-400",
    light: "bg-gray-50 dark:bg-gray-800/30",
  },
  bronze: {
    bg: "from-amber-600 via-amber-700 to-amber-800",
    glow: "shadow-amber-600/50",
    text: "text-amber-900",
    border: "border-amber-600",
    light: "bg-amber-50 dark:bg-amber-900/20",
  },
};

// Avatar ranglari
const AVATAR_COLORS = [
  "from-purple-500 to-pink-500",
  "from-blue-500 to-cyan-500",
  "from-green-500 to-emerald-500",
  "from-orange-500 to-red-500",
  "from-indigo-500 to-purple-500",
  "from-teal-500 to-green-500",
  "from-rose-500 to-pink-500",
  "from-amber-500 to-yellow-500",
];

// Ism qisqartirish (avatar uchun)
const getInitials = (name: string) => {
  if (!name) return "?";
  const words = name.trim().split(" ");
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Podium Card - Top 3 uchun
const PodiumCard = memo(
  ({
    item,
    position,
  }: {
    item: LeaderboardItem;
    position: 1 | 2 | 3;
  }) => {
    const { t } = useTranslation(["dashboard"]);
    const colorKey =
      position === 1 ? "gold" : position === 2 ? "silver" : "bronze";
    const colors = PODIUM_COLORS[colorKey];
    const avatarColor = AVATAR_COLORS[position % AVATAR_COLORS.length];

    // Podium balandligi
    const podiumHeight =
      position === 1 ? "h-28 sm:h-32" : position === 2 ? "h-20 sm:h-24" : "h-16 sm:h-20";
    const cardOrder = position === 1 ? "order-2" : position === 2 ? "order-1" : "order-3";
    const cardMarginTop = position === 1 ? "mt-0" : position === 2 ? "mt-6 sm:mt-8" : "mt-10 sm:mt-12";

    return (
      <div
        className={`flex flex-col items-center ${cardOrder} ${cardMarginTop} flex-1 min-w-0 px-1`}
      >
        {/* Crown for #1 */}
        {position === 1 && (
          <div className="animate-bounce mb-1">
            <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 drop-shadow-lg" />
          </div>
        )}

        {/* Avatar */}
        <div className="relative mb-2">
          <div
            className={`
              w-12 h-12 sm:w-16 sm:h-16 rounded-full
              bg-gradient-to-br ${avatarColor}
              flex items-center justify-center
              text-white font-bold text-sm sm:text-lg
              shadow-lg ${colors.glow}
              border-3 sm:border-4 ${colors.border}
              transform hover:scale-110 transition-transform duration-300
            `}
          >
            {getInitials(item.name)}
          </div>
          {/* Medal badge */}
          <div
            className={`
              absolute -bottom-1 -right-1
              w-5 h-5 sm:w-6 sm:h-6 rounded-full
              bg-gradient-to-br ${colors.bg}
              flex items-center justify-center
              text-white font-bold text-xs
              shadow-md
            `}
          >
            {position}
          </div>
        </div>

        {/* Ism */}
        <p
          className="font-semibold text-center text-xs sm:text-sm max-w-full truncate px-1"
          title={item.name}
        >
          {item.name}
        </p>

        {/* Success rate */}
        <div className="flex items-center gap-1 mt-1">
          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
          <span className="text-green-600 dark:text-green-400 font-bold text-xs sm:text-sm">
            {item.successRate}%
          </span>
        </div>

        {/* Stats */}
        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
          {item.successfulOrders}/{item.totalOrders} {t("ordersShort")}
        </div>

        {/* Podium */}
        <div
          className={`
            w-full ${podiumHeight} mt-2
            bg-gradient-to-b ${colors.bg}
            rounded-t-lg
            flex items-center justify-center
            shadow-lg ${colors.glow}
          `}
        >
          {position === 1 && (
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-100 opacity-50" />
          )}
          {position === 2 && (
            <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-gray-100 opacity-50" />
          )}
          {position === 3 && (
            <Star className="w-5 h-5 sm:w-6 sm:h-6 text-amber-100 opacity-50" />
          )}
        </div>
      </div>
    );
  }
);

// Oddiy ro'yxat elementi (4-10 o'rinlar uchun)
const LeaderboardRow = memo(
  ({
    item,
    position,
    isExpanded,
  }: {
    item: LeaderboardItem;
    position: number;
    isExpanded?: boolean;
  }) => {
    const { t } = useTranslation(["dashboard"]);
    const avatarColor = AVATAR_COLORS[position % AVATAR_COLORS.length];

    // Animatsiya uchun delay
    const animationDelay = `${(position - 4) * 100}ms`;

    return (
      <div
        className={`
          flex items-center gap-2 sm:gap-4 p-2 sm:p-3
          bg-white dark:bg-[#3B3656]
          rounded-xl
          hover:bg-gray-50 dark:hover:bg-[#4B4666]
          transition-all duration-300
          border border-gray-100 dark:border-gray-700
          ${isExpanded ? "animate-slideIn" : ""}
        `}
        style={{ animationDelay }}
      >
        {/* Position */}
        <div
          className={`
            w-7 h-7 sm:w-8 sm:h-8 rounded-full
            bg-gray-100 dark:bg-gray-700
            flex items-center justify-center
            font-bold text-xs sm:text-sm text-gray-600 dark:text-gray-300
            flex-shrink-0
          `}
        >
          {position}
        </div>

        {/* Avatar */}
        <div
          className={`
            w-8 h-8 sm:w-10 sm:h-10 rounded-full
            bg-gradient-to-br ${avatarColor}
            flex items-center justify-center
            text-white font-semibold text-xs sm:text-sm
            flex-shrink-0
          `}
        >
          {getInitials(item.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm sm:text-base truncate">{item.name}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
            {item.successfulOrders}/{item.totalOrders} {t("ordersShort")}
          </p>
        </div>

        {/* Success Rate */}
        <div className="flex flex-col items-end flex-shrink-0">
          <div className="flex items-center gap-1">
            <Flame
              className={`w-3 h-3 sm:w-4 sm:h-4 ${
                item.successRate >= 80
                  ? "text-green-500"
                  : item.successRate >= 60
                  ? "text-yellow-500"
                  : "text-gray-400"
              }`}
            />
            <span
              className={`font-bold text-sm sm:text-base ${
                item.successRate >= 80
                  ? "text-green-600 dark:text-green-400"
                  : item.successRate >= 60
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {item.successRate}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-12 sm:w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                item.successRate >= 80
                  ? "bg-green-500"
                  : item.successRate >= 60
                  ? "bg-yellow-500"
                  : "bg-gray-400"
              }`}
              style={{ width: `${item.successRate}%` }}
            />
          </div>
        </div>
      </div>
    );
  }
);

// Asosiy Leaderboard komponenti
const Leaderboard = memo(
  ({ title, data, type, showPodium = true }: LeaderboardProps) => {
    const { t } = useTranslation(["dashboard"]);
    const [isExpanded, setIsExpanded] = useState(false);

    // Data formatlash - turli formatlarni qo'llab-quvvatlash
    const formattedData: LeaderboardItem[] = (data || []).map((item: any) => ({
      id: item.market_id || item.courier_id || item.id,
      name: item.market_name || item.courier_name || item.name || "Unknown",
      totalOrders: Number(item.total_orders || item.totalOrders) || 0,
      successfulOrders: Number(item.successful_orders || item.successfulOrders) || 0,
      successRate: Number(item.success_rate || item.successRate) || 0,
    }));

    const top3 = formattedData.slice(0, 3);
    const rest = formattedData.slice(3);
    const visibleRest = isExpanded ? rest : rest.slice(0, 4);

    if (formattedData.length === 0) {
      return (
        <div className="bg-white dark:bg-[#2A263D] p-4 sm:p-6 rounded-2xl shadow-lg">
          <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            {title}
          </h3>
          <div className="text-center py-8 text-gray-500">
            <Medal className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>{t("noData")}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-[#2A263D] p-3 sm:p-6 rounded-2xl shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-sm sm:text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
            <span className="truncate">{title}</span>
          </h3>
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full flex-shrink-0">
            <Flame className="w-3 h-3 text-orange-500" />
            <span className="hidden sm:inline">{t("last30Days")}</span>
            <span className="sm:hidden">30 {t("daysShort")}</span>
          </div>
        </div>

        {/* Podium - Top 3 */}
        {showPodium && top3.length >= 3 && (
          <div className="flex items-end justify-center gap-1 sm:gap-2 mb-4 sm:mb-6 px-2">
            {/* 2nd place */}
            <PodiumCard item={top3[1]} position={2} />
            {/* 1st place */}
            <PodiumCard item={top3[0]} position={1} />
            {/* 3rd place */}
            <PodiumCard item={top3[2]} position={3} />
          </div>
        )}

        {/* Mobile: Simplified top 3 cards when less than 3 items */}
        {showPodium && top3.length > 0 && top3.length < 3 && (
          <div className="space-y-2 mb-4">
            {top3.map((item, idx) => (
              <LeaderboardRow
                key={item.id || idx}
                item={item}
                position={idx + 1}
              />
            ))}
          </div>
        )}

        {/* Rest of the list */}
        {rest.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-[10px] sm:text-xs text-gray-500 px-2">
                {t("otherParticipants")}
              </span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            {visibleRest.map((item, idx) => (
              <LeaderboardRow
                key={item.id || idx + 4}
                item={item}
                position={idx + 4}
                isExpanded={isExpanded && idx >= 4}
              />
            ))}

            {/* Show more/less button */}
            {rest.length > 4 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`
                  w-full py-2 sm:py-3 mt-2
                  flex items-center justify-center gap-2
                  text-blue-600 dark:text-blue-400
                  hover:bg-blue-50 dark:hover:bg-blue-900/20
                  rounded-xl transition-colors
                  text-sm font-medium
                `}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    {t("showLess")}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    {t("showMore")} ({rest.length - 4})
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Motivational footer */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl">
          <p className="text-xs sm:text-sm text-center text-gray-700 dark:text-gray-300">
            {type === "couriers" ? (
              <>
                <Star className="w-4 h-4 inline-block text-yellow-500 mr-1" />
                {t("courierMotivation")}
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4 inline-block text-green-500 mr-1" />
                {t("marketMotivation")}
              </>
            )}
          </p>
        </div>
      </div>
    );
  }
);

// CSS animatsiyasi uchun
const styles = `
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-slideIn {
  animation: slideIn 0.3s ease-out forwards;
}
`;

// Style qo'shish
if (typeof document !== "undefined") {
  const styleElement = document.createElement("style");
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default Leaderboard;
