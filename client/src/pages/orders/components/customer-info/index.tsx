import { Input, Select } from "antd";
import { Bell } from "lucide-react";
import { memo, useState, type ChangeEvent } from "react";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";

interface ICustomer {
  phone_number: string;
  region?: string;
  district?: string;
  name: string;
  address: string;
}

const initialState: ICustomer = {
  phone_number: "",
  region: undefined,
  district: undefined,
  name: "",
  address: "",
};

const CustomerInfocomp = () => {
  const [formData, setFormData] = useState<ICustomer>(initialState);

  const { getUser } = useUser();
  const { data } = getUser();
  const users = data?.data?.filter((user: any) => user?.role === "registrator");
  console.log(users);

  const { getRegions } = useRegion();
  const { data: allRegions } = getRegions();
  const regions = allRegions?.data.map((item: any) => ({
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

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof ICustomer, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="w-full p-5 rounded-md bg-[#ffffff] dark:bg-[#312D48] shadow-lg">
      <h1 className="mb-4 font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
        Customer Info
      </h1>
      <div className="flex flex-col gap-4">
        <Input
          name="phone_number"
          value={formData.phone_number}
          onChange={handleChange}
          placeholder="Phone Number"
          className="h-[45px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
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
              value={formData.region}
              onChange={(value) => handleSelectChange("region", value)}
              placeholder="Viloyat tanlang"
              className="w-full h-[45px]! custom-select-dropdown-bright"
              options={regions}
              dropdownClassName="dark-dropdown"
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">District</label>
            <Select
              value={formData.district}
              onChange={(value) => handleSelectChange("district", value)}
              placeholder="Tuman tanlang"
              className="w-full h-[45px]! custom-select-dropdown-bright"
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
          <div className="p-1 rounded-md bg-[#FFB400]">
            <Bell className="text-[#ffffff]" />
          </div>
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
