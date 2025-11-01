import { Edit, Trash } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { usePost } from "../../../../shared/api/hooks/usePost";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import ConfirmPopup from "../../../../shared/components/confirmPopup";
import { useGlobalScanner } from "../../../../shared/components/global-scanner";
import { useTranslation } from "react-i18next";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import EmptyPage from "../../../../shared/components/empty-page";
import Skeleton from "../../components/search/skeleton";

const OrderView = () => {
  useGlobalScanner();
  const { t } = useTranslation("todayOrderList");
  const { t: st } = useTranslation("status");

  // useEffect(() => {
  //   const blockScanner = (e: KeyboardEvent) => {
  //     e.preventDefault(); // ❌ hech narsa bajarilmaydi
  //     e.stopPropagation(); // ❌ boshqa joyga o‘tmaydi
  //   };

  //   window.addEventListener("keydown", blockScanner, true);
  //   window.addEventListener("keypress", blockScanner, true);

  //   return () => {
  //     window.removeEventListener("keydown", blockScanner, true);
  //     window.removeEventListener("keypress", blockScanner, true);
  //   };
  // }, []);

  const { id } = useParams();
  const user = useSelector((state: RootState) => state.roleSlice);
  const [deleteId, setDeleteId] = useState("");
  const [isPrintDisabled, setIsPrintDisabled] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const navigate = useNavigate();
  const [_, setOpenMenuId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchData, setSearch] = useState<any>(null);
  const { getOrderByMarket, getMarketsByMyNewOrders, deleteOrders } =
    useOrder();

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearch(value);
      }, 500),
    []
  );

  const params = searchData ? { search: searchData, limit: 0 } : { limit: 0 };
  const { createPost, createPrint } = usePost();
  const { data, refetch, isLoading } =
    user.role === "market"
      ? getMarketsByMyNewOrders(params)
      : getOrderByMarket(id, params);

  useEffect(() => {
    if (data?.data?.total === 0 && searchData == null) {
      navigate(-1);
    }
  }, [data]);

  useEffect(() => {
    if (data?.data?.data) {
      setSelectedIds(data.data?.data?.map((item: any) => item.id));
    }
  }, [data]);

  const { handleApiError, handleSuccess } = useApiNotification();

  const hanlerDelete = (id: string) => {
    deleteOrders.mutate(id, {
      onSuccess: () => {
        handleSuccess("Order muvaffaqiyatli o'chirildi");
      },
      onError: (err: any) => {
        handleApiError(err, "Orderni o'chirishda xatolik yuz ber");
      },
    });
  };
  // const handlePrint = () => {
  //   const orderids = {
  //     orderIds: selectedIds,
  //   };
  //   createPrint.mutate(orderids, {
  //     onSuccess: () => {
  //       handleSuccess("Chop etildi");
  //     },
  //     onError: (err: any) => {
  //       handleApiError(err, "Chop etishda hatolik yuz berdi");
  //     },
  //   });
  // };

  const handlePrint = () => {
    if (isPrintDisabled) return; // 🔒 agar allaqachon bosilgan bo‘lsa, qaytadi

    setIsPrintDisabled(true); // ⛔ bosilgandan so‘ng tugma bloklanadi

    const orderids = { orderIds: selectedIds };
    createPrint.mutate(orderids, {
      onSuccess: () => {
        handleSuccess("Chop etildi");
      },
      onError: (err: any) => {
        handleApiError(err, "Chop etishda hatolik yuz berdi");
      },
      onSettled: () => {
        setTimeout(() => setIsPrintDisabled(false), 10000); // ⏳ 10 soniyadan keyin qayta yoqiladi
      },
    });
  };

  const handleAccapted = () => {
    const newOrder = {
      order_ids: selectedIds,
    };

    createPost.mutate(newOrder, {
      onSuccess: () => {
        if (selectedIds.length !== data?.data?.data.length) {
          refetch();
        } else {
          setSelectedIds([]);
          navigate("/order/markets/new-orders");
        }
      },
      onError: (err: any) =>
        handleApiError(err, "Pochtani yaratishda xatolik yuz berdi"),
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(
      (prev) =>
        prev.includes(id)
          ? prev.filter((item) => item !== id) // agar bor bo‘lsa — olib tashla
          : [...prev, id] // yo‘q bo‘lsa — qo‘sh
    );
  };

  return (
    <div
      onClick={() => setOpenMenuId("")}
      className="bg-white rounded-md m-5 dark:bg-[#312d4b]"
    >
      <div className="flex justify-between items-center max-[650px]:flex-col">
        <div className="flex justify-between w-full items-center p-10 max-[650px]:flex-col">
          <h2 className="text-[20px] font-medium text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            {t("title")}
          </h2>
          <form action="">
            <div className="border border-[#d1cfd4] max-[650px]:mt-3 rounded-md">
              <input
                onChange={(e) => debouncedSearch(e.target.value)}
                className="outline-none px-4 py-3"
                type="text"
                placeholder={t("placeholder.search")}
              />
            </div>
          </form>
        </div>{" "}
        <button
          onClick={() => handlePrint()}
          disabled={isPrintDisabled}
          className={`border px-5 text-nowrap py-3 max-[650px]:mb-3 rounded-md text-[#8c57ff] border-[#8c57ff] ${
            isPrintDisabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isPrintDisabled ? "Kutayapti..." : "Chop etish"}
        </button>
      </div>
      <div className="w-full">
        {isLoading ? (
          <Skeleton /> // ⬅️ Skelet chiqadi yuklanayotgan paytda
        ) : (
<table className="w-full">
  <thead className="bg-[#9d70ff] min-[900px]:h-[56px] text-[16px] text-white text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
    <tr>
      {user.role !== "market" && (
        <th data-cell="">
          <div className="flex items-center gap-10 ml-10">
            <input
              type="checkbox"
              checked={
                !!data?.data?.data &&
                selectedIds.length === data.data?.data?.length
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
          </div>
        </th>
      )}
      <th data-cell="#">
        <div className="flex items-center gap-10">
          <div className="w-[2px] h-[14px] bg-[#2E263D1F]  dark:bg-[#524B6C]"></div>
          <span>#</span>
        </div>
      </th>
      <th data-cell={t("customer")}>
        <div className="flex items-center gap-10">
          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
          <span>{t("customer")}</span>
        </div>
      </th>
      <th data-cell={t("phone")}>
        <div className="flex items-center gap-10">
          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
          <span>{t("phone")}</span>
        </div>
      </th>
      <th data-cell={t("viloyat")}>
        <div className="flex items-center gap-10">
          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
          <span>{t("viloyat")}</span>
        </div>
      </th>
      <th data-cell={t("tuman")}>
        <div className="flex items-center gap-10">
          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
          <span>{t("tuman")}</span>
        </div>
      </th>
      <th data-cell={t("status")}>
        <div className="flex items-center gap-10">
          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
          <span>{t("status")}</span>
        </div>
      </th>
      <th data-cell={t("price")}>
        <div className="flex items-center gap-10">
          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
          <span>{t("price")}</span>
        </div>
      </th>
      <th data-cell={t("delivery")}>
        <div className="flex items-center gap-10">
          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
          <span>{t("delivery")}</span>
        </div>
      </th>
      <th data-cell={t("action")}>
        <div className="flex items-center gap-10">
          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
          <span>{t("action")}</span>
          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
        </div>
      </th>
    </tr>
  </thead>

  <tbody className="cursor-pointer">
    {data?.data?.data?.map((item: any, inx: number) => (
      <tr
        onClick={() => toggleSelect(item.id)}
        key={item?.id}
        className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759] select-none"
      >
        {user.role !== "market" && (
          <td data-cell="" className="pl-10">
            <input
              type="checkbox"
              onClick={(e) => e.stopPropagation()}
              checked={selectedIds.includes(item.id)}
              onChange={() => toggleSelect(item.id)}
            />
          </td>
        )}
        <td data-cell="#" className="pl-10">{inx + 1}</td>
        <td data-cell={t("customer")} className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
          {item?.customer?.name}
        </td>
        <td data-cell={t("phone")} className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
          {item?.customer?.phone_number
            ? `${item.customer.phone_number
                .replace(/\D/g, "")
                .replace(
                  /^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/,
                  "+$1 $2 $3 $4 $5"
                )}`
            : ""}{" "}
        </td>
        <td data-cell={t("viloyat")} className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
          {item?.customer?.district?.region?.name}
        </td>
        <td data-cell={t("tuman")} className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
          {item?.customer?.district?.name}
        </td>
        <td data-cell={t("status")} className="pl-10">
          <span
            className={`py-2 px-3 rounded-2xl text-[13px] text-white dark:text-[#E7E3FCB2] bg-blue-500`}
          >
            {st(`${item.status}`).toUpperCase()}
          </span>
        </td>
        <td data-cell={t("price")} className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
          {new Intl.NumberFormat("uz-UZ").format(item?.total_price)} UZS
        </td>
        <td data-cell={t("delivery")} className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
          {t(`${item?.where_deliver}`)}
        </td>
        <td data-cell={t("action")} className="relative pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
          <button
            className="hover:text-red-600 cursor-pointer"
            onClick={() => {
              setDeleteId(item.id);
              setIsConfirmOpen(true);
            }}
          >
            <Trash />
          </button>
          <button
            className="hover:text-[#396ebe] cursor-pointer"
            onClick={() => navigate(`/orders/order-detail/${item?.id}`)}
          >
            <Edit />
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>

        )}
        {(!data?.data?.data || data.data.data.length === 0) && (
          <div className="flex flex-col justify-center items-center min-h-[60vh]">
            <EmptyPage />
          </div>
        )}

        {user?.role !== "market" && data?.data?.data?.length > 0 && (
          <div className="flex justify-end mr-10 mt-5">
            <button
              type="submit"
              disabled={
                !selectedIds ||
                (Array.isArray(selectedIds) && selectedIds.length === 0)
              }
              onClick={handleAccapted}
              className={`px-2 py-1 ${
                !selectedIds ||
                (Array.isArray(selectedIds) && selectedIds.length === 0)
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              } font-sans bg-[#8c57ff] rounded-md mb-5 text-white`}
            >
              {t("qabulQilish")}
            </button>
          </div>
        )}
      </div>
      <ConfirmPopup
        isShow={isConfirmOpen}
        title="Buyurtmani o‘chirishni tasdiqlaysizmi?"
        description="O‘chirilgandan so‘ng uni qaytarib bo‘lmaydi."
        confirmText="Ha, o‘chirish"
        cancelText="Bekor qilish"
        onConfirm={() => {
          if (deleteId) {
            hanlerDelete(deleteId); // 🔴 shu joyda API yoki console.log ishlaydi
          }
          setIsConfirmOpen(false);
          setDeleteId("");
        }}
        onCancel={() => {
          setIsConfirmOpen(false);
          setDeleteId("");
        }}
      />
    </div>
  );
};

export default memo(OrderView);
