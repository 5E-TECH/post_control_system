import { Input, Modal, Select } from "antd";
import { memo, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCustomerData } from "../../../../shared/lib/features/customer_and_market-id";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import type { RootState } from "../../../../app/store";
import { useTranslation } from "react-i18next";
import { debounce } from "../../../../shared/helpers/DebounceFunc";

export interface ICustomer {
  phone_number: string;
  extra_number?: string;
  region_id?: string | null;
  district_id?: string | null;
  name: string;
  address?: string;
}

export const initialState: ICustomer = {
  phone_number: "+998 ",
  extra_number: "",
  region_id: null,
  district_id: null,
  name: "",
  address: "",
};

const CustomerInfocomp = () => {
  const { t } = useTranslation("createOrder");
  const [formData, setFormData] = useState<ICustomer>(initialState);

  const [regionSearch, setRegionSearch] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");

  const { getRegions, getRegionsById } = useRegion();
  const { data: allRegions } = getRegions();
  const dispatch = useDispatch();

  const customers = useSelector((state: RootState) => state.customerSlice.list);

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

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.startsWith("998")) val = val.slice(3);
    let formatted = "+998 ";
    if (val.length > 0) {
      formatted += val
        .replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/, (_, a, b, c, d) =>
          [a, b, c, d].filter(Boolean).join(" ")
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

    // 🔍 Telefon raqamdan faqat raqamlarni olib solishtiramiz
    const clearPhone = formatted.replace(/\D/g, "");
    const existing = customers.find(
      (c) => c.phone_number.replace(/\D/g, "") === clearPhone
    );

    if (existing) {
      Modal.confirm({
        title: "Bu telefon raqam mavjud",
        content: `${existing.phone_number} raqamidagi mijoz allaqachon mavjud. Davom etasizmi?`,
        okText: "Ha, davom etaman",
        cancelText: "Yo‘q",
        onCancel: () => {
          setFormData((prev) => ({ ...prev, phone_number: "+998 " }));
        },
      });
    }
  };

  const customerData = useSelector(
    (state: RootState) => state.setCustomerData.customerData
  );

  useEffect(() => {
    if (customerData) {
      setFormData({
        ...initialState,
        ...customerData,
        extra_number: customerData.extra_number || "",
      });
    } else {
      setFormData(initialState);
    }
    setRegionSearch("");
    setDistrictSearch("");
  }, [customerData]);

  const { data } = getRegionsById(
    formData?.region_id as string,
    !!formData?.region_id
  );

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

  const formatFullName = (value: string) => {
    if (!value) return "";
    return value
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="w-full p-5 rounded-md dark:bg-[#312D48] shadow-lg">
      <h1 className="mb-4 font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
        {t("customerInfo")}
      </h1>

      <div className="flex flex-col gap-4">
        {/* 🔹 Telefon raqam, qo‘shimcha raqam va ism yonma-yon */}
        <div className="flex gap-4 max-[850px]:flex-col">
          {/* Asosiy telefon raqami */}
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              {t("customerForm.phone")}
            </label>
            <Input
              name="phone_number"
              value={formData.phone_number}
              onChange={handlePhoneChange}
              placeholder="+998 90 123 45 67"
              className="h-[45px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:text-[#E7E3FCCC]!"
            />
          </div>
          {/* ✅ Qo‘shimcha raqam (optional) */}
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">
              {t("Qoshimcha raqam")}
            </label>
            <Input
              name="extra_number"
              value={formData.extra_number || ""}
              onChange={(e) => {
                let raw = e.target.value.replace(/\D/g, "");

                if (raw.startsWith("998")) raw = raw.slice(3);

                if (!raw) {
                  handleChange({
                    ...e,
                    target: { ...e.target, name: "extra_number", value: null },
                  } as any);
                  return;
                }

                let formatted = "+998 ";
                formatted += raw
                  .replace(
                    /(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/,
                    (_, a, b, c, d) => [a, b, c, d].filter(Boolean).join(" ")
                  )
                  .trim();

                handleChange({
                  ...e,
                  target: {
                    ...e.target,
                    name: "extra_number",
                    value: formatted,
                  },
                } as any);
              }}
              placeholder="+998 "
              className="h-[45px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FCCC]! dark:text-[#E7E3FCCC]!"
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
              onChange={(e) => {
                // Bo‘sh joylarga ruxsat berib, so‘zlarni formatlash
                const rawValue = e.target.value;
                handleChange({
                  ...e,
                  target: {
                    ...e.target,
                    name: "name",
                    value: formatFullName(rawValue),
                  },
                } as any);
              }}
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
