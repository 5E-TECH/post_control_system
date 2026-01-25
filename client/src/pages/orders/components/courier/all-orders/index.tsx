import {
  Form,
  Input,
  InputNumber,
  Pagination,
  type FormProps,
  type PaginationProps,
} from "antd";
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
  RotateCcw,
} from "lucide-react";
import { memo, useEffect, useRef, useState, type MouseEvent } from "react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import EmptyPage from "../../../../../shared/components/empty-page";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useNavigate } from "react-router-dom";
import ConfirmPopup from "../../../../../shared/components/confirmPopup";
import Popup from "../../../../../shared/ui/Popup";
import type { FieldType } from "../waiting-orders";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";

const statusConfig: Record<
  string,
  { bg: string; text: string; darkBg: string; darkText: string }
> = {
  new: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    darkBg: "dark:bg-sky-900/30",
    darkText: "dark:text-sky-400",
  },
  received: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    darkBg: "dark:bg-amber-900/30",
    darkText: "dark:text-amber-400",
  },
  on_the_road: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    darkBg: "dark:bg-indigo-900/30",
    darkText: "dark:text-indigo-400",
  },
  waiting: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    darkBg: "dark:bg-orange-900/30",
    darkText: "dark:text-orange-400",
  },
  sold: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    darkBg: "dark:bg-emerald-900/30",
    darkText: "dark:text-emerald-400",
  },
  cancelled: {
    bg: "bg-red-100",
    text: "text-red-700",
    darkBg: "dark:bg-red-900/30",
    darkText: "dark:text-red-400",
  },
  paid: {
    bg: "bg-green-100",
    text: "text-green-700",
    darkBg: "dark:bg-green-900/30",
    darkText: "dark:text-green-400",
  },
  partly_paid: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    darkBg: "dark:bg-yellow-900/30",
    darkText: "dark:text-yellow-400",
  },
  cancelled_sent: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    darkBg: "dark:bg-gray-900/30",
    darkText: "dark:text-gray-400",
  },
  closed: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    darkBg: "dark:bg-gray-900/30",
    darkText: "dark:text-gray-400",
  },
};

