import { memo, useRef, useState, type MouseEvent } from "react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import EmptyPage from "../../../../../shared/components/empty-page";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Pagination,
  type FormProps,
  type PaginationProps,
} from "antd";
// import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useNavigate } from "react-router-dom";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import Popup from "../../../../../shared/ui/Popup";
import { X } from "lucide-react";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";

type FieldType = {
  comment?: string;
  extraCost?: number;
};

const WaitingOrders = () => {
  const navigate = useNavigate();
  const orderId = useRef<string | null>(null);
  const urlType = useRef<string | null>(null);

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);
  const { getCourierOrders, sellOrder, cancelOrder } = useOrder();
  const { data } = getCourierOrders({ status: "waiting" });
  const total = data?.data?.total || 0;

  const [form] = Form.useForm<FieldType>();
  const { handleSuccess, handleApiError } = useApiNotification();
  const onFinish: FormProps<FieldType>["onFinish"] = (values) => {
    const id = orderId.current;
    const type = urlType.current;

    if (type === "sell") {
      sellOrder.mutate(
        { id: id as string, data: values },
        {
          onSuccess: () => {
            setIsShow(false);
            handleSuccess("Buyurtma muvaffaqiyatli sotildi");
          },
          onError: (err: any) =>
            handleApiError(err, "Buyurtmani sotishda xatolik yuz berdi"),
        }
      );
    } else {
      cancelOrder.mutate(
        { id: id as string, data: values },
        {
          onSuccess: () => {
            setIsShow(false);
            handleSuccess("Buyurtma muvaffaqiyatli bekor qilindi");
          },
          onError: (err: any) =>
            handleApiError(err, "Buyurtmani bekor qilishda xatolik yuz berdi"),
        }
      );
    }
  };
  const handleSellOrder = (
    e: MouseEvent<HTMLButtonElement | HTMLElement>,
    id: string
  ) => {
    e.stopPropagation();
    orderId.current = id;
    urlType.current = "sell";
    setIsShow(true);
  };

  const handleCancelOrder = (
    e: MouseEvent<HTMLButtonElement | HTMLElement>,
    id: string
  ) => {
    e.stopPropagation();
    orderId.current = id;
    urlType.current = "cancel";
    setIsShow(true);
  };

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

  const [isShow, setIsShow] = useState(false);

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
                <span>MAZNIL</span>
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
          {data?.data?.data?.map((item: any, inx: number) => (
            <tr
              onClick={() => navigate(`/orders/order-detail/${item.id}`)}
              key={item?.id}
              className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759] cursor-pointer"
            >
              <td className="data-cell pl-10" data-cell="#">
                {inx + 1}
              </td>
              <td
                className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#d5d1eb]"
                data-cell="MIJOZ ISMI"
              >
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
                <span className="py-2 px-3 rounded-2xl text-[13px] text-white bg-orange-500">
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
                <div className="flex gap-3">
                  <Button
                    disabled={sellOrder.isPending}
                    loading={sellOrder.isPending}
                    onClick={(e) => handleSellOrder(e, item?.id)}
                    className="bg-[var(--color-bg-sy)]! text-[#ffffff]! border-none! hover:opacity-80"
                  >
                    Sotish
                  </Button>
                  <Button
                    disabled={cancelOrder.isPending}
                    loading={cancelOrder.isPending}
                    onClick={(e) => handleCancelOrder(e, item?.id)}
                    className="bg-red-500! text-[#ffffff]! border-none! hover:opacity-80"
                  >
                    Bekor qilish
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-center pt-5">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
        />
      </div>
      <Popup isShow={isShow} onClose={() => setIsShow(false)}>
        <div className="w-[400px] bg-[#ffffff] shadow-lg rounded-md relative pb-4">
          <X
            className="absolute top-2.5 right-2.5 cursor-pointer hover:bg-gray-200"
            onClick={() => setIsShow(false)}
          />

          <Form
            initialValues={{}}
            form={form}
            onFinish={onFinish}
            className="px-8!"
          >
            <div className="pt-10">
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

            <div className="flex justify-center">
              <Button
                htmlType="submit"
                className="px-5! py-4! bg-[var(--color-bg-sy)]! text-[#ffffff]!"
              >
                Tasdiqlash
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
