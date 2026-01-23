import { memo, useState, type FC } from "react";
import Popup from "../../../../shared/ui/Popup";
import { useProduct } from "../../../../shared/api/hooks/useProduct";
import { InputNumber, Select } from "antd";
import TextArea from "antd/es/input/TextArea";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { useParams } from "react-router-dom";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import type { RootState } from "../../../../app/store";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { DEFAULT_PRODUCT_IMAGE } from "../../../../shared/const";
import {
  Edit3,
  Trash2,
  Plus,
  Save,
  X,
  ShoppingBag,
  Wallet,
  CreditCard,
  Banknote,
  MessageSquare,
  Truck,
  Home,
} from "lucide-react";

interface IProps {
  items: any[];
  to_be_paid: any;
  paid_amount: any;
  total_price: any;
  marketId: string;
  comment: string;
  deleveryStatus: string;
  status?: string;
}

const Details: FC<IProps> = ({
  items = [],
  total_price,
  to_be_paid,
  paid_amount,
  marketId,
  comment,
  deleveryStatus,
  status,
}) => {
  const { t } = useTranslation("orderList");
  const { id } = useParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [editItem, setEditItem] = useState("");
  const [addItem, setAddItem] = useState(false);
  const [newQty, setNewQty] = useState(1);
  const [totalPrice, setTotalPrice] = useState(total_price);
  const [updatedComment, setComment] = useState(comment);
  const [delevery, setDelivery] = useState(deleveryStatus);
  const [isProductsOpen, setIsProductsOpen] = useState(false);

  const { getProductsByMarket } = useProduct();
  const { data } = getProductsByMarket(marketId, isProductsOpen);

  const selectedProduct = data?.data?.products?.find(
    (p: any) => p.id === selectedId
  );

  const [orderItems, setOrderItems] = useState(
    items.map((item) => ({
      id: item.id,
      product_id: item.product.id,
      quantity: item.quantity,
      image_url: item.product.image_url,
      name: item.product.name,
    }))
  );

  const { role } = useSelector((state: RootState) => state.roleSlice);

  const { updateOrders } = useOrder();
  const { handleSuccess, handleApiError } = useApiNotification();

  const handlesubmit = () => {
    const payload: any = {};

    if (delevery !== deleveryStatus) payload.where_deliver = delevery;
    if (totalPrice !== total_price) payload.total_price = totalPrice;
    if (updatedComment !== comment) payload.comment = updatedComment;

    const initialItems = items.map((i) => ({
      product_id: i.product.id,
      quantity: i.quantity,
    }));

    const currentItems = orderItems.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
    }));

    const isSame =
      JSON.stringify(initialItems) === JSON.stringify(currentItems);

    if (!isSame) payload.order_item_info = currentItems;

    if (Object.keys(payload).length === 0) {
      return;
    }

    updateOrders.mutate(
      { id, data: payload },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          handleSuccess("Order muvaffaqiyatli yangilandi");
        },
        onError: (err: any) => {
          handleApiError(err, "Order yangilashda muammo yuzaga berdi");
        },
      }
    );
  };

  const { Option } = Select;

  const marketOptions = data?.data?.products?.map((item: any) => (
    <Option key={item.id} value={item.id}>
      {item.name}
    </Option>
  ));

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white">
                {t("detail.orderDetails")}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {items.length} ta mahsulot
              </p>
            </div>
          </div>
          {status === "new" && role !== "market" && role !== "courier" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              {t("detail.edit")}
            </button>
          )}
        </div>
      </div>

      {/* Items Table Header */}
      <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-800/50 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        <div className="col-span-8">{t("detail.product")}</div>
        <div className="col-span-4 text-right">{t("detail.qty")}</div>
      </div>

      {/* Items List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
          >
            <div className="col-span-8 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img
                  src={item.product.image_url ? `/uploads/${item.product.image_url}` : DEFAULT_PRODUCT_IMAGE}
                  alt={item.product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                  }}
                />
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-gray-800 dark:text-white text-sm truncate">
                  {item.product.name}
                </h4>
              </div>
            </div>
            <div className="col-span-4 text-right">
              <span className="inline-flex items-center justify-center min-w-[40px] px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-medium">
                {item.quantity}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Comment Section */}
      {comment && (
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/50 bg-amber-50 dark:bg-amber-900/10">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                Izoh
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {comment}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Status */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-2">
          {deleveryStatus === "center" ? (
            <Truck className="w-4 h-4 text-blue-500" />
          ) : (
            <Home className="w-4 h-4 text-green-500" />
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Yetkazish:
          </span>
          <span
            className={`text-sm font-medium px-2 py-0.5 rounded-lg ${
              deleveryStatus === "center"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            }`}
          >
            {deleveryStatus === "center" ? "Markazga" : "Manzilga"}
          </span>
        </div>
      </div>

      {/* Totals */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/30">
        <div className="space-y-3">
          {/* Total Price */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t("detail.total")}
              </span>
            </div>
            <span className="text-lg font-bold text-gray-800 dark:text-white">
              {Number(total_price).toLocaleString("uz-UZ")} so'm
            </span>
          </div>

          {role !== "courier" && (
            <>
              {/* To Be Paid */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t("detail.to_be_paid")}
                  </span>
                </div>
                <span className="text-base font-semibold text-orange-600 dark:text-orange-400">
                  {Number(to_be_paid).toLocaleString("uz-UZ")} so'm
                </span>
              </div>

              {/* Paid Amount */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t("detail.paid_amount")}
                  </span>
                </div>
                <span className="text-base font-semibold text-green-600 dark:text-green-400">
                  {Number(paid_amount).toLocaleString("uz-UZ")} so'm
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Popup isShow={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="w-[720px] max-w-[95vw] bg-white dark:bg-[#2A263D] rounded-2xl shadow-xl overflow-hidden">
          {/* Modal Header */}
          <div className="p-5 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Edit3 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {t("detail.editOrder")}
              </h2>
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-5 max-h-[60vh] overflow-y-auto">
            {/* Order Items */}
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img
                      src={item.image_url ? `/uploads/${item.image_url}` : DEFAULT_PRODUCT_IMAGE}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-800 dark:text-white text-sm truncate">
                      {item.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-3">
                    {editItem === item.id ? (
                      <div className="flex items-center gap-2">
                        <InputNumber
                          min={1}
                          value={item.quantity}
                          onChange={(value) => {
                            setOrderItems((prev) =>
                              prev.map((el) =>
                                el.id === item.id
                                  ? { ...el, quantity: value }
                                  : el
                              )
                            );
                          }}
                          className="w-20"
                        />
                        <button
                          className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                          onClick={() => setEditItem("")}
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center justify-center min-w-[40px] px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-medium">
                        {item.quantity}
                      </span>
                    )}
                    <button
                      className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg transition-colors cursor-pointer"
                      onClick={() => setEditItem(item.id)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors cursor-pointer"
                      onClick={() =>
                        setOrderItems((prev) =>
                          prev.filter((el) => el.id !== item.id)
                        )
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Item */}
            {addItem && (
              <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <h4 className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-3">
                  Yangi mahsulot qo'shish
                </h4>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedId}
                    onChange={(value) => setSelectedId(value)}
                    placeholder="Mahsulot tanlang"
                    className="flex-1"
                  >
                    {marketOptions}
                  </Select>
                  <InputNumber
                    min={1}
                    value={newQty}
                    onChange={(value) => setNewQty(value ?? 1)}
                    className="w-20"
                  />
                  <button
                    className="px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-colors cursor-pointer"
                    onClick={() => {
                      if (!selectedProduct) return;
                      setOrderItems((prev) => [
                        ...prev,
                        {
                          id: crypto.randomUUID(),
                          product_id: selectedProduct.id,
                          quantity: newQty,
                          image_url: selectedProduct.image_url,
                          name: selectedProduct.name,
                        },
                      ]);
                      setSelectedId("");
                      setNewQty(1);
                      setAddItem(false);
                    }}
                  >
                    {t("detail.add1")}
                  </button>
                </div>
              </div>
            )}

            {/* Delivery & Price Settings */}
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Yetkazish turi
                  </label>
                  <Select
                    value={delevery}
                    onChange={(value) => setDelivery(value)}
                    className="w-full"
                  >
                    <Select.Option value="center">Markazga</Select.Option>
                    <Select.Option value="address">Manzilga</Select.Option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    {t("detail.totalPrice")}
                  </label>
                  <InputNumber
                    min={1}
                    value={totalPrice}
                    onChange={(value) => setTotalPrice(value)}
                    className="w-full"
                    formatter={(value) =>
                      `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                    }
                    parser={(value) => value!.replace(/\s/g, "")}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Izoh
                </label>
                <TextArea
                  rows={3}
                  value={updatedComment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Izoh kiriting..."
                  className="w-full dark:bg-gray-800! dark:text-white! dark:placeholder-gray-500!"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-5 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
            <button
              onClick={() => {
                setAddItem((p) => !p);
                setIsProductsOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 border-2 border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t("detail.add")}
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => handlesubmit()}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all cursor-pointer"
              >
                {t("detail.save")}
              </button>
            </div>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(Details);
