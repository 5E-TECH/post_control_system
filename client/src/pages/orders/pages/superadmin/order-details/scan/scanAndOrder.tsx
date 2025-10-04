// src/pages/orders/pages/superadmin/order-details/scan/ScanAndOrder.tsx
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import type { RootState } from "../../../../../../app/store";
import Popup from "../../../../../../shared/ui/Popup";
import { AlertCircle, Minus, Plus, X } from "lucide-react";
import { Button, Form, Input, InputNumber, Select, type FormProps } from "antd";
import type { FieldType } from "../../../../components/courier/waiting-orders";

export default function ScanAndOrder() {
  const { token } = useParams();
  const authToken = useSelector((state: RootState) => state.authSlice.token);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [partleSoldShow, setPartlySoldShow] = useState<boolean>(false);
  const [orderItemInfo, setOrderItemInfo] = useState<any[]>([]);
  const [totalPrice, setTotalPrice] = useState<number | string>("");
  const [isShow, setIsShow] = useState<boolean>(true);
  const [alertBtnYesNo, setAlertBtnYesNo] = useState<boolean>(false);
  const [alertBtnYesNoWaiting, setAlertBtnYesNoWaiting] =
    useState<boolean>(false);
  const [actionTypeOrder, setActionTypeOrder] = useState<
    "sell" | "cancel" | null
  >(null);

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

  const orderStatus = order?.data?.status;
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
        const res = await fetch(
          `http://10.181.40.168:8080/api/v1/order/qr-code/${token}`,
          {
            method: "GET",
            headers: {
              Authorization: authToken ? `Bearer ${authToken}` : "",
            },
          }
        );

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

  const [form] = Form.useForm<FieldType>();
  const onFinish: FormProps<FieldType>["onFinish"] = () => {};

  const handleSellOrder = () => {
    setAlertBtnYesNoWaiting(true);
    setActionTypeOrder("sell");
  };

  const handleCancelOrder = () => {
    setAlertBtnYesNoWaiting(true);
    setActionTypeOrder("cancel");
  };

  if (loading) return <div>Yuklanmoqda...</div>;
  if (error) return <div style={{ color: "red" }}>Error: {error}</div>;

  return (
    <Popup isShow={isShow}>
      <div className="w-[350px] shadow-lg rounded-md bg-[#ffffff] flex flex-col justify-between pt-6 px-8">
        <X
          className="absolute top-2.5 right-2.5 cursor-pointer hover:bg-gray-200"
          onClick={() => setIsShow(false)}
        />

        {/* Umumiy content */}
        <div
          className={`space-y-1 text-[16px] text-[#2E263DE5] dark:text-[#E7E3FCE5]`}>
          <p>
            <span className="font-semibold">Mijoz ismi:</span>{" "}
            <span>{order.data?.customer?.name || "—"}</span>
          </p>
          <p>
            <span className="font-semibold">Mijoz tel raqami:</span>{" "}
            <span>{order.data?.customer?.phone_number || "—"}</span>
          </p>
          <p>
            <span className="font-semibold">Tumani: </span>
            <span>{order.data?.customer?.district?.name || "—"}</span>
          </p>
          <p>
            <span className="font-semibold">Mahsulot nomi: </span>
            <span>
              {order.data?.items?.length
                ? order.data.items
                    .map((item: any) => item.product.name)
                    .join(", ")
                : "—"}
            </span>
          </p>
          <p>
            <span className="font-semibold">Mahsulot soni: </span>
            <span>{order.data?.customer?.phone_number || "—"}</span>
          </p>
          <p>
            <span className="font-semibold">Umumiy summa:</span>{" "}
            <span>
              {order.data?.total_price
                ? order.data.total_price.toLocaleString("uz-UZ")
                : "0"}{" "}
              so'm
            </span>
          </p>
        </div>

        {partleSoldShow && (
          <div className={`flex flex-col pt-${partleSoldShow ? 3 : 0}`}>
            {orderItemInfo.map((item, index) => (
              <div
                key={item.product_id}
                className="pt-4 flex gap-10 justify-between"
              >
                <Form.Item className="flex-1!">
                  <Select
                    className="!h-[40px] custom-select-dropdown-bright"
                    dropdownClassName="dark-dropdown"
                    value={item.product_id}
                    disabled
                    options={[
                      {
                        label: item.name,
                        value: item.product_id,
                      },
                    ]}
                  />
                </Form.Item>

                <div className="flex gap-2 items-center mb-6 select-none">
                  <Plus
                    className="h-[20px] w-[20px] cursor-pointer hover:opacity-70"
                    onClick={() => {
                      const updated = [...orderItemInfo];
                      updated[index].quantity += 1;
                      setOrderItemInfo(updated);
                    }}
                  />
                  <span className="text-[20px]">{item.quantity}</span>
                  <Minus
                    className="h-[20px] w-[20px] cursor-pointer hover:opacity-70"
                    onClick={() => {
                      const updated = [...orderItemInfo];
                      if (updated[index].quantity > 0) {
                        updated[index].quantity -= 1;
                        setOrderItemInfo(updated);
                      }
                    }}
                  />
                </div>
              </div>
            ))}

            <Form.Item>
              <Input
                className="h-[40px]!"
                placeholder="To'lov summasi"
                value={totalPrice}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, "");
                  const formatted = new Intl.NumberFormat("uz-UZ").format(
                    Number(rawValue || 0)
                  );
                  setTotalPrice(formatted);
                }}></Input>
            </Form.Item>
          </div>
        )}

        {alertBtnYesNo && (
          <div className="flex flex-col gap-5 pt-2">
            <span className="text-center text-[18px] text-red-500">
              {orderStatus === "sold"
                ? "Sotilgan"
                : orderStatus === "cancelled"
                ? "Bekor qilingan"
                : ""}{" "}
              buyurtmani ortga qaytarmohchimsz?
            </span>

            <div className="flex gap-10">
              <Button
                className="w-full bg-red-500! text-white! h-[40px]!"
                onClick={() => setAlertBtnYesNo(false)}
              >
                Yo'q
              </Button>
              <Button className="w-full bg-[var(--color-bg-sy)]! text-white! h-[40px]!">
                Ha
              </Button>
            </div>
          </div>
        )}

        {orderStatus === "waiting" && (
          <div className="pt-1">
            <Form initialValues={{}} form={form} onFinish={onFinish}>
              <div>
                <span className="">Izoh</span>
                <Form.Item name="comment">
                  <Input.TextArea
                    className="py-4! dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#A9A5C0]! dark:text-[#E7E3FC66]!"
                    placeholder="Izoh qoldiring (ixtiyoriy)"
                    style={{ resize: "none" }}
                  />
                </Form.Item>
              </div>

              <div>
                <span>Qo'shimcha (pul)</span>
                <Form.Item name="extraCost">
                  <InputNumber
                    placeholder="Qo'shimcha pul"
                    className="h-[40px]! w-full!"
                    formatter={(value) =>
                      value
                        ? value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                        : ""
                    }
                    parser={(value) => value?.replace(/,/g, "") || ""}
                  />
                </Form.Item>
              </div>
            </Form>
          </div>
        )}

        <div className="pb-4">
          {orderStatus === "on_the_road" && (
            <div className="w-full pt-5">
              <Button className="w-full h-[40px]! bg-[var(--color-bg-sy)]! text-[#ffffff]!">
                Qabul qildim
              </Button>
            </div>
          )}

          {alertBtnYesNoWaiting && (
            <div className="flex flex-col gap-5 pt-2">
              <span className="text-center text-[18px] text-red-500">
                Buyurtmani{" "}
                {actionTypeOrder === "sell"
                  ? "sotmohchimsz"
                  : "bekor qilmohchimsz"}
                ?
              </span>

              <div className="flex gap-10">
                <Button
                  className="w-full bg-red-500! text-white! h-[40px]!"
                  onClick={() => setAlertBtnYesNoWaiting(false)}
                >
                  Yo'q
                </Button>
                <Button className="w-full bg-[var(--color-bg-sy)]! text-white! h-[40px]!">
                  Ha
                </Button>
              </div>
            </div>
          )}

          {!alertBtnYesNoWaiting && orderStatus === "waiting" && (
            <div className="w-full flex gap-5">
              <Button
                className="w-full h-[40px]!"
                onClick={() => setPartlySoldShow((p) => !p)}>
                <AlertCircle />
              </Button>
              <Button
                className="w-full h-[40px]! bg-red-500! text-[#ffffff]!"
                onClick={handleCancelOrder}
              >
                Bekor qilish
              </Button>
              <Button
                className="w-full h-[40px]! bg-[var(--color-bg-sy)]! text-[#ffffff]!"
                onClick={handleSellOrder}
              >
                Sotish
              </Button>
            </div>
          )}

          {!alertBtnYesNo && orderStatus === "sold" && (
            <div className="pt-4 flex gap-10">
              <Button
                className="w-full h-[40px]!"
                onClick={() => setAlertBtnYesNo((p) => !p)}
              >
                <AlertCircle />
              </Button>

              <Button className="w-full h-[40px]! bg-[var(--color-bg-sy)]! text-[#ffffff]!">
                Buyurtmani qaytarish
              </Button>
            </div>
          )}

          {!alertBtnYesNo && orderStatus === "cancelled" && (
            <div className="pt-4 flex gap-10">
              <Button
                className="w-full h-[40px]!"
                onClick={() => setAlertBtnYesNo((p) => !p)}
              >
                <AlertCircle />
              </Button>

              <Button className="w-full h-[40px]! bg-yellow-500! text-[#ffffff]!">
                Buyurtmani qaytarish
              </Button>
            </div>
          )}
        </div>
      </div>
    </Popup>
  );
}
