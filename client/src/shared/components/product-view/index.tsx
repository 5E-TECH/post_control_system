import { Pagination, type PaginationProps } from "antd";
import { Trash2, Package, Store, Loader2, Edit, X, Upload, ImageIcon } from "lucide-react";
import { memo, type FC, useRef } from "react";
import { useProduct } from "../../api/hooks/useProduct";
import ConfirmPopup from "../confirmPopup";
import { useApiNotification } from "../../hooks/useApiNotification";
import { useParamsHook } from "../../hooks/useParams";
import { useDispatch, useSelector } from "react-redux";
import { setLimit, setPage } from "../../lib/features/paginationProductSlice";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../app/store";
import { DEFAULT_PRODUCT_IMAGE } from "../../const";
import { useState } from "react";

interface IProps {
  data: any;
  total?: number;
}

const ProductView: FC<IProps> = ({ data, total }) => {
  const { t } = useTranslation("product");
  const dispatch = useDispatch();
  const [popup, setPopup] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editItem, setEditItem] = useState<{
    id: string;
    name: string;
    image_url: string;
  } | null>(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>("");
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    if (newPage === 1) {
      dispatch(setPage(newPage));
      removeParam("page");
    } else {
      dispatch(setPage(newPage));
      setParam("page", newPage);
    }

    if (newLimit === 10) {
      dispatch(setLimit(newLimit));
      removeParam("limit");
    } else {
      dispatch(setLimit(newLimit));
      setParam("limit", newLimit);
    }
  };

  const user = useSelector((state: RootState) => state.roleSlice);

  const { deleteProduct, updateProduct } = useProduct();
  const { handleSuccess, handleApiError } = useApiNotification();

  const handleDelete = () => {
    deleteProduct.mutate(deleteItem?.id, {
      onSuccess: () => {
        handleSuccess("Mahsulot muvaffaqiyatli o'chirib tashlandi");
      },
      onError: (err: any) =>
        handleApiError(err, "mahsulotini o'chirishda xatolik yuz berdi"),
    });
    setPopup(false);
  };

  const handlePopup = (id: any, name: string) => {
    setPopup(true);
    setDeleteItem({ id, name });
  };

  // Edit handlers
  const handleEditPopup = (item: any) => {
    setEditItem({
      id: item.id,
      name: item.name,
      image_url: item.image_url || "",
    });
    setEditName(item.name);
    setEditImagePreview(item.image_url || "");
    setEditImage(null);
    setEditModal(true);
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditSubmit = () => {
    if (!editItem || !editName.trim()) return;

    const formData = new FormData();
    formData.append("name", editName.trim());
    if (editImage) {
      formData.append("image", editImage);
    }

    updateProduct.mutate(
      {
        id: editItem.id,
        data: formData,
        isMarket: user.role === "market",
      },
      {
        onSuccess: () => {
          handleSuccess("Mahsulot muvaffaqiyatli yangilandi");
          setEditModal(false);
          setEditItem(null);
          setEditName("");
          setEditImage(null);
          setEditImagePreview("");
        },
        onError: (err: any) =>
          handleApiError(err, "Mahsulotni yangilashda xatolik yuz berdi"),
      }
    );
  };

  const closeEditModal = () => {
    setEditModal(false);
    setEditItem(null);
    setEditName("");
    setEditImage(null);
    setEditImagePreview("");
  };

  // Data massiv ekanligini tekshirish
  const products = Array.isArray(data) ? data : [];

  if (products.length === 0) {
    return (
      <div className="py-10 sm:py-16 text-center px-4">
        <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3 sm:mb-4" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-1.5 sm:mb-2">
          Mahsulotlar topilmadi
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Hozircha hech qanday mahsulot yo'q
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gradient-to-r from-purple-500 to-indigo-600">
              <th className="px-4 py-3 text-left text-sm font-medium text-white w-14 whitespace-nowrap">
                #
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white whitespace-nowrap">
                {t("productName")}
              </th>
              {user.role !== "market" && (
                <th className="px-4 py-3 text-left text-sm font-medium text-white whitespace-nowrap">
                  {t("popup.market")}
                </th>
              )}
              <th className="px-4 py-3 text-center text-sm font-medium text-white w-28 whitespace-nowrap">
                {t("action")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {products.map((item: any, inx: number) => (
              <tr
                key={item?.id}
                className="hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {(page - 1) * limit + inx + 1}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img
                        src={item?.image_url || DEFAULT_PRODUCT_IMAGE}
                        alt={item?.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            DEFAULT_PRODUCT_IMAGE;
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white truncate max-w-[200px]">
                      {item?.name}
                    </span>
                  </div>
                </td>
                {user.role !== "market" && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <Store className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[150px]">
                        {item?.user?.name || "-"}
                      </span>
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => handleEditPopup(item)}
                      disabled={updateProduct.isPending}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handlePopup(item.id, item.name)}
                      disabled={deleteProduct.isPending}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {deleteProduct.isPending &&
                      deleteItem?.id === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
        {products.map((item: any) => (
          <div
            key={item?.id}
            className="p-3 sm:p-4 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
          >
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img
                  src={item?.image_url || DEFAULT_PRODUCT_IMAGE}
                  alt={item?.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-white truncate">
                  {item?.name}
                </p>
                {user.role !== "market" && item?.user?.name && (
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5 sm:mt-1">
                    <Store className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                    <span className="truncate">{item?.user?.name}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEditPopup(item)}
                  disabled={updateProduct.isPending}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={() => handlePopup(item.id, item.name)}
                  disabled={deleteProduct.isPending}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleteProduct.isPending && deleteItem?.id === item.id ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total && total > 0 && (
        <div className="px-3 sm:px-4 py-3 sm:py-4 border-t border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
            Jami: {total} ta
          </span>
          <Pagination
            showSizeChanger
            current={page}
            total={total}
            pageSize={limit}
            onChange={onChange}
            size="small"
            responsive
            showTotal={(total) => (
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                Jami: {total} ta
              </span>
            )}
          />
        </div>
      )}

      {/* Delete Confirmation Popup */}
      <ConfirmPopup
        isShow={popup}
        title={`"${deleteItem?.name}" mahsulotini o'chirishni tasdiqlaysizmi?`}
        description="Bu amalni ortga qaytarib bo'lmaydi."
        confirmText="Ha, o'chir"
        cancelText="Bekor qilish"
        onConfirm={handleDelete}
        onCancel={() => setPopup(false)}
      />

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeEditModal}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700/50 sticky top-0 bg-white dark:bg-[#2A263D] z-10">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Edit className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                Mahsulotni tahrirlash
              </h3>
              <button
                onClick={closeEditModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              {/* Image Upload */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Rasm
                </label>
                <div
                  onClick={() => editFileInputRef.current?.click()}
                  className="relative w-full h-32 sm:h-40 rounded-lg sm:rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 transition-colors cursor-pointer overflow-hidden group"
                >
                  {editImagePreview ? (
                    <>
                      <img
                        src={editImagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-xs sm:text-sm font-medium flex items-center gap-2">
                          <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                          Rasmni o'zgartirish
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 mb-2" />
                      <span className="text-xs sm:text-sm">Rasm yuklash</span>
                    </div>
                  )}
                </div>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageChange}
                  className="hidden"
                />
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Mahsulot nomi
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Mahsulot nomini kiriting"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1E1B2E] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-[#1E1B2E] sticky bottom-0">
              <button
                onClick={closeEditModal}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={updateProduct.isPending || !editName.trim()}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {updateProduct.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Saqlanmoqda...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  "Saqlash"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ProductView);
