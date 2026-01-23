import { memo, type FC, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, Edit3, X, Save, Loader2 } from "lucide-react";
import Popup from "../../../../shared/ui/Popup";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { Input } from "antd";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import { useTranslation } from "react-i18next";
import { buildAdminPath } from "../../../../shared/const";

interface IProps {
  customer: {
    name: string;
    phone_number: string;
    id: string;
  } | null;
}

const CustomerDetail: FC<IProps> = ({ customer }) => {
  const { t } = useTranslation("orderList");
  const navigate = useNavigate();
  if (!customer) return null;
  const { role } = useSelector((state: RootState) => state.roleSlice);

  const [isShowPopup, setIsShowPopup] = useState(false);
  const { updateOrdersUserPhoneAndName } = useOrder();

  const [name, setName] = useState(customer.name);
  const [phoneNumber, setPhoneNumber] = useState(customer.phone_number);

  const handleOpenPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    setName(customer.name);
    setPhoneNumber(customer.phone_number);
    setIsShowPopup(true);
  };

  const { handleApiError, handleSuccess } = useApiNotification();

  const handleSave = () => {
    const updatedCustomer = {
      name,
      phone_number: phoneNumber,
    };

    updateOrdersUserPhoneAndName.mutate(
      {
        id: customer.id,
        data: updatedCustomer,
      },
      {
        onSuccess: () => {
          setIsShowPopup(false);
          handleSuccess("Order manzili muvaffaqiyatli yangilandi");
        },
        onError: (err: any) => {
          handleApiError(err, "Malumotlarni yangilashda xatolik yuz berdi");
        },
      }
    );
  };

  const handleNavigateToCustomer = () => {
    navigate(buildAdminPath(`orders/customer/${customer.id}`));
  };

  const canEdit = role !== "market" && role !== "courier";

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                {t("detail.customerDetail")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Mijoz haqida ma'lumot
              </p>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={handleOpenPopup}
              className="h-9 w-9 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all cursor-pointer"
              title={t("detail.edit")}
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Customer Info */}
      <div className="p-4 space-y-4">
        {/* Customer Avatar & Name - Clickable to profile */}
        <div
          onClick={handleNavigateToCustomer}
          className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30 hover:border-blue-200 dark:hover:border-blue-700/50 transition-all cursor-pointer group"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <span className="text-xl font-bold text-white">
              {customer.name?.charAt(0)?.toUpperCase() || "M"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white capitalize truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {customer.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Profilni ko'rish uchun bosing
            </p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {t("detail.customerInfo")}
          </h4>
          <a
            href={`tel:${customer.phone_number}`}
            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-500 group-hover:shadow-lg transition-all">
              <Phone className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("phone")}
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                {customer.phone_number}
              </p>
            </div>
          </a>
        </div>
      </div>

      {/* Edit Popup */}
      <Popup isShow={isShowPopup} onClose={() => setIsShowPopup(false)}>
        <div className="bg-white dark:bg-[#2A263D] w-[420px] rounded-2xl shadow-xl overflow-hidden">
          {/* Modal Header */}
          <div className="p-5 border-b border-gray-100 dark:border-gray-700/50 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                    {t("detail.editCustomerInfo")}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Mijoz ma'lumotlarini tahrirlash
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
            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Ism
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ismni kiriting"
                  className="h-11 pl-11 rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Telefon raqam
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Phone className="w-5 h-5 text-gray-400" />
                </div>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Telefon raqamni kiriting"
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
              {t("detail.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={updateOrdersUserPhoneAndName.isPending}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
                updateOrdersUserPhoneAndName.isPending
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:shadow-lg hover:shadow-blue-500/25 cursor-pointer"
              }`}
            >
              {updateOrdersUserPhoneAndName.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saqlanmoqda...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {t("detail.save")}
                </>
              )}
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(CustomerDetail);
