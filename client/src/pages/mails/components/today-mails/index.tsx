import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { usePost } from "../../../../shared/api/hooks/useMail";

const TodayMails = () => {
  const navigate = useNavigate();

  const { getAllPosts } = usePost();
  const { data } = getAllPosts();
  const posts = data?.data;
  console.log(posts)
  return (
    <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 gap-10">
      {posts?.map((post: any) => (
        <div
          key={post?.id}
          className="min-h-[250px] shadow-lg rounded-md bg-[#ffffff] flex flex-col items-center justify-center cursor-pointer dark:bg-[#312D48]"
          onClick={() => navigate("/mails/1")}
        >
          {/* <h1 className="text-[30px]">{post}</h1> */}
          <p className="text-[22px]">
            <span>{post?.order_quantity}</span> ta buyurtmalar
          </p>
          <p className="text-[22px] font-bold">
            <span>{post?.post_total_price}</span> so'm
          </p>
        </div>
      ))}
    </div>
  );
};

export default memo(TodayMails);
