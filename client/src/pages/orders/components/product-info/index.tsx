import { memo, useEffect, useState, type ChangeEvent } from "react";
import { setProductInfo } from "../../../../shared/lib/features/customer_and_market-id";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import { useTranslation } from "react-i18next";
import {
  DollarSign,
  Truck,
  Home,
  MessageSquare,
  User,
  FileText,
} from "lucide-react";

const parsePriceToNumber = (value: string | number): number => {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9]/g, "");
  return Number(cleaned) || 0;
};

export interface IProductInfo {
  total_price: number | string;
  where_deliver: string;
  comment?: string;
  operator?: string;
}

const ProductInfo = () => {
  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const default_tariff = useSelector(
    (state: RootState) => state.authSlice.default_tariff
  );
  const OperatorName = useSelector((state: RootState) => state.roleSlice.name);
  const initialState: IProductInfo = {
    total_price: "",
    where_deliver: market?.default_tariff || default_tariff || "center",
    comment: "",
    operator: OperatorName || "",
  };

  const { t } = useTranslation("createOrder");
  const [formData, setFormData] = useState<IProductInfo>(initialState);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof IProductInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const dispatch = useDispatch();
  const productInfo = useSelector(
    (state: RootState) => state.setCustomerData.productInfo
  );

  useEffect(() => {
    const cleanedPrice = parsePriceToNumber(formData.total_price);
    const data = {
      ...formData,
      total_price: cleanedPrice,
    };
    dispatch(setProductInfo(data));
  }, [formData, dispatch]);

  useEffect(() => {
    if (productInfo === null) {
      setFormData(initialState);
    }
  }, [productInfo]);

  const formatPrice = (value: string | number) => {
    const num = parsePriceToNumber(value);
    if (num === 0) return "";
    return new Intl.NumberFormat("uz-UZ").format(num);
  };

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">
              {t("productInfo.title")}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Buyurtma ma'lumotlari
            </p>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-4 sm:p-5 space-y-5">
        {/* Price and Delivery Type Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Total Price */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              {t("productInfo.totalPrice")}
            </label>
            <div className="relative">
              <input
                name="total_price"
                value={formatPrice(formData.total_price)}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, "");
                  const formatted = new Intl.NumberFormat("uz-UZ").format(
                    Number(rawValue || 0)
                  );
                  handleChange({
                    ...e,
                    target: {
                      ...e.target,
                      name: "total_price",
                      value: formatted,
                    },
                  } as any);
                }}
                type="text"
                placeholder={t("productInfo.totalPricePlaceholder")}
                className="w-full h-12 px-4 pr-16 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-lg font-semibold"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                so'm
              </span>
            </div>
          </div>

          {/* Delivery Type */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Truck className="w-4 h-4 text-blue-500" />
              {t("productInfo.whereDeliver")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectChange("where_deliver", "center")}
                className={`h-12 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all cursor-pointer ${
                  formData.where_deliver === "center"
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <Truck className="w-4 h-4" />
                {t("productInfo.whereDeliverCenter")}
              </button>
              <button
                type="button"
                onClick={() => handleSelectChange("where_deliver", "address")}
                className={`h-12 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all cursor-pointer ${
                  formData.where_deliver === "address"
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <Home className="w-4 h-4" />
                {t("productInfo.whereDeliverAddress")}
              </button>
            </div>
          </div>
        </div>

        {/* Operator */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <User className="w-4 h-4 text-purple-500" />
            {t("Operator")}
          </label>
          <input
            name="operator"
            value={formData.operator}
            onChange={handleChange}
            placeholder={t("Operator...")}
            className="w-full h-11 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <MessageSquare className="w-4 h-4 text-amber-500" />
            {t("productInfo.comment")}
          </label>
          <textarea
            name="comment"
            value={formData.comment}
            onChange={handleChange}
            rows={3}
            placeholder={t("productInfo.commentPlaceholder")}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
          />
        </div>

        {/* Summary Preview */}
        {formData.total_price && parsePriceToNumber(formData.total_price) > 0 && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Jami narx:
              </span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatPrice(formData.total_price)} so'm
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span
                className={`px-2 py-1 rounded-md ${
                  formData.where_deliver === "center"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                }`}
              >
                {formData.where_deliver === "center" ? (
                  <span className="flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    Markazga
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Home className="w-3 h-3" />
                    Manzilga
                  </span>
                )}
              </span>
              {formData.operator && (
                <span className="px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  Operator: {formData.operator}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ProductInfo);
