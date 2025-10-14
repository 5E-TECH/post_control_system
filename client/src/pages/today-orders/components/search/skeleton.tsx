import { memo } from "react";

const Skeleton = () => {
  return (
    <div className="animate-pulse mt-5 space-y-3">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-6 gap-4 p-3 border-b border-gray-200 dark:border-gray-700"
        >
          <div className="h-4 bg-gray-300 rounded col-span-1"></div>
          <div className="h-4 bg-gray-300 rounded col-span-1"></div>
          <div className="h-4 bg-gray-300 rounded col-span-1"></div>
          <div className="h-4 bg-gray-300 rounded col-span-1"></div>
          <div className="h-4 bg-gray-300 rounded col-span-1"></div>
          <div className="h-4 bg-gray-300 rounded col-span-1"></div>
        </div>
      ))}
    </div>
  );
};

export default memo(Skeleton);
