import { memo, type FC, useState, useEffect } from "react";
import Popup from "../../../../shared/ui/Popup";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { useDistrict } from "../../../../shared/api/hooks/useDistrict";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { Input, Select } from "antd";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";

interface IProps {
  address: string;
  districtId: string; // order kelgan tuman id
  id: string;
}

const ShippingAddress: FC<IProps> = ({ address, districtId, id }) => {
  const { role } = useSelector((state: RootState) => state.roleSlice);

  const [isShowPopup, setIsShowPopup] = useState(false);
  const [newAddress, setNewAddress] = useState(address);

  const { updateOrdersUserAddress } = useOrder();

  const { getDistrictById } = useDistrict();
  const { data: districtData } = getDistrictById(districtId, isShowPopup);

  const { getRegionsById, getRegions } = useRegion();
  const { data: regionData } = getRegions(isShowPopup); // barcha viloyatlar

  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");

  const { data: districtByRegionId, refetch: refetchDistricts } =
    getRegionsById(selectedRegion, isShowPopup);

  useEffect(() => {
    if (districtData?.data?.region?.id) {
      setSelectedRegion(districtData?.data?.region?.id);
      setSelectedDistrict(districtId);
    }
  }, [districtData, districtId]);

  useEffect(() => {
    if (selectedRegion) {
      refetchDistricts();
    }
  }, [selectedRegion, refetchDistricts]);

  useEffect(() => {
    if (isShowPopup) {
      setSelectedDistrict("");
    }
  }, [selectedRegion, isShowPopup]);

  const handleRegionChange = (value: string) => {
    setSelectedRegion(value);
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
  };

  const { handleApiError, handleSuccess } = useApiNotification();
  const handleUpdate = () => {
    const dataToSend = {
      address: newAddress,
      district_id: selectedDistrict,
    };

    updateOrdersUserAddress.mutate(
      { id, data: dataToSend },
      {
        onSuccess: () => {
          setIsShowPopup(false);
          handleSuccess("Order manzili muvaffaqiyatli yangilandi.");
        },
        onError: (err: any) =>
          handleApiError(err, "Malumotlarni yangilashda xatolik yuz berdi"),
      }
    );
  };

  return (
    <div>
      <div className="m-5">
        <div className="flex justify-between">
          <h2 className="font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
            Shipping address
          </h2>
          {role !== "market" && role !== "courier" && (
            <button
              onClick={() => setIsShowPopup(true)}
              className="text-[15px] font-medium text-[#8C57FF] hover:underline cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      <div className="m-5">
        <h2 className="text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2] ">
          {address}
        </h2>
      </div>

      {/* Popup */}
      <Popup isShow={isShowPopup} onClose={() => setIsShowPopup(false)}>
        <div className="bg-white dark:bg-[#28243d] w-[400px] rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-medium mb-4 dark:text-white">
            Edit Shipping Address
          </h2>

          <div className="flex flex-col  gap-5">
            <Select
              value={selectedRegion}
              onChange={handleRegionChange}
              placeholder="Viloyatni tanlang"
              className="w-full mb-3"
            >
              {regionData?.data?.map((region: any) => (
                <Select.Option key={region.id} value={region.id}>
                  {region.name}
                </Select.Option>
              ))}
            </Select>

            <Select
              value={selectedDistrict}
              onChange={handleDistrictChange}
              placeholder="Tumanni tanlang"
              className="w-full mb-3"
            >
              {districtByRegionId?.data?.districts?.map((district: any) => (
                <Select.Option key={district.id} value={district.id}>
                  {district.name}
                </Select.Option>
              ))}
            </Select>

            <Input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="Manzilni kiriting"
              className="w-full mb-3 dark:bg-[#312D4B]! dark:outline-none! dark:text-white! dark:placeholder-gray-400!"
            />
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => setIsShowPopup(false)}
              className="px-4 py-2 rounded-md border border-[#8C57FF] text-[#8C57FF] dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#3a324e]"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 rounded-md bg-[#8C57FF] text-white hover:bg-[#7a4de6]"
            >
              Save
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(ShippingAddress);
