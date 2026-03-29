import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../shared/api/hooks/useRegister";
import { useOrder } from "../../shared/api/hooks/useOrder";
import { useApiNotification } from "../../shared/hooks/useApiNotification";
import ConfirmPopup from "../../shared/components/confirmPopup";
import { Pagination, type PaginationProps, Empty } from "antd";
import { useParamsHook } from "../../shared/hooks/useParams";
import { buildAdminPath } from "../../shared/const";
import {
  Loader2,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Phone,
  MapPin,
  User,
  Calendar,
  ChevronRight,
  Truck,
  Home,
  Edit,
  Trash2,
  Filter,
  Wallet,
  TrendingDown,
} from "lucide-react";

const fmt = (val: number) =>
  new Intl.NumberFormat("uz-UZ").format(val || 0);

const fmtDate = (ts: string | number) => {
  if (!ts) return "—";
  const date = new Date(Number(ts));
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month} ${hours}:${minutes}`;
};

const formatPhone = (phone: string) => {
  if (!phone) return "";
  return phone
    .replace(/\D/g, "")
    .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
};

// Status config
const statusConfig: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string; label: string }
> = {
  created: { bg: "bg-blue-100", text: "text-blue-700", darkBg: "dark:bg-blue-900/30", darkText: "dark:text-blue-400", label: "Yaratilgan" },
  new: { bg: "bg-sky-100", text: "text-sky-700", darkBg: "dark:bg-sky-900/30", darkText: "dark:text-sky-400", label: "Yangi" },
  received: { bg: "bg-green-100", text: "text-green-700", darkBg: "dark:bg-green-900/30", darkText: "dark:text-green-400", label: "Qabul qilingan" },
  "on the road": { bg: "bg-amber-100", text: "text-amber-700", darkBg: "dark:bg-amber-900/30", darkText: "dark:text-amber-400", label: "Yo'lda" },
  waiting: { bg: "bg-orange-100", text: "text-orange-700", darkBg: "dark:bg-orange-900/30", darkText: "dark:text-orange-400", label: "Kutilmoqda" },
  sold: { bg: "bg-violet-100", text: "text-violet-700", darkBg: "dark:bg-violet-900/30", darkText: "dark:text-violet-400", label: "Sotilgan" },
  cancelled: { bg: "bg-red-100", text: "text-red-700", darkBg: "dark:bg-red-900/30", darkText: "dark:text-red-400", label: "Bekor qilingan" },
  paid: { bg: "bg-emerald-100", text: "text-emerald-700", darkBg: "dark:bg-emerald-900/30", darkText: "dark:text-emerald-400", label: "To'langan" },
  partly_paid: { bg: "bg-teal-100", text: "text-teal-700", darkBg: "dark:bg-teal-900/30", darkText: "dark:text-teal-400", label: "Qisman to'langan" },
  "cancelled (sent)": { bg: "bg-gray-100", text: "text-gray-700", darkBg: "dark:bg-gray-800", darkText: "dark:text-gray-400", label: "Bekor (yuborilgan)" },
  closed: { bg: "bg-zinc-100", text: "text-zinc-700", darkBg: "dark:bg-zinc-800", darkText: "dark:text-zinc-400", label: "Yopilgan" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status] || statusConfig.new;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${config.bg} ${config.text} ${config.darkBg} ${config.darkText}`}>
      {config.label}
    </span>
  );
};

const statusFilters = [
  { value: "", label: "Barchasi" },
  { value: "created", label: "Yaratilgan" },
  { value: "new", label: "Yangi" },
  { value: "received", label: "Qabul qilingan" },
  { value: "on the road", label: "Yo'lda" },
  { value: "waiting", label: "Kutilmoqda" },
  { value: "sold", label: "Sotildi" },
  { value: "paid", label: "To'langan" },
  { value: "cancelled", label: "Bekor qilingan" },
];

const canEditOrder = (status: string) => status === "created" || status === "new";

