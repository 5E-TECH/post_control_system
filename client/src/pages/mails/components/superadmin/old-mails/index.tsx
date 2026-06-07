import { memo, useCallback, useMemo, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { usePost, post } from "../../../../../shared/api/hooks/usePost";
import { useTranslation } from "react-i18next";
import { DatePicker, Pagination, Select, type PaginationProps } from "antd";
import dayjs from "dayjs";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import { ChevronRight, Loader2, Clock, CheckCircle, XCircle, Calendar, Archive, User, MapPin, Filter, X, Printer } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../../shared/api";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { generateCourierReceipt } from "../../../../../shared/helpers/generate-courier-receipt";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";

interface FilterRegion {
  id: string;
  name: string;
}
interface FilterCourier {
  id: string;
  name: string;
  serves_all: boolean;
  region_ids: string[];
}

const { RangePicker } = DatePicker;

const statusOptions = [
  { value: "sent", label: "Jo'natilgan" },
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

const OldMails = () => {
  useTranslation("mails");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useSelector((state: RootState) => state.roleSlice.role);
  const canSeePrice = role === "superadmin" || role === "admin";
  const { getAllPosts, getOldPostsFilterOptions } = usePost();
  const { getParam, setParam, removeParam } = useParamsHook();
  const { handleSuccess, handleApiError } = useApiNotification();

  // Eski pochtadan kuryer chekini (QR kodli) qayta chiqarish. Pochta
  // jo'natilganda generatsiya bo'lgan chekni istalgan vaqtda qayta hosil
  // qiladi — barcha ma'lumot ro'yxat javobida bor (qr_code_token, kuryer,
  // viloyat, buyurtma soni, sana). Karta bosilishi (navigatsiya) bilan
  // to'qnashmasligi uchun stopPropagation.
  const handleReprintReceipt = useCallback(
    async (e: MouseEvent<HTMLButtonElement>, post: any) => {
      e.stopPropagation();
      if (!post?.qr_code_token) {
        handleApiError(null, "Bu pochtada QR kod topilmadi");
        return;
      }
      try {
        await generateCourierReceipt({
          qrCodeToken: post.qr_code_token,
          courierName: post?.courier?.name || "",
          regionName: post?.region?.name || "",
          courierPhone: post?.courier?.phone_number || "",
          orderCount: post?.order_quantity,
          date: post?.created_at,
        });
        handleSuccess("Chek tayyor");
      } catch (err) {
        handleApiError(err, "Chek yaratishda xatolik yuz berdi");
      }
    },
    [handleSuccess, handleApiError],
  );

  const regionId = getParam("region_id") || undefined;
  const courierId = getParam("courier_id") || undefined;
  const status = getParam("status") || undefined;
  const from = getParam("from") || undefined;
  const to = getParam("to") || undefined;

  // Filtr ma'lumotlari (biriktirish bo'yicha). Dropdownlarni o'zaro cheklash:
  // tanlangan viloyatga xizmat qiluvchi kuryerlar / tanlangan kuryerga
  // biriktirilgan viloyatlar (super kuryer bo'lsa — barchasi).
  const { data: filterOptsData } = getOldPostsFilterOptions(role !== "courier");
  const allRegions: FilterRegion[] = filterOptsData?.data?.regions || [];
  const couriers: FilterCourier[] = filterOptsData?.data?.couriers || [];
  const postRegionIds: string[] = filterOptsData?.data?.postRegionIds || [];

  const selectedCourier = couriers.find((c) => c.id === courierId);

  // Kuryer biror viloyatga xizmat qiladimi (serves_all yoki ro'yxatda bormi).
  const courierServesRegion = (c: FilterCourier, rid: string) =>
    c.serves_all || c.region_ids.includes(rid);

  // Viloyatlar: kuryer tanlangan bo'lsa — unga biriktirilgan barcha viloyatlar
  // (serves_all → hammasi); aks holda eski pochtasi bor viloyatlar.
  const regionOptions = useMemo(() => {
    let list = allRegions;
    if (selectedCourier) {
      list = selectedCourier.serves_all
        ? allRegions
        : allRegions.filter((r) => selectedCourier.region_ids.includes(r.id));
    } else {
      list = allRegions.filter((r) => postRegionIds.includes(r.id));
    }
    return list.map((r) => ({ value: r.id, label: r.name }));
  }, [allRegions, postRegionIds, selectedCourier]);

  // Kuryerlar: viloyat tanlangan bo'lsa — shu viloyatga xizmat qiladiganlar.
  const courierOptions = useMemo(() => {
    const list = regionId
      ? couriers.filter((c) => courierServesRegion(c, regionId))
      : couriers;
    return list.map((c) => ({ value: c.id, label: c.name }));
  }, [couriers, regionId]);

  const hasFilter = !!(regionId || courierId || status || from || to);

  // Filtr o'zgarganda sahifani 1-ga qaytaramiz (eski sahifada bo'sh chiqmasin).
  const applyFilter = (key: string, value?: string) => {
    if (value) setParam(key, value);
    else removeParam(key);
    removeParam("page");
  };

  // Viloyat tanlanganda: tanlangan kuryer shu viloyatga xizmat qilmasa
  // tozalanadi (mos kelmaydigan kombinatsiya bo'sh natija bermasin).
  const onRegionChange = (value?: string) => {
    removeParam("page");
    if (!value) return removeParam("region_id");
    setParam("region_id", value);
    if (selectedCourier && !courierServesRegion(selectedCourier, value)) {
      removeParam("courier_id");
    }
  };

  // Kuryer tanlanganda: tanlangan viloyat shu kuryernikiga mos bo'lmasa
  // tozalanadi.
  const onCourierChange = (value?: string) => {
    removeParam("page");
    if (!value) return removeParam("courier_id");
    setParam("courier_id", value);
    const c = couriers.find((x) => x.id === value);
    if (regionId && c && !courierServesRegion(c, regionId)) {
      removeParam("region_id");
    }
  };

  const clearFilters = () => {
    ["region_id", "courier_id", "status", "from", "to", "page"].forEach(
      removeParam,
    );
  };

  // Prefetch post data on hover
  const prefetchPost = useCallback((postId: string, status: string) => {
    const path = ["canceled", "canceled_received"].includes(status) ? "rejected/" : "";
    queryClient.prefetchQuery({
      queryKey: [post, postId, path, undefined],
      queryFn: () => api.get(`post/orders/${path}${postId}`).then((res) => res.data),
      staleTime: 1000 * 60 * 3,
    });
  }, [queryClient]);

  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 8);

  const { data, isLoading } = getAllPosts("", {
    page,
    limit,
    region_id: regionId,
    courier_id: courierId,
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

  const onChange: PaginationProps["onChange"] = (newPage) => {
    if (newPage === 1) removeParam("page");
    else setParam("page", newPage);
  };

  const onShowSizeChange: PaginationProps["onShowSizeChange"] = (
    _current,
    newLimit
  ) => {
    if (newLimit === 8) removeParam("limit");
    else setParam("limit", newLimit);
    removeParam("page");
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

  const activeCount = [regionId, courierId, status, from || to].filter(
    Boolean,
  ).length;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2.5">
        <div>
          <label className={labelCls}>
            <MapPin className="w-3.5 h-3.5" /> Viloyat
          </label>
          <Select
            showSearch
            allowClear
            size="large"
            optionFilterProp="label"
            value={regionId}
            onChange={(v) => onRegionChange(v)}
            options={regionOptions}
            placeholder="Tanlang"
            className="w-full"
          />
        </div>
        <div>
          <label className={labelCls}>
            <User className="w-3.5 h-3.5" /> Kuryer
          </label>
          <Select
            showSearch
            allowClear
            size="large"
            optionFilterProp="label"
            value={courierId}
            onChange={(v) => onCourierChange(v)}
            options={courierOptions}
            placeholder="Tanlang"
            className="w-full"
          />
        </div>
        <div>
          <label className={labelCls}>
            <Archive className="w-3.5 h-3.5" /> Holati
          </label>
          <Select
            allowClear
            size="large"
            value={status}
            onChange={(v) => applyFilter("status", v)}
            options={statusOptions}
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
                ? "Boshqa viloyat, status yoki sanani tanlab ko'ring"
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
                onMouseEnter={() => prefetchPost(post?.id, post?.status)}
                onClick={() =>
                  navigate(`/mails/${post?.id}?status=${post?.status}`, {
                    state: { regionName: post?.region?.name, hideSend: true },
                  })
                }
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

                <h3 className="text-xl font-bold text-white/90 mb-3 line-clamp-1">
                  {post?.region?.name}
                </h3>

                {post?.courier?.name && (
                  <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-white/10">
                    <User className="w-4 h-4 text-white/60" />
                    <span className="text-white/80 text-sm font-medium">{post.courier.name}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">Buyurtmalar:</span>
                    <span className="text-white/90 font-semibold text-base">{post?.order_quantity} ta</span>
                  </div>
                  {canSeePrice && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 text-sm">Summa:</span>
                      <span className="text-white/90 font-bold text-base">
                        {new Intl.NumberFormat("uz-UZ").format(Number(post?.post_total_price) || 0)} so'm
                      </span>
                    </div>
                  )}
                  {post?.created_at && (
                    <div className="flex items-center gap-1 text-white/50 text-xs pt-2 border-t border-white/10">
                      <Calendar className="w-3 h-3" />
                      {formatDate(post.created_at)}
                    </div>
                  )}
                </div>

                {["sent", "received"].includes(post?.status?.toLowerCase()) &&
                  post?.qr_code_token && (
                    <button
                      onClick={(e) => handleReprintReceipt(e, post)}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Chekni qayta chiqarish
                    </button>
                  )}
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
          onShowSizeChange={onShowSizeChange}
          pageSizeOptions={["8", "16", "32", "64"]}
          className="cursor-pointer"
        />
      </div>
        </>
      )}
    </div>
  );
};

export default memo(OldMails);
