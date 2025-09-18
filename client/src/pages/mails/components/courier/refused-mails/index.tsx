import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import EmptyPage from "../../../../../shared/components/empty-page";

const CourierRefusedMails = () => {
  const navigate = useNavigate();
  const { getRejectedPostsCourier } = usePost();
  const { data } = getRejectedPostsCourier();
  const posts = Array.isArray(data?.data) ? data?.data : [];
  return (
    <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 gap-10">
      {posts?.length ? (
        posts?.map((post: any) => (
          <div
            key={post?.id}
            className="min-h-[250px] shadow-lg rounded-md bg-[#ffffff] flex flex-col items-center justify-center cursor-pointer dark:bg-[#312D48]"
            onClick={() =>
              navigate(`/courier-mails/${post?.id}`, {
                state: { regionName: post?.region?.name, hideSend: true },
              })
            }
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
