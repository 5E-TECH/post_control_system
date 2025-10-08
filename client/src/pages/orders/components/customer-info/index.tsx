import { Input, Select } from "antd";
import { memo, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCustomerData } from "../../../../shared/lib/features/customer_and_market-id";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import type { RootState } from "../../../../app/store";
import { useTranslation } from "react-i18next";
import { debounce } from "../../../../shared/helpers/DebounceFunc";

export interface ICustomer {
  phone_number: string;
  region_id?: string | null;
  district_id?: string | null;
  name: string;
  address?: string;
}

export const initialState: ICustomer = {
  phone_number: "+998 ",
  region_id: null,
  district_id: null,
  name: "",
  address: "",
};

const CustomerInfocomp = () => {
  const { t } = useTranslation("createOrder");
  const [formData, setFormData] = useState<ICustomer>(initialState);

  // 🔑 search uchun alohida state
  const [regionSearch, setRegionSearch] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");

  const { getRegions, getRegionsById } = useRegion();

  // 🔹 Regionlarni backenddan searchsiz olib kelamiz
  const { data: allRegions } = getRegions();

  // 🔹 Frontendda search qilamiz
  const regions = allRegions?.data
    ?.filter((item: any) =>
      regionSearch
        ? item.name.toLowerCase().includes(regionSearch.toLowerCase())
        : true
    )
    .map((item: any) => ({
      value: item.id,
      label: item.name,
    }));

  const debouncedSearch = useMemo(
    () =>
      debounce((callback: (val: string) => void, value: string) => {
        callback(value);
      }, 500),
    []
  );

  const dispatch = useDispatch();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    dispatch(setCustomerData(updated));
  };

  const handleSelectChange = (name: keyof ICustomer, value: string) => {
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    dispatch(setCustomerData(updated));
  };

  const customerData = useSelector(
    (state: RootState) => state.setCustomerData.customerData
  );

  useEffect(() => {
    if (customerData) {
      setFormData(customerData as ICustomer);
    } else {
      setFormData(initialState);
    }
  }, [customerData]);

  // 🔹 Tanlangan regionga qarab districtlarni olib kelamiz
  const { data } = getRegionsById(
    formData?.region_id as string,
    !!formData?.region_id
  );

  // 🔹 Districtlarda ham frontend search
  const specificDistrictsByRegion = data?.data?.districts
    ?.filter((district: any) =>
      districtSearch
        ? district.name.toLowerCase().includes(districtSearch.toLowerCase())
        : true
    )
    .map((district: any) => ({
      value: district?.id,
      label: district?.name,
    }));

  return (
    <div className="w-full p-5 rounded-md dark:bg-[#312D48] shadow-lg">
      <h1 className="mb-4 font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
        {t("customerInfo")}
      </h1>

      <div className="flex flex-col gap-4">
        {/* 🔹 Telefon raqam va ism yonma-yon */}
        <div className="flex gap-4 max-[650px]:flex-col">
          {/* Telefon raqami */}
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              {t("customerForm.phone")}
            </label>
            <Input
              name="phone_number"
              value={formData.phone_number}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, "");
                if (val.startsWith("998")) val = val.slice(3);

                let formatted = "+998 ";
                if (val.length > 0) {
                  formatted += val
                    .replace(
                      /(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/,
                      (_, a, b, c, d) => [a, b, c, d].filter(Boolean).join(" ")
                    )
                    .trim();
                }

                handleChange({
                  ...e,
                  target: {
                    ...e.target,
                    name: "phone_number",
                    value: formatted,
                  },
                } as any);
              }}
              placeholder="+998 90 123 45 67"
              className="h-[45px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FCCC]! dark:text-[#E7E3FCCC]!"
            />
          </div>

          {/* Ism */}
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              {t("customerForm.name")}
            </label>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t("placeholder.name")}
              className="h-[45px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FCCC]! dark:text-[#E7E3FCCC]!"
            />
          </div>
        </div>

        {/* 🔹 Region va District */}
        <div className="flex gap-4 max-[650px]:flex-col">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              {t("customerForm.region")}
            </label>
            <Select
              value={formData.region_id}
              onSearch={(value) =>
                debouncedSearch((searchValue: string) => {
                  setRegionSearch(searchValue);
                }, value)
              }
              onChange={(value) => handleSelectChange("region_id", value)}
              placeholder={t("placeholder.selectRegion")}
              className="w-full h-[45px]! custom-select-dropdown-bright"
              options={regions}
              dropdownClassName="dark-dropdown"
              showSearch
              filterOption={false}
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              {t("customerForm.district")}
            </label>
            <Select
              value={formData.district_id}
              onSearch={(value) =>
                debouncedSearch((searchValue: string) => {
                  setDistrictSearch(searchValue);
                }, value)
              }
              onChange={(value) => handleSelectChange("district_id", value)}
              placeholder={t("placeholder.selectDistrict")}
              className="w-full h-[45px]! custom-select-dropdown-bright"
              options={formData?.region_id ? specificDistrictsByRegion : []}
              dropdownClassName="dark-dropdown"
              showSearch
              filterOption={false}
            />
          </div>
        </div>

        {/* Address */}
        <div className="pb-1">
          <label className="block text-xs text-gray-500 mb-1">
            {t("customerForm.address")}
          </label>
          <Input
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder={t("placeholder.address")}
            className="h-[45px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FCCC]! dark:text-[#E7E3FCCC]!"
          />
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerInfocomp);
