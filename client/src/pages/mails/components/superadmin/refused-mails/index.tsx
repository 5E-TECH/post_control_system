import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePost, post } from "../../../../../shared/api/hooks/usePost";
import { useTranslation } from "react-i18next";
import { ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../../shared/api";

const RefusedMails = () => {
  useTranslation("mails");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getAllPosts } = usePost();
  const { data, refetch, isLoading } = getAllPosts("rejected");
  const posts = Array.isArray(data?.data) ? data?.data : [];

  // Prefetch post data on hover
  const prefetchPost = useCallback((postId: string) => {
    queryClient.prefetchQuery({
      queryKey: [post, "rejected", postId],
      queryFn: () => api.get(`post/orders/rejected/${postId}`).then((res) => res.data),
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
        <Loader2 className="w-10 h-10 animate-spin text-red-500" />
      </div>
    );
  }

  if (!posts?.length) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Rad etilgan pochtalar yo'q
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Hozircha rad etilgan pochtalar mavjud emas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Posts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {posts.map((post: any) => (
          <div
            key={post?.id}
            onMouseEnter={() => prefetchPost(post?.id)}
            onClick={() =>
              navigate(`/mails/refused/mails/${post?.id}`, {
                state: { regionName: post?.region?.name },
              })
            }
            className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 cursor-pointer hover:shadow-xl hover:shadow-red-500/20 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-white/20 text-white">
                  <AlertTriangle className="w-3 h-3" />
                  Rad etilgan
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

export default memo(RefusedMails);
