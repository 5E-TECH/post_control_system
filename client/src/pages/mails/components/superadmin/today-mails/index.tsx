import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import EmptyPage from "../../../../../shared/components/empty-page";
import { useTranslation } from "react-i18next";
import MailSkeleton from "../../choose-mail/MailSkeleton";

const borderColorsByStatus = {
  new: "border-gray-400",
  received: "border-blue-500",
  "on the road": "border-indigo-500",
  waiting: "border-yellow-500",
  sold: "border-green-600",
  cancelled: "border-red-500",
  paid: "border-emerald-600",
  partly_paid: "border-teal-500",
  "cancelled (sent)": "border-orange-500",
  closed: "border-gray-600",
};

const TodayMails = () => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  const { getAllPosts } = usePost();
  const { data, refetch, isLoading } = getAllPosts("new");
  const posts = Array.isArray(data?.data) ? data?.data : [];

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
    return <MailSkeleton />;
  }

  return (
    <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-10">
      {posts?.length ? (
        posts?.map((post: any) => (
          <div
            key={post?.id}
            className={`min-h-[250px] ${
              borderColorsByStatus[
                post?.status as keyof typeof borderColorsByStatus
              ]
            } shadow-2xl rounded-md flex flex-col items-center justify-center cursor-pointer bg-green-500 dark:bg-[#3f692e] text-white`}
            onClick={() =>
              navigate(`/mails/${post?.id}`, {
                state: { regionName: post?.region?.name },
              })
            }
          >
            <h1 className="text-[30px] line-clamp-1 text-center">
              {post?.region?.name}
            </h1>
            <p className="text-[22px]">
              <span>{post?.order_quantity}</span> {t("tabuyurtmalar")}
            </p>
            <p className="text-[22px] font-bold">
              <span>
                {new Intl.NumberFormat("uz-UZ").format(post?.post_total_price)}{" "}
                {t("so'm")}
              </span>
            </p>
          </div>
        ))
      ) : (
        <div className="col-span-4 flex justify-center h-[65vh] items-center">
          <EmptyPage />
        </div>
      )}
    </div>
  );
};

export default memo(TodayMails);
