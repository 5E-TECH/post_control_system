import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import type { RootState } from "../../../../../../app/store";
import Popup from "../../../../../../shared/ui/Popup";
import { AlertCircle, X } from "lucide-react";
import {
  Button,
  Form,
  message,
  type FormProps,
} from "antd";
import type { FieldType } from "../../../../components/courier/waiting-orders";
import { useOrder } from "../../../../../../shared/api/hooks/useOrder";
import { useApiNotification } from "../../../../../../shared/hooks/useApiNotification";
import { BASE_URL } from "../../../../../../shared/const";

export default function ScanAndOrder() {
  const { token } = useParams();
  const authToken = useSelector((state: RootState) => state.authSlice.token);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [partleSoldShow, setPartlySoldShow] = useState<boolean>(false);
  const [orderItemInfo, setOrderItemInfo] = useState<any[]>([]);
  const [totalPrice] = useState<number | string>("");
  const [isShow, setIsShow] = useState<boolean>(true);
  // const [alertBtnYesNo, setAlertBtnYesNo] = useState<boolean>(false);
  const [_, setAlertBtnYesNoWaiting] =
    useState<boolean>(false);
  const [actionTypeOrder, setActionTypeOrder] = useState<
    "sell" | "cancel" | null
  >(null);
  const navigate = useNavigate();
  const { handleSuccess, handleApiError, handleWarning } = useApiNotification();

  const { sellOrder, cancelOrder, partlySellOrder } = useOrder();
  const [form] = Form.useForm<FieldType>();

  const orderStatus = order?.data?.status;
  const id = order?.data?.id;

  // 🟢 Buyurtma ma’lumotini olish
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
        const res = await fetch(`${BASE_URL}order/qr-code/${token}`, {
          headers: {
            Authorization: authToken ? `Bearer ${authToken}` : "",
          },
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          const message =
            json?.message ||
            json?.error?.message ||
            json?.error ||
            "Server xatosi yuz berdi";
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

  // 🔄 Buyurtma elementlarini tayyorlash
  useEffect(() => {
    if (isShow && order?.data) {
      const items = order.data.items?.map((item: any) => ({
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
      }));
      setOrderItemInfo(items || []);
    }
  }, [isShow, order]);

  // 🟢 Qabul qilish (receive) funksiyasi
  const handleReceiveOrderById = async (id: string) => {
    if (!id) {
      message.error("Buyurtma ID topilmadi");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}post/receive/order/${id}`, {
        method: "PATCH", // 🔁 PATCH bo‘ldi
        headers: {
          Authorization: authToken ? `Bearer ${authToken}` : "",
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Buyurtmani qabul qilishda xatolik");
      }

      handleSuccess("Buyurtma muvaffaqiyatli qabul qilindi");
      navigate(-1); // orqaga qaytish
    } catch (err: any) {
      handleApiError(err, "Buyurtmani qabul qilishda xatolik");
    } finally {
      setLoading(false);
    }
  };


  // 🔵 Buyurtmani sotish/bekor qilish formasi
  const onFinish: FormProps<FieldType>["onFinish"] = (data) => {
    if (!id) return;

    if (actionTypeOrder === "sell") {
      if (!partleSoldShow) {
        // Qisman sotish
        const order_item_info = orderItemInfo.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }));

        if (!totalPrice || Number(totalPrice) < 0) {
          handleWarning("Buyurtma summasi 0 dan katta bo‘lishi kerak");
          return;
        }

        const partlySellData = {
          order_item_info,
          totalPrice: Number(String(totalPrice).replace(/,/g, "")),
          extraCost: Number(data?.extraCost),
          comment: data?.comment,
        };

        partlySellOrder.mutate(
          { id, data: partlySellData },
          {
            onSuccess: () => {
              setIsShow(false);
              handleSuccess("Buyurtma qisman sotildi");
            },
            onError: (err: any) =>
              handleApiError(err, "Buyurtmani qisman sotishda xatolik"),
          }
        );
      } else {
        // To‘liq sotish
        sellOrder.mutate(
          { id, data },
          {
            onSuccess: () => {
              setIsShow(false);
              handleSuccess("Buyurtma sotildi");
            },
            onError: (err: any) =>
              handleApiError(err, "Buyurtmani sotishda xatolik"),
          },
        );
      }
    } else if (actionTypeOrder === "cancel") {
      // Bekor qilish
      cancelOrder.mutate(
        { id, data },
        {
          onSuccess: () => {
            setIsShow(false);
            handleSuccess("Buyurtma bekor qilindi");
          },
          onError: (err: any) =>
            handleApiError(err, "Buyurtmani bekor qilishda xatolik"),
        }
      );
    }
  };

  const handleSellOrder = () => {
    setAlertBtnYesNoWaiting(true);
    setActionTypeOrder("sell");
  };

  const handleCancelOrder = () => {
    setAlertBtnYesNoWaiting(true);
    setActionTypeOrder("cancel");
  };

  if (loading) return <div>Yuklanmoqda...</div>;
  if (error) return <div style={{ color: "red" }}>Xato: {error}</div>;

  return (
    <Popup isShow={isShow}>
      <div className="w-[350px] shadow-lg rounded-md bg-white flex flex-col justify-between pt-6 px-8">
        <X
          className="absolute top-2.5 right-2.5 cursor-pointer hover:bg-gray-200"
          onClick={() => {
            setIsShow(false);
            navigate(-1);
          }}
        />

        {/* 🧾 Buyurtma ma’lumotlari */}
        <div className="space-y-1 text-[16px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
          <p>
            <b>Mijoz:</b> {order.data?.customer?.name || "—"}
          </p>
          <p>
            <b>Telefon:</b> {order.data?.customer?.phone_number || "—"}
          </p>
          <p>
            <b>Tuman:</b> {order.data?.customer?.district?.name || "—"}
          </p>
          <p>
            <b>Mahsulotlar:</b>{" "}
            {order.data?.items?.length
              ? order.data.items.map((i: any) => i.product.name).join(", ")
              : "—"}
          </p>
          <p>
            <b>Umumiy summa:</b>{" "}
            {order.data?.total_price
              ? order.data.total_price.toLocaleString("uz-UZ")
              : "0"}{" "}
            so'm
          </p>
        </div>

        <Form form={form} onFinish={onFinish} className="pb-4">
          {orderStatus === "on the road" && (
            <div className="w-full pt-5">
              <Button
                onClick={() => handleReceiveOrderById(order?.data?.id)}
                className="w-full h-[40px]! bg-[var(--color-bg-sy)]! text-[#ffffff]!"
              >
                Qabul qilish
              </Button>
            </div>
          )}

          {orderStatus === "waiting" && (
            <div className="pt-4 flex gap-5">
              <Button
                className="w-full h-[40px]!"
                onClick={() => setPartlySoldShow((p) => !p)}
              >
                <AlertCircle />
              </Button>
              <Button
                className="w-full h-[40px]! bg-red-500! text-white!"
                onClick={handleCancelOrder}
              >
                Bekor qilish
              </Button>
              <Button
                className="w-full h-[40px]! bg-[var(--color-bg-sy)]! text-white!"
                onClick={handleSellOrder}
              >
                Sotish
              </Button>
            </div>
          )}
        </Form>
      </div>
    </Popup>
  );
}
