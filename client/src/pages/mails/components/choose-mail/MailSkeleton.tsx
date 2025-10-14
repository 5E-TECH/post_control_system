import { memo } from "react";

const MailSkeleton = () => {
  return (
    <div className="w-full mt-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl h-68 flex flex-col justify-center items-center shadow-md"
          >
            <div className="h-6 w-32 bg-gray-300 dark:bg-gray-700 rounded mb-4"></div>
            <div className="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded mb-3"></div>
            <div className="h-5 w-40 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(MailSkeleton);
