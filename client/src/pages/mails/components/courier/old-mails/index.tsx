import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import { useDispatch } from "react-redux";
import {
  setHideSend,
  setRegionName,
} from "../../../../../shared/lib/features/regionSlice";
import { useTranslation } from "react-i18next";
import { Pagination, type PaginationProps } from "antd";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import { ChevronRight, Loader2, Clock, Calendar, CheckCircle, XCircle, Archive } from "lucide-react";

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

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    if (newPage === 1) removeParam("page");
    else setParam("page", newPage);

    if (newLimit === 8) removeParam("limit");
    else setParam("limit", newLimit);
  };

  const { data, isLoading } = getOldPostsCourier({ page, limit });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!posts?.length) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <Clock className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Eski pochtalar yo'q
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Hozircha arxivlangan pochtalar mavjud emas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
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
    </div>
  );
};

export default memo(CourierOldMails);
