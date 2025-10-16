import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import type { RootState } from "../../../../../../app/store";
import Popup from "../../../../../../shared/ui/Popup";
import { AlertCircle, Minus, Plus, X } from "lucide-react";
import { Button, Form, Input, InputNumber, message, Select, type FormProps } from "antd";
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
  const [totalPrice, setTotalPrice] = useState<number | string>("");
  const [isShow, setIsShow] = useState<boolean>(true);
  const [alertBtnYesNo, setAlertBtnYesNo] = useState<boolean>(false);
  const [alertBtnYesNoWaiting, setAlertBtnYesNoWaiting] =
    useState<boolean>(false);
  const [actionTypeOrder, setActionTypeOrder] = useState<
    "sell" | "cancel" | null
  >(null);
  const [isModalOpen, _] = useState(false);

  const navigate = useNavigate()

   useEffect(() => {
     if (!isModalOpen) {
       form.resetFields(["extraCost", "comment"]);
     }
   }, [isModalOpen]);


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
  } = useOrder();
  const [form] = Form.useForm<FieldType>();

  const id = order?.data?.id;
  const onFinish: FormProps<FieldType>["onFinish"] = (data) => {
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
          totalPrice: Number(String(totalPrice).split(",").join("")),
          extraCost: Number(data?.extraCost),
          comment: data?.comment,
        };
        partlySellOrder.mutate(
          { id, data: partlySellData },
          {
            onSuccess: () => {
              setIsShow(false);
              handleSuccess("Buyurtma muvaffaqiyatli qisman sotildi");
              navigate(-1)
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtma qisman sotilishda xatolik");
              navigate(-1);
            },
          }
        );
      } else {
        sellOrder.mutate(
          { id, data },
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
          totalPrice: Number(String(totalPrice).split(",").join("")),
          extraCost: Number(data?.extraCost),
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
            onError: (err: any) =>
            {
              handleApiError(err, "Buyurtmani qisman bekor qilishda xatolik"),
                navigate(-1);
            }
            
          }
        );
      } else {
        cancelOrder.mutate(
          { id, data },
          {
            onSuccess: () => {
              setIsShow(false);
              handleSuccess("Buyurtma muvaffaqiyatli bekor qilindi");
              navigate(-1);
            },
            onError: (err: any) => {
              handleApiError(err, "Buyurtmani bekor qilishda xatolik"),
              navigate(-1);
            }
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
        navigate(-1)
      },
      onError: (err) => {
        console.error(err);
        message.error("Buyurtma qabul qilishda xatolik yuz berdi!");
        navigate(-1)
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

  if (loading) return <div>Yuklanmoqda...</div>;
  if (error) return <div style={{ color: "red" }}>Error: {error}</div>;

  return (
    <Popup isShow={isShow}>
      <div className="w-[350px] shadow-lg rounded-md bg-[#ffffff] flex flex-col justify-between pt-6 px-8">
        <X
          className="absolute top-2.5 right-2.5 cursor-pointer hover:bg-gray-200"
          onClick={() => {
            setIsShow(false);
            navigate(-1);
          }}
        />

        {/* Umumiy content */}
        <div
          className={`space-y-1 text-[16px] text-[#2E263DE5] dark:text-[#E7E3FCE5]`}
        >
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
                }}
              ></Input>
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
              buyurtmani ortga qaytarmoqchimisiz?
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

        <Form initialValues={{}} form={form} onFinish={onFinish}>
          {orderStatus === "waiting" && (
            <div className="pt-1">
              <div>
                <span>Izoh</span>
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
            </div>
          )}

          <div className="pb-4">
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

            {alertBtnYesNoWaiting && (
              <div className="flex flex-col gap-5 pt-2">
                <span className="text-center text-[18px] text-red-500">
                  Buyurtmani{" "}
                  {actionTypeOrder === "sell"
                    ? "sotmoqchimisiz"
                    : "bekor qilmoqchimisiz"}
                  ?
                </span>

                <div className="flex gap-10">
                  <Button
                    className="w-full bg-red-500! text-white! h-[40px]!"
                    onClick={() => setAlertBtnYesNoWaiting(false)}
                  >
                    Yo'q
                  </Button>
                  <Button
                    onClick={() => form.submit()}
                    className="w-full bg-[var(--color-bg-sy)]! text-white! h-[40px]!"
                  >
                    Ha
                  </Button>
                </div>
              </div>
            )}

            {!alertBtnYesNoWaiting && orderStatus === "waiting" && (
              <div className="w-full flex gap-5">
                <Button
                  className="w-full h-[40px]!"
                  onClick={() => setPartlySoldShow((p) => !p)}
                >
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
        </Form>
      </div>
    </Popup>
  );
}
