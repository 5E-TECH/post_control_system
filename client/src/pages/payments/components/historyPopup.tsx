import { memo, type FC } from "react";
import { useCashBox } from "../../../shared/api/hooks/useCashbox";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface IProps {
  id: string | null;
  onClose: () => void;
}

const HistoryPopup: FC<IProps> = ({ id, onClose }) => {
  const { t } = useTranslation("payment");
  const { getCashBoxHistoryById } = useCashBox();
  const { data } = getCashBoxHistoryById(id);
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#28243d] w-[40%] h-[85%] rounded-t-2xl shadow-lg animate-slide-up-slow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center items-center border-b px-4 py-2 relative">
          <h2 className="text-xl font-semibold">{t("to'lovTarixi")}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-500 text-[25px] absolute top-1 right-5"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 capitalize">
          {/* Umumiy ma’lumot */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="font-semibold text-lg mb-2 text-blue-600 dark:text-blue-400">
              {t("umumiyMa'lumot")}
            </h3>
            <p className="flex">
              <span className="w-[50%] font-semibold">{t("operationType")}:</span>
              <span>{data?.data?.operation_type}</span>
            </p>
            <p className="flex">
              <span className="w-[50%] font-semibold">{t("sourceType")}:</span>
              <span>{data?.data?.source_type}</span>
            </p>
            <p className="flex">
              <span className="w-[50%] font-semibold">{t("amount")}:</span>
              <span
                className={` text-green-600 ${
                  data?.data?.operation_type === "expense"
                    ? "text-red-500"
                    : "text-green-500"
                }`}
              >
                {data?.data?.amount?.toLocaleString()}
              </span>
            </p>
            <p className="flex">
              <span className="w-[50%] font-semibold">{t("afterBalance")}:</span>
              <span className="text-indigo-600">
                {data?.data?.balance_after?.toLocaleString()}
              </span>
            </p>
            <p className="flex">
              <span className="w-[50%] font-semibold">{t("comment")}:</span>
              <span>{data?.data?.comment}</span>
            </p>
            <p className="flex">
              <span className="w-[50%] font-semibold">{t("paymentDate")}:</span>
              <span>
                {new Date(Number(data?.data?.created_at)).toLocaleString(
                  "uz-UZ"
                )}
              </span>
            </p>
          </div>

          {/* Foydalanuvchi */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="font-semibold text-lg mb-2 text-orange-600 dark:text-orange-400">
              {t("foydalanuvchi")}
            </h3>
            <p className="flex">
              <span className="w-[50%] font-semibold">{t("ism")}:</span>
              <span>{data?.data?.createdByUser?.name}</span>
            </p>
            <p className="flex">
              <span className="w-[50%] font-semibold">{t("phone")}:</span>
              <span>
                {data?.data?.createdByUser?.phone_number?.replace(
                  /(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})/,
                  "$1 $2 $3 $4 $5"
                )}
              </span>
            </p>
            <p className="flex">
              <span className="w-[50%] font-semibold">{t("rol")}:</span>
              <span>{data?.data?.createdByUser?.role}</span>
            </p>
          </div>

          {/* Buyurtma */}
          {data?.data?.order && (
            <div
              onClick={() =>
                navigate(`/orders/order-detail/${data?.data?.order?.id}`)
              }
              className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow cursor-pointer"
            >
              <h3 className="font-semibold text-lg mb-2 text-green-600 dark:text-green-400">
                {t("buyurtma")}
              </h3>
              <p className="flex">
                <span className="w-[50%] font-semibold">{t("umumiyNarx")}:</span>
                <span>{data?.data?.order?.total_price}</span>
              </p>
              <p className="flex">
                <span className="w-[50%] font-semibold">{t("to'lanishiKerak")}:</span>
                <span>{data?.data?.order?.to_be_paid}</span>
              </p>
              <p className="flex">
                <span className="w-[50%] font-semibold">{t("to'langan")}:</span>
                <span>{data?.data?.order?.paid_amount}</span>
              </p>
              <p className="flex">
                <span className="w-[50%] font-semibold">{t("status")}:</span>
                <span
                  className={`ml-1 px-2 py-0.5 rounded text-white 
                    ${
                      data?.data?.order?.status === "sold"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                >
                  {data?.data?.order?.status}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(HistoryPopup);
