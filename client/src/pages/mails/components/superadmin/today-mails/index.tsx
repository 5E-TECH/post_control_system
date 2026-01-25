import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePost, post } from "../../../../../shared/api/hooks/usePost";
import { useTranslation } from "react-i18next";
import { MapPin, Package, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../../shared/api";

const TodayMails = () => {
  useTranslation("mails");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getAllPosts } = usePost();
  const { data, refetch, isLoading } = getAllPosts("new");
  const posts = Array.isArray(data?.data) ? data?.data : [];

  // Prefetch post data on hover
  const prefetchPost = useCallback((postId: string) => {
    queryClient.prefetchQuery({
      queryKey: [post, postId, "", undefined],
      queryFn: () => api.get(`post/orders/${postId}`).then((res) => res.data),
      staleTime: 1000 * 60 * 3,
    });
  }, [queryClient]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await refetch();
      } catch (err) {
        console.error("Refetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refetch]);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!posts?.length) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Yangi pochtalar yo'q
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Hozircha jo'natilishi kerak bo'lgan pochtalar mavjud emas
          </p>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalOrders = posts.reduce((sum: number, p: any) => sum + (Number(p.order_quantity) || 0), 0);
  const totalPrice = posts.reduce((sum: number, p: any) => sum + (Number(p.post_total_price) || 0), 0);

  return (
    <div className="h-full overflow-y-auto">
      {/* Stats - simplified */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-6 text-sm">
        <span className="text-gray-600 dark:text-gray-300">
          <span className="font-bold text-gray-800 dark:text-white">{posts.length}</span> viloyat
        </span>
        <span className="text-gray-600 dark:text-gray-300">
          <span className="font-bold text-gray-800 dark:text-white">{totalOrders}</span> buyurtma
        </span>
        <span className="text-gray-600 dark:text-gray-300">
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalPrice.toLocaleString()}</span> so'm
        </span>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {posts.map((post: any) => (
          <div
            key={post?.id}
            onMouseEnter={() => prefetchPost(post?.id)}
            onClick={() =>
              navigate(`/mails/${post?.id}`, {
                state: { regionName: post?.region?.name },
              })
            }
            className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 cursor-pointer hover:shadow-xl hover:shadow-emerald-500/20 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-white/20 text-white">
                  <Sparkles className="w-3 h-3" />
                  Yangi
                </span>
                <ChevronRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-3 line-clamp-1">
              {post?.region?.name}
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm">Buyurtmalar:</span>
                <span className="text-white font-semibold text-base">{post?.order_quantity} ta</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm">Summa:</span>
                <span className="text-white font-bold text-base">
                  {new Intl.NumberFormat("uz-UZ").format(Number(post?.post_total_price) || 0)} so'm
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(TodayMails);
