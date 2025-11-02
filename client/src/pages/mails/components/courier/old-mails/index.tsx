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
import { useTranslation } from "react-i18next";
import { Pagination, type PaginationProps } from "antd";
import { useParamsHook } from "../../../../../shared/hooks/useParams";

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

const CourierOldMails = () => {
  const { t } = useTranslation("mails");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { getOldPostsCourier } = usePost();

  // ✅ Pagination boshqaruvi
  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 12);

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    if (newPage === 1) removeParam("page");
    else setParam("page", newPage);

    if (newLimit === 8) removeParam("limit");
    else setParam("limit", newLimit);
  };

  // ✅ API chaqiruv
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

  if (isLoading) return <MailSkeleton />;

  return posts?.length > 0 ? (
    <div>
      <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 gap-10 max-sm:grid-cols-1">
        {posts.map((post: any) => (
          <div
            key={post?.id}
            className={`min-h-[250px] border ${
              borderColorsByStatus[
                post?.status as keyof typeof borderColorsByStatus
              ]
            } shadow-sm rounded-md flex flex-col items-center justify-center cursor-pointer ${
              post?.status === "canceled"
                ? "bg-red-500 dark:bg-[#73374d]"
                : "bg-[#45C1FF] dark:bg-[#2a4c76]"
            } text-white border-0`}
            onClick={() => handleNavigate(post)}
          >
            <p>{post?.status}</p>
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
              <span>{post?.order_quantity}</span> {t("orders")}
            </p>
            <p className="text-[22px] font-bold">
              <span>
                {new Intl.NumberFormat("uz-UZ").format(post?.post_total_price)}{" "}
                so'm
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* ✅ Pagination pastda */}
      <div className="flex justify-center my-8">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
        />
      </div>
    </div>
  ) : (
    <div className="col-span-4 flex justify-center h-[65vh] items-center">
      <EmptyPage />
    </div>
  );
};

export default memo(CourierOldMails);
