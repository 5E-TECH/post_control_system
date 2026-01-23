import { memo, type FC, useState, useEffect } from "react";
import { MapPin, Map, Building2, Home, Edit3, X, Save, Loader2 } from "lucide-react";
import Popup from "../../../../shared/ui/Popup";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { useDistrict } from "../../../../shared/api/hooks/useDistrict";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { Input, Select } from "antd";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import { useTranslation } from "react-i18next";

interface IProps {
  address: string;
  districtId: string;
  id: string;
  isOrderAddress?: boolean; // true bo'lsa order manzilini, false bo'lsa mijoz manzilini yangilaydi
}

const ShippingAddress: FC<IProps> = ({ address, districtId, id, isOrderAddress = false }) => {
  const { t } = useTranslation("orderList");
  const { role } = useSelector((state: RootState) => state.roleSlice);
  const [district, setDistrict] = useState(districtId);

  const [isShowPopup, setIsShowPopup] = useState(false);
  const [newAddress, setNewAddress] = useState(address);

  const { updateOrdersUserAddress, updateOrderAddress } = useOrder();

  const { getDistrictById } = useDistrict();
  const { data: districtData, refetch } = getDistrictById(district);

  useEffect(() => {
    refetch();
  }, [district]);

  const { getRegionsById, getRegions } = useRegion();
  const { data: regionData } = getRegions(isShowPopup);

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
      setSelectedDistrict(districtData?.data?.id);
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

    // isOrderAddress true bo'lsa order manzilini, aks holda mijoz manzilini yangilash
    const mutation = isOrderAddress ? updateOrderAddress : updateOrdersUserAddress;

    mutation.mutate(
      { id, data: dataToSend },
      {
        onSuccess: () => {
          setIsShowPopup(false);
          setDistrict(selectedDistrict);
          handleSuccess("Manzil muvaffaqiyatli yangilandi.");
        },
        onError: (err: any) =>
          handleApiError(err, "Manzilni yangilashda xatolik yuz berdi"),
      }
    );
  };

  // Aktiv mutationni aniqlash
  const activeMutation = isOrderAddress ? updateOrderAddress : updateOrdersUserAddress;

  const canEdit = role !== "market" && role !== "courier";

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                {t("detail.address")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Yetkazib berish manzili
              </p>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => setIsShowPopup(true)}
              className="h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              {t("detail.edit")}
            </button>
          )}
        </div>
      </div>

      {/* Address Info */}
      <div className="p-4 space-y-3">
        {/* Region */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Map className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("detail.viloyat")}
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
              {districtData?.data?.region?.name || "—"}
            </p>
          </div>
        </div>

        {/* District */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("detail.tuman")}
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
              {districtData?.data?.name || "—"}
            </p>
          </div>
        </div>

        {/* Full Address */}
        <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
          <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("detail.manzil")}
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white">
              {address || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Edit Popup */}
      <Popup isShow={isShowPopup} onClose={() => setIsShowPopup(false)}>
        <div className="bg-white dark:bg-[#2A263D] w-[420px] rounded-2xl shadow-xl overflow-hidden">
          {/* Modal Header */}
          <div className="p-5 border-b border-gray-100 dark:border-gray-700/50 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Manzilni tahrirlash
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Yetkazib berish manzilini o'zgartirish
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsShowPopup(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-4">
            {/* Region Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Viloyat
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Map className="w-5 h-5 text-gray-400" />
                </div>
                <Select
                  value={selectedRegion}
                  onChange={handleRegionChange}
                  placeholder="Viloyatni tanlang"
                  className="w-full h-11 [&_.ant-select-selector]:pl-11! [&_.ant-select-selector]:rounded-xl! [&_.ant-select-selector]:border-gray-200! dark:[&_.ant-select-selector]:border-gray-600! dark:[&_.ant-select-selector]:bg-gray-800!"
                >
                  {regionData?.data?.map((region: any) => (
                    <Select.Option key={region.id} value={region.id}>
                      {region.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>

            {/* District Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tuman
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Building2 className="w-5 h-5 text-gray-400" />
                </div>
                <Select
                  value={selectedDistrict}
                  onChange={handleDistrictChange}
                  placeholder="Tumanni tanlang"
                  className="w-full h-11 [&_.ant-select-selector]:pl-11! [&_.ant-select-selector]:rounded-xl! [&_.ant-select-selector]:border-gray-200! dark:[&_.ant-select-selector]:border-gray-600! dark:[&_.ant-select-selector]:bg-gray-800!"
                >
                  {districtByRegionId?.data?.districts?.map((district: any) => (
                    <Select.Option key={district.id} value={district.id}>
                      {district.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Address Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                To'liq manzil
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Home className="w-5 h-5 text-gray-400" />
                </div>
                <Input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Manzilni kiriting"
                  className="h-11 pl-11 rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-5 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/30 flex justify-end gap-3">
            <button
              onClick={() => setIsShowPopup(false)}
              className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
              Bekor qilish
            </button>
            <button
              onClick={handleUpdate}
              disabled={activeMutation.isPending}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
                activeMutation.isPending
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/25 cursor-pointer"
              }`}
            >
              {activeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saqlanmoqda...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Saqlash
                </>
              )}
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(ShippingAddress);
