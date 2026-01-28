import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import type { RootState } from "../../../../../../app/store";
import Popup from "../../../../../../shared/ui/Popup";
import {
  AlertCircle,
  ArrowLeft,
  Minus,
  Plus,
  X,
  QrCode,
  RefreshCw,
  Package,
  ScanLine,
  AlertTriangle,
  HelpCircle,
  User,
  Phone,
  MapPin,
  ShoppingBag,
  Hash,
  Banknote,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  RotateCcw,
  PackagePlus,
  Send,
  Edit3,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import {
  Form,
  Input,
  message,
  type FormProps,
} from "antd";
import type { FieldType } from "../../../../components/courier/waiting-orders";
import { useOrder } from "../../../../../../shared/api/hooks/useOrder";
import { useApiNotification } from "../../../../../../shared/hooks/useApiNotification";
import { BASE_URL } from "../../../../../../shared/const";

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  maxQuantity?: number; // 👈 optional — chunki serverdan kelmasligi mumkin
}

export default function ScanAndOrder() {
  const { token } = useParams();
  const authToken = useSelector((state: RootState) => state.authSlice.token);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [partleSoldShow, setPartlySoldShow] = useState<boolean>(false);
  const [orderItemInfo, setOrderItemInfo] = useState<OrderItem[]>([]);
  const [totalPrice, setTotalPrice] = useState<number | string>("");
  const [isShow, setIsShow] = useState<boolean>(true);
  const [alertBtnYesNo, setAlertBtnYesNo] = useState<boolean>(false);
  const [select, setSelect] = useState("");
  const [alertBtnYesNoAdd, setAlertBtnYesNoAdd] = useState<boolean>(false);
  const [alertBtnYesNoWaiting, setAlertBtnYesNoWaiting] =
    useState<boolean>(false);
  const [actionTypeOrder, setActionTypeOrder] = useState<
    "sell" | "cancel" | null
  >(null);
  const [isModalOpen, _] = useState(false);
  const [extraCostValue, setExtraCostValue] = useState<string>("");

  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.roleSlice.role);

  useEffect(() => {
    if (!isModalOpen) {
      form.resetFields(["extraCost", "comment"]);
      setExtraCostValue("");
    }
  }, [isModalOpen]);

  // Popup ochilganda form va extraCostValue ni tozalash
  useEffect(() => {
    if (isShow) {
      form.resetFields(["extraCost", "comment"]);
      setExtraCostValue("");
    }
  }, [isShow]);

  useEffect(() => {
    if (isShow && order?.data) {
      const initialItems = order?.data?.items?.map((item: any) => ({
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
      }));
      setOrderItemInfo(initialItems || []);
    }
  }, [isShow, order]);

  const { handleSuccess, handleApiError, handleWarning } = useApiNotification();
  const orderStatus = order?.data?.status;
  const postStatus = order?.data?.status;
  useEffect(() => {
    if (!token) {
      setError("QR token topilmadi");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      setLoading(true);
      setError("");
      setOrder(null);

      try {
        let url = token.includes("post_")
          ? `${BASE_URL}post/scan/${token.replace("post_", "")}`
          : `${BASE_URL}order/qr-code/${token}`;

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: authToken ? `Bearer ${authToken}` : "",
          },
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          let message = "Xatolik: server javob bermadi";

          if (json?.message) message = json.message;
          else if (typeof json?.error === "string") message = json.error;
          else if (typeof json?.error?.message === "string")
            message = json.error.message;

          throw new Error(message);
        }

        const data = await res.json();
        setOrder(data);

      } catch (err: any) {
        setError(err.message || "Xatolik yuz berdi");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [token, authToken]);

  const {
    sellOrder,
    cancelOrder,
    partlySellOrder,
    courierReceiveOrderByScanerById,
    rollbackOrder,
    joinPostRefusalProduct,
    receivePostByScan
  } = useOrder();

  const [form] = Form.useForm<FieldType>();

  const id = order?.data?.id;
  const onFinish: FormProps<FieldType>["onFinish"] = (data) => {
    // extraCostValue dan raqam olish (formatlangan stringdan)
    const parsedExtraCost = extraCostValue
      ? Number(String(extraCostValue).replace(/[^\d]/g, ""))
      : undefined;

    if (actionTypeOrder === "sell") {
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
        const partlySellData = {
          order_item_info,
          totalPrice: Number(String(totalPrice).replace(/[^\d]/g, "")),
          extraCost: parsedExtraCost,
          comment: data?.comment,
        };
        partlySellOrder.mutate(
          { id, data: partlySellData },
          {
            onSuccess: () => {
              setIsShow(false);
              handleSuccess("Buyurtma muvaffaqiyatli qisman sotildi");
              navigate(-1);
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtma qisman sotilishda xatolik");
              navigate(-1);
            },
          }
        );
      } else {
        // extraCost ni qo'lda qo'shish
        const sellData = {
          comment: data?.comment,
          extraCost: parsedExtraCost,
        };
        sellOrder.mutate(
          { id, data: sellData },
          {
            onSuccess: () => {
              setIsShow(false);
              handleSuccess("Buyurtma muvaffaqiyatli sotildi");
              navigate(-1);
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtmani sotishda xatolik");
              navigate(-1);
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
        const partlySellData = {
          order_item_info,
          totalPrice: Number(String(totalPrice).replace(/[^\d]/g, "")),
          extraCost: parsedExtraCost,
          comment: data?.comment,
        };
        partlySellOrder.mutate(
          { id, data: partlySellData },
          {
            onSuccess: () => {
              setIsShow(false);
              handleSuccess("Buyurtma muvaffaqiyatli qisman bekor qilindi");
              navigate(-1);
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtmani qisman bekor qilishda xatolik"),
                navigate(-1);
            },
          }
        );
      } else {
        // extraCost ni qo'lda qo'shish
        const cancelData = {
          comment: data?.comment,
          extraCost: parsedExtraCost,
        };
        cancelOrder.mutate(
          { id, data: cancelData },
          {
            onSuccess: () => {
              setIsShow(false);
              handleSuccess("Buyurtma muvaffaqiyatli bekor qilindi");
              navigate(-1);
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtmani bekor qilishda xatolik"),
                navigate(-1);
            },
          }
        );
      }
    }
  };

  const handleReceiveOrderById = (id: string) => {
    if (!id) {
      message.warning("Buyurtma ID topilmadi!");
      return;
    }

    courierReceiveOrderByScanerById.mutate(id, {
      onSuccess: () => {
        message.success("Buyurtma muvaffaqiyatli qabul qilindi!");
        navigate(-1);
      },
      onError: (err) => {
        console.error(err);
        message.error("Buyurtma qabul qilishda xatolik yuz berdi!");
        navigate(-1);
      },
    });
  };

  const handleSellOrder = () => {
    setAlertBtnYesNoWaiting(true);
    setActionTypeOrder("sell");
  };

  const handleCancelOrder = () => {
    setAlertBtnYesNoWaiting(true);
    setActionTypeOrder("cancel");
  };

  // let maxQuantity:number;

  const joinPostRefusalProducts = (order_ids: string) => {
    joinPostRefusalProduct.mutate(
      { order_ids: [order_ids] },
      {
        onSuccess: () => {
          message.success("Buyurtma muvaffaqiyatli pochtaga qo'shildi!");
          navigate(-1);
        },
        onError: (err) => {
          console.error(err);
          message.error("Buyurtmani pochtaga qo'shishda xatolik yuz berdi!");
          navigate(-1);
        },
      }
    );
  };

  useEffect(() => {
    if (isShow && order?.data) {
      const initialItems = order?.data?.items?.map((item: any) => ({
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        maxQuantity: item.quantity, // ✅ shu joyda to‘g‘ridan-to‘g‘ri beramiz
      }));
      setOrderItemInfo(initialItems || []);
    }
  }, [isShow, order]);

  const handleMinus = (index: number) => {
    setOrderItemInfo((prev) => {
      // Hozirgi umumiy miqdorni hisoblaymiz
      const totalQuantity = prev.reduce((sum, item) => sum + item.quantity, 0);

      // Agar umumiy son 1 dan katta bo‘lsa, kamaytirishga ruxsat beramiz
      if (totalQuantity > 1) {
        return prev.map((item, i) => {
          if (i === index && item.quantity > 0) {
            // kamaytirgandan keyin umumiy son 0 bo‘lmasligini tekshiramiz
            const newTotal = totalQuantity - 1;
            if (newTotal >= 1) {
              return { ...item, quantity: item.quantity - 1 };
            }
          }
          return item;
        });
      }

      // agar umumiy son 1 bo‘lsa, hech narsa o‘zgartirmaymiz
      return prev;
    });
  };

  const handlePlus = (index: number) => {
    setOrderItemInfo((prev) => {
      const updated = prev.map((item, i) => {
        if (i === index && item.quantity < (item.maxQuantity ?? Infinity)) {
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      });
      return updated;
    });
  };

  // Loading state - zamonaviy animatsiya bilan
  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/50 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] flex flex-col items-center justify-center p-6">
        {/* Animated loader */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 animate-pulse">
            <Package className="w-12 h-12 text-white" />
          </div>
          {/* Scanning animation */}
          <div className="absolute -inset-4 border-4 border-purple-500/30 rounded-[32px] animate-ping" />
        </div>

        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
          Buyurtma yuklanmoqda
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-xs">
          QR kod tekshirilmoqda, iltimos kuting...
        </p>

        {/* Loading dots */}
        <div className="flex gap-2 mt-6">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );

  // Error state - zamonaviy va foydali UI
  if (error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#2D1F2F] dark:to-[#1E1B2E] flex flex-col items-center justify-center p-6">
        {/* Error icon */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-red-500/30">
            <AlertTriangle className="w-12 h-12 text-white" />
          </div>
          {/* Glow effect */}
          <div className="absolute -inset-2 bg-red-500/20 rounded-[32px] blur-xl -z-10" />
        </div>

        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-center">
          Buyurtma topilmadi
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-xs mb-6">
          {error}
        </p>

        {/* Error details card */}
        <div className="w-full max-w-sm bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-6 shadow-lg">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white text-sm mb-1">
                Nima uchun bu xatolik chiqdi?
              </h3>
              <ul className="text-gray-500 dark:text-gray-400 text-xs space-y-1">
                <li>• QR kod noto'g'ri yoki buzilgan bo'lishi mumkin</li>
                <li>• Buyurtma tizimda mavjud emas</li>
                <li>• Buyurtma o'chirilgan bo'lishi mumkin</li>
                <li>• Internet aloqasida muammo</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="w-full max-w-sm space-y-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full h-14 px-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] touch-manipulation"
          >
            <ScanLine className="w-5 h-5" />
            Qayta skanerlash
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full h-14 px-6 bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.98] touch-manipulation"
          >
            <RefreshCw className="w-5 h-5" />
            Qayta yuklash
          </button>
        </div>

        {/* Back to home link */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 text-gray-400 dark:text-gray-500 text-sm flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors touch-manipulation"
        >
          <ArrowLeft className="w-4 h-4" />
          Bosh sahifaga qaytish
        </button>
      </div>
    );

  const confirmPost = (token: string) => {
    receivePostByScan.mutate(token, {
      onSuccess: () => {
        setIsShow(false);
        handleSuccess("Pochta muvaffaqiyatli qabul qilindi!");
        navigate(-1);
      },
      onError: (err: any) => {
        handleApiError(err, "Pochtani qabul qilishda xatolik yuz berdi!");
        navigate(-1);
      },
    })
  }

  // Status badge renderer
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
      waiting: { icon: <Clock className="w-3.5 h-3.5" />, label: "Kutilmoqda", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
      "on the road": { icon: <Truck className="w-3.5 h-3.5" />, label: "Yo'lda", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      sold: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Sotilgan", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      cancelled: { icon: <XCircle className="w-3.5 h-3.5" />, label: "Bekor qilingan", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
      paid: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "To'langan", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
      partly_paid: { icon: <DollarSign className="w-3.5 h-3.5" />, label: "Qisman to'langan", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
      sent: { icon: <Send className="w-3.5 h-3.5" />, label: "Yuborilgan", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    };
    const config = statusConfig[status] || { icon: <Package className="w-3.5 h-3.5" />, label: status, color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  return (
    <>
      {token?.includes("post_") ? (
        /* ==================== POST POPUP ==================== */
        <Popup isShow={isShow}>
          <div className="w-[380px] max-w-[95vw] bg-white dark:bg-[#1E1B2E] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5">
              <button
                type="button"
                onClick={() => { setIsShow(false); navigate(-1); }}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all touch-manipulation active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Pochta tekshiruvi</h2>
                  <p className="text-white/70 text-sm">
                    {postStatus === "sent" ? "Tasdiqlash kerak" : "Qabul qilingan"}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {postStatus === "sent" ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-4 border border-amber-200 dark:border-amber-800/30">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm mb-1">
                        Tasdiqlash talab etiladi
                      </h3>
                      <p className="text-amber-700 dark:text-amber-400/80 text-sm">
                        Ushbu pochtada barcha buyurtmalar borligini tasdiqlaysizmi?
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-4 border border-green-200 dark:border-green-800/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-300">
                        Pochta qabul qilingan!
                      </h3>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {postStatus === "sent" && role === "courier" && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsShow(false); navigate(-1); }}
                    className="flex-1 h-14 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] touch-manipulation"
                  >
                    <X className="w-5 h-5" />
                    Bekor qilish
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmPost(token.replace("post_", ""))}
                    className="flex-1 h-14 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/25 transition-all active:scale-[0.98] touch-manipulation"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Qabul qilish
                  </button>
                </div>
              )}
            </div>
          </div>
        </Popup>
      ) : (
        /* ==================== ORDER POPUP ==================== */
        <Popup isShow={isShow}>
          <div className="w-[420px] max-w-[95vw] bg-white dark:bg-[#1E1B2E] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 px-6 py-5">
              <button
                type="button"
                onClick={() => { setIsShow(false); navigate(-1); }}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all touch-manipulation active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">Buyurtma topildi</h2>
                    <p className="text-white/70 text-sm">#{order.data?.id?.slice(-8) || "—"}</p>
                  </div>
                </div>
                {getStatusBadge(orderStatus)}
              </div>
            </div>

            {/* Customer & Product Info */}
            <div className="p-5 space-y-4">
              {/* Customer Card */}
              <div className="bg-gray-50 dark:bg-[#2A263D] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  Mijoz ma'lumotlari
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ismi</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                        {order.data?.customer?.name || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Telefon</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {order.data?.customer?.phone_number || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tuman</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                        {order.data?.customer?.district?.name || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Products Card */}
              <div className="bg-gray-50 dark:bg-[#2A263D] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Mahsulotlar
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Mahsulot nomi</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                        {order.data?.items?.length
                          ? order.data.items.map((item: any) => item.product.name).join(", ")
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Hash className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Jami soni</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {order.data?.items?.reduce((sum: any, item: any) => sum + (item.quantity || 0), 0) || "—"} ta
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Price Card */}
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white/70 text-xs">Umumiy summa</p>
                      <p className="text-xl font-bold">
                        {order.data?.total_price ? order.data.total_price.toLocaleString("uz-UZ") : "0"} so'm
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Partial Sell Section */}
              {partleSoldShow && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border-2 border-amber-200 dark:border-amber-800/30">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                      <Edit3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-800 dark:text-amber-300 text-base">
                        Qisman sotish rejimi
                      </h3>
                      <p className="text-xs text-amber-600 dark:text-amber-400/70">Mahsulot sonini o'zgartiring</p>
                    </div>
                  </div>

                  {/* Product items */}
                  <div className={`space-y-3 ${orderItemInfo.length > 3 ? "max-h-56 overflow-y-auto pr-1 -mr-1" : ""}`}>
                    {orderItemInfo.map((item, index) => (
                      <div key={item.product_id} className="flex items-center justify-between bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-amber-100 dark:border-gray-700">
                        <span className="text-sm font-semibold text-gray-800 dark:text-white truncate flex-1 mr-4">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleMinus(index)}
                            disabled={item.quantity <= 0 || orderItemInfo.reduce((sum, i) => sum + i.quantity, 0) <= 1}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all touch-manipulation select-none ${
                              item.quantity <= 0 || orderItemInfo.reduce((sum, i) => sum + i.quantity, 0) <= 1
                                ? "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                                : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 active:scale-90 active:bg-red-200"
                            }`}
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <span className="w-10 text-center text-lg font-bold text-gray-800 dark:text-white tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handlePlus(index)}
                            disabled={item.quantity >= (item.maxQuantity ?? Infinity)}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all touch-manipulation select-none ${
                              item.quantity >= (item.maxQuantity ?? Infinity)
                                ? "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                                : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 active:scale-90 active:bg-green-200"
                            }`}
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payment amount input - larger for mobile */}
                  <div className="mt-5 p-4 bg-white dark:bg-[#2A263D] rounded-xl border border-amber-100 dark:border-gray-700">
                    <label className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      To'lov summasi (so'm)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full h-14 px-4 text-xl font-bold rounded-xl border-2 border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-[#1E1B2E] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                      placeholder="0"
                      value={totalPrice}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, "");
                        const formatted = new Intl.NumberFormat("uz-UZ").format(Number(rawValue || 0));
                        setTotalPrice(formatted);
                      }}
                    />
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/50 mt-2">
                      Qisman sotish uchun to'lov summasini kiriting
                    </p>
                  </div>
                </div>
              )}

              {/* Rollback Confirmation */}
              {alertBtnYesNo && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800/30">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                      <RotateCcw className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-red-800 dark:text-red-300 text-sm mb-1">
                        Buyurtmani qaytarish
                      </h3>
                      <p className="text-red-700 dark:text-red-400/80 text-sm">
                        {orderStatus === "sold" ? "Sotilgan" : orderStatus === "cancelled" ? "Bekor qilingan" : ""} buyurtmani "kutilmoqda" holatiga qaytarmoqchimisiz?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAlertBtnYesNo(false)}
                      className="flex-1 h-12 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-all active:scale-[0.98] touch-manipulation"
                    >
                      Yo'q
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        rollbackOrder.mutate(id, {
                          onSuccess: () => {
                            handleSuccess("Buyurtma muvaffaqiyatli 'kutilmoqda' holatiga qaytarildi!");
                            navigate(-1);
                          },
                          onError: (err: any) => {
                            handleApiError(err, "Xatolik! Buyurtma kutilmoqdaga qaytarilmadi.");
                            navigate(-1);
                          },
                        });
                      }}
                      disabled={rollbackOrder.isPending}
                      className="flex-1 h-12 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 transition-all active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                    >
                      {rollbackOrder.isPending ? "Yuklanmoqda..." : "Ha, qaytarish"}
                    </button>
                  </div>
                </div>
              )}

              {/* Add to Post Confirmation */}
              {alertBtnYesNoAdd && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800/30">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                      <PackagePlus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm mb-1">
                        Pochtaga qo'shish
                      </h3>
                      <p className="text-amber-700 dark:text-amber-400/80 text-sm">
                        Buyurtmani pochtaga qo'shmoqchimisiz?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAlertBtnYesNoAdd(false)}
                      className="flex-1 h-12 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-all active:scale-[0.98] touch-manipulation"
                    >
                      Yo'q
                    </button>
                    <button
                      type="button"
                      onClick={() => joinPostRefusalProducts(select)}
                      className="flex-1 h-12 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] touch-manipulation"
                    >
                      Ha, qo'shish
                    </button>
                  </div>
                </div>
              )}

              {/* Sell/Cancel Confirmation */}
              {alertBtnYesNoWaiting && (
                <div className={`rounded-xl p-4 border ${actionTypeOrder === "sell" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30"}`}>
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${actionTypeOrder === "sell" ? "bg-green-100 dark:bg-green-900/40" : "bg-red-100 dark:bg-red-900/40"}`}>
                      {actionTypeOrder === "sell" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div>
                      <h3 className={`font-semibold text-sm mb-1 ${actionTypeOrder === "sell" ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}>
                        {actionTypeOrder === "sell" ? "Sotishni tasdiqlang" : "Bekor qilishni tasdiqlang"}
                      </h3>
                      <p className={`text-sm ${actionTypeOrder === "sell" ? "text-green-700 dark:text-green-400/80" : "text-red-700 dark:text-red-400/80"}`}>
                        Buyurtmani {actionTypeOrder === "sell" ? "sotmoqchimisiz" : "bekor qilmoqchimisiz"}?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setAlertBtnYesNoWaiting(false)}
                      className="flex-1 h-12 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-all active:scale-[0.98] touch-manipulation"
                    >
                      Yo'q
                    </button>
                    <button
                      type="button"
                      onClick={() => form.submit()}
                      className={`flex-1 h-12 px-4 text-white font-medium rounded-xl shadow-lg transition-all active:scale-[0.98] touch-manipulation ${
                        actionTypeOrder === "sell"
                          ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-500/25"
                          : "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/25"
                      }`}
                    >
                      Ha, {actionTypeOrder === "sell" ? "sotish" : "bekor qilish"}
                    </button>
                  </div>
                </div>
              )}

              {/* Form for waiting status */}
              <Form initialValues={{}} form={form} onFinish={onFinish}>
                {orderStatus === "waiting" && !alertBtnYesNoWaiting && (
                  <div className="space-y-5 bg-gray-50 dark:bg-[#2A263D] rounded-2xl p-5 border border-gray-100 dark:border-gray-800">
                    {/* Qo'shimcha to'lov */}
                    <div>
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                          className="w-full h-16 px-5 pr-20 rounded-xl text-xl font-bold bg-white dark:bg-[#1E1B2E] border-2 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          style={{ fontSize: '20px' }}
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">
                          so'm
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1">
                        Kassadan ayiriladigan qo'shimcha xarajat
                      </p>
                    </div>

                    {/* Izoh */}
                    <div>
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        Izoh
                        <span className="text-xs text-gray-400 font-normal">(ixtiyoriy)</span>
                      </label>
                      <Form.Item name="comment" className="mb-0">
                        <Input.TextArea
                          className="!rounded-xl !bg-white dark:!bg-[#1E1B2E] !border-2 !border-gray-200 dark:!border-gray-600 dark:!text-white !min-h-[100px] !text-base !p-4"
                          placeholder="Buyurtma haqida izoh yozing..."
                          rows={3}
                          style={{ resize: "none", fontSize: '16px' }}
                        />
                      </Form.Item>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-5 space-y-3">
                  {/* Courier receive button */}
                  {orderStatus === "on the road" && role === "courier" && (
                    <button
                      type="button"
                      onClick={() => handleReceiveOrderById(order?.data?.id)}
                      className="w-full h-14 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/25 transition-all active:scale-[0.98] touch-manipulation"
                    >
                      <Truck className="w-5 h-5" />
                      Buyurtmani qabul qilish
                    </button>
                  )}

                  {/* Waiting status actions */}
                  {!alertBtnYesNoWaiting && orderStatus === "waiting" && (
                    <div className="space-y-3">
                      {/* Partial sell toggle - separate row */}
                      <button
                        type="button"
                        onClick={() => setPartlySoldShow((p) => !p)}
                        className={`w-full h-12 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] touch-manipulation font-medium ${
                          partleSoldShow
                            ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <Edit3 className="w-5 h-5" />
                        {partleSoldShow ? "Qisman sotishni yopish" : "Qisman sotish"}
                      </button>

                      {/* Sell and Cancel buttons - separate row */}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleCancelOrder}
                          className="flex-1 h-14 px-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 transition-all active:scale-[0.98] touch-manipulation"
                        >
                          <XCircle className="w-5 h-5" />
                          Bekor qilish
                        </button>
                        <button
                          type="button"
                          onClick={handleSellOrder}
                          className="flex-1 h-14 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/25 transition-all active:scale-[0.98] touch-manipulation"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          Sotish
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Superadmin paid/partly_paid actions */}
                  {!alertBtnYesNo && role === "superadmin" && ["paid", "partly_paid"].includes(orderStatus) && (
                    <button
                      type="button"
                      onClick={() => setAlertBtnYesNo((p) => !p)}
                      className="w-full h-14 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] touch-manipulation"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Buyurtmani qaytarish
                    </button>
                  )}

                  {/* Superadmin cancelled actions */}
                  {!alertBtnYesNo && !alertBtnYesNoAdd && role === "superadmin" && orderStatus === "cancelled" && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setAlertBtnYesNo((p) => !p)}
                        className="flex-1 h-14 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] touch-manipulation"
                      >
                        <RotateCcw className="w-5 h-5" />
                        Qaytarish
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAlertBtnYesNoAdd((p) => !p); setSelect(id); }}
                        className="flex-1 h-14 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] touch-manipulation"
                      >
                        <PackagePlus className="w-5 h-5" />
                        Pochtaga qo'shish
                      </button>
                    </div>
                  )}
                </div>
              </Form>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}
