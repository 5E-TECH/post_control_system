import { memo } from "react";
import noDataImg from "../../assets/logo.svg";


const EmptyPage = () => {
  return (
    <div className="flex flex-col justify-center items-center h-[850px]">
      <img
        src={noDataImg}
        alt="No data"
        className="w-[180px] h-[180px] object-contain mb-4"
      />
      <p className="text-gray-500 dark:text-gray-300 text-lg">No data found</p>
    </div>
  );
};

export default memo(EmptyPage);
