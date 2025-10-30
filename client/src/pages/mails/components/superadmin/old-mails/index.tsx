import { memo } from "react";
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

const OldMails = () => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  const { getAllPosts } = usePost();
  const { data, isLoading } = getAllPosts("");
  const posts = Array.isArray(data?.data) ? data?.data : [];

  if (isLoading) {
    return <MailSkeleton />;
  }
  return (
    <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-10">
      {posts.length ? (
        posts?.map((post: any) => (
          <div
            key={post?.id}
            className={`min-h-[250px] border ${
              borderColorsByStatus[
                post?.status as keyof typeof borderColorsByStatus
              ]
            } shadow-2xl rounded-md flex flex-col items-center justify-center cursor-pointer ${
              post?.status == "canceled"
                ? "bg-red-500 dark:bg-[#73374d]"
                : "bg-[#45C1FF] dark:bg-[#2a4c76]"
            } text-white border-0`}
            onClick={() =>
              navigate(`/mails/${post?.id}?status=${post?.status}`, {
                state: { regionName: post?.region?.name, hideSend: true },
              })
            }
          >
            <p>{post?.status}</p>
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
            {post?.created_at &&
              new Date(Number(post.created_at)).toLocaleString("uz-UZ", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
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

export default memo(OldMails);