const AllOrders = () => {
  const { t } = useTranslation("orderList");
  const { t: st } = useTranslation("status");
  const navigate = useNavigate();

  const {
    getCourierOrders,
    sellOrder,
    cancelOrder,
    rollbackOrder,
    partlySellOrder,
  } = useOrder();

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);

  const onChange: PaginationProps["onChange"] = (newPage, limit) => {
    if (newPage === 1) {
      removeParam("page");
    } else {
      setParam("page", newPage);
    }

    if (limit === 10) {
      removeParam("limit");
    } else {
      setParam("limit", limit);
    }
  };

  const search = useSelector((state: RootState) => state.setUserFilter.search);
  const { from, to } = useSelector(
    (state: RootState) => state.dateFilterReducer
  );
  const { data, isLoading } = getCourierOrders({
    search,
    page,
    limit,
    startDate: from,
    endDate: to,
  });

  const total = data?.data?.total || 0;
  const orders = data?.data?.data || [];

  const [isShow, setIsShow] = useState<boolean>(false);
  const [isShowModal, setIsShowModal] = useState<boolean>(false);
  const orderId = useRef<string | null>(null);
  const { handleSuccess, handleApiError, handleWarning } = useApiNotification();

  const order = useRef<any | null>(null);
  const urlType = useRef<string | null>(null);

  const handleSellOrder = (
    e: MouseEvent<HTMLButtonElement | HTMLElement>,
    item: any
  ) => {
    e.stopPropagation();
    order.current = item;
    urlType.current = "sell";
    setIsShow(true);
  };

  const handleCancelOrder = (
    e: MouseEvent<HTMLButtonElement | HTMLElement>,
    item: any
  ) => {
    e.stopPropagation();
    order.current = item;
    urlType.current = "cancel";
    setIsShow(true);
  };

  const handleRollback = (
    e: MouseEvent<HTMLButtonElement | HTMLElement>,
    id: string
  ) => {
    e.stopPropagation();
    orderId.current = id;
    setIsShowModal(true);
  };

  const handleConfirm = () => {
    const id = orderId.current;
    rollbackOrder.mutate(id as string, {
      onSuccess: () => {
        handleSuccess("Buyurtma muvaffaqiyatli ortga qaytarildi");
        setIsShowModal(false);
      },
      onError: (err: any) =>
        handleApiError(err, "Buyurtma qaytarilishda xatolik"),
    });
  };

  const resetPopupState = () => {
    form.resetFields();
    setPartlySoldShow(false);
    setOrderItemInfo([]);
    setTotalPrice("");
    order.current = null;
    urlType.current = null;
  };

  const closePopup = () => {
    resetPopupState();
    setIsShow(false);
  };

  const [form] = Form.useForm<FieldType>();
  const onFinish: FormProps<FieldType>["onFinish"] = (values) => {
    const item = order.current;
    const type = urlType.current;

    // Parse extraCost - handle formatted numbers like "300,000" or "300 000"
    const extraCostValue = values?.extraCost;
    const parsedExtraCost = extraCostValue
      ? Number(String(extraCostValue).replace(/[^\d]/g, ""))
      : undefined;

    if (type === "sell") {
      if (partleSoldShow) {
        const order_item_info = orderItemInfo.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }));

        if (
          totalPrice === undefined ||
          totalPrice === null ||
          totalPrice === "" ||
          Number(totalPrice) < 0
        ) {
          handleWarning("Buyurtma summasini minimal 0 bolishi kerak");
          return;
        }
        const data = {
          order_item_info,
          totalPrice: Number(String(totalPrice).split(",").join("")),
          extraCost: parsedExtraCost,
          comment: values?.comment,
        };
        partlySellOrder.mutate(
          { id: order.current.id, data },
          {
            onSuccess: () => {
              closePopup();
              handleSuccess("Buyurtma muvaffaqiyatli qisman sotildi");
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtma qisman sotilishda xatolik");
            },
          }
        );
      } else {
        const data = {
          comment: values?.comment,
          extraCost: parsedExtraCost,
        };
        sellOrder.mutate(
          { id: item?.id as string, data },
          {
            onSuccess: () => {
              closePopup();
              handleSuccess("Buyurtma muvaffaqiyatli sotildi");
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtmani sotishda xatolik");
            },
          }
        );
      }
    } else {
      if (partleSoldShow) {
        const order_item_info = orderItemInfo.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }));
        if (
          totalPrice === undefined ||
          totalPrice === null ||
          totalPrice === "" ||
          Number(totalPrice) < 0
        ) {
          handleWarning("Buyurtma summasini minimal 0 bolishi kerak");
          return;
        }
        const data = {
          order_item_info,
          totalPrice: Number(String(totalPrice).split(",").join("")),
          extraCost: parsedExtraCost,
          comment: values?.comment,
        };
        partlySellOrder.mutate(
          { id: order.current.id, data },
          {
            onSuccess: () => {
              closePopup();
              handleSuccess("Buyurtma muvaffaqiyatli qisman bekor qilindi");
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtmani qisman bekor qilishda xatolik");
            },
          }
        );
      } else {
        const data = {
          comment: values?.comment,
          extraCost: parsedExtraCost,
        };
        cancelOrder.mutate(
          { id: item?.id as string, data },
          {
            onSuccess: () => {
              closePopup();
              handleSuccess("Buyurtma muvaffaqiyatli bekor qilindi");
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtmani bekor qilishda xatolik");
            },
          }
        );
      }
    }
  };

  const [partleSoldShow, setPartlySoldShow] = useState<boolean>(false);
  const [orderItemInfo, setOrderItemInfo] = useState<any[]>([]);
  const [totalPrice, setTotalPrice] = useState<number | string>("");

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

  useEffect(() => {
    if (search) {
      setParam("page", 1);
    }
  }, [search]);

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

  const getStatusStyle = (status: string) => {
    const config = statusConfig[status] || statusConfig.closed;
    return `${config.bg} ${config.text} ${config.darkBg} ${config.darkText}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${getStatusStyle(
                  item.status
                )}`}
              >
                <Package className="w-3.5 h-3.5" />
                {st(`${item.status}`)}
              </span>
              <span className="text-xs text-gray-400">
                #{(page - 1) * limit + index + 1}
              </span>
            </div>

            {/* Customer Info */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
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
                  item?.where_deliver === "address"
                    ? "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                    : "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                }`}
              >
                {item?.where_deliver === "address" ? (
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
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  {formatPrice(item?.total_price)} so'm
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            {item?.status === "waiting" ? (
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
            ) : item?.status === "sold" || item?.status === "cancelled" ? (
              <button
                onClick={(e) => handleRollback(e, item?.id)}
                className="w-full h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <RotateCcw className="w-4 h-4" />
                Ortga qaytarish
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-[#2A263D] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
        <table className="w-full table-fixed">
          <thead>
            <tr className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
              <th className="px-3 py-4 text-left text-sm font-semibold w-[4%]">
                #
              </th>
              <th className="px-3 py-4 text-left text-sm font-semibold w-[14%]">
                {t("mijoz")}
              </th>
              <th className="px-3 py-4 text-left text-sm font-semibold w-[12%]">
                {t("phone")}
              </th>
              <th className="px-3 py-4 text-left text-sm font-semibold w-[12%]">
                {t("detail.address")}
              </th>
              <th className="px-3 py-4 text-left text-sm font-semibold w-[10%]">
                {t("market")}
              </th>
              <th className="px-3 py-4 text-left text-sm font-semibold w-[10%]">
                {t("status")}
              </th>
              <th className="px-3 py-4 text-right text-sm font-semibold w-[10%]">
                {t("price")}
              </th>
              <th className="px-3 py-4 text-left text-sm font-semibold w-[8%]">
                {t("delivery")}
              </th>
              <th className="px-3 py-4 text-left text-sm font-semibold w-[10%]">
                {t("sana")}
              </th>
              <th className="px-3 py-4 text-center text-sm font-semibold w-[10%]">
                {t("harakat")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {orders.map((item: any, index: number) => (
              <tr
                key={item?.id}
                onClick={() => navigate(`/orders/order-detail/${item.id}`)}
                className="hover:bg-blue-50 dark:hover:bg-[#3d3759] cursor-pointer transition-colors"
              >
                <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {(page - 1) * limit + index + 1}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-medium text-gray-800 dark:text-white truncate text-sm">
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
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getStatusStyle(
                      item.status
                    )}`}
                  >
                    {st(`${item.status}`)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="font-semibold text-gray-800 dark:text-white text-sm">
                    {formatPrice(item?.total_price)}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300">
                  <span className="truncate block">
                    {t(`${item?.where_deliver}`)}
                  </span>
                </td>
                <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="truncate block">
                    {formatDate(item?.created_at)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {item?.status === "waiting" ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => handleSellOrder(e, item)}
                        className="px-2 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                      >
                        {t("sotish")}
                      </button>
                      <button
                        onClick={(e) => handleCancelOrder(e, item)}
                        className="px-2 py-1.5 rounded-lg border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium transition-colors"
                      >
                        Bekor
                      </button>
                    </div>
                  ) : item?.status === "sold" || item?.status === "cancelled" ? (
                    <div className="flex justify-center">
                      <button
                        onClick={(e) => handleRollback(e, item?.id)}
                        className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
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
          className="[&_.ant-pagination-item-active]:bg-blue-500 [&_.ant-pagination-item-active]:border-blue-500"
        />
      </div>

      {/* Rollback Confirm Popup */}
      <ConfirmPopup
        isShow={isShowModal}
        onCancel={() => setIsShowModal(false)}
        onConfirm={handleConfirm}
        description={t("popupTitle")}
      />

      {/* Sell/Cancel Popup */}
      <Popup isShow={isShow} onClose={closePopup}>
        <div className="w-[95vw] max-w-[420px] bg-white dark:bg-[#2A263D] shadow-xl rounded-2xl relative pb-6 px-5 max-h-[90vh] overflow-hidden overflow-y-auto">
          <button
            onClick={closePopup}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 mb-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">
              {partleSoldShow
                ? `Qisman ${urlType.current === "sell" ? "sotish" : "bekor qilish"}`
                : urlType.current === "sell"
                  ? "Buyurtmani sotish"
                  : "Buyurtmani bekor qilish"}
            </h2>
          </div>

          {/* Order Info */}
          <div className="space-y-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {order.current?.customer?.name || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {order.current?.customer?.phone_number || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {order.current?.customer?.district?.name || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Umumiy summa:
              </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {order.current?.total_price
                  ? formatPrice(order.current.total_price)
                  : "0"}{" "}
                so'm
              </span>
            </div>
          </div>

          {/* Partial Sell/Cancel Items */}
          {partleSoldShow && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mahsulotlar:
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {orderItemInfo.map((item, index) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2">
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
                        className="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center disabled:opacity-30"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-medium text-gray-800 dark:text-white">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePlus(index)}
                        disabled={item.quantity >= (item.maxQuantity ?? Infinity)}
                        className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center disabled:opacity-30"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  To'lov summasi
                </label>
                <Input
                  className="h-11 rounded-xl"
                  placeholder="To'lov summasi"
                  value={totalPrice}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const formatted = new Intl.NumberFormat("uz-UZ").format(
                      Number(raw || 0)
                    );
                    setTotalPrice(formatted);
                  }}
                />
              </div>
            </div>
          )}

          {/* Form */}
          <Form form={form} onFinish={onFinish} layout="vertical">
            <Form.Item
              name="extraCost"
              label={
                <span className="text-gray-700 dark:text-gray-300">
                  Qo'shimcha (pul)
                </span>
              }
              className="mb-3"
            >
              <InputNumber
                placeholder="Qo'shimcha pul"
                className="w-full h-11 rounded-xl"
                formatter={(v) =>
                  v ? v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""
                }
                parser={(v) => v?.replace(/,/g, "") || ""}
              />
            </Form.Item>

            <Form.Item
              name="comment"
              label={
                <span className="text-gray-700 dark:text-gray-300">Izoh</span>
              }
              className="mb-4"
            >
              <Input.TextArea
                className="rounded-xl dark:bg-[#312D4B] dark:border-gray-600 dark:text-white"
                placeholder="Izoh qoldiring (ixtiyoriy)"
                rows={3}
                style={{ resize: "none" }}
              />
            </Form.Item>

            <div className="flex gap-3">
              {urlType.current === "sell" && (
                <button
                  type="button"
                  onClick={() => setPartlySoldShow((p) => !p)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    partleSoldShow
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  <AlertCircle className="w-5 h-5" />
                </button>
              )}

              <button
                type="submit"
                disabled={getIsPending()}
                className={`flex-1 h-11 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  urlType.current === "sell"
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                    : "bg-gradient-to-r from-red-500 to-rose-600 text-white"
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
          </Form>
        </div>
      </Popup>
    </div>
  );
};

export default memo(AllOrders);
