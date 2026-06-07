import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import { useDispatch } from "react-redux";
import {
  setHideSend,
  setRegionName,
} from "../../../../../shared/lib/features/regionSlice";
import { useTranslation } from "react-i18next";
import { DatePicker, Pagination, Select, type PaginationProps } from "antd";
import dayjs from "dayjs";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import { ChevronRight, Loader2, Clock, Calendar, CheckCircle, XCircle, Archive, Filter, X } from "lucide-react";

const { RangePicker } = DatePicker;

// Kuryer eski pochtalari faqat shu statuslarda bo'ladi (qabul qilingan /
// bekor qilib jo'natilgan / qaytarilgan).
const courierStatusOptions = [
  { value: "received", label: "Qabul qilingan" },
  { value: "canceled", label: "Bekor qilingan" },
  { value: "canceled_received", label: "Qaytarilgan" },
];

const statusConfig: Record<string, { badge: string; icon: typeof CheckCircle; label: string }> = {
  sent: { badge: "bg-blue-500/80", icon: CheckCircle, label: "Jo'natilgan" },
  received: { badge: "bg-emerald-500/80", icon: CheckCircle, label: "Qabul qilingan" },
  canceled: { badge: "bg-red-500/80", icon: XCircle, label: "Bekor qilingan" },
  canceled_received: { badge: "bg-orange-500/80", icon: XCircle, label: "Qaytarilgan" },
  new: { badge: "bg-gray-500/80", icon: Clock, label: "Yangi" },
};

const CourierOldMails = () => {
  useTranslation("mails");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { getOldPostsCourier } = usePost();

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 12);

  const status = getParam("status") || undefined;
  const from = getParam("from") || undefined;
  const to = getParam("to") || undefined;
  const hasFilter = !!(status || from || to);

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    if (newPage === 1) removeParam("page");
    else setParam("page", newPage);

    if (newLimit === 8) removeParam("limit");
    else setParam("limit", newLimit);
  };

  // Filtr o'zgarganda sahifani 1-ga qaytaramiz.
  const applyFilter = (key: string, value?: string) => {
    if (value) setParam(key, value);
    else removeParam(key);
    removeParam("page");
  };

  const clearFilters = () => {
    ["status", "from", "to", "page"].forEach(removeParam);
  };

  const { data, isLoading } = getOldPostsCourier({
    page,
    limit,
    status,
    startDate: from,
    endDate: to,
  });
  const posts = Array.isArray(data?.data?.data)
    ? data?.data?.data
    : Array.isArray(data?.data)
    ? data?.data
    : [];
  const total = data?.data?.total || posts.length;

  const handleNavigate = (post: any) => {
    navigate(`/courier-mails/${post?.id}`);
    dispatch(setRegionName(post?.region?.name));
    dispatch(setHideSend(true));
  };

  const formatDate = (timestamp: string | number) => {
    if (!timestamp) return "-";
    return new Date(Number(timestamp)).toLocaleString("uz-UZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status?.toLowerCase()] || statusConfig.new;
  };

  const activeCount = [status, from || to].filter(Boolean).length;
  const labelCls =
    "flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

  const filterBar = (
    <div className="flex-shrink-0 mb-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-[#2A263D] p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Filter className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Filtrlar
          </span>
          {activeCount > 0 && (
            <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-semibold">
              {activeCount}
            </span>
          )}
        </div>
        {hasFilter && (
          <button
            onClick={clearFilters}
            className="h-8 px-3 rounded-lg bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Tozalash
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
        <div>
          <label className={labelCls}>
            <Archive className="w-3.5 h-3.5" /> Pochta turi
          </label>
          <Select
            allowClear
            size="large"
            value={status}
            onChange={(v) => applyFilter("status", v)}
            options={courierStatusOptions}
            placeholder="Barchasi"
            className="w-full"
          />
        </div>
        <div>
          <label className={labelCls}>
            <Calendar className="w-3.5 h-3.5" /> Sana oralig'i
          </label>
          <RangePicker
            size="large"
            value={[from ? dayjs(from) : null, to ? dayjs(to) : null]}
            onChange={(dates: any) => {
              applyFilter(
                "from",
                dates?.[0] ? dates[0].format("YYYY-MM-DD") : undefined,
              );
              if (dates?.[1]) setParam("to", dates[1].format("YYYY-MM-DD"));
              else removeParam("to");
            }}
            placeholder={["Boshlanish", "Tugash"]}
            format="YYYY-MM-DD"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {filterBar}

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        </div>
      ) : !posts?.length ? (
        <div className="flex justify-center items-center flex-1 py-20">
          <div className="text-center">
            <Clock className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              {hasFilter ? "Filtr bo'yicha pochta topilmadi" : "Eski pochtalar yo'q"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {hasFilter
                ? "Boshqa pochta turi yoki sanani tanlab ko'ring"
                : "Hozircha arxivlangan pochtalar mavjud emas"}
            </p>
          </div>
        </div>
      ) : (
        <>
      {/* Posts Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {posts.map((post: any) => {
            const config = getStatusConfig(post?.status);
            const StatusIcon = config.icon;

            return (
              <div
                key={post?.id}
                onClick={() => handleNavigate(post)}
                className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-2xl p-5 cursor-pointer hover:shadow-xl hover:from-slate-500 hover:to-gray-600 transition-all group opacity-90"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                    <Archive className="w-6 h-6 text-white/80" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white ${config.badge}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                    <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
                  <Calendar className="w-4 h-4" />
                  {formatDate(post?.created_at)}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">Buyurtmalar:</span>
                    <span className="text-white/90 font-semibold text-base">{post?.order_quantity} ta</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">Summa:</span>
                    <span className="text-white/90 font-bold text-base">
                      {new Intl.NumberFormat("uz-UZ").format(Number(post?.post_total_price) || 0)} so'm
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-center py-4 flex-shrink-0 border-t border-gray-100 dark:border-gray-700/50 mt-4">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
          pageSizeOptions={["8", "12", "24", "48"]}
          className="cursor-pointer"
        />
      </div>
        </>
      )}
    </div>
  );
};

export default memo(CourierOldMails);
