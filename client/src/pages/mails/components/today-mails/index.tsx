import { memo } from "react";
import { useNavigate } from "react-router-dom";

const TodayMails = () => {
  const navigate = useNavigate();

  return (
    <div className="h-[250px] grid grid-cols-4 gap-10">
      <div
        className="shadow-lg rounded-md bg-[#ffffff] flex flex-col items-center justify-center cursor-pointer dark:bg-[#312D48]"
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
