import { memo, type FC, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClose: () => void;
  isShow?: boolean;
}

const Popup: FC<Props> = ({ children, onClose, isShow = false }) => {
  if (!isShow) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed top-0 left-0 w-full h-screen bg-black/50 z-40"
      ></div>

      <div className="z-50 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {children}
      </div>
    </>
  );
};

export default memo(Popup);
