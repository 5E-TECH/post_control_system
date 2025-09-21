const TableSkeleton = ({
  rows = 5,
  columns = 8,
}: {
  rows?: number;
  columns?: number;
}) => {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr
          key={rIdx}
          className="h-[56px] animate-pulse border-b border-[#f0f0f0] dark:border-[#524B6C]"
        >
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="pl-10">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
};

export default TableSkeleton;
