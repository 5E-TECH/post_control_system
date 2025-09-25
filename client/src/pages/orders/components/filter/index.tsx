import { memo, useState } from "react";
import {
  marketlar,
  statusOptions,
  viloyatlar,
} from "../../../../shared/static/order";
import { ArrowRight } from "lucide-react";
import Select from "../select/select"; // shu Select komponentni import qildik
import { Button, DatePicker, Space } from "antd";
import { useDispatch } from "react-redux";
import { useProfile } from "../../../../shared/api/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { togglePermission } from "../../../../shared/lib/features/add-order-permission";
import { useTranslation } from "react-i18next";

const Filter = () => {
  const { t } = useTranslation("orderList");
  const [form, setForm] = useState({
    market: "",
    region: "",
    status: "",
    from: "",
    to: "",
    order: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const { refetch } = useProfile().getUser();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const handleCheck = async () => {
    const res = await refetch();
    const addOrder = res.data.data.add_order;
    if (!addOrder && res.data.data.role === "market") {
      dispatch(togglePermission(true));
      return;
    }
    navigate("/orders/choose-market");
  };

  const marketOptions = marketlar?.map((item: any) => (
    <option key={item.value} value={item.value}>
      {item.label}
    </option>
  ));

  const regionOptions = viloyatlar?.map((item: any) => (
    <option key={item.value} value={item.value}>
      {item.label}
    </option>
  ));

  const statusOpts = statusOptions.map((item) => (
    <option key={item.value} value={item.value}>
      {item.label}
    </option>
  ));

  // const [range, setRange] = useState<[string, string] | null>(null);

  // const onChange = (_: null, dateStrings: [string, string]) => {
  //   setRange(dateStrings);
  // };
  // console.log(range);

  return (
    <div className="">
      <h2 className="text-[18px] mb-2">Filters</h2>
      <div className="w-full grid grid-cols-3 gap-5 max-[900px]:grid-cols-2 max-[750px]:grid-cols-1">
        <Select
          name="market"
          value={form.market}
          onChange={handleChange}
          placeholder={t("placeholder.selectMarket")}
          className="w-full"
        >
          {marketOptions}
        </Select>

        <Select
          name="region"
          value={form.region}
          onChange={handleChange}
          placeholder={t("placeholder.selectRegion")}
          className="w-full"
        >
          {regionOptions}
        </Select>

        <Select
          name="status"
          value={form.status}
          onChange={handleChange}
          placeholder={t("placeholder.selectStatus")}
          className="w-full"
        >
          {statusOpts}
        </Select>
      </div>

      <div className="w-full flex flex-wrap gap-4 justify-between items-center pt-5 border-[#F6F7FB] dark:border-[#595572] max-[800px]:flex-col max-[800px]:gap-5">
        <Space direction="vertical" size={10} className="max-[800px]:w-full">
          <DatePicker.RangePicker format="YYYY-MM-DD" className="w-full" />
        </Space>

        <div className="flex items-center gap-5 flex-wrap max-[800px]:w-full">
          <input
            type="text"
            name="order"
            value={form.order}
            onChange={handleChange}
            placeholder={t("placeholder.searchOrder")}
            className="border border-[#E5E7EB] rounded-lg px-3 py-[10px] outline-none max-[800px]:w-full"
          />
          <Button
            onClick={handleCheck}
            className="w-[140px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none! dark:border-none! max-[800px]:w-full!"
          >
            {t("button.addOrder")} <ArrowRight className="w-[13px] h-[13px]" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(Filter);
