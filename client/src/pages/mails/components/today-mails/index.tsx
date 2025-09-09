import { memo } from "react";
import { useNavigate } from "react-router-dom";

const TodayMails = () => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-4 max-xl:grid-cols-3 max-lg:grid-cols-2 gap-10">
      <div
        className="min-h-[250px] shadow-lg rounded-md bg-[#ffffff] flex flex-col items-center justify-center cursor-pointer dark:bg-[#312D48]"
        onClick={() => navigate("/mails/1")}
      >
        <h1 className="text-[30px]">Andijon</h1>
        <p className="text-[22px]">
          <span>15</span> ta buyurtmalar
        </p>
        <p className="text-[22px] font-bold">
          <span>20,000,000</span> so'm
        </p>
      </div>
    </div>
  );
};

export default memo(TodayMails);
