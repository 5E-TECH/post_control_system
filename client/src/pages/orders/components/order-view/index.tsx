import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { useDispatch, useSelector } from "react-redux";
import TableSkeleton from "../ordersTabelSkeleton/ordersTableSkeleton";
import { Pagination, type PaginationProps } from "antd";
import { useParamsHook } from "../../../../shared/hooks/useParams";
import { useTranslation } from "react-i18next";
import type { RootState } from "../../../../app/store";
import { exportToExcel } from "../../../../shared/helpers/export-download-excel";
import { resetDownload } from "../../../../shared/lib/features/excel-download-func/excelDownloadFunc";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { BASE_URL } from "../../../../shared/const";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";

const statusColors: Record<string, string> = {
  new: "bg-sky-500",
  received: "bg-green-600",
  "on the road": "bg-amber-500",
  waiting: "bg-orange-400",
  sold: "bg-violet-600",
  cancelled: "bg-red-600",
  paid: "bg-emerald-500",
  partly_paid: "bg-teal-500",
  "cancelled (sent)": "bg-gray-500",
  closed: "bg-zinc-800",
};

const statusLabels: Record<string, string> = {
  new: "Yangi",
  received: "Qabul qilingan",
  "on the road": "Yo'lda",
  waiting: "Kutilmoqda",
  sold: "Sotilgan",
  cancelled: "Bekor qilingan",
  paid: "To'langan",
  partly_paid: "Qisman to'langan",
  "cancelled (sent)": "Bekorlangan jo'natma",
  closed: "Yopilgan",
};

