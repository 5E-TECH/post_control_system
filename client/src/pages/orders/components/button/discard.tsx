import { Button } from "antd";
import { memo, type FC, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  handleDiscard?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
}

const Discard: FC<Props> = ({ children, className, type, handleDiscard }) => {
  return (
    <Button
      onClick={handleDiscard}
      htmlType={type}
      className={`w-[91px]! h-[38px]! bg-[#F4F5FA]! border! border-[#8A8D93]! text-[#8A8D93]! hover:opacity-80! dark:bg-[#28243D]! ${className}`}
    >
      {children}
    </Button>
  );
};

export default memo(Discard);
