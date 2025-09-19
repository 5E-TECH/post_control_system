import { Input, Select } from "antd";
import { memo, useEffect, useState, type ChangeEvent } from "react";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useDistrict } from "../../../../shared/api/hooks/useDistrict";
import { useDispatch, useSelector } from "react-redux";
import { setCustomerData } from "../../../../shared/lib/features/customer_and_market-id";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import type { RootState } from "../../../../app/store";

export interface ICustomer {
  phone_number: string;
  district_id?: string | null;
  name: string;
  address: string;
}

export const initialState: ICustomer = {
  phone_number: "+998 ",
  district_id: null,
  name: "",
  address: "",
};

const CustomerInfocomp = () => {
  const [formData, setFormData] = useState<ICustomer>(initialState);

  const { getUser } = useUser();
  const { data } = getUser();
  const users = Array.isArray(data?.data)
    ? data?.data.filter((user: any) => user?.role === "registrator")
    : [];
  console.log(users);
  const { getRegions } = useRegion();
  const { data: allRegions } = getRegions();
  const regions = allRegions?.data.map((item: any) => ({
    value: item.id,
    label: item.name,
  }));

  const { getDistricts } = useDistrict();
  const { data: allDistricts } = getDistricts();
  const districts = allDistricts?.data.map((item: any) => ({
    value: item.id,
    label: item.name,
  }));
  // const [phoneNumber, setPhoneNumer] = useState<string>("");

  // const allNumbers = users
  //   ?.filter((user: any) =>
  //     phoneNumber && user?.phone_number?.startsWith(phoneNumber)
  //       ? user?.phone_number
  //       : null
  //   )
  //   .map((user: any) => user?.phone_number);
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
    setFormData(customerData as ICustomer);
  }, [customerData]);
  return (
    <div className="w-full p-5 rounded-md dark:bg-[#312D48] shadow-lg">
      <h1 className="mb-4 font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
        Customer Info
      </h1>
      <div className="flex flex-col gap-4">
        <Input
          name="phone_number"
          value={formData.phone_number}
          onChange={(e) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.startsWith("998")) {
              val = val.slice(3);
            }

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
              target: { ...e.target, name: "phone_number", value: formatted },
            } as any);
          }}
          placeholder="+998 90 123 45 67"
          className="h-[45px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]!"
        />

        {/* {allNumbers?.length ? (
          <div className="grid grid-cols-5 gap-5">
            {allNumbers?.map((number: string, inx: number) => (
              <div key={inx} className="cursor-pointer hover:opacity-80">
                <span>{number}</span>
              </div>
            ))}
          </div>
        ) : (
          ""
        )} */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Region</label>
            <Select
              placeholder="Viloyat tanlang"
              className="w-full h-[45px]! custom-select-dropdown-bright"
              options={regions}
              dropdownClassName="dark-dropdown"
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">District</label>
            <Select
              value={formData.district_id}
              onChange={(value) => handleSelectChange("district_id", value)}
              placeholder="Tuman tanlang"
              className="w-full h-[45px]! custom-select-dropdown-bright"
              options={districts}
              dropdownClassName="dark-dropdown"
            />
          </div>
        </div>

        <Input
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Name"
          className="h-[45px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
        />

        <Input
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Address"
          className="h-[45px]! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
        />

        <div className="w-full h-[62px] rounded-md bg-[#FFF9EB] dark:bg-[#413745] flex items-center gap-4 px-4">
          <span
            className="font-medium text-[19px] text-[#FFB400]"
            style={{ wordSpacing: 1 }}
          >
            Confirm that you have access to johndoe@gmail.com in sender email
            settings.
          </span>
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerInfocomp);
