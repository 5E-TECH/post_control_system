import { Button } from "antd";
import { ArrowRight } from "lucide-react";
import { memo, type FC, type JSX } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  text: string;
  icon: JSX.Element;
  className?: string;
  path:string
}

const Success: FC<Props> = ({ text, icon, className, path }) => {
  const navigate = useNavigate();
  const onClick = () => {
    navigate(path);
  };
  return (
    <Button
      onClick={onClick}
      className={`w-[91px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none! ${className}`}
    >
      {text} {icon ? icon : <ArrowRight className="h-[13px] w-[13px]" />}
    </Button>
  );
};

export default memo(Success);
