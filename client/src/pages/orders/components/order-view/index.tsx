import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { useDispatch, useSelector } from "react-redux";
import { Pagination, type PaginationProps, Empty } from "antd";
import { useParamsHook } from "../../../../shared/hooks/useParams";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../../app/store";
import { exportToExcel } from "../../../../shared/helpers/export-download-excel";
import { resetDownload } from "../../../../shared/lib/features/excel-download-func/excelDownloadFunc";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { BASE_URL } from "../../../../shared/const";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";
import {
  User,
  Phone,
  MapPin,
  Store,
  Calendar,
  ChevronRight,
  Truck,
  Home,
} from "lucide-react";

// Status colors with better contrast
const statusConfig: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string }
> = {
  new: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    darkBg: "dark:bg-sky-900/30",
    darkText: "dark:text-sky-400",
  },
  received: {
    bg: "bg-green-100",
    text: "text-green-700",
    darkBg: "dark:bg-green-900/30",
    darkText: "dark:text-green-400",
  },
  "on the road": {
    bg: "bg-amber-100",
    text: "text-amber-700",
    darkBg: "dark:bg-amber-900/30",
    darkText: "dark:text-amber-400",
  },
  waiting: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    darkBg: "dark:bg-orange-900/30",
    darkText: "dark:text-orange-400",
  },
  sold: {
    bg: "bg-violet-100",
    text: "text-violet-700",
    darkBg: "dark:bg-violet-900/30",
    darkText: "dark:text-violet-400",
  },
  cancelled: {
    bg: "bg-red-100",
    text: "text-red-700",
    darkBg: "dark:bg-red-900/30",
    darkText: "dark:text-red-400",
  },
  paid: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    darkBg: "dark:bg-emerald-900/30",
    darkText: "dark:text-emerald-400",
  },
  partly_paid: {
    bg: "bg-teal-100",
    text: "text-teal-700",
    darkBg: "dark:bg-teal-900/30",
    darkText: "dark:text-teal-400",
  },
  "cancelled (sent)": {
    bg: "bg-gray-100",
    text: "text-gray-700",
    darkBg: "dark:bg-gray-800",
    darkText: "dark:text-gray-400",
  },
  closed: {
    bg: "bg-zinc-100",
    text: "text-zinc-700",
    darkBg: "dark:bg-zinc-800",
    darkText: "dark:text-zinc-400",
  },
};

const statusLabels: Record<string, string> = {
  new: "Yangi",
  received: "Qabul qilingan",
  "on the road": "Yo'lda",
  waiting: "Kutilmoqda",
  sold: "Sotilgan",
  cancelled: "Bekor qilingan",
  paid: "To'langan",
  partly_paid: "Qisman to'langan",
  "cancelled (sent)": "Bekorlangan jo'natma",
  closed: "Yopilgan",
};

// Helper function to build query string with proper array handling
const buildQueryString = (filters: Record<string, any>): string => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value !== null && value !== undefined) {
      params.append(key, value);
    }
  });
  return params.toString();
};

// Format price with spaces
const formatPrice = (price: number) => {
  return new Intl.NumberFormat("uz-UZ").format(price);
};

// Format date
const formatDate = (timestamp: number) => {
  const date = new Date(Number(timestamp));
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month} ${hours}:${minutes}`;
};

// Format phone number
const formatPhone = (phone: string) => {
  if (!phone) return "";
  return phone
    .replace(/\D/g, "")
    .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
};

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const { t: st } = useTranslation("status");
  const config = statusConfig[status] || statusConfig.new;

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold
        ${config.bg} ${config.text} ${config.darkBg} ${config.darkText}
      `}
    >
      {st(`${status}`)}
    </span>
  );
};

