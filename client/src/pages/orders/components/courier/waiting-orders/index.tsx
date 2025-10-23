import { memo, useEffect, useRef, useState, type MouseEvent } from "react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import EmptyPage from "../../../../../shared/components/empty-page";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Pagination,
  Select,
  type FormProps,
  type PaginationProps,
} from "antd";
import { useNavigate } from "react-router-dom";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import Popup from "../../../../../shared/ui/Popup";
import { AlertCircle, Minus, Plus, X } from "lucide-react";
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
  const { t:st } = useTranslation("status");

  const navigate = useNavigate();
  const order = useRef<any | null>(null);
  const urlType = useRef<string | null>(null);

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);
  const { getCourierOrders, sellOrder, cancelOrder, partlySellOrder } =
    useOrder();
  const search = useSelector((state: RootState) => state.setUserFilter.search);
  const { data } = getCourierOrders({ status: "waiting", search, page, limit });
  const total = data?.data?.total || 0;

  const [form] = Form.useForm<FieldType>();
  const { handleSuccess, handleApiError, handleWarning } = useApiNotification();

  const [isShow, setIsShow] = useState<boolean>(false);
  const [partleSoldShow, setPartlySoldShow] = useState<boolean>(false);
  const [orderItemInfo, setOrderItemInfo] = useState<any[]>([]);
  const [totalPrice, setTotalPrice] = useState<number | string>("");

  const closePopup = () => {
    setIsShow(false);
    setPartlySoldShow(false);
    form.resetFields(); // 🔹 Formani tozalaydi
    setTotalPrice("");
    setOrderItemInfo([]);
  };

  const onFinish: FormProps<FieldType>["onFinish"] = (values) => {
    const item = order.current;
    const type = urlType.current;

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
          totalPrice: Number(String(totalPrice).split(",").join("")),
          extraCost: Number(values?.extraCost),
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
        sellOrder.mutate(
          { id: item?.id as string, data: values },
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
          totalPrice: Number(String(totalPrice).split(",").join("")),
          extraCost: Number(values?.extraCost),
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
        cancelOrder.mutate(
          { id: item?.id as string, data: values },
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
    form.resetFields(); // 🔹 yangi buyurtma ochilganda formani tozalaydi
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

  return data?.data?.data?.length > 0 ? (
    <div>
      <table className="w-full">
        <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5] uppercase">
          <tr>
            <th>#</th>
            <th>{t("mijoz")}</th>
            <th>{t("phone")}</th>
            <th>{t("detail.address")}</th>
            <th>{t("market")}</th>
            <th>{t("status")}</th>
            <th>{t("price")}</th>
            <th>{t("stock")}</th>
            <th>{t("harakat")}</th>
          </tr>
        </thead>
        <tbody>
          {data?.data?.data?.map((item: any, inx: number) => (
            <tr
              onClick={() => navigate(`/orders/order-detail/${item.id}`)}
              key={item?.id}
              className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759] cursor-pointer"
            >
              <td className="pl-10">{inx + 1}</td>
              <td className="pl-10">{item?.customer?.name}</td>
              <td className="pl-10">{item?.customer?.phone_number}</td>
              <td className="pl-10">{item?.customer?.district?.name}</td>
              <td className="pl-10">{item?.market?.name}</td>
              <td className="pl-10">
                <span className="py-2 px-3 rounded-2xl text-[13px] text-white bg-orange-500">
                  {st(`${item.status}`)}
                </span>
              </td>
              <td className="pl-10">
                {new Intl.NumberFormat("uz-UZ").format(item?.total_price)}
              </td>
              <td className="pl-15">{item?.items.length}</td>
              <td>
                <div className="flex gap-3">
                  <Button
                    onClick={(e) => handleSellOrder(e, item)}
                    className="bg-[var(--color-bg-sy)]! text-[#ffffff]! border-none!"
                  >
                    {t("sotish")}
                  </Button>
                  <Button
                    onClick={(e) => handleCancelOrder(e, item)}
                    className="bg-red-500! text-[#ffffff]! border-none!"
                  >
                    {t("detail.cancel")}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-center pt-5 pb-5">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
        />
      </div>

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
              {order.current?.customer?.name || "—"}
            </p>
            <p>
              <span className="font-semibold">Tel raqam:</span>{" "}
              {order.current?.customer?.phone_number || "—"}
            </p>
            <p>
              <span className="font-semibold">Umumiy summa:</span>{" "}
              {order.current?.total_price
                ? order.current.total_price.toLocaleString("uz-UZ")
                : "0"}{" "}
              so'm
            </p>
          </div>

          {partleSoldShow && (
            <div className="flex flex-col">
              {orderItemInfo.map((item, index) => (
                <div
                  key={item.product_id}
                  className="pt-4 flex gap-10 justify-between"
                >
                  <Form.Item className="flex-1!">
                    <Select
                      className="!h-[40px]"
                      value={item.product_id}
                      disabled
                      options={[{ label: item.name, value: item.product_id }]}
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
                        if (updated[index].quantity > 0)
                          updated[index].quantity -= 1;
                        setOrderItemInfo(updated);
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
                    const raw = e.target.value.replace(/\D/g, "");
                    const formatted = new Intl.NumberFormat("uz-UZ").format(
                      Number(raw || 0)
                    );
                    setTotalPrice(formatted);
                  }}
                />
              </Form.Item>
            </div>
          )}

          <Form form={form} onFinish={onFinish}>
            <div>
              <Form.Item name="extraCost" className="py-4!">
                <span>Qo'shimcha (pul)</span>
                <InputNumber
                  placeholder="Qo'shimcha pul"
                  className="h-[40px]! w-full!"
                  formatter={(v) =>
                    v ? v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""
                  }
                  parser={(v) => v?.replace(/,/g, "") || ""}
                />
              </Form.Item>
            </div>

            <div className={`pt-${partleSoldShow ? 0 : 3}`}>
              <Form.Item name="comment">
                <span>Izoh</span>
                <Input.TextArea
                  className="py-4!"
                  placeholder="Izoh qoldiring (ixtiyoriy)"
                  style={{ resize: "none" }}
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
                } text-[#ffffff]!`}
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

export default memo(WaitingOrders);
