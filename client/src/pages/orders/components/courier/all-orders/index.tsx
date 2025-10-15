import { Button, Form, Input, InputNumber, Select, type FormProps } from "antd";
import { AlertCircle, Minus, Plus, X } from "lucide-react";
import { memo, useEffect, useRef, useState, type MouseEvent } from "react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import EmptyPage from "../../../../../shared/components/empty-page";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useNavigate } from "react-router-dom";
import ConfirmPopup from "../../../../../shared/components/confirmPopup";
import Popup from "../../../../../shared/ui/Popup";
import type { FieldType } from "../waiting-orders";

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  received: "bg-green-500",
  on_the_road: "bg-yellow-500",
  waiting: "bg-orange-500",
  sold: "bg-purple-500",
  cancelled: "bg-red-500",
  paid: "bg-cyan-500",
  partly_paid: "bg-pink-500",
  cancelled_sent: "bg-gray-500",
  closed: "bg-black",
};

const AllOrders = () => {
  const navigate = useNavigate();

  const {
    getCourierOrders,
    sellOrder,
    cancelOrder,
    rollbackOrder,
    partlySellOrder,
  } = useOrder();
  const { data } = getCourierOrders();
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
          extraCost: Number(values?.extraCost),
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
        sellOrder.mutate(
          { id: item?.id as string, data: values },
          {
            onSuccess: () => {
              closePopup();
              handleSuccess("Buyurtma muvaffaqiyatli sotildi");
              navigate(-1);
            },
            onError: (err: any) =>
            {
              handleApiError(err, "Buyurtmani sotishda xatolik"), 
              navigate(-1);
            } 
            
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
          extraCost: Number(values?.extraCost),
          comment: values?.comment,
        };
        partlySellOrder.mutate(
          { id: order.current.id, data },
          {
            onSuccess: () => {
              closePopup();
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
          { id: item?.id as string, data: values },
          {
            onSuccess: () => {
              closePopup();
              handleSuccess("Buyurtma muvaffaqiyatli bekor qilindi");
              navigate(-1);
            },
            onError: (err: any) =>
            {
              handleApiError(err, "Buyurtmani bekor qilishda xatolik"),
              navigate(-1);
            }
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
      }));
      setOrderItemInfo(initialItems || []);
    }
  }, [isShow]);

  // Loading and Disabled button
  const getIsPending = () => {
    if (urlType.current === "sell") {
      return partleSoldShow ? partlySellOrder.isPending : sellOrder.isPending;
    } else {
      return partleSoldShow ? partlySellOrder.isPending : cancelOrder.isPending;
    }
  };

  return data?.data?.data?.length > 0 ? (
    <div>
      <table className="w-full">
        <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
          <tr>
            <th>
              <div className="flex items-center gap-10 pl-10 pr-5">
                <span>#</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>MIJOZ</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>TEL RAQAMI</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>MANZIL</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>FIRMA</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>HOLATI</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>NARXI</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>OMBOR</span>
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th>
              <div className="flex items-center justify-center gap-30">
                <span>HARAKAT</span>
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.data?.map((item: any, inx: number) => {
            console.log(item.id);

            return (
              <tr
                onClick={(e) => {
                  console.log(e);

                  navigate(`/order/order-detail/${item.id}`);
                }}
                key={item?.id}
                className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759] cursor-pointer"
              >
                <td className="pl-10">{inx + 1}</td>
                <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#d5d1eb]">
                  {item?.customer?.name}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                  {item?.customer?.phone_number}
                </td>
                <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#d5d1eb]">
                  {item?.customer?.district?.name}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                  {item?.market?.name}
                </td>
                <td className="pl-10">
                  <span
                    className={`py-2 px-3 rounded-2xl text-[13px] text-white ${
                      statusColors[item.status] || "bg-slate-400"
                    }`}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                  {new Intl.NumberFormat("uz-UZ").format(item?.total_price)}
                </td>
                <td className="pl-15 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                  {item?.items.length}
                </td>
                <td className="text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                  {item?.status === "waiting" ? (
                    <div className="flex gap-3">
                      <Button
                        onClick={(e) => handleSellOrder(e, item)}
                        className="bg-[var(--color-bg-sy)]! text-[#ffffff]! border-none! hover:opacity-80"
                      >
                        Sotish
                      </Button>
                      <Button
                        onClick={(e) => handleCancelOrder(e, item)}
                        className="bg-red-500! text-[#ffffff]! border-none! hover:opacity-80"
                      >
                        Bekor qilish
                      </Button>
                    </div>
                  ) : item?.status === "sold" ||
                    item?.status === "cancelled" ? (
                    <div className="ml-9">
                      <Button onClick={(e) => handleRollback(e, item?.id)}>
                        <AlertCircle />
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmPopup
        isShow={isShowModal}
        onCancel={() => setIsShowModal(false)}
        onConfirm={handleConfirm}
        description="Buyurtmani ortga qaytarasizmi?"
      />

      <Popup isShow={isShow} onClose={closePopup}>
        <div className="w-[400px] bg-[#ffffff] shadow-lg rounded-md relative pb-4 px-8">
          <X
            className="absolute top-2.5 right-2.5 cursor-pointer hover:bg-gray-200"
            onClick={closePopup}
          />
          {partleSoldShow && (
            <h2 className="text-center pt-3 text-[20px]">
              Qisman {urlType.current === "sell" ? "sotish" : "bekor qilish"}
            </h2>
          )}
          <div
            className={`space-y-1 pt-${
              partleSoldShow ? 1 : 4
            } text-[16px] text-[#2E263DE5] dark:text-[#E7E3FCE5]`}
          >
            <p>
              <span className="font-semibold">Mijoz ismi:</span>{" "}
              <span>{order.current?.customer?.name || "—"}</span>
            </p>
            <p>
              <span className="font-semibold">Mijoz tel raqami:</span>{" "}
              <span>{order.current?.customer?.phone_number || "—"}</span>
            </p>
            <p>
              <span className="font-semibold">Umumiy summa:</span>{" "}
              <span>
                {order.current?.total_price
                  ? order.current.total_price.toLocaleString("uz-UZ")
                  : "0"}{" "}
                so'm
              </span>
            </p>
          </div>

          {partleSoldShow && (
            <div className="flex flex-col">
              {orderItemInfo.map((item, index) => (
                <div
                  key={item.productId}
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

          <Form initialValues={{}} form={form} onFinish={onFinish}>
            <div className={`pt-${partleSoldShow ? 0 : 3}`}>
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

            <div className="flex justify-between">
              <Button onClick={() => setPartlySoldShow((p) => !p)}>
                <AlertCircle />
              </Button>
              <Button
                disabled={getIsPending()}
                loading={getIsPending()}
                htmlType="submit"
                className={`px-5! py-4! ${
                  urlType.current === "sell"
                    ? "bg-[var(--color-bg-sy)]!"
                    : "bg-red-500!"
                } bg-[var(--color-bg-sy)]! text-[#ffffff]!`}
              >
                {urlType.current === "sell" ? "Sotish" : "Bekor qilish"}
              </Button>
            </div>
          </Form>
        </div>
      </Popup>
    </div>
  ) : (
    <div className="h-[65vh]">
      <EmptyPage />
    </div>
  );
};

export default memo(AllOrders);
