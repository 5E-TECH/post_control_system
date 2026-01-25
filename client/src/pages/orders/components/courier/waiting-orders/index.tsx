import { memo, useEffect, useRef, useState, type MouseEvent } from "react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import EmptyPage from "../../../../../shared/components/empty-page";
import {
  Form,
  Input,
  Pagination,
  type FormProps,
  type PaginationProps,
} from "antd";
import { useNavigate } from "react-router-dom";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import Popup from "../../../../../shared/ui/Popup";
import {
  AlertCircle,
  Minus,
  Plus,
  X,
  User,
  Phone,
  MapPin,
  Store,
  Truck,
  Home,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
} from "lucide-react";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";

export type FieldType = {
  comment?: string;
  extraCost?: number;
};

const WaitingOrders = () => {
  const { t } = useTranslation("orderList");
  const { t: st } = useTranslation("status");

  const navigate = useNavigate();
  const order = useRef<any | null>(null);
  const urlType = useRef<string | null>(null);

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);
  const { getCourierOrders, sellOrder, cancelOrder, partlySellOrder } =
    useOrder();
  const search = useSelector((state: RootState) => state.setUserFilter.search);
  const { from, to } = useSelector(
    (state: RootState) => state.dateFilterReducer
  );
  const { data, isLoading } = getCourierOrders({
    status: "waiting",
    search,
    page,
    limit,
    startDate: from,
    endDate: to,
  });
  const total = data?.data?.total || 0;
  const orders = data?.data?.data || [];

  const [form] = Form.useForm<FieldType>();
  const { handleSuccess, handleApiError, handleWarning } = useApiNotification();

  const [isShow, setIsShow] = useState<boolean>(false);
  const [partleSoldShow, setPartlySoldShow] = useState<boolean>(false);
  const [orderItemInfo, setOrderItemInfo] = useState<any[]>([]);
  const [totalPrice, setTotalPrice] = useState<number | string>("");
  const [extraCostValue, setExtraCostValue] = useState<string>("");

  const closePopup = () => {
    setIsShow(false);
    setPartlySoldShow(false);
    form.resetFields();
    setTotalPrice("");
    setExtraCostValue("");
    setOrderItemInfo([]);
  };

  useEffect(() => {
    if (search) {
      setParam("page", 1);
    }
  }, [search]);

  const onFinish: FormProps<FieldType>["onFinish"] = (values) => {
    const item = order.current;
    const type = urlType.current;

    // extraCostValue dan raqam olish (formatlangan stringdan)
    const parsedExtraCost = extraCostValue
      ? Number(String(extraCostValue).replace(/[^\d]/g, ""))
      : undefined;

    if (type === "sell") {
      if (partleSoldShow) {
        const order_item_info = orderItemInfo.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }));
        if (!totalPrice || Number(totalPrice) < 0) {
          handleWarning("Buyurtma summasini minimal 0 bo'lishi kerak");
          return;
        }
        const data = {
          order_item_info,
          totalPrice: Number(String(totalPrice).replace(/[^\d]/g, "")),
          extraCost: parsedExtraCost,
          comment: values?.comment,
        };
        partlySellOrder.mutate(
          { id: order.current.id, data },
          {
            onSuccess: () => {
              handleSuccess("Buyurtma muvaffaqiyatli qisman sotildi");
              closePopup();
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtma qisman sotilishda xatolik");
            },
          }
        );
      } else {
        // extraCost ni qo'lda qo'shish (Form.Item ichida emas)
        const data = {
          comment: values?.comment,
          extraCost: parsedExtraCost,
        };
        sellOrder.mutate(
          { id: item?.id as string, data },
          {
            onSuccess: () => {
              handleSuccess("Buyurtma muvaffaqiyatli sotildi");
              closePopup();
            },
            onError: (err: any) =>
              handleApiError(err, "Buyurtmani sotishda xatolik"),
          }
        );
      }
    } else {
      if (partleSoldShow) {
        const order_item_info = orderItemInfo.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }));
        if (!totalPrice || Number(totalPrice) < 0) {
          handleWarning("Buyurtma summasini minimal 0 bo'lishi kerak");
          return;
        }
        const data = {
          order_item_info,
          totalPrice: Number(String(totalPrice).replace(/[^\d]/g, "")),
          extraCost: parsedExtraCost,
          comment: values?.comment,
        };
        partlySellOrder.mutate(
          { id: order.current.id, data },
          {
            onSuccess: () => {
              handleSuccess("Buyurtma muvaffaqiyatli qisman bekor qilindi");
              closePopup();
            },
            onError: (err: any) =>
              handleApiError(err, "Buyurtmani qisman bekor qilishda xatolik"),
          }
        );
      } else {
        // extraCost ni qo'lda qo'shish (Form.Item ichida emas)
        const data = {
          comment: values?.comment,
          extraCost: parsedExtraCost,
        };
        cancelOrder.mutate(
          { id: item?.id as string, data },
          {
            onSuccess: () => {
              handleSuccess("Buyurtma muvaffaqiyatli bekor qilindi");
              closePopup();
            },
            onError: (err: any) =>
              handleApiError(err, "Buyurtmani bekor qilishda xatolik"),
          }
        );
      }
    }
  };

  const handleSellOrder = (
    e: MouseEvent<HTMLButtonElement | HTMLElement>,
    item: any
  ) => {
    e.stopPropagation();
    order.current = item;
    urlType.current = "sell";
    setIsShow(true);
    form.resetFields();
    setPartlySoldShow(false);
    setTotalPrice("");
  };

  const handleCancelOrder = (
    e: MouseEvent<HTMLButtonElement | HTMLElement>,
    item: any
  ) => {
    e.stopPropagation();
    order.current = item;
    urlType.current = "cancel";
    setIsShow(true);
    form.resetFields();
    setPartlySoldShow(false);
    setTotalPrice("");
  };

  const onChange: PaginationProps["onChange"] = (newPage, limit) => {
    if (newPage === 1) removeParam("page");
    else setParam("page", newPage);

    if (limit === 10) removeParam("limit");
    else setParam("limit", limit);
  };

  useEffect(() => {
    if (isShow && order.current) {
      const initialItems = order.current?.items?.map((item: any) => ({
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        maxQuantity: item.quantity,
      }));
      setOrderItemInfo(initialItems || []);
    }
  }, [isShow]);

  const getIsPending = () => {
    if (urlType.current === "sell") {
      return partleSoldShow ? partlySellOrder.isPending : sellOrder.isPending;
    } else {
      return partleSoldShow ? partlySellOrder.isPending : cancelOrder.isPending;
    }
  };

  const handleMinus = (index: number) => {
    setOrderItemInfo((prev) => {
      const totalQuantity = prev.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQuantity > 1) {
        return prev.map((item, i) => {
          if (i === index && item.quantity > 0) {
            const newTotal = totalQuantity - 1;
            if (newTotal >= 1) {
              return { ...item, quantity: item.quantity - 1 };
            }
          }
          return item;
        });
      }
      return prev;
    });
  };

  const handlePlus = (index: number) => {
    setOrderItemInfo((prev) =>
      prev.map((item, i) => {
        const currentData = order.current?.items?.[i];
        const max = currentData?.quantity ?? item.maxQuantity ?? Infinity;
        if (i === index && item.quantity < max) {
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      })
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("uz-UZ").format(price);
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    return phone
      .replace(/\D/g, "")
      .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
  };

  const formatDate = (timestamp: string | number) => {
    if (!timestamp) return "-";
    const date = new Date(Number(timestamp));
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-12">
        <EmptyPage />
      </div>
    );
  }

  return (
    <div>
      {/* Mobile Card View */}
      <div className="lg:hidden p-3 space-y-3">
        {orders.map((item: any, index: number) => (
          <div
            key={item?.id}
            onClick={() => navigate(`/orders/order-detail/${item.id}`)}
            className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-transform"
          >
            {/* Header: Status + Index */}
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <Package className="w-3.5 h-3.5" />
                {st("waiting")}
              </span>
              <span className="text-xs text-gray-400">
                #{(page - 1) * limit + index + 1}
              </span>
            </div>

            {/* Customer Info */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base text-gray-800 dark:text-white truncate">
                  {item?.customer?.name || "Noma'lum"}
                </h3>
                <a
                  href={`tel:${item?.customer?.phone_number}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300"
                >
                  <Phone className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span>{formatPhone(item?.customer?.phone_number)}</span>
                </a>
              </div>
            </div>

            {/* Info Row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs mb-3">
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="truncate max-w-[100px]">
                  {item?.customer?.district?.name || "-"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                <Store className="w-3.5 h-3.5 text-gray-400" />
                <span className="truncate max-w-[80px]">
                  {item?.market?.name || "-"}
                </span>
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                  item?.where_deliver === "home"
                    ? "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                    : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                }`}
              >
                {item?.where_deliver === "home" ? (
                  <Home className="w-3 h-3" />
                ) : (
                  <Truck className="w-3 h-3" />
                )}
                <span>{t(`${item?.where_deliver}`)}</span>
              </div>
            </div>

            {/* Price & Date */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(item?.created_at)}</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-amber-600 dark:text-amber-400">
                  {formatPrice(item?.total_price)} so'm
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={(e) => handleSellOrder(e, item)}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <CheckCircle2 className="w-4 h-4" />
                Sotish
              </button>
              <button
                onClick={(e) => handleCancelOrder(e, item)}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <XCircle className="w-4 h-4" />
                Bekor
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-[#2A263D] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
        <table className="w-full table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <th className="px-3 py-3 text-left text-sm font-semibold w-[50px]">
                #
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold w-[15%]">
                {t("mijoz")}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold w-[12%]">
                {t("phone")}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold w-[12%]">
                {t("detail.address")}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold w-[12%]">
                {t("market")}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold w-[10%]">
                {t("status")}
              </th>
              <th className="px-3 py-3 text-right text-sm font-semibold w-[10%]">
                {t("price")}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold w-[9%]">
                {t("delivery")}
              </th>
              <th className="px-3 py-3 text-left text-sm font-semibold w-[12%]">
                {t("sana")}
              </th>
              <th className="px-3 py-3 text-center text-sm font-semibold w-[140px]">
                {t("harakat")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {orders.map((item: any, index: number) => (
              <tr
                key={item?.id}
                onClick={() => navigate(`/orders/order-detail/${item.id}`)}
                className="hover:bg-amber-50 dark:hover:bg-[#3d3759] cursor-pointer transition-colors"
              >
                <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {(page - 1) * limit + index + 1}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-medium text-gray-800 dark:text-white truncate">
                      {item?.customer?.name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                  <span className="truncate block">
                    {formatPhone(item?.customer?.phone_number)}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                  <span className="truncate block">
                    {item?.customer?.district?.name || "-"}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                  <span className="truncate block">
                    {item?.market?.name}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    {st("waiting")}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {formatPrice(item?.total_price)}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {t(`${item?.where_deliver}`)}
                </td>
                <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(item?.created_at)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={(e) => handleSellOrder(e, item)}
                      className="px-2.5 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                    >
                      {t("sotish")}
                    </button>
                    <button
                      onClick={(e) => handleCancelOrder(e, item)}
                      className="px-2.5 py-1.5 rounded-lg border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium transition-colors"
                    >
                      Bekor
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center py-4 border-t border-gray-100 dark:border-gray-800">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
          className="[&_.ant-pagination-item-active]:bg-amber-500 [&_.ant-pagination-item-active]:border-amber-500"
        />
      </div>

      {/* Popup Modal */}
      <Popup isShow={isShow} onClose={closePopup}>
        <div className="w-[95vw] max-w-[420px] bg-white dark:bg-[#2A263D] shadow-2xl rounded-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header with gradient */}
          <div
            className={`px-5 pt-5 pb-4 ${
              urlType.current === "sell"
                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                : "bg-gradient-to-r from-red-500 to-rose-600"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">
                {partleSoldShow
                  ? `Qisman ${urlType.current === "sell" ? "sotish" : "bekor qilish"}`
                  : urlType.current === "sell"
                    ? "Sotish"
                    : "Bekor qilish"}
              </h2>
              <button
                onClick={closePopup}
                className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Info Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">
                    {order.current?.customer?.name || "—"}
                  </h3>
                  <div className="flex items-center gap-1 text-white/80 text-sm">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{formatPhone(order.current?.customer?.phone_number) || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
                <div className="flex items-center gap-1 text-white/80 text-sm">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{order.current?.customer?.district?.name || "—"}</span>
                </div>
                <div className="text-right">
                  <p className="text-white/70 text-xs">Jami summa</p>
                  <p className="font-bold text-white text-lg">
                    {order.current?.total_price
                      ? formatPrice(order.current.total_price)
                      : "0"}{" "}
                    <span className="text-sm font-normal">so'm</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Partial Toggle Button - ONLY FOR SELL */}
            {urlType.current === "sell" && (
              <button
                type="button"
                onClick={() => setPartlySoldShow((p) => !p)}
                className={`w-full mb-4 p-3 rounded-xl border-2 border-dashed transition-all flex items-center gap-3 ${
                  partleSoldShow
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    partleSoldShow
                      ? "bg-amber-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="text-left flex-1">
                  <p
                    className={`font-medium text-sm ${
                      partleSoldShow
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    Qisman sotish
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Mahsulotlarni alohida tanlash
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    partleSoldShow
                      ? "border-amber-500 bg-amber-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {partleSoldShow && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </button>
            )}

            {/* Partial Sell Items - ONLY FOR SELL */}
            {partleSoldShow && urlType.current === "sell" && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Mahsulotlar
                </p>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {orderItemInfo.map((item, index) => (
                    <div
                      key={item.product_id}
                      className="flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Max: {item.maxQuantity} ta
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMinus(index)}
                          disabled={
                            item.quantity <= 0 ||
                            orderItemInfo.reduce(
                              (sum, i) => sum + i.quantity,
                              0
                            ) <= 1
                          }
                          className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform"
                        >
                          <Minus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </button>
                        <span className="w-10 text-center font-bold text-gray-800 dark:text-white text-lg">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePlus(index)}
                          disabled={item.quantity >= (item.maxQuantity ?? Infinity)}
                          className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    To'lov summasi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      className="h-12 rounded-xl text-lg font-semibold pr-16"
                      placeholder="0"
                      value={totalPrice}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        const formatted = new Intl.NumberFormat("uz-UZ").format(
                          Number(raw || 0)
                        );
                        setTotalPrice(formatted);
                      }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                      so'm
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <Form form={form} onFinish={onFinish} layout="vertical">
              {/* Qo'shimcha to'lov */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  Qo'shimcha to'lov
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={extraCostValue}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      const formatted = raw ? new Intl.NumberFormat("uz-UZ").format(Number(raw)) : "";
                      setExtraCostValue(formatted);
                      form.setFieldValue("extraCost", raw ? Number(raw) : undefined);
                    }}
                    className="w-full h-14 px-4 pr-16 rounded-xl text-lg font-semibold bg-white dark:bg-[#312D4B] border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-base">
                    so'm
                  </span>
                </div>
              </div>

              {/* Izoh */}
              <div className="mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  Izoh
                  <span className="text-xs text-gray-400 font-normal">(ixtiyoriy)</span>
                </label>
                <Form.Item name="comment" className="mb-0">
                  <Input.TextArea
                    className="!rounded-xl !bg-white dark:!bg-[#312D4B] !border-gray-200 dark:!border-gray-600 dark:!text-white !min-h-[100px] !text-base !p-4"
                    placeholder="Izoh yozing..."
                    rows={3}
                    style={{ resize: "none" }}
                  />
                </Form.Item>
              </div>
            </Form>
          </div>

          {/* Fixed Bottom Button - Single Full Width */}
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={() => form.submit()}
              disabled={getIsPending()}
              className={`w-full h-14 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                urlType.current === "sell"
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25"
                  : "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/25"
              } ${getIsPending() ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {getIsPending() ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : urlType.current === "sell" ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Sotish
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Bekor qilish
                  </>
                )}
              </button>
            </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(WaitingOrders);