// Mobile Order Card Component
const OrderCard = ({
  item,
  index,
  onClick,
}: {
  item: any;
  index: number;
  onClick: () => void;
}) => {
  const { t } = useTranslation("orderList");

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#2A2640] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-transform cursor-pointer"
    >
      {/* Header: Status + Index */}
      <div className="flex items-center justify-between mb-3">
        <StatusBadge status={item?.status} />
        <span className="text-xs text-gray-400">#{index + 1}</span>
      </div>

      {/* Customer info - full width */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base text-gray-800 dark:text-white">
            {item?.customer?.name || "Noma'lum"}
          </h3>
          <a
            href={`tel:${item?.customer?.phone_number}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400"
          >
            <Phone className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span>{formatPhone(item?.customer?.phone_number)}</span>
          </a>
        </div>
      </div>

      {/* Info Row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-sm">
        {/* Location */}
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-300">
            {item?.district?.name || item?.customer?.district?.name || "-"}
          </span>
        </div>

        {/* Market */}
        <div className="flex items-center gap-1.5">
          <Store className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-300">
            {item?.market?.name || "-"}
          </span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-300">
            {formatDate(item?.created_at)}
          </span>
        </div>
      </div>

      {/* Footer: Price + Delivery + Arrow */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          {/* Price */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("price")}
            </p>
            <p className="font-bold text-gray-800 dark:text-white">
              {formatPrice(item?.total_price)}{" "}
              <span className="text-xs font-normal text-gray-500">so'm</span>
            </p>
          </div>

          {/* Delivery type */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
            {item?.where_deliver === "home" ? (
              <Home className="w-3.5 h-3.5 text-orange-500" />
            ) : (
              <Truck className="w-3.5 h-3.5 text-blue-500" />
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {t(`${item?.where_deliver}`)}
            </span>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  );
};

// Loading Skeleton for Mobile
const MobileCardSkeleton = () => (
  <div className="bg-white dark:bg-[#2A2640] rounded-xl p-4 animate-pulse">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div>
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
        </div>
      </div>
      <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
    <div className="grid grid-cols-2 gap-2 mb-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
      ))}
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  </div>
);

// Loading Skeleton for Desktop
const TableRowSkeleton = () => (
  <tr className="animate-pulse">
    {[...Array(8)].map((_, i) => (
      <td key={i} className="px-4 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      </td>
    ))}
  </tr>
);

const OrderView = () => {
  const { t } = useTranslation("orderList");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { getOrders } = useOrder();
  const { getMarketsAllNewOrder } = useMarket();

  const user = useSelector((state: RootState) => state.roleSlice);
  const filters = useSelector((state: RootState) => state.setFilter);
  const triggerDownload = useSelector(
    (state: RootState) => state.requestDownload
  );
  const { handleApiError, handleSuccess } = useApiNotification();
  const role = user.role;

  const { getParam, setParam, removeParam } = useParamsHook();
  const limit = Number(getParam("limit") || 10);

  // page state
  const [page, setPage] = useState<number>(Number(getParam("page") || 1));

  const cleanObject = (obj: Record<string, any>) =>
    Object.fromEntries(
      Object.entries(obj).filter(
        ([_, v]) => v !== "" && v !== null && v !== undefined
      )
    );

  const cleanedFilters = cleanObject(filters);

  // filter o'zgarganda sahifa 1 ga tushadi
  useEffect(() => {
    setPage(1);
    setParam("page", 1);
  }, [JSON.stringify(cleanedFilters)]);

  // page o'zgarganda URL-ni yangilaymiz
  useEffect(() => {
    page === 1 ? removeParam("page") : setParam("page", page);
  }, [page]);

  // query
  const queryParams = { page, limit, ...cleanedFilters };

  const { data, refetch, isLoading } =
    role === "market"
      ? getMarketsAllNewOrder(queryParams)
      : getOrders(queryParams);

  useEffect(() => {
    if (role === "market") refetch();
  }, [role]);

  const myNewOrders = Array.isArray(data?.data?.data) ? data?.data?.data : [];
  const total = data?.data?.total;

  // pagination onChange
  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    setPage(newPage);
    if (newLimit !== limit) setParam("limit", newLimit);
  };

  // Excel yuklash
  useEffect(() => {
    const downloadExcel = async () => {
      try {
        const isFiltered = Object.keys(cleanedFilters).length > 0;

        let url = `${BASE_URL}order`;
        if (user?.role === "market") {
          url = `${BASE_URL}order/market/all/my-orders`;
        } else if (user?.role === "courier") {
          url = `${BASE_URL}order/courier/orders`;
        }

        const response = await fetch(
          `${url}?page=1&fetchAll=true&${buildQueryString(cleanedFilters)}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("x-auth-token")}`,
            },
          }
        );

        const rawText = await response.text();

        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error("Backend JSON emas, HTML qaytaryapti!");
        }

        const orders = data?.data?.data?.filter(
          (order: any) => order.status !== "new"
        );
        const exportData = orders?.map((order: any, inx: number) => ({
          N: inx + 1,
          // Order district yoki customer district (fallback)
          Viloyat: order?.district?.assignedToRegion?.name || order?.customer?.district?.assignedToRegion?.name,
          Tuman: order?.district?.name || order?.customer?.district?.name,
          Firma: order?.market?.name,
          Mahsulot: order?.items
            ?.map((item: any) => item.product.name)
            ?.join(", "),
          "Telefon raqam": order?.customer?.phone_number,
          Narxi: Number((order?.total_price ?? 0) / 1000),
          Kuryer: order?.post?.courier?.name || "-",
          Holati: statusLabels[order?.status],
          Sana: new Date(Number(order?.created_at)).toLocaleString("uz-UZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));

        exportToExcel(
          exportData || [],
          isFiltered ? "filterlangan_buyurtmalar" : "barcha_buyurtmalar"
        );

        handleSuccess("Buyurtmalar muvaffaqiyatli export qilindi");
      } catch (err) {
        handleApiError(err, "Excel yuklashda xatolik");
      } finally {
        dispatch(resetDownload());
      }
    };

    if (triggerDownload.triggerDownload) downloadExcel();
  }, [triggerDownload, dispatch, cleanedFilters, user?.role]);

  return (
    <div className="w-full">
      {/* Mobile View - Card Layout */}
      <div className="block lg:hidden">
        <div className="p-3 space-y-3">
          {isLoading ? (
            [...Array(5)].map((_, i) => <MobileCardSkeleton key={i} />)
          ) : myNewOrders.length === 0 ? (
            <div className="py-12">
              <Empty description="Buyurtmalar topilmadi" />
            </div>
          ) : (
            myNewOrders.map((item: any, index: number) => (
              <OrderCard
                key={item.id}
                item={item}
                index={(page - 1) * limit + index}
                onClick={() => navigate(`order-detail/${item.id}`)}
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
                <th className="px-4 py-4 text-left text-sm font-semibold w-12">
                  #
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold min-w-[180px] max-w-[250px]">
                  {t("customer")}
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold whitespace-nowrap">
                  {t("phone")}
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold min-w-[100px]">
                  {t("district")}
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold min-w-[100px]">
                  {t("market")}
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold whitespace-nowrap">
                  {t("status")}
                </th>
                <th className="px-4 py-4 text-right text-sm font-semibold whitespace-nowrap">
                  {t("price")}
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold whitespace-nowrap">
                  {t("createdAt")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                [...Array(10)].map((_, i) => <TableRowSkeleton key={i} />)
              ) : myNewOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <Empty description="Buyurtmalar topilmadi" />
                  </td>
                </tr>
              ) : (
                myNewOrders.map((item: any, index: number) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`order-detail/${item.id}`)}
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
                          {item?.customer?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {formatPhone(item?.customer?.phone_number)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{item?.district?.name || item?.customer?.district?.name || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="truncate block">{item?.market?.name}</span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item?.status} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-semibold text-gray-800 dark:text-white">
                        {formatPrice(item?.total_price)}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">so'm</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(item?.created_at)}
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
    </div>
  );
};

export default memo(OrderView);
