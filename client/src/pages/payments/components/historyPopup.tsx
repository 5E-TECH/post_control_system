import { memo, type FC } from "react";
import { useCashBox } from "../../../shared/api/hooks/useCashbox";

interface IProps {
  id: string | null;
  onClose: () => void;
}

const HistoryPopup: FC<IProps> = ({ id, onClose }) => {
  const { getCashBoxHistoryById } = useCashBox();
  const { data } = getCashBoxHistoryById(id);

  if (!id) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
      onClick={onClose} // tashqariga bosilganda yopiladi
    >
      <div
        className="
      bg-white dark:bg-[#28243d]
      w-[75%] h-[85%]
      rounded-t-2xl shadow-lg
      animate-slide-up-slow
    "
        onClick={(e) => e.stopPropagation()} // ichkariga bosilganda yopilmaydi
      >
        <div className="flex justify-between items-center border-b px-4 py-2">
          <h2 className="text-xl font-semibold">{data?.data?.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-500 text-lg"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <p>Popup content shu yerda bo‘ladi...</p>
        </div>
      </div>
    </div>
  );
};

export default memo(HistoryPopup);
