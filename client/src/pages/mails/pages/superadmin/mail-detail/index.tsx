import { memo, useEffect, useState } from "react";
import { Check, Printer, Trash2 } from "lucide-react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Button } from "antd";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import SearchInput from "../../../../users/components/search-input";
import Popup from "../../../../../shared/ui/Popup";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { resetDownload } from "../../../../../shared/lib/features/excel-download-func/excelDownloadFunc";
import { usePostScanner } from "../../../../../shared/components/post-scanner";
import { exportToExcel } from "../../../../../shared/helpers/export-download-excel-with-courier";
import ConfirmPopup from "../../../../../shared/components/confirmPopup";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";

const MailDetail = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation("mails");

  const { id } = useParams();
  const { state } = useLocation();
  const regionName = state?.regionName;
  const search = useSelector(
    (state: RootState) => state.resetUserFilter.search
  );

  const role = useSelector((state: RootState) => state.roleSlice.role);

  const { getPostById, sendAndGetCouriersByPostId, sendPost, createPrint } =
    usePost();
  const { deleteOrders } = useOrder();
  const { mutate: sendAndGetCouriers } = sendAndGetCouriersByPostId();
  const { mutate: sendCouriersToPost, isPending } = sendPost();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const [isPrintDisabled, setIsPrintDisabled] = useState(false);
  const [selected, setSelected] = useState("");
  const [confirmPopup, setConfirmPopup] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handlePrint = (id: string) => {
    // if (id) return; // 🔒 agar allaqachon bosilgan bo‘lsa, qaytadi

    setIsPrintDisabled(true); // ⛔ bosilgandan so‘ng tugma bloklanadi

    const orderids = { orderIds: [id] };
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

  usePostScanner(undefined, setSelectedIds);

  // Dynamic fetching based on status
  const [params] = useSearchParams();
  const status = params.get("status");

  let endpoint = "";
  let condition = false;

  if (status === "received") {
    endpoint = "";
    condition = true;
  } else if (["canceled", "canceled_received"].includes(status as string)) {
    endpoint = "rejected/";
    condition = true;
  } else {
    endpoint = "";
    condition = true;
  }

  const { data } = getPostById(id as string, endpoint, condition, search);
  const postData = data?.data?.allOrdersByPostId || data?.data;

  useEffect(() => {
    if (postData && !initialized) {
      setSelectedIds([]);
      setInitialized(true);
    }
  }, [postData, initialized]);

  const [isShow, setIsShow] = useState(false);
  const [couriers, setCouriers] = useState<any[]>([]);
  const { handleSuccess, handleApiError, handleWarning } = useApiNotification();
  const handleClick = (id: string) => {
    if (selectedIds.length === 0) {
      handleWarning(
        "Buyurtma tanlanmagan",
        "Buyurtmani tanlab keyin jo'nata olasiz"
      );
      return;
    }

    sendAndGetCouriers(id as string, {
      onSuccess: (res) => {
        if (res?.data?.moreThanOneCourier) {
          setCouriers(res?.data?.couriers || []);
          setIsShow(true);
        } else {
          const courierId = res?.data?.couriers?.[0]?.id;
          const post = {
            orderIds: selectedIds,
            courierId,
          };

          sendCouriersToPost(
            { id, data: post },
            {
              onSuccess: (res) => {
                console.log("res.data", res.data);

                const courierName = res?.data?.updatedPost?.courier?.name;
                handleSuccess(`Pochta ${courierName} kuryerga jo'natildi`);

                try {
                  const mails = res?.data?.newOrders;
                  console.log("mails", mails);

                  const exportData = mails?.map((mail: any, inx: number) => ({
                    N: inx + 1,
                    Mijoz: mail?.customer?.name || "",
                    "Telefon raqam": mail?.customer?.phone_number,
                    Firma: mail?.market?.name,
                    Narxi: Number((mail?.total_price ?? 0) / 1000),
                    Manzil:
                      mail?.where_deliver == "center"
                        ? "Markazgacha"
                        : "Uygacha",
                    Tuman: mail?.customer?.district?.name,
                    Izoh: mail?.comment || "",
                  }));

                  exportToExcel(exportData || [], "pochtalar", {
                    qrCodeToken: res?.data?.updatedPost?.qr_code_token,
                    regionName: res?.data?.updatedPost?.region?.name,
                    courierName,
                    totalOrders: res?.data?.postTotalInfo?.total,
                    date: res?.data?.updatedPost?.created_at,
                  });

                  handleSuccess("Buyurtmalar muvaffaqiyatli export qilindi");
                } catch (error) {
                  console.log(error);

                  handleApiError(error, "Excel yuklashda xatolik");
                } finally {
                  dispatch(resetDownload());
                }

                navigate("/mails");
              },
              onError: (err: any) =>
                handleApiError(
                  err,
                  "Kuryerga pochta yuborishda xatolik yuz berdi"
                ),
            }
          );
        }
      },
      onError: (err: any) =>
        handleApiError(err, "Kuryerlarni olishda xatolik yuz berdi"),
    });
  };

  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(
    null
  );
  const handleSelectedCourier = (id: string) => {
    setSelectedCourierId(id);
  };

  const navigate = useNavigate();
  const handleConfirmCouriers = () => {
    if (!selectedCourierId) {
      handleWarning("Kuryer tanlanmagan", "Kuryer tanlab keyin jo'nata olasiz");
      return;
    }
    const post = {
      orderIds: selectedIds,
      courierId: selectedCourierId,
    };
    sendCouriersToPost(
      { id: id as string, data: post },
      {
        onSuccess: (res) => {
          console.log("tasdiqlash", res);

          const courierName = res?.data?.updatedPost?.courier?.name;
          handleSuccess(`Pochta ${courierName} kuryerga jo'natildi`);

          try {
            const mails = res?.data?.newOrders;
            console.log("mails", mails);

            const exportData = mails?.map((mail: any, inx: number) => ({
              N: inx + 1,
              Mijoz: mail?.customer?.name || "",
              "Telefon raqam": mail?.customer?.phone_number,
              Firma: mail?.market?.name,
              Narxi: Number((mail?.total_price ?? 0) / 1000),
              Manzil:
                mail?.where_deliver == "center" ? "Markazgacha" : "Uygacha",
              Tuman: mail?.customer?.district?.name,
              Izoh: mail?.comment || "",
            }));

            exportToExcel(exportData || [], "pochtalar", {
              qrCodeToken: res?.data?.updatedPost?.qr_code_token,
              regionName: res?.data?.updatedPost?.region?.name,
              courierName,
              totalOrders: res?.data?.postTotalInfo?.total,
              date: res?.data?.updatedPost?.created_at,
            });

            handleSuccess("Buyurtmalar muvaffaqiyatli export qilindi");
          } catch (error) {
            handleApiError(error, "Excel yuklashda xatolik");
          } finally {
            dispatch(resetDownload());
          }

          navigate("/mails");
        },
        onError: (err: any) =>
          handleApiError(err, "Kuryerlarga jo'natishda xatolik yuz berdi."),
      }
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(
      (prev) =>
        prev.includes(id)
          ? prev.filter((item) => item !== id) // agar bor bo‘lsa — olib tashla
          : [...prev, id] // yo‘q bo‘lsa — qo‘sh
    );
  };

  const hideSend = state?.hideSend;

  return (
    <div className="flex flex-col gap-5 p-5 ">
      <div className="flex flex-col justify-between shadow-lg rounded-md bg-[#ffffff] dark:bg-[#312D48]">
        <div className="flex justify-between px-5 pt-5">
          <h1 className="text-2xl mt-1">
            <span>{regionName}</span> {t("buyurtmalari")}
          </h1>
          <SearchInput placeholder={`${t("qidiruv")}...`} />
        </div>

        <div
          className={`mt-5 grid gap-6 px-5 max-[901px]:grid-cols-1 ${
            !hideSend ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          {!hideSend ? (
            <div
              className={`flex flex-col justify-center items-center border rounded-xl py-3 shadow-sm bg-white dark:bg-[#312D4B] ${
                selectedIds.length == postData?.length
                  ? "border-green-500"
                  : "border-red-500"
              }`}
            >
              <span
                className={`text-[32px] font-bold ${
                  selectedIds.length == postData?.length
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {selectedIds.length} / {postData?.length}
              </span>
            </div>
          ) : null}

          <div className="flex flex-col justify-center items-center border border-[var(--color-bg-sy)] rounded-xl py-3 shadow-sm bg-white dark:bg-[#312D4B] dark:border-[#D5D1EB]">
            <span className="text-[18px] font-medium text-gray-600 dark:text-[#A9A5C0]">
              {t("uygacha")}
            </span>
            <span className="text-[22px] font-bold text-[#2E263D] dark:text-[#E7E3FC]">
              {data?.data?.homeOrders?.homeOrders ?? 0} {t("ta")}
            </span>
            <span className="text-[15px] text-gray-500 dark:text-[#A9A5C0]">
              {data?.data?.homeOrders?.homeOrdersTotalPrice?.toLocaleString(
                "uz-UZ"
              ) ?? 0}{" "}
              {t("so'm")}
            </span>
          </div>

          <div className="flex flex-col justify-center items-center border border-[var(--color-bg-sy)] rounded-xl py-3 shadow-sm bg-white dark:bg-[#312D4B] dark:border-[#D5D1EB]">
            <span className="text-[18px] font-medium text-gray-600 dark:text-[#A9A5C0]">
              {t("markazgacha")}
            </span>
            <span className="text-[22px] font-bold text-[#2E263D] dark:text-[#E7E3FC]">
              {data?.data?.centerOrders?.centerOrders ?? 0} {t("ta")}
            </span>
            <span className="text-[15px] text-gray-500 dark:text-[#A9A5C0]">
              {data?.data?.centerOrders?.centerOrdersTotalPrice?.toLocaleString(
                "uz-UZ"
              ) ?? 0}{" "}
              {t("so'm")}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <table>
            <thead className="bg-[#F6F7FB] dark:bg-[#3D3759] capitalize">
              <tr>
                {!hideSend ? (
                  <th className="p-[20px] flex items-center">
                    <input
                      type="checkbox"
                      className="w-[18px] h-[18px] rounded-sm"
                      checked={
                        !!postData && selectedIds.length === postData?.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(postData.map((item: any) => item.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                ) : null}
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("mijozIsmi")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("telefonRaqami")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("tumani")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("market")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("pulMiqdori")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("delivery")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("time")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("action")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {postData?.map((order: any) => (
                <tr
                  key={order?.id}
                  onClick={() => toggleSelect(order.id)}
                  className="select-none"
                >
                  {!hideSend ? (
                    <td className="p-[20px] flex items-center">
                      {" "}
                      <input
                        type="checkbox"
                        className="w-[18px] h-[18px] rounded-sm"
                        onClick={(e) => e.stopPropagation()} // table row click bilan to‘qnashmasin
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelect(order.id)}
                      />
                    </td>
                  ) : null}
                  <td className="w-[254px] h-[56px] pl-[20px] text-left">
                    <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
                      {order?.customer?.name}
                    </span>
                  </td>
                  <td className="w-[254px] h-[56px] pl-[20px] text-left">
                    <span className="font-normal text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                      {order?.customer?.phone_number}
                    </span>
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {order?.customer?.district?.name}
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {order?.market?.name}
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {new Intl.NumberFormat("uz-UZ").format(order?.total_price)}
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {t(`${order?.where_deliver}`)}
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {new Date(Number(order?.created_at)).toLocaleDateString(
                      "uz-UZ"
                    )}
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    <div className="flex gap-5">
                      <button
                        disabled={isPrintDisabled && order?.id === selected}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrint(order?.id);
                          setSelected(order?.id);
                        }}
                        className="cursor-pointer"
                      >
                        <Printer />
                      </button>
                      {role === "superadmin" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(order.id);
                            setConfirmPopup(true);
                          }}
                        >
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!hideSend ? (
        <div className="flex justify-end">
          <Button
            disabled={isPending}
            loading={isPending}
            onClick={() => handleClick(id as string)}
            className="w-[160px]! h-[37px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! text-[15px]!"
          >
            {t("pochtanijonatish")}
          </Button>
        </div>
      ) : null}

      {confirmPopup && (
        <ConfirmPopup
          isShow={confirmPopup}
          title="O‘chirishni tasdiqlaysizmi?"
          description="Bu amalni ortga qaytarib bo‘lmaydi."
          confirmText="Ha, o‘chirish"
          cancelText="Bekor qilish"
          onConfirm={() => {
            if (deleteId) {
              hanlerDelete(deleteId); // 🔴 shu joyda API yoki console.log ishlaydi
            }
            setDeleteId("");
            setConfirmPopup(false);
          }}
          onCancel={() => setConfirmPopup(false)}
        />
      )}

      {isShow && (
        <Popup isShow={isShow} onClose={() => setIsShow(false)}>
          <div className="min-h-[450px] w-[450px] bg-[#ffffff] rounded-md">
            <h1 className="text-[22px] text-center py-3">Kuryerlar ro'yxati</h1>

            <div className="grid grid-cols-1 gap-3 p-3">
              {couriers.map((courier: any) => (
                <div
                  key={courier?.id}
                  className="p-4 rounded-xl shadow-md flex items-center justify-between hover:shadow-lg transition cursor-pointer"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      {courier?.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      📞 {courier?.phone_number || "Telefon raqami yo‘q"}
                    </p>
                  </div>

                  <Button
                    className={`${
                      selectedCourierId === courier?.id
                        ? "bg-[var(--color-bg-sy)]! text-white!"
                        : ""
                    }`}
                    onClick={() => handleSelectedCourier(courier?.id)}
                  >
                    {selectedCourierId === courier?.id ? (
                      <span className="flex items-center gap-1">
                        Tanlandi <Check className="w-4 h-4 text-green-300" />
                      </span>
                    ) : (
                      "Tanlash"
                    )}
                  </Button>
                </div>
              ))}

              <Button
                disabled={isPending}
                loading={isPending}
                className="bg-[var(--color-bg-sy)]! text-white!"
                onClick={handleConfirmCouriers}
              >
                Tasdiqlash
              </Button>
            </div>
          </div>
        </Popup>
      )}
    </div>
  );
};

export default memo(MailDetail);
