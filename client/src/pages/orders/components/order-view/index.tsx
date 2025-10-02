import { memo, useEffect } from "react";
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

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  received: "bg-green-500",
  "on the road": "bg-yellow-500",
  waiting: "bg-orange-500",
  sold: "bg-purple-500",
  cancelled: "bg-red-500",
  paid: "bg-cyan-500",
  partly_paid: "bg-pink-500",
  "cancelled (sent)": "bg-gray-500",
  closed: "bg-black",
};

const statusLabels: Record<string, string> = {
  new: "Yangi",
  received: "Qabul qilingan",
  "on the road": "Yo‘lda",
  waiting: "Kutilmoqda",
  sold: "Sotilgan",
  cancelled: "Bekor qilingan",
  paid: "To‘langan",
  partly_paid: "Qisman to‘langan",
  "cancelled (sent)": "Bekorlangan jo‘natma",
  closed: "Yopilgan",
};

const OrderView = () => {
  const { t } = useTranslation("orderList");
  const navigate = useNavigate();

  const { getOrders, getMarketsByMyNewOrders } = useOrder();
  const user = useSelector((state: RootState) => state.roleSlice);
  const filters = useSelector((state: RootState) => state.setFilter);
  const role = user.role;
  let query;

  const cleanObject = (obj: Record<string, any>) => {
    return Object.fromEntries(
      Object.entries(obj).filter(
        ([_, v]) => v !== "" && v !== null && v !== undefined
      )
    );
  };

  const cleanedFilters = cleanObject(filters);

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);

  switch (role) {
    case "superadmin":
      query = getOrders({ page, limit, ...cleanedFilters });
      break;
    case "admin":
      query = getOrders({ page, limit, ...filters });
      break;
    case "registrator":
      query = getOrders({ page, limit, ...filters });
      break;
    case "market":
      query = getMarketsByMyNewOrders({ page, limit, ...cleanedFilters });
      break;
    default:
      query = { data: { data: [] } };
  }

  const { data, isLoading } = query;
  const myNewOrders = Array.isArray(data?.data?.data) ? data?.data?.data : [];
  const total = data?.data?.total || 0;

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

  const dispatch = useDispatch();
  const triggerDownload = useSelector(
    (state: RootState) => state.requestDownload
  );

  const { handleApiError, handleSuccess } = useApiNotification();
  useEffect(() => {
    const downloadExcel = async () => {
      try {
        const isFiltered = Object.keys(cleanedFilters).length > 0;

        const response = await fetch(
          `${BASE_URL}order?page=1&limit=0&${new URLSearchParams(
            cleanedFilters
          )}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("x-auth-token")}`,
            },
          }
        );

        const rawText = await response.text();

        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error("❌ Backend JSON emas, HTML qaytaryapti!");
        }
        const orders = data?.data?.data;
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

    if (triggerDownload.triggerDownload) {
      downloadExcel();
    }
  }, [triggerDownload, dispatch]);
  return (
    <div className="w-full bg-white py-1 dark:bg-[#312d4b] min-[650px]:overflow-x-auto">
      <table className="w-full border border-gray-200 shadow-sm">
        <thead className="bg-[#9d70ff] min-[900px]:h-[56px] text-[16px] text-white text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
          <tr>
            <th>
              <div className="flex items-center ml-10">
                <span>#</span>
              </div>
            </th>

            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("customer")}</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("phone")}</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("region")}</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("district")}</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("market")}</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("status")}</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("price")}</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("stock")}</span>
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
          </tr>
        </thead>
        {isLoading ? (
          <TableSkeleton rows={10} columns={8} />
        ) : (
          <tbody>
            {myNewOrders?.map((item: any, inx: number) => (
              <tr
                key={item.id}
                className={`h-[56px] cursor-pointer hover:bg-[#f6f7fb9f] dark:hover:bg-[#3d3759] font-medium dark:text-[#d5d1eb] text-[#2E263DE5] text-[16px]
                  ${
                    inx % 2 === 0
                      ? "bg-white dark:bg-[#2a243a]"
                      : "bg-[#aa85f818] dark:bg-[#342d4a]"
                  }
                `}
                onClick={() => navigate(`order-detail/${item.id}`)}
              >
                <td className="data-cell pl-10" data-cell="#">
                  {inx + 1}
                </td>
                <td
                  className="data-cell pl-10  dark:text-[#d5d1eb]"
                  data-cell="CUSTOMER"
                >
                  {item?.customer?.name}
                </td>
                <td className="data-cell pl-10" data-cell="PHONE">
                  {item?.customer?.phone_number}
                </td>
                <td className="data-cell pl-10" data-cell="REGION">
                  {item?.customer?.district?.name}
                </td>
                <td className="data-cell pl-10" data-cell="DISTRICT">
                  {item?.customer?.district?.name}
                </td>
                <td className="data-cell pl-10" data-cell="MARKET">
                  {item?.market?.name}
                </td>
                <td className="data-cell pl-10" data-cell="STATUS">
                  <span
                    className={`py-2 px-3 rounded-2xl text-[13px] text-white ${
                      statusColors[item?.status] || "bg-gray-400"
                    }`}
                  >
                    {statusLabels[item?.status] || item?.status}
                  </span>
                </td>
                <td className="data-cell pl-10" data-cell="PRICE">
                  <span>
                    {new Intl.NumberFormat("uz-UZ").format(item?.total_price)}{" "}
                  </span>
                </td>
                <td
                  className="data-cell pl-15 text-[15px] text-[#2E263DB2]"
                  data-cell="STOCK"
                >
                  {item?.items.length}
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
