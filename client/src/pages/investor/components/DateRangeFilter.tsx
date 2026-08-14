import { memo } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

interface Props {
  from?: string; // YYYY-MM-DD
  to?: string;
  onChange: (from?: string, to?: string) => void;
}

// Investor sahifalari uchun sana oralig'i filtri (AntD RangePicker, YYYY-MM-DD).
const DateRangeFilter = ({ from, to, onChange }: Props) => {
  return (
    <RangePicker
      value={[from ? dayjs(from) : null, to ? dayjs(to) : null]}
      onChange={(dates) =>
        onChange(
          dates?.[0] ? dates[0].format("YYYY-MM-DD") : undefined,
          dates?.[1] ? dates[1].format("YYYY-MM-DD") : undefined,
        )
      }
      className="w-full sm:w-72 dark:bg-[#342d4a]! dark:border-[#4b3b6a]!"
      allowClear
    />
  );
};

export default memo(DateRangeFilter);
