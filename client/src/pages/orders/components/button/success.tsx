import { Button } from "antd";
import { memo, type FC, type JSX } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  text: string;
  icon: JSX.Element;
  path: string;
  className?: string;
}

const Success: FC<Props> = ({ text, icon, className, path }) => {
  const navigate = useNavigate();
  const onClick = () => {
    navigate(`/orders/${path}`);
  };
  return (
    <Button
      onClick={onClick}
      className={`w-[91px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none! ${className}`}
    >
      {text} {icon}
    </Button>
  );
};

export default memo(Success);