const OrderView = () => {
  const { t } = useTranslation("orderList");
  const { t: st } = useTranslation("status");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { getOrders } = useOrder();
  const { getMarketsAllNewOrder } = useMarket();

  const user = useSelector((state: RootState) => state.roleSlice);
  const filters = useSelector((state: RootState) => state.setFilter);
  const triggerDownload = useSelector(
    (state: RootState) => state.requestDownload
  );
  const { handleApiError, handleSuccess } = useApiNotification();
  const role = user.role;

  const { getParam, setParam, removeParam } = useParamsHook();
  const limit = Number(getParam("limit") || 10);

  // page state
  const [page, setPage] = useState<number>(Number(getParam("page") || 1));

  const cleanObject = (obj: Record<string, any>) =>
    Object.fromEntries(
      Object.entries(obj).filter(
        ([_, v]) => v !== "" && v !== null && v !== undefined
      )
    );

  const cleanedFilters = cleanObject(filters);

  // filter o'zgarganda sahifa 1 ga tushadi
  useEffect(() => {
    setPage(1);
    setParam("page",1);
  }, [JSON.stringify(cleanedFilters)]);

  // page o'zgarganda URL-ni yangilaymiz
  useEffect(() => {
    page === 1 ? removeParam("page") : setParam("page", page);
  }, [page]);

  // query
  const queryParams = { page, limit, ...cleanedFilters };


  const { data, refetch, isLoading } =
    role === "market"
      ? getMarketsAllNewOrder(queryParams)
      : getOrders(queryParams);

  useEffect(() => {
    if (role === "market") refetch();
  }, [role]);

  const myNewOrders = Array.isArray(data?.data?.data) ? data?.data?.data : [];
  const total = data?.data?.total;
  console.log('total',total);
  

  // pagination onChange
  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    setPage(newPage);
    if (newLimit !== limit) setParam("limit", newLimit);
  };

  // Excel yuklash
  // const user = useSelector((state: RootState) => state.roleSlice);

  useEffect(() => {
    const downloadExcel = async () => {
      try {
        const isFiltered = Object.keys(cleanedFilters).length > 0;

        // 🔥 URL ni rolga qarab belgilaymiz
        let url = `${BASE_URL}order`;
        if (user?.role === "market") {
          url = `${BASE_URL}order/market/all/my-orders`;
        } else if (user?.role === "courier") {
          url = `${BASE_URL}order/courier/orders`;
        }

        const response = await fetch(
          `${url}?page=1&limit=0&${new URLSearchParams(cleanedFilters)}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("x-auth-token")}`,
            },
          }
        );

        console.log("response", response);

        const rawText = await response.text();
        console.log("rawtext", rawText);

        let data;
        try {
          data = JSON.parse(rawText);
          console.log("Data", data);
        } catch {
          throw new Error("❌ Backend JSON emas, HTML qaytaryapti!");
        }

        const orders = data?.data?.data;
        console.log("orders", orders);

        const exportData = orders?.map((order: any, inx: number) => ({
          N: inx + 1,
          Viloyat: order?.customer?.district?.region?.name,
          Tuman: order?.customer?.district?.name,
          Firma: order?.market?.name,
          Mahsulot: order?.items
            ?.map((item: any) => item.product.name)
            ?.join(", "),
          "Telefon raqam": order?.customer?.phone_number,
          Narxi: Number((order?.total_price ?? 0) / 1000),
          Holati: statusLabels[order?.status],
          Sana: new Date(Number(order?.created_at)).toLocaleString("uz-UZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));

        exportToExcel(
          exportData || [],
          isFiltered ? "filterlangan_buyurtmalar" : "barcha_buyurtmalar"
        );

        handleSuccess("Buyurtmalar muvaffaqiyatli export qilindi");
      } catch (err) {
        handleApiError(err, "Excel yuklashda xatolik");
      } finally {
        dispatch(resetDownload());
      }
    };

    if (triggerDownload.triggerDownload) downloadExcel();
  }, [triggerDownload, dispatch, cleanedFilters, user?.role]);

  return (
    <div className="w-full bg-white py-1 dark:bg-[#312d4b] min-[650px]:overflow-x-auto">
      <table className="w-full border-gray-200 shadow-sm">
        <thead className="bg-[#9d70ff] min-[900px]:h-[56px] text-[16px] text-white text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
          <tr>
            {[
              "#",
              t("customer"),
              t("phone"),
              t("region"),
              t("district"),
              t("market"),
              t("status"),
              t("price"),
              t("createdAt"),
            ].map((header, idx) => (
              <th key={idx}>
                <div className="flex items-center gap-2 pl-10">
                  {idx !== 0 && (
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  )}
                  <span>{header}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        {isLoading ? (
          <TableSkeleton rows={10} columns={8} />
        ) : (
          <tbody>
            {myNewOrders?.map((item: any, inx: number) => (
              <tr
                key={item.id}
                className={`h-[56px] cursor-pointer hover:bg-[#f6f7fb9f] dark:hover:bg-[#3d3759] font-medium dark:text-[#d5d1eb] text-[#2E263DE5] text-[16px] ${
                  inx % 2 === 0
                    ? "bg-white dark:bg-[#2a243a]"
                    : "bg-[#aa85f818] dark:bg-[#342d4a]"
                }`}
                onClick={() => navigate(`order-detail/${item.id}`)}
              >
                <td className="pl-10" data-cell="#">
                  {" "}
                  {inx + 1}
                </td>
                <td className="pl-10" data-cell={t("customer")}>
                  {item?.customer?.name}
                </td>
                <td className="pl-10" data-cell={t("phone")}>
                  {item?.customer?.phone_number
                    ? `${item?.customer.phone_number
                        .replace(/\D/g, "")
                        .replace(
                          /^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/,
                          "+$1 $2 $3 $4 $5"
                        )}`
                    : ""}
                </td>
                <td className="pl-10" data-cell={t("region")}>
                  {item?.customer?.district?.region?.name}
                </td>
                <td className="pl-10" data-cell={t("district")}>
                  {item?.customer?.district?.name}
                </td>
                <td className="pl-10" data-cell={t("market")}>
                  {item?.market?.name}
                </td>
                <td className="pl-10" data-cell={t("status")}>
                  <span
                    className={`py-2 px-3 rounded-2xl text-[13px] text-white ${
                      statusColors[item?.status] || "bg-gray-400"
                    }`}
                  >
                    {st(`${item?.status}`)}
                  </span>
                </td>
                <td className="pl-10" data-cell={t("price")}>
                  {new Intl.NumberFormat("uz-UZ").format(item?.total_price)}
                </td>
                <td className="pl-10" data-cell={t("createdAt")}>
                  {(() => {
                    const date = new Date(Number(item?.created_at));
                    const day = String(date.getDate()).padStart(2, "0");
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const year = date.getFullYear();
                    const hours = String(date.getHours()).padStart(2, "0");
                    const minutes = String(date.getMinutes()).padStart(2, "0");

                    return `${day}-${month}-${year} ${hours}:${minutes}`;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
      <div className="flex justify-center mt-3">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default memo(OrderView);