// Mobile Order Card
const OrderCard = ({
  item,
  index,
  onClick,
  onEdit,
  onDelete,
  showEarnings,
}: {
  item: any;
  index: number;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showEarnings: boolean;
}) => (
  <div
    onClick={onClick}
    className="bg-white dark:bg-[#2A2640] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-transform cursor-pointer"
  >
    {/* Header: Status + Index + Actions */}
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <StatusBadge status={item?.status} />
        <span className="text-xs text-gray-400">#{index + 1}</span>
      </div>
      {canEditOrder(item?.status) && (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all cursor-pointer"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>

    {/* Customer info */}
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
        <User className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-base text-gray-800 dark:text-white truncate">
          {item?.customer?.name || "Noma'lum"}
        </h3>
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <Phone className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          {formatPhone(item?.customer?.phone_number)}
        </span>
      </div>
    </div>

    {/* Info Row */}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-sm">
      <div className="flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-gray-600 dark:text-gray-300">
          {item?.district?.name || item?.customer?.district?.name || "-"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-gray-600 dark:text-gray-300">
          {fmtDate(item?.created_at)}
        </span>
      </div>
    </div>

    {/* Footer: Price + Earning + Delivery + Arrow */}
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Narxi</p>
          <p className="font-bold text-gray-800 dark:text-white">
            {fmt(item?.total_price)}{" "}
            <span className="text-xs font-normal text-gray-500">so'm</span>
          </p>
        </div>

        {/* Earning */}
        {showEarnings && item?.earning && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Daromad</p>
            {item.is_cancelled ? (
              <p className="text-sm font-semibold text-red-500 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                <span className="line-through">{fmt(item.earning.amount)}</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                <Wallet className="w-3 h-3" />+{fmt(item.earning.amount)}
              </p>
            )}
          </div>
        )}

        {/* Delivery type */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
          {item?.where_deliver === "address" ? (
            <Home className="w-3.5 h-3.5 text-orange-500" />
          ) : (
            <Truck className="w-3.5 h-3.5 text-blue-500" />
          )}
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {item?.where_deliver === "address" ? "Uyga" : "Markaz"}
          </span>
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-gray-400" />
    </div>
  </div>
);

// Loading Skeletons
const MobileCardSkeleton = () => (
  <div className="bg-white dark:bg-[#2A2640] rounded-xl p-4 animate-pulse">
    <div className="flex items-start justify-between mb-3">
      <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      <div className="flex-1">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
        <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  </div>
);

const TableRowSkeleton = () => (
  <tr className="animate-pulse">
    {[...Array(8)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      </td>
    ))}
  </tr>
);

const OperatorOrders = () => {
  const navigate = useNavigate();
  const { getMyOrders } = useUser();
  const { deleteOrders } = useOrder();
  const { handleApiError, handleSuccess } = useApiNotification();

  const { getParam, setParam, removeParam } = useParamsHook();
  const limit = Number(getParam("limit") || 20);
  const [page, setPage] = useState<number>(Number(getParam("page") || 1));
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const { data, isLoading } = getMyOrders(
    { page, limit, status: statusFilter || undefined },
    true,
  );

  const result = data?.data;
  const orders = result?.orders || [];
  const stats = result?.stats;
  const pagination = result?.pagination;
  const showEarnings = result?.show_earnings;
  const total = pagination?.total || 0;

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    setPage(newPage);
    newPage === 1 ? removeParam("page") : setParam("page", newPage);
    if (newLimit !== limit) setParam("limit", newLimit);
  };

  const handleDelete = (id: string) => {
    deleteOrders.mutate(id, {
      onSuccess: () => handleSuccess("Buyurtma muvaffaqiyatli o'chirildi"),
      onError: (err: any) => handleApiError(err, "Buyurtmani o'chirishda xatolik"),
    });
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            Mening buyurtmalarim
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Siz yaratgan barcha buyurtmalar
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
          <div className="relative bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow-sm overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white mb-3 shadow-lg">
              <Package className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Jami</p>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{stats.total}</h2>
          </div>
          <div className="relative bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow-sm overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white mb-3 shadow-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sotilgan</p>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{stats.sold}</h2>
          </div>
          <div className="relative bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow-sm overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500" />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center text-white mb-3 shadow-lg">
              <XCircle className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bekor</p>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{stats.cancelled}</h2>
          </div>
          <div className="relative bg-white dark:bg-[#2A263D] p-4 rounded-2xl shadow-sm overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-500" />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-white mb-3 shadow-lg">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kutilmoqda</p>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{stats.pending}</h2>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatusFilter(f.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === f.value
                ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Mobile View - Card Layout */}
      <div className="block lg:hidden">
        <div className="space-y-3">
          {isLoading ? (
            [...Array(5)].map((_, i) => <MobileCardSkeleton key={i} />)
          ) : orders.length === 0 ? (
            <div className="py-12">
              <Empty description="Buyurtmalar topilmadi" />
            </div>
          ) : (
            orders.map((item: any, index: number) => (
              <OrderCard
                key={item.id}
                item={item}
                index={(page - 1) * limit + index}
                onClick={() => navigate(buildAdminPath(`orders/order-detail/${item.id}`))}
                onEdit={() => navigate(buildAdminPath(`orders/order-detail/${item.id}`))}
                onDelete={() => {
                  setDeleteId(item.id);
                  setIsConfirmOpen(true);
                }}
                showEarnings={showEarnings}
              />
            ))
          )}
        </div>
      </div>

      {/* Desktop View - Table Layout */}
      <div className="hidden lg:block bg-white dark:bg-[#2A2640] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                <th className="px-4 py-4 text-left text-sm font-semibold w-12">#</th>
                <th className="px-4 py-4 text-left text-sm font-semibold min-w-[180px]">Mijoz</th>
                <th className="px-4 py-4 text-left text-sm font-semibold whitespace-nowrap">Telefon</th>
                <th className="px-4 py-4 text-left text-sm font-semibold min-w-[100px]">Tuman</th>
                <th className="px-4 py-4 text-left text-sm font-semibold whitespace-nowrap">Holat</th>
                <th className="px-4 py-4 text-right text-sm font-semibold whitespace-nowrap">Narxi</th>
                {showEarnings && (
                  <th className="px-4 py-4 text-right text-sm font-semibold whitespace-nowrap">Daromad</th>
                )}
                <th className="px-4 py-4 text-left text-sm font-semibold whitespace-nowrap">Sana</th>
                <th className="px-4 py-4 text-center text-sm font-semibold w-24">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                [...Array(10)].map((_, i) => <TableRowSkeleton key={i} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={showEarnings ? 9 : 8} className="py-12">
                    <Empty description="Buyurtmalar topilmadi" />
                  </td>
                </tr>
              ) : (
                orders.map((item: any, index: number) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(buildAdminPath(`orders/order-detail/${item.id}`))}
                    className="hover:bg-purple-50 dark:hover:bg-[#3d3759] cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {(page - 1) * limit + index + 1}
                    </td>
                    <td className="px-4 py-4 max-w-[250px]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-medium text-gray-800 dark:text-white truncate" title={item?.customer?.name}>
                          {item?.customer?.name || "Noma'lum"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {formatPhone(item?.customer?.phone_number)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">
                          {item?.district?.name || item?.customer?.district?.name || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item?.status} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-semibold text-gray-800 dark:text-white">
                        {fmt(item?.total_price)}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">so'm</span>
                    </td>
                    {showEarnings && (
                      <td className="px-4 py-4 text-right">
                        {item?.earning ? (
                          item.is_cancelled ? (
                            <span className="text-sm font-semibold text-red-500 flex items-center justify-end gap-1">
                              <TrendingDown className="w-3.5 h-3.5" />
                              <span className="line-through">{fmt(item.earning.amount)}</span>
                            </span>
                          ) : (
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center justify-end gap-1">
                              <Wallet className="w-3.5 h-3.5" />+{fmt(item.earning.amount)}
                            </span>
                          )
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {fmtDate(item?.created_at)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {canEditOrder(item?.status) ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(buildAdminPath(`orders/order-detail/${item.id}`));
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all cursor-pointer"
                            title="Tahrirlash"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(item.id);
                              setIsConfirmOpen(true);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                            title="O'chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex justify-center py-4">
          <Pagination
            showSizeChanger
            current={page}
            total={total}
            pageSize={limit}
            onChange={onChange}
            className="[&_.ant-pagination-item-active]:bg-purple-600 [&_.ant-pagination-item-active]:border-purple-600 [&_.ant-pagination-item-active_a]:text-white"
          />
        </div>
      )}

      <ConfirmPopup
        isShow={isConfirmOpen}
        title="Buyurtmani o'chirishni tasdiqlaysizmi?"
        description="O'chirilgandan so'ng uni qaytarib bo'lmaydi."
        confirmText="Ha, o'chirish"
        cancelText="Bekor qilish"
        onConfirm={() => {
          if (deleteId) handleDelete(deleteId);
          setIsConfirmOpen(false);
          setDeleteId("");
        }}
        onCancel={() => {
          setIsConfirmOpen(false);
          setDeleteId("");
        }}
      />
    </div>
  );
};

export default memo(OperatorOrders);
