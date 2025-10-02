import { memo, useCallback } from "react";
import { statusOptions } from "../../../../shared/static/order";
import { ArrowRight } from "lucide-react";
import { Button, DatePicker, Select, Space } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { useProfile } from "../../../../shared/api/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { togglePermission } from "../../../../shared/lib/features/add-order-permission";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../../app/store";
import {
  resetFilter,
  setFilter,
} from "../../../../shared/lib/features/order-filters";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import { requestDownload } from "../../../../shared/lib/features/excel-download-func/excelDownloadFunc";

const Filter = () => {
  const { t } = useTranslation("orderList");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { role } = useSelector((state: RootState) => state.roleSlice);

  const { getMarkets } = useMarket();
  const { data } = getMarkets(role !== "market", { limit: 0 });
  const { getRegions } = useRegion();
  const { data: regionData } = getRegions();

  const form = useSelector((state: RootState) => state.setFilter);

  const { refetch } = useProfile().getUser(role === "market");

  // umumiy Select uchun handler
  const handleSelectChange = (name: string) => (value: string) => {
    dispatch(setFilter({ name, value }));
  };

  // search uchun debounce qilingan handler
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      dispatch(setFilter({ name: "search", value }));
    }, 500),
    [dispatch]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  // RangePicker uchun
  const handleDateChange = (_: any, dateStrings: [string, string]) => {
    dispatch(setFilter({ name: "startDate", value: dateStrings[0] }));
    dispatch(setFilter({ name: "endDate", value: dateStrings[1] }));
  };

  // Permission check
  const handleCheck = async () => {
    const res = await refetch();
    const addOrder = res.data.data.add_order;
    if (!addOrder && res.data.data.role === "market") {
      dispatch(togglePermission(true));
      return;
    }
    navigate("/orders/choose-market");
  };

  // excel download
  const handleDownload = () => {
    dispatch(requestDownload());
  };

  // options
  const marketOptions =
    data?.data?.data?.map((item: any) => ({
      value: item.id,
      label: item.name,
    })) || [];

  const regionOptions =
    regionData?.data?.map((item: any) => ({
      value: item.id,
      label: item.name,
    })) || [];

  const statusOpts =
    statusOptions.map((item) => ({
      value: item.value,
      label: item.label,
    })) || [];

  const handleClear = () => {
    dispatch(resetFilter());
  };

  return (
    <div>
      <h2 className="text-[18px] mb-2">Filters</h2>
      <div className="w-full grid grid-cols-4 gap-5 max-[900px]:grid-cols-3 max-[750px]:grid-cols-2 max-[350px]:grid-cols-1">
        {role !== "market" && (
          <Select
            value={form.marketId}
            onChange={handleSelectChange("marketId")}
            placeholder={t("placeholder.selectMarket")}
            className="w-full h-[45px]!"
            options={marketOptions}
          />
        )}

        <Select
          value={form.regionId}
          onChange={handleSelectChange("regionId")}
          placeholder={t("placeholder.selectRegion")}
          className="w-full h-[45px]!"
          options={regionOptions}
        />

        <Select
          value={form.status}
          onChange={handleSelectChange("status")}
          placeholder={t("placeholder.selectStatus")}
          className="w-full h-[45px]!"
          options={statusOpts}
        />
        <div className="flex min-[900px]:justify-end">
          <Button
            className="w-[150px]! max-[651px]:w-full! h-[45px]!"
            onClick={handleClear}
          >
            Tozalash
          </Button>
        </div>
      </div>

      <div className="w-full flex flex-wrap gap-4 justify-between items-center pt-5 border-[#F6F7FB] dark:border-[#595572] max-[800px]:flex-col max-[800px]:gap-5">
        <Space direction="vertical" size={10} className="max-[800px]:w-full">
          <DatePicker.RangePicker
            format="YYYY-MM-DD"
            className="w-full"
            onChange={handleDateChange}
          />
        </Space>

        <div className="flex items-center gap-5 flex-wrap max-[800px]:w-full">
          <Button
            onClick={handleDownload}
            className="w-[100px]! h-[38px]! outline-none text-[16px]! text-gray-500! max-[800px]:w-full!"
          >
            Export
          </Button>
          <input
            type="text"
            name="search"
            defaultValue={form.search}
            onChange={handleSearchChange}
            placeholder={t("placeholder.searchOrder")}
            className="border border-gray-300! rounded-lg h-[38px]! indent-3 hover:outline-none max-[800px]:w-full"
          />
          <Button
            onClick={handleCheck}
            className="w-[180px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none! dark:border-none! max-[800px]:w-full!"
          >
            {t("button.addOrder")} <ArrowRight className="h-[13px] w-[13px]" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(Filter);
