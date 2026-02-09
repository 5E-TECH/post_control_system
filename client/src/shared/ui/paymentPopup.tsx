import { memo, type FC, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClose?: () => void;
  isShow?: boolean;
}

const PaymentPopup: FC<Props> = ({ children, onClose, isShow = false }) => {
  if (!isShow) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center p-3 sm:p-4 overflow-y-auto">
      {/* Orqa fon - bosilganda popup yopiladi */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
      />

      {/* Popup kontenti - bosilganda yopilmaydi */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-[101] w-full flex justify-center my-auto"
      >
        {children}
      </div>
    </div>
  );
};

export default memo(PaymentPopup);
