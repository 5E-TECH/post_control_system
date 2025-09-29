import { memo, type FC, useState, type ChangeEvent, useEffect } from "react";
import Popup from "../../../../shared/ui/Popup";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
// import { useParams } from "react-router-dom";
import { useDistrict } from "../../../../shared/api/hooks/useDistrict";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";

interface IProps {
  address: string;
  districtId: string; // order kelgan tuman id
  id: string;
}

const ShippingAddress: FC<IProps> = ({ address, districtId, id }) => {
  const [isShowPopup, setIsShowPopup] = useState(false);
  const [newAddress, setNewAddress] = useState(address);

  const { updateOrdersUserAddress } = useOrder();
  // const { id } = useParams();

  // district va regionlarni olish
  const { getDistrictById } = useDistrict();
  const { data: districtData } = getDistrictById(districtId, isShowPopup); // district detail

  const { getRegionsById, getRegions } = useRegion();
  const { data: regionData } = getRegions(isShowPopup); // barcha viloyatlar

  // default viloyat (districtId orqali)
  const [selectedRegion, setSelectedRegion] = useState<string>(""); // viloyat
  const [selectedDistrict, setSelectedDistrict] = useState<string>(""); // tuman

  // tanlangan region bo‘yicha tumanlarni olish
  const { data: districtByRegionId, refetch: refetchDistricts } =
    getRegionsById(selectedRegion, isShowPopup);

  // 🔹 1 — districtId orqali regionni aniqlash va set qilish
  useEffect(() => {
    if (districtData?.data?.region?.id) {
      setSelectedRegion(districtData?.data?.region?.id); // regionni avtomatik set qiladi
      setSelectedDistrict(districtId); // districtni avtomatik set qiladi
    }
  }, [districtData, districtId]);

  // 🔹 2 — region o‘zgarganda tumanni qayta olish
  useEffect(() => {
    if (selectedRegion) {
      refetchDistricts();
    }
  }, [selectedRegion, refetchDistricts]);

  // 🔹 3 — region o‘zgarsa district reset bo‘lsin
  useEffect(() => {
    // districtni reset qilish — faqat agar user o‘zgartirsa
    if (isShowPopup) {
      setSelectedDistrict("");
    }
  }, [selectedRegion, isShowPopup]);

  // region select
  const handleRegionChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRegion(e.target.value);
  };

  // district select
  const handleDistrictChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedDistrict(e.target.value);
  };

  // yangilash
  const { handleApiError } = useApiNotification();
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
        },
        onError: (err: any) =>
          handleApiError(
            err,
            "Malumotlarni yangilashda xatolik yuz berdi,keyinroq urinib ko'ring"
          ),
      }
    );
  };
  return (
    <div>
      <div className="m-5">
        <div className="flex justify-between">
          <h2
            className={`font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]`}
          >
            Shipping address
          </h2>
          <button
            onClick={() => setIsShowPopup(true)}
            className="text-[15px] font-medium text-[#8C57FF] hover:underline"
          >
            Edit
          </button>
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

          {/* Viloyat */}
          <select
            value={selectedRegion}
            onChange={handleRegionChange}
            className="w-full p-2 mb-3 border rounded-md dark:bg-[#1f1b2e] dark:text-white"
          >
            <option value="">Viloyatni tanlang</option>
            {regionData?.data?.map((region: any) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>

          {/* Tumanni tanlash */}
          <select
            value={selectedDistrict}
            onChange={handleDistrictChange}
            className="w-full p-2 mb-3 border rounded-md dark:bg-[#1f1b2e] dark:text-white"
          >
            <option value="">Tumanni tanlang</option>
            {districtByRegionId?.data?.districts?.map((district: any) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>

          {/* Manzil */}
          <input
            type="text"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            className="w-full p-2 border rounded-md dark:bg-[#1f1b2e] dark:text-white"
          />

          {/* Tugmalar */}
          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={() => setIsShowPopup(false)}
              className="px-4 py-2 rounded-md border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#3a324e]"
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
