import { memo, type FC, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClose?: () => void;
  isShow?: boolean;
}

const PaymentPopup: FC<Props> = ({ children, onClose, isShow = false }) => {
  if (!isShow) return null;

  return (
    <>
      {/* Orqa fon (blur yoki qora fon) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-100"
      ></div>

      {/* Popup konteyner */}
      <div className="z-101 fixed inset-0 flex justify-center items-center">
        {/* Click tashqariga tushmasin */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex justify-center items-center w-full h-full"
        >
          {children}
        </div>
      </div>
    </>
  );
};

export default memo(PaymentPopup);
