import { memo, useState } from "react";
import {
  marketlar,
  statusOptions,
  viloyatlar,
} from "../../../../shared/static/order";
import Success from "../button/success";
import { ArrowRight } from "lucide-react";
import Select from "../select/select"; // shu Select komponentni import qildik

const Filter = () => {
  const [form, setForm] = useState({
    market: "",
    region: "",
    status: "",
    from: "",
    to: "",
    order: "",
  });

  console.log(form);
  
  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

  return (
    <div>
      <h2 className="text-[18px] mb-2">Filters</h2>
      <div className="w-full flex gap-5">
        <Select
          name="market"
          value={form.market}
          onChange={handleChange}
          placeholder="Select market"
          className="w-[180px] flex-1"
        >
          {marketOptions}
        </Select>

        <Select
          name="region"
          value={form.region}
          onChange={handleChange}
          placeholder="Select region"
          className="w-[180px] flex-1"
        >
          {regionOptions}
        </Select>

        <Select
          name="status"
          value={form.status}
          onChange={handleChange}
          placeholder="Select status"
          className="w-[180px] flex-1"
        >
          {statusOpts}
        </Select>
      </div>

      <div className="border-t w-full mt-5 flex pt-5 justify-between border-[#F6F7FB] dark:border-[#595572]">
        <div className="flex gap-5">
          <Select
            name="from"
            value={form.from}
            onChange={handleChange}
            placeholder="From"
            className="w-[150px]"
          >
            {marketOptions}
          </Select>

          <Select
            name="to"
            value={form.to}
            onChange={handleChange}
            placeholder="To"
            className="w-[180px]"
          >
            {regionOptions}
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            name="order"
            value={form.order}
            onChange={handleChange}
            placeholder="Search order"
            className="border border-[#E5E7EB] rounded-lg px-3 py-[10px] outline-none"
          />
          <Success
            text="Add Order"
            path="choose-market"
            icon={<ArrowRight className="h-[13px] w-[13px]" />}
            className="w-[140px]!"
          />
        </div>
      </div>
    </div>
  );
};

export default memo(Filter);
