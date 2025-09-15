import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { createContext, memo, useMemo } from "react";
import Select from "../../components/select/select";
import SearchInput from "../../../users/components/search-input";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { Button } from "antd";
import useNotification from "antd/es/notification/useNotification";

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
        <div className="flex justify-between px-5 pt-5 pb-7">
          <div className="flex gap-5">
            <Select
              name="from"
              //   value={form.from}
              //   onChange={handleChange}
              placeholder="From"
              className="w-[150px]"
            >
              {/* {marketOptions} */}
            </Select>

            <Select
              name="to"
              //   value={form.to}
              //   onChange={handleChange}
              placeholder="To"
              className="w-[180px]"
            >
              {/* {regionOptions} */}
            </Select>
          </div>
          <div>
            <SearchInput placeholder="Buyurtmani qidirish..." />
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
            <tr>
              <th>
                <div className="flex items-center gap-10 ml-10">
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
                <div className="flex items-center gap-30">
                  <span>ACTIONS</span>
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((item: any, inx: number) => (
              <tr
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
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                  {item?.items.length}
                </td>
                <td className="text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]">
                  {item?.status === "sold" || item?.status === "cancelled" ? (
                    <Button>
                      <AlertCircle />
                    </Button>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleSellOrder(item?.id)}
                        className="bg-[var(--color-bg-sy)]! text-[#ffffff]! border-none! hover:opacity-80"
                      >
                        Sotish
                      </Button>
                      <Button
                        onClick={() => handleCancelOrder(item?.id)}
                        className="bg-red-500! text-[#ffffff]! border-none! hover:opacity-80"
                      >
                        Bekor qilish
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end items-center pr-[105px] pt-4 gap-6 pb-[16px]">
          <div className="flex items-center">
            <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
              Rows per page:
            </span>
            <select
              className="rounded px-2 py-1 text-[15px] outline-none"
              defaultValue="10"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="flex items-center font-normal text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            <span className="mr-1">1-5</span>
            <span className="mr-1">of</span>
            <span className="">13</span>
          </div>

          <div className="flex items-center gap-[23px]">
            <ChevronLeft className="w-5 h-5 cursor-pointer text-gray-600 dark:text-[#E7E3FCE5] hover:opacity-75" />
            <ChevronRight className="w-5 h-5 cursor-pointer text-gray-600 dark:text-[#E7E3FCE5] hover:opacity-75" />
          </div>
        </div>
      </div>
    </Context.Provider>
  );
};

export default memo(CourierOrders);
