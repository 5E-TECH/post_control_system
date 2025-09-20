import { type FC } from "react";
import Popup from "../../ui/Popup";

interface IConfirmPopupProps {
  isShow: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmPopup: FC<IConfirmPopupProps> = ({
  isShow,
  title = "Tasdiqlaysizmi?",
  description = "Bu amalni ortga qaytarib bo‘lmaydi.",
  confirmText = "Ha",
  cancelText = "Bekor qilish",
  onConfirm,
  onCancel,
}) => {
  return (
    <Popup isShow={isShow} onClose={onCancel}>
      <div className="bg-white dark:bg-[#2B2B3C] p-6 rounded-2xl shadow-lg w-[350px] text-center">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        {description && (
          <p className="text-gray-500 dark:text-gray-300 mb-6">{description}</p>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={onConfirm}
            type="button"
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            type="button"
            className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default ConfirmPopup;
