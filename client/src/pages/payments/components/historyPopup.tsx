import { memo, type FC } from 'react';
import { useCashBox } from '../../../shared/api/hooks/useCashbox';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  FileText,
  CreditCard,
  X,
  ShoppingCart,
  Info,
  Phone,
  UserCheck,
} from 'lucide-react';
import { FaMoneyBillWave } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';

interface IProps {
  id: string | null;
  onClose: () => void;
}

const HistoryPopup: FC<IProps> = ({ id, onClose }) => {
  const { t } = useTranslation('payment');
  const { t:ts } = useTranslation('status');
  const { getCashBoxHistoryById } = useCashBox();
  const { data, isLoading } = getCashBoxHistoryById(id);
  const navigate = useNavigate();

  if (!id) return null;

  const info = data?.data;
  const isIncome = info?.operation_type === 'income';
  const user = useSelector((state: RootState) => state.roleSlice);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1e1b2f] w-full sm:w-[90%] md:w-[70%] lg:w-[50%] xl:w-[45%] max-h-[90%] rounded-2xl shadow-2xl p-4 sm:p-6 transform transition-all scale-100 animate-fade-in overflow-y-auto border border-gray-200 dark:border-gray-700 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-center items-center border-b border-gray-300 dark:border-gray-600 pb-3 relative">
          <h2 className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 text-center">
            <FileText className="w-6 h-6" />
            {t("to'lovTarixi")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 absolute top-0 right-2"
          >
            <X size={26} />
          </button>
        </div>

        {/* === LOADING (SKELETON) === */}
        {isLoading ? (
          <div className="mt-5 space-y-6 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 shadow-md space-y-3"
              >
                <div className="h-5 w-1/3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-gray-300 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 w-5/6 bg-gray-300 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 w-4/6 bg-gray-300 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 w-3/6 bg-gray-300 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* === MAIN CONTENT === */
          <div className="mt-5 space-y-6 capitalize">
            {/* Umumiy ma’lumot */}
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 shadow-md">
              <h3 className="font-semibold text-lg sm:text-xl mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Info className="w-5 h-5" />
                {t("umumiyMa'lumot")}
              </h3>

              <div className="space-y-2 text-sm sm:text-base">
                <p className="flex justify-between flex-wrap">
                  <span className="font-medium">{t('operationType')}:</span>
                  <span
                    className={`flex items-center gap-1 font-semibold ${
                      isIncome ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownCircle size={18} />
                    ) : (
                      <ArrowUpCircle size={18} />
                    )}
                    {t(`${info?.operation_type}`)}
                  </span>
                </p>

                <p className="flex justify-between flex-wrap">
                  <span className="font-medium">{t('sourceType')}:</span>
                  <span className="flex items-center gap-1">
                    <CreditCard size={16} />
                    {t(`sourceTypes.${info?.source_type}`)}
                  </span>
                </p>

                <p className="flex justify-between flex-wrap">
                  <span className="font-medium">{t('amount')}:</span>
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      isIncome ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    <FaMoneyBillWave size={16} />
                    {info?.amount?.toLocaleString()}
                  </span>
                </p>

                <p className="flex justify-between flex-wrap">
                  <span className="font-medium">{t('afterBalance')}:</span>
                  <span className="text-indigo-600 font-semibold">
                    {info?.balance_after?.toLocaleString()}
                  </span>
                </p>

                {info?.comment && (
                  <p className="flex justify-between flex-wrap">
                    <span className="font-medium">{t('comment')}:</span>
                    <span className="italic text-gray-600 dark:text-gray-300 break-all text-right">
                      {info?.comment}
                    </span>
                  </p>
                )}

                <p className="flex justify-between flex-wrap">
                  <span className="font-medium">{t('paymentDate')}:</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={16} />
                    {new Date(Number(info?.created_at)).toLocaleString('uz-UZ')}
                  </span>
                </p>
              </div>
            </div>

            {/* Foydalanuvchi */}
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-orange-50 to-yellow-100 dark:from-gray-800 dark:to-gray-900 shadow-md">
              <h3 className="font-semibold text-lg sm:text-xl mb-3 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <UserCheck className="w-5 h-5" />
                {t('foydalanuvchi')}
              </h3>
              <div className="space-y-2 text-sm sm:text-base">
                <p className="flex justify-between flex-wrap">
                  <span className="font-medium">{t('ism')}:</span>
                  <span>{info?.createdByUser?.name}</span>
                </p>
                <p className="flex justify-between flex-wrap">
                  <span className="font-medium">{t('phone')}:</span>
                  <span className="flex items-center gap-1">
                    <Phone size={16} />
                    {info?.createdByUser?.phone_number?.replace(
                      /(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})/,
                      '$1 $2 $3 $4 $5',
                    )}
                  </span>
                </p>
                <p className="flex justify-between flex-wrap">
                  <span className="font-medium">{t('rol')}:</span>
                  <span className="capitalize">
                    {info?.createdByUser?.role}
                  </span>
                </p>
              </div>
            </div>

            {/* Buyurtma */}
            {info?.order && (
              <div
                onClick={() =>
                  navigate(`/orders/order-detail/${info?.order?.id}`)
                }
                className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-800 dark:to-gray-900 shadow-md cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <h3 className="font-semibold text-lg sm:text-xl mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                  <ShoppingCart className="w-5 h-5" />
                  {t('buyurtma')} {`(${info?.order?.where_deliver}) ${info?.order?.user?.name}`}
                </h3>
                <div className="space-y-2 text-sm sm:text-base">
                  <p className="flex justify-between flex-wrap">
                    <span className="font-medium">{t('tuman')}</span>
                    <span>{info?.order?.customer?.district?.name}</span>
                  </p>

                  <p className="flex justify-between flex-wrap">
                    <span className="font-medium">{t('telefon_nomer')}:</span>
                    <span>
                      {info?.order?.customer?.phone_number.replace(
                        /(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})/,
                        '$1 $2 $3 $4 $5',
                      )}
                    </span>
                  </p>

                  <p className="flex justify-between flex-wrap">
                    <span className="font-medium">{t('umumiyNarx')}:</span>
                    <span className="font-semibold flex items-center gap-1 text-green-600">
                      <FaMoneyBillWave size={16} />

                      {info?.order?.total_price.toLocaleString()}
                    </span>
                  </p>

                  {user?.role !== 'courier' && (
                    <>
                      <p className="flex justify-between flex-wrap">
                        <span className="font-medium">
                          {t("to'lanishiKerak")}:
                        </span>
                        <span>{info?.order?.to_be_paid.toLocaleString()}</span>
                      </p>
                      <p className="flex justify-between flex-wrap">
                        <span className="font-medium">{t("to'langan")}:</span>
                        <span className="text-green-700 font-semibold">
                          {info?.order?.paid_amount.toLocaleString()}
                        </span>
                      </p>
                    </>
                  )}

                  <p className="flex justify-between items-center flex-wrap">
                    <span className="font-medium">{t('status')}:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-white font-medium ${
                        info?.order?.status === 'sold'
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}
                    >
                      {ts(`${info?.order?.status}`)}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(HistoryPopup);
