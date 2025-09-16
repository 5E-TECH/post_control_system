import { createContext, memo, useMemo } from "react";
import Select from "../../components/select/select";
import SearchInput from "../../../users/components/search-input";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import useNotification from "antd/es/notification/useNotification";
import { NavLink, Outlet } from "react-router-dom";

const Context = createContext({ name: "Default" });

const CourierOrders = () => {
  const { getCourierOrders, sellOrder, cancelOrder } = useOrder();
  const { data } = getCourierOrders();
  const orders = data?.data;

  const [api, contextHolder] = useNotification();

  const handleSellOrder = (id: string) => {
    sellOrder.mutate(
      { id, data: {} },
      {
        onSuccess: () => {
          api.success({
            message: "✅ Buyurtma muvaffaqiyatli sotildi",
            placement: "topRight",
          });
        },
        onError: (err: any) => {
          let description = "Xatolik yuz berdi, keyinroq urinib ko‘ring.";

          if (err?.response?.status === 400) {
            description = "Noto‘g‘ri so‘rov yuborildi.";
          } else if (err?.response?.status === 401) {
            description =
              "Avtorizatsiya xatosi. Iltimos, qayta tizimga kiring.";
          } else if (err?.response?.status === 403) {
            description = "Sizda bu amalni bajarishga ruxsat yo‘q.";
          } else if (err?.response?.status === 404) {
            description = "Buyurtma topilmadi.";
          } else if (err?.response?.status === 409) {
            description = "Bu buyurtma allaqachon sotilgan yoki mavjud emas.";
          } else if (err?.response?.status === 500) {
            description = "Serverda nosozlik, keyinroq urinib ko‘ring.";
          } else {
            description = err?.response?.data?.message || description;
          }

          api.error({
            message: "Buyurtmani sotishda xatolik",
            description,
            placement: "topRight",
          });
        },
      }
    );
  };

  const handleCancelOrder = (id: string) => {
    cancelOrder.mutate(
      { id, data: {} },
      {
        onSuccess: () => {
          api.success({
            message: "✅ Buyurtma muvaffaqiyatli bekor qilindi",
            placement: "topRight",
          });
        },
        onError: (err: any) => {
          let description = "Xatolik yuz berdi, keyinroq urinib ko‘ring.";

          if (err?.response?.status === 400) {
            description = "Noto‘g‘ri so‘rov yuborildi.";
          } else if (err?.response?.status === 401) {
            description =
              "Avtorizatsiya xatosi. Iltimos, qayta tizimga kiring.";
          } else if (err?.response?.status === 403) {
            description = "Sizda bu amalni bajarishga ruxsat yo‘q.";
          } else if (err?.response?.status === 404) {
            description = "Buyurtma topilmadi.";
          } else if (err?.response?.status === 409) {
            description = "Buyurtma allaqachon bekor qilingan.";
          } else if (err?.response?.status === 500) {
            description = "Serverda nosozlik, keyinroq urinib ko‘ring.";
          } else {
            description = err?.response?.data?.message || description;
          }

          api.error({
            message: "Buyurtmani bekor qilishda xatolik",
            description,
            placement: "topRight",
          });
        },
      }
    );
  };

  const contextValue = useMemo(() => ({ name: "Ant Design" }), []);

  return (
    <Context.Provider value={contextValue}>
      {contextHolder}
      <div className="w-full bg-white py-5 dark:bg-[#312d4b]">
        <h1 className="font-medium text-[20px] text-[#2E263DE5] dark:text-[#D4D0E9] px-5">
          Bugungi buyurtmalar
        </h1>

        <div className="flex justify-between px-5 pt-5 pb-7 items-center">
          <div className="flex gap-5">
            <Select
              name="from"
              placeholder="From"
              className="w-[150px]"
            ></Select>

            <Select name="to" placeholder="To" className="w-[180px]"></Select>
          </div>

          <div className="flex gap-6">
            <NavLink
              end
              to="/courier-orders/orders"
              className={({ isActive }) =>
                `text-md font-medium transition duration-200 ${
                  isActive
                    ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
                    : "text-[#2E263DB2] hover:text-[#5A48FA]"
                } pb-1`
              }
            >
              Kutilayotgan buyurtmalar
            </NavLink>

            <NavLink
              to="/courier-orders/orders/all"
              className={({ isActive }) =>
                `text-md font-medium transition duration-200 ${
                  isActive
                    ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
                    : "text-[#2E263DB2] hover:text-[#5A48FA]"
                } pb-1`
              }
            >
              Hamma buyurtmalar
            </NavLink>

            <NavLink
              to="/courier-orders/orders/cancelled"
              className={({ isActive }) =>
                `text-md font-medium transition duration-200 ${
                  isActive
                    ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
                    : "text-[#2E263DB2] hover:text-[#5A48FA]"
                } pb-1`
              }
            >
              Bekor qilingan buyurtmalar
            </NavLink>
          </div>

          <div>
            <SearchInput placeholder="Buyurtmani qidirish..." />
          </div>
        </div>

        <Outlet />
      </div>
    </Context.Provider>
  );
};

export default memo(CourierOrders);
