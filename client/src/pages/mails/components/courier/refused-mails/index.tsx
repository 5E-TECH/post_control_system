import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import EmptyPage from "../../../../../shared/components/empty-page";
import MailSkeleton from "../../choose-mail/MailSkeleton";
import { useDispatch } from "react-redux";
import {
  setHideSend,
  setRegionName,
} from "../../../../../shared/lib/features/regionSlice";

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

const CourierRefusedMails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { getRejectedPostsCourier } = usePost();
  const { data, isLoading } = getRejectedPostsCourier();
  const posts = Array.isArray(data?.data) ? data?.data : [];

  const handleNavigate = (post: any) => {
    console.log("11111111111111111111", post?.region?.name);
    navigate(`/courier-mails/${post?.id}`);

    dispatch(setRegionName(post?.region?.name));
    dispatch(setHideSend(true));
  };

  if (isLoading) {
    return <MailSkeleton />;
  }

  return (
    <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 gap-10">
      {posts?.length ? (
        posts?.map((post: any) => (
          <div
            key={post?.id}
            className={`min-h-[250px] ${
              borderColorsByStatus[
                post?.status as keyof typeof borderColorsByStatus
              ]
            } shadow-2xl rounded-md flex flex-col items-center justify-center cursor-pointer bg-red-500 dark:bg-[#73374d] text-white`}
            onClick={() => handleNavigate(post)}
          >
            <h1 className="text-[30px]">
              {post?.created_at &&
                new Date(Number(post.created_at)).toLocaleString("uz-UZ", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            </h1>
            <p className="text-[22px]">
              <span>{post?.order_quantity}</span> ta buyurtmalar
            </p>
            <p className="text-[22px] font-bold">
              <span>
                {new Intl.NumberFormat("uz-UZ").format(post?.post_total_price)}{" "}
                so'm
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

export default memo(CourierRefusedMails);
