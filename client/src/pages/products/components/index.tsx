import { memo, useState } from "react";
import { Image } from "antd";
import { useProduct } from "../../../shared/api/hooks/useProduct";
import {
  X,
  Upload,
  ImagePlus,
  Package,
  Loader2,
  AlertCircle,
  RotateCcw,
  Save,
} from "lucide-react";
import { useParams } from "react-router-dom";
import Popup from "../../../shared/ui/Popup";
import { useForm, type Resolver } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useApiNotification } from "../../../shared/hooks/useApiNotification";
import { useTranslation } from "react-i18next";
import defaultImage from "../../../shared/assets/product/empty.webp";

// Yup validation
const schema = yup.object().shape({
  name: yup.string().required("Mahsulot nomi majburiy!"),
  image: yup.mixed<FileList>().notRequired(),
});

interface FormValues {
  name: string;
  image?: FileList;
}

const AddProduct = () => {
  const { t } = useTranslation("product");
  const { createProduct } = useProduct();
  const [showConfirm, setShowConfirm] = useState(false);
  const { id } = useParams();
  const [dragActive, setDragActive] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: yupResolver(schema) as Resolver<FormValues, any>,
  });

  const file = watch("image")?.[0] || null;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setValue("image", e.dataTransfer.files as any);
    }
  };

  const handleDiscard = () => {
    reset();
  };

  const { handleSuccess, handleApiError } = useApiNotification();

  const onSubmit = async (values: FormValues) => {
    const formData = new FormData();
    formData.append("name", values.name);
    formData.append("market_id", id ? id : "");

    if (values.image && values.image.length > 0) {
      formData.append("image", values.image[0]);
    } else {
      const response = await fetch(defaultImage);
      const blob = await response.blob();
      formData.append("image", blob, "default.png");
    }

    try {
      createProduct.mutate(formData, {
        onSuccess: () => {
          handleSuccess("Mahsulot muvaffaqiyatli qo'shildi");
          reset();
        },
        onError: (err: any) =>
          handleApiError(err, "Mahsulot yaratishda xatolik yuz berdi"),
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gradient-to-r from-purple-500 to-indigo-600">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          {t("productInformation")}
        </h2>
        <p className="text-xs sm:text-sm text-white/70 mt-0.5 sm:mt-1">
          Yangi mahsulot ma'lumotlarini kiriting
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column - Name Input */}
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                {t("productName")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  className={`w-full h-10 sm:h-12 pl-9 sm:pl-11 pr-3 sm:pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border ${
                    errors.name
                      ? "border-red-300 dark:border-red-700 focus:ring-red-500/20 focus:border-red-500"
                      : "border-gray-200 dark:border-gray-700 focus:ring-purple-500/20 focus:border-purple-500"
                  } bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all`}
                  type="text"
                  placeholder={`${t("productName")}...`}
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <p className="text-red-500 text-xs sm:text-sm mt-1.5 sm:mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Action Buttons - Mobile */}
            <div className="flex gap-2 sm:gap-3 lg:hidden">
              <button
                onClick={() => setShowConfirm(true)}
                type="button"
                className="flex-1 h-10 sm:h-12 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm sm:text-base font-medium flex items-center justify-center gap-1.5 sm:gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">{t("discard")}</span>
                <span className="xs:hidden">Tozala</span>
              </button>
              <button
                type="submit"
                disabled={createProduct.isPending}
                className="flex-1 h-10 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm sm:text-base font-medium flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-purple-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {createProduct.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
                <span className="hidden xs:inline">{createProduct.isPending ? "Saqlanmoqda..." : t("save")}</span>
                <span className="xs:hidden">{createProduct.isPending ? "..." : "Saqlash"}</span>
              </button>
            </div>
          </div>

          {/* Right Column - Image Upload */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              {t("productRasmi")}
            </label>
            <div
              className={`relative w-full h-36 sm:h-48 border-2 border-dashed rounded-lg sm:rounded-xl flex items-center justify-center transition-all ${
                dragActive
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                  : file
                  ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                  : "border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-600"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDrop={handleDrop}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
            >
              {!file ? (
                <div className="text-center p-3 sm:p-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 mx-auto rounded-lg sm:rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2 sm:mb-3">
                    <ImagePlus className="w-5 h-5 sm:w-7 sm:h-7 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-0.5 sm:mb-1">
                    {t("dragAndDrop")}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
                    {t("or")}
                  </p>
                  <div className="relative inline-block">
                    <button
                      type="button"
                      className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs sm:text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline-block mr-1 sm:mr-1.5" />
                      {t("browseImage")}
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      {...register("image")}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full p-2 sm:p-3">
                  <Image
                    src={URL.createObjectURL(file)}
                    alt="Preview"
                    className="w-full h-full object-contain rounded-md sm:rounded-lg"
                    style={{ maxHeight: "140px" }}
                  />
                  <button
                    type="button"
                    onClick={() => reset({ image: undefined })}
                    className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg cursor-pointer"
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                  <div className="absolute bottom-0.5 left-0.5 right-7 sm:bottom-1 sm:left-1 sm:right-9 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-black/50 rounded-md sm:rounded-lg">
                    <p className="text-[10px] sm:text-xs text-white truncate">{file.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons - Desktop */}
        <div className="hidden lg:flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700/50">
          <button
            onClick={() => setShowConfirm(true)}
            type="button"
            className="h-11 px-5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            {t("discard")}
          </button>
          <button
            type="submit"
            disabled={createProduct.isPending}
            className="h-11 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {createProduct.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {createProduct.isPending ? "Saqlanmoqda..." : t("save")}
          </button>
        </div>
      </form>

      {/* Confirm Discard Popup */}
      <Popup isShow={showConfirm} onClose={() => setShowConfirm(false)}>
        <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl w-[95vw] sm:w-[90vw] max-w-sm overflow-hidden shadow-2xl">
          {/* Modal Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700/50">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-lg sm:rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-2 sm:mb-3">
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white text-center">
              Formani tozalash
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center mt-0.5 sm:mt-1">
              Haqiqatan ham formani tozalamoqchimisiz?
            </p>
          </div>

          {/* Modal Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex gap-2 sm:gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 h-10 sm:h-11 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm sm:text-base font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              onClick={() => {
                handleDiscard();
                setShowConfirm(false);
              }}
              className="flex-1 h-10 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm sm:text-base font-medium shadow-lg shadow-red-500/25 hover:shadow-xl transition-all cursor-pointer"
            >
              Ha, tozala
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(AddProduct);
