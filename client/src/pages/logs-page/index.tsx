import React from "react";
import Lottie from "lottie-react";
import animationData from "../../shared/assets/logs/Developer cyan.json"; // manzilni to‘g‘rilab yoz

const LogsPage = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[80vh] bg-gray-50 dark:bg-gray-900">
      <div className="w-[300px] md:w-[400px]">
        <Lottie animationData={animationData} loop={true} />
      </div>
      <p className="mt-4 text-gray-600 dark:text-gray-300 text-lg font-medium">
        Developer code yozmoqda... Logs sahifasi tayyorlanmoqda 🎨
      </p>
    </div>
  );
};

export default React.memo(LogsPage);
