import { Button } from "antd";
import { memo, type FC } from "react";

interface Props {
  children: string;
  className?: string;
}

const Discard: FC<Props> = ({ children, className }) => {
  return (
    <Button
      className={`w-[91px]! h-[38px]! bg-[#F4F5FA]! border! border-[#8A8D93]! text-[#8A8D93]! hover:opacity-80! dark:bg-[#28243D]! ${className}`}
    >
      {children}
    </Button>
  );
};

export default memo(Discard);
