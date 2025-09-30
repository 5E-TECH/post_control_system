import { memo } from "react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import EmptyPage from "../../../../../shared/components/empty-page";
import { Button, Pagination, type PaginationProps } from "antd";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useNavigate } from "react-router-dom";
import { useParamsHook } from "../../../../../shared/hooks/useParams";

const WaitingOrders = () => {
  const navigate = useNavigate();

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);
  const { getCourierOrders, sellOrder, cancelOrder } = useOrder();
  const { data } = getCourierOrders({ status: "waiting" });
  const total = data?.data?.total || 0;

  const { handleSuccess, handleApiError } = useApiNotification();
  const handleSellOrder = (id: string) => {
    sellOrder.mutate(
      { id, data: {} },
      {
        onSuccess: () => {
          handleSuccess("Buyurtma muvaffaqiyatli sotildi");
        },
        onError: (err: any) =>
          handleApiError(err, "Buyurtmani sotishda xatolik yuz berdi"),
      }
    );
  };

  const handleCancelOrder = (id: string) => {
    cancelOrder.mutate(
      { id, data: {} },
      {
        onSuccess: () => {
          handleSuccess("Buyurtma muvaffaqiyatli bekor qilindi");
        },
        onError: (err: any) =>
          handleApiError(err, "Buyurtmani bekor qilishda xatolik yuz berdi"),
      }
    );
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
                <span>CUSTOMER</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>PHONE</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>ADDRESS</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>MARKET</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>STATUS</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>PRICE</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>STOCK</span>
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th>
              <div className="flex items-center justify-center gap-30">
                <span>ACTIONS</span>
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
                    onClick={() => handleSellOrder(item?.id)}
                    className="bg-[var(--color-bg-sy)]! text-[#ffffff]! border-none! hover:opacity-80"
                  >
                    Sotish
                  </Button>
                  <Button
                    disabled={cancelOrder.isPending}
                    loading={cancelOrder.isPending}
                    onClick={() => handleCancelOrder(item?.id)}
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

      <div className="flex justify-center">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
        />
      </div>
    </div>
  ) : (
    <div className="h-[65vh]">
      <EmptyPage />
    </div>
  );
};

export default memo(WaitingOrders);
