import { memo, useEffect, useState } from "react";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import { Button, Pagination, type PaginationProps } from "antd";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import EmptyPage from "../../../../../shared/components/empty-page";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useParamsHook } from "../../../../../shared/hooks/useParams";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import ConfirmPopup from "../../../../../shared/components/confirmPopup";

const CancelledOrders = () => {
  const { t } = useTranslation("orderList");
  const { t: st } = useTranslation("status");

  const [openPopup, setOpenPopup] = useState(false);

  // Pagination start
  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);

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
  // Pagination end

  const { getCourierOrders } = useOrder();

  const { mutate: cancelPost, isPending } = usePost().canceledPost();
  const search = useSelector((state: RootState) => state.setUserFilter.search);
  const { from, to } = useSelector(
    (state: RootState) => state.dateFilterReducer
  );

  const { data, refetch } = getCourierOrders({
    status: "cancelled",
    search,
    page,
    limit,
    startDate: from,
    endDate: to,
  });
  const total = data?.data?.total || 0;

  useEffect(() => {
    if (search) {
      setParam("page", 1);
    }
  }, [search]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { handleSuccess, handleApiError } = useApiNotification();
  useEffect(() => {
    if (data?.data?.data) {
      setSelectedIds(data?.data?.data?.map((item: any) => item.id));
    }
  }, [data]);
  const handleClick = () => {
    const payload = {
      order_ids: selectedIds,
    };
    cancelPost(payload, {
      onSuccess: () => {
        handleSuccess("Buyurtmalar muvaffaqiyatli qaytarildi");
        refetch();
      },
      onError: (error: any) =>
        handleApiError(
          error,
          "Buyurtmalarni qaytarishda noma'lum xatolik yuz berdi"
        ),
    });
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return data?.data?.data?.length > 0 ? (
    <div>
      <table className="w-full">
        <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5] uppercase">
          <tr>
            {data?.data?.data?.length ? (
              <th className="p-[20px] flex items-center">
                <input
                  type="checkbox"
                  className="w-[18px] h-[18px] rounded-sm"
                  checked={
                    !!data?.data?.data &&
                    selectedIds.length === data?.data?.data?.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(
                        data?.data?.data?.map((item: any) => item.id)
                      );
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              </th>
            ) : (
              ""
            )}
            <th>
              <div
                className={`flex items-center gap-10 pr-7 ${
                  !data?.data?.data?.length ? "pl-7" : ""
                }`}
              >
                <span>#</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("mijoz")}</span>
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
                <span>{t("detail.address")}</span>
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
                <span>{t("delivery")}</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>{t("sana")}</span>
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          {data?.data?.data?.map((item: any, inx: number) => (
            <tr
              key={item?.id}
              onClick={() => toggleSelect(item.id)}
              className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759] cursor-pointer"
            >
              <td className="p-[20px] flex items-center" data-cell="✓">
                <input
                  type="checkbox"
                  className="w-[18px] h-[18px] rounded-sm"
                  checked={item?.id ? selectedIds.includes(item?.id) : false}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds([...selectedIds, item?.id]);
                    } else {
                      setSelectedIds(
                        selectedIds.filter((id) => id !== item?.id)
                      );
                    }
                  }}
                />
              </td>
              <td data-cell="#"> {inx + 1}</td>
              <td
                className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#d5d1eb]"
                data-cell={t("mijoz")}
              >
                {item?.customer?.name}
              </td>
              <td
                className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]"
                data-cell={t("phone")}
              >
                {item?.customer?.phone_number}
              </td>
              <td
                className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#d5d1eb]"
                data-cell={t("detail.address")}
              >
                {item?.customer?.district?.name}
              </td>
              <td
                className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]"
                data-cell={t("market")}
              >
                {item?.market?.name}
              </td>
              <td className="pl-10" data-cell={t("status")}>
                <span className="py-2 px-3 rounded-2xl text-[13px] text-white bg-[#FB2C36]">
                  {st(`${item.status}`)}
                </span>
              </td>
              <td
                className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]"
                data-cell={t("price")}
              >
                {new Intl.NumberFormat("uz-UZ").format(item?.total_price)}
              </td>
              <td
                className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]"
                data-cell={t("delivery")}
              >
                {t(`${item?.where_deliver}`)}
              </td>
              <td
                className="pl-5 text-[#2E263DB2] text-[15px] dark:text-[#d5d1eb]"
                data-cell={t("sana")}
              >
                {new Date(Number(item?.created_at))
                  .toISOString()
                  .substring(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-center mb-5">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
        />
      </div>

      <div className="flex justify-end px-5 mb-5 max-[650px]:w-full">
        <Button
          disabled={isPending}
          loading={isPending}
          onClick={() => setOpenPopup(true)}
          className="w-[180px]! max-[650px]:w-full! h-[37px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! text-[15px]! border-none! hover:opacity-85!"
        >
          {t("send")}
        </Button>
      </div>
      {openPopup && (
        <ConfirmPopup
          isShow={openPopup}
          title="Buyurtmalarni pochtaga qo'shishni tasdiqlaysizmi?"
          description="Ushbu amalni ortga qaytarib bo‘lmaydi."
          confirmText="Ha"
          cancelText="Bekor qilish"
          onConfirm={() => {
            handleClick(); // Tasdiqlaganda funksiyani chaqiramiz
            setOpenPopup(false); // Popup yopiladi
          }}
          onCancel={() => setOpenPopup(false)} // Bekor qilganda yopiladi
        />
      )}
    </div>
  ) : (
    <div className="h-[65vh]">
      <EmptyPage />
    </div>
  );
};

export default memo(CancelledOrders);
