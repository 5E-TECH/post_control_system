import { Edit, Trash } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import phone from "../../../../shared/assets/order/detail.svg";
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
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
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
      <div className="flex justify-between items-center">
        <div className="flex justify-between w-full items-center p-10">
          <h2 className="text-[20px] font-medium text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            {t("title")}
          </h2>
          <form action="">
            <div className="border border-[#d1cfd4] rounded-md">
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
          className={`border px-5 text-nowrap py-3 rounded-md text-[#8c57ff] border-[#8c57ff] ${
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
            <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:text-[#E7E3FCE5] dark:bg-[#3d3759]">
              <tr>
                {user.role !== "market" && (
                  <th>
                    <div className="flex items-center gap-10 ml-10">
                      <input
                        type="checkbox"
                        checked={
                          !!data?.data?.data &&
                          selectedIds.length === data.data?.data?.length
                        } // ✅ doim boolean
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(
                              data?.data?.data?.map((item: any) => item.id)
                            ); // 🔄 hamma id yig‘iladi
                          } else {
                            setSelectedIds([]); // 🔄 bo‘shatib yuboriladi
                          }
                        }}
                      />
                    </div>
                  </th>
                )}
                <th>
                  <div className="flex items-center gap-10">
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
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
                    <span>{t("viloyat")}</span>
                  </div>
                </th>

                <th>
                  <div className="flex items-center gap-10">
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    <span>{t("tuman")}</span>
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
                  <td className="pl-10">
                    <input
                      type="checkbox"
                      onClick={(e) => e.stopPropagation()} // table row click bilan to‘qnashmasin
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td className="pl-10">{inx + 1}</td>
                  <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.customer?.name}
                  </td>
                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.customer?.phone_number
                      ? `${item.customer.phone_number
                          .replace(/\D/g, "")
                          .replace(
                            /^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/,
                            "+$1 $2 $3 $4 $5"
                          )}`
                      : ""}{" "}
                  </td>
                  <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.customer?.district?.region?.name}
                  </td>

                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {item?.customer?.district?.name}
                  </td>

                  <td className="pl-10">
                    <span
                      className={`py-2 px-3 rounded-2xl text-[13px] text-white dark:text-[#E7E3FCB2]  bg-blue-500`}
                    >
                      {st(`${item.status}`).toUpperCase()}
                    </span>
                  </td>
                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {new Intl.NumberFormat("uz-UZ").format(item?.total_price)}{" "}
                    UZS
                  </td>
                  <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    {t(`${item?.where_deliver}`)}
                  </td>
                  <td className="relative pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                    <button
                      className="hover:text-red-600 cursor-pointer"
                      onClick={() => {
                        setDeleteId(item.id); // shu joyda id saqlanadi
                        setIsConfirmOpen(true); // popup ochiladi
                      }}
                    >
                      <Trash />
                    </button>
                    <button
                      className="hover:text-[#396ebe] cursor-pointer"
                      onClick={() =>
                        navigate(`/orders/order-detail/${item?.id}`)
                      }
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
        {selectedOrder && (
          <div
            className="fixed inset-0 bg-[#f4f5fa79] bg-opacity-80 flex items-center justify-center z-50 dark:bg-[#28243d3b]"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="bg-white rounded-lg shadow-lg p-6 w-[500px] relative dark:bg-[#28243d]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-3 text-gray-600 hover:text-black"
                onClick={() => setSelectedOrder(null)}
              >
                ✕
              </button>
              <div>
                <div className="flex gap-4 items-center justify-between pr-4 border-b pb-2">
                  <div className="flex gap-4 items-center">
                    <h2>Buyurtma</h2>
                    <div className="bg-[var(--color-bg-sy)] py-0.5 px-1.5 rounded-md">
                      new
                    </div>
                  </div>
                  <div>
                    <h2>Sep 10, 2025, 13:20</h2>
                  </div>
                </div>
                <div>
                  <div className="pt-2">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="flex justify-between border-b pb-2">
                            <td>Product</td>
                            <td>Miqdori</td>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 3 }).map((_, inx: number) => (
                          <tr
                            key={inx}
                            className="flex justify-between items-center pr-4 border-b mb-2"
                          >
                            <td>
                              <div className="flex items-center gap-3">
                                <div>
                                  <img src={phone} alt="" />
                                </div>
                                <div>
                                  <h2 className="text-[15px]">iphone 15</h2>
                                  <p className="text-[13px]">Samsung zo'r</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="">1</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end mr-4">
                      <h2>Tota: 5_000_000 USD</h2>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between pr-7 mt-5">
                  <div>
                    <h2 className="text-[18px]">Customer detail</h2>
                    <h2 className="text-[15px]">phone: +998913607434</h2>
                    <h2 className="text-[15px]">address: Namangan, Chortoq</h2>
                  </div>
                  <div>
                    <h2 className="text-[18px]">Shipping Status</h2>
                    <h2 className="text-[15px]">On the Road</h2>
                  </div>
                </div>
              </div>
            </div>
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
