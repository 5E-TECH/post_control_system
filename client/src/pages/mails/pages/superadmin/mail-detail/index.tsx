import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Check, Printer, Trash2, ArrowLeft, Search, Package, Home, MapPin, Phone, User, Store, Calendar, Send, Loader2, CheckCircle, XCircle, RefreshCw, ChevronDown, Globe, FileText, AlertTriangle, Repeat } from "lucide-react";

// Skeleton Loading Component
const SkeletonCard = () => (
  <div className="bg-gray-50 dark:bg-[#3A3650] rounded-xl p-3 sm:p-4 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-600 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 lg:gap-4 flex-1">
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-28" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20" />
        <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-24" />
        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20" />
      </div>
    </div>
  </div>
);

const MailDetailSkeleton = () => (
  <div className="h-full flex flex-col overflow-hidden">
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col flex-1 overflow-hidden">
      {/* Header Skeleton */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-2 animate-pulse" />
            </div>
          </div>
          <div className="w-full sm:w-72 h-11 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-[#2A263D] rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-12 mt-1 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3 flex-shrink-0">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        </div>
        <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  </div>
);
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import Popup from "../../../../../shared/ui/Popup";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { resetDownload } from "../../../../../shared/lib/features/excel-download-func/excelDownloadFunc";
import { usePostScanner } from "../../../../../shared/components/post-scanner";
import { exportToExcel } from "../../../../../shared/helpers/export-download-excel-with-courier";
import { generateCourierReceipt } from "../../../../../shared/helpers/generate-courier-receipt";
import ConfirmPopup from "../../../../../shared/components/confirmPopup";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import { buildAdminPath } from "../../../../../shared/const";
import { debounce } from "../../../../../shared/helpers/DebounceFunc";

const MailDetail = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation("mails");

  const { id } = useParams();
  const { state } = useLocation();
  const regionName = state?.regionName;

  // Local search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const debouncedSetSearch = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedSearch(value);
      }, 400),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedSetSearch(value);
  };

  const role = useSelector((state: RootState) => state.roleSlice.role);

  const { getPostById, sendAndGetCouriersByPostId, sendPost, createBrowserPrint, createThermalPdf, reassignPost } =
    usePost();
  const { deleteOrders } = useOrder();
  const { mutate: sendAndGetCouriers } = sendAndGetCouriersByPostId();
  const { mutate: sendCouriersToPost, isPending } = sendPost();

  // Reassign courier state
  const [showReassign, setShowReassign] = useState(false);
  const [reassignCouriers, setReassignCouriers] = useState<any[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const [isPrintDisabled, setIsPrintDisabled] = useState(false);
  const [confirmPopup, setConfirmPopup] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [printDropdownOpen, setPrintDropdownOpen] = useState<string | null>(null);
  const [bulkPrintDropdownOpen, setBulkPrintDropdownOpen] = useState(false);
  const printDropdownRef = useRef<HTMLDivElement>(null);
  const bulkPrintDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (printDropdownRef.current && !printDropdownRef.current.contains(e.target as Node)) {
        setPrintDropdownOpen(null);
      }
      if (bulkPrintDropdownRef.current && !bulkPrintDropdownRef.current.contains(e.target as Node)) {
        setBulkPrintDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBrowserPrint = (orderIds: string[]) => {
    if (isPrintDisabled || orderIds.length === 0) return;
    setIsPrintDisabled(true);
    setPrintDropdownOpen(null);
    setBulkPrintDropdownOpen(false);
    createBrowserPrint.mutate({ orderIds }, {
      onSuccess: (res: any) => {
        const html = res?.data?.html || res?.html;
        if (html) {
          const printWindow = window.open("", "_blank");
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            handleSuccess("Chek tayyor");
          } else {
            handleApiError(null, "Brauzer yangi oyna ochishga ruxsat bermadi. Popup blockerni o'chiring.");
          }
        } else {
          handleApiError(null, "Chek ma'lumotlari topilmadi");
        }
      },
      onError: (err: any) => {
        handleApiError(err, "Chek yaratishda xatolik yuz berdi");
      },
      onSettled: () => {
        setTimeout(() => setIsPrintDisabled(false), 3000);
      },
    });
  };

  const handleThermalPdf = (orderIds: string[]) => {
    if (isPrintDisabled || orderIds.length === 0) return;
    setIsPrintDisabled(true);
    setPrintDropdownOpen(null);
    setBulkPrintDropdownOpen(false);
    createThermalPdf.mutate({ orderIds }, {
      onSuccess: (res: any) => {
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        handleSuccess("PDF tayyor — saqlang yoki chop eting");
      },
      onError: (err: any) => {
        handleApiError(err, "PDF yaratishda xatolik yuz berdi");
      },
      onSettled: () => {
        setTimeout(() => setIsPrintDisabled(false), 3000);
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

  const { visualFeedback } = usePostScanner(undefined, setSelectedIds);

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

  const { data, isLoading, refetch } = getPostById(id as string, endpoint, condition);
  const postData = data?.data?.allOrdersByPostId || data?.data;

  // Filter locally by name or phone
  const filteredPostData = useMemo(() => {
    if (!postData || !Array.isArray(postData)) return postData;
    if (!debouncedSearch) return postData;

    const searchLower = debouncedSearch.toLowerCase();
    return postData.filter((order: any) => {
      const name = order?.customer?.name?.toLowerCase() || "";
      const phone = order?.customer?.phone_number || "";
      return name.includes(searchLower) || phone.includes(debouncedSearch);
    });
  }, [postData, debouncedSearch]);

  // Takroriy telefon raqamlarni aniqlash
  const duplicateInfo = useMemo(() => {
    if (!postData || !Array.isArray(postData)) return { groups: [] as { phone: string; orders: any[] }[], orderIds: new Set<string>() };

    const phoneMap = new Map<string, any[]>();
    for (const order of postData) {
      const phone = (order?.customer?.phone_number || "").replace(/\D/g, "");
      if (!phone) continue;
      if (!phoneMap.has(phone)) phoneMap.set(phone, []);
      phoneMap.get(phone)!.push(order);
    }

    const groups: { phone: string; orders: any[] }[] = [];
    const orderIds = new Set<string>();

    for (const [, orders] of phoneMap) {
      if (orders.length > 1) {
        groups.push({ phone: orders[0]?.customer?.phone_number || "", orders });
        orders.forEach((o: any) => orderIds.add(o.id));
      }
    }

    return { groups, orderIds };
  }, [postData]);

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

                const courierName = res?.data?.updatedPost?.courier?.name;
                handleSuccess(`Pochta ${courierName} kuryerga jo'natildi`);

                try {
                  const mails = res?.data?.newOrders;

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
                    Tuman: mail?.district?.name || mail?.customer?.district?.name,
                    Izoh: mail?.comment || "",
                  }));

                  exportToExcel(exportData || [], "pochtalar", {
                    qrCodeToken: res?.data?.updatedPost?.qr_code_token,
                    regionName: res?.data?.updatedPost?.region?.name,
                    courierName,
                    totalOrders: res?.data?.postTotalInfo?.total,
                    date: res?.data?.updatedPost?.created_at,
                  });

                  generateCourierReceipt({
                    qrCodeToken: res?.data?.updatedPost?.qr_code_token,
                    courierName: courierName || "",
                    regionName: res?.data?.updatedPost?.region?.name || "",
                    courierPhone: res?.data?.updatedPost?.courier?.phone_number || "",
                    orderCount: res?.data?.postTotalInfo?.total,
                    date: res?.data?.updatedPost?.created_at,
                  });

                  handleSuccess("Buyurtmalar muvaffaqiyatli export qilindi");
                } catch (error) {

                  handleApiError(error, "Excel yuklashda xatolik");
                } finally {
                  dispatch(resetDownload());
                }

                navigate(buildAdminPath("mails"));
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

          const courierName = res?.data?.updatedPost?.courier?.name;
          handleSuccess(`Pochta ${courierName} kuryerga jo'natildi`);

          try {
            const mails = res?.data?.newOrders;

            const exportData = mails?.map((mail: any, inx: number) => ({
              N: inx + 1,
              Mijoz: mail?.customer?.name || "",
              "Telefon raqam": mail?.customer?.phone_number,
              Firma: mail?.market?.name,
              Narxi: Number((mail?.total_price ?? 0) / 1000),
              Manzil:
                mail?.where_deliver == "center" ? "Markazgacha" : "Uygacha",
              Tuman: mail?.district?.name || mail?.customer?.district?.name,
              Izoh: mail?.comment || "",
            }));

            exportToExcel(exportData || [], "pochtalar", {
              qrCodeToken: res?.data?.updatedPost?.qr_code_token,
              regionName: res?.data?.updatedPost?.region?.name,
              courierName,
              totalOrders: res?.data?.postTotalInfo?.total,
              date: res?.data?.updatedPost?.created_at,
            });

            generateCourierReceipt({
              qrCodeToken: res?.data?.updatedPost?.qr_code_token,
              courierName: courierName || "",
              regionName: res?.data?.updatedPost?.region?.name || "",
              courierPhone: res?.data?.updatedPost?.courier?.phone_number || "",
              orderCount: res?.data?.postTotalInfo?.total,
              date: res?.data?.updatedPost?.created_at,
            });

            handleSuccess("Buyurtmalar muvaffaqiyatli export qilindi");
          } catch (error) {
            handleApiError(error, "Excel yuklashda xatolik");
          } finally {
            dispatch(resetDownload());
          }

          navigate(buildAdminPath("mails"));
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
          ? prev.filter((item) => item !== id)
          : [...prev, id]
    );
  };

  const hideSend = state?.hideSend;

  const handleOpenReassign = () => {
    if (!id) return;
    sendAndGetCouriers(id, {
      onSuccess: (res: any) => {
        setReassignCouriers(res?.data?.couriers || []);
        setSelectedCourierId(null);
        setShowReassign(true);
      },
      onError: (err: any) => handleApiError(err, "Kurierlarni yuklashda xatolik"),
    });
  };

  const handleReassign = () => {
    if (!id || !selectedCourierId) return;
    reassignPost.mutate(
      { id, courier_id: selectedCourierId },
      {
        onSuccess: (res: any) => {
          handleSuccess(res?.message || "Pochta boshqa kuryerga o'tkazildi");
          setShowReassign(false);
          refetch();
        },
        onError: (err: any) => handleApiError(err, "Kuryerni o'zgartirishda xatolik"),
      }
    );
  };

  const formatPhone = (phone: string | undefined) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("998")) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10, 12)}`;
    }
    return phone;
  };

  const formatDate = (timestamp: string | number) => {
    if (!timestamp) return "-";
    return new Date(Number(timestamp)).toLocaleDateString("uz-UZ");
  };

  if (isLoading) {
    return <MailDetailSkeleton />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-[#3A3650] transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <span className="truncate">{regionName} {t("buyurtmalari")}</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 ml-10 sm:ml-13">
                  {filteredPostData?.length || 0} ta buyurtma mavjud
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Ism yoki telefon raqam..."
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A263D] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Reassign Courier Button - faqat superadmin va jo'natilgan pochtalar uchun */}
              {hideSend && role === "superadmin" && (
                <button
                  onClick={handleOpenReassign}
                  className="h-11 px-4 rounded-xl flex items-center gap-2 text-sm font-medium border border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Repeat className="w-4 h-4" />
                  <span className="hidden sm:inline">Kuryerni o'zgartirish</span>
                </button>
              )}

              {/* Bulk Print Dropdown */}
              {!hideSend && (
                <div className="relative" ref={bulkPrintDropdownRef}>
                  <button
                    onClick={() => {
                      if (!isPrintDisabled && selectedIds.length > 0) {
                        setBulkPrintDropdownOpen((prev) => !prev);
                      }
                    }}
                    disabled={isPrintDisabled || selectedIds.length === 0}
                    className={`h-11 px-4 rounded-xl flex items-center gap-2 text-sm font-medium border transition-all whitespace-nowrap ${
                      isPrintDisabled || selectedIds.length === 0
                        ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"
                        : "border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
                    }`}
                  >
                    <Printer className="w-4 h-4" />
                    {isPrintDisabled ? "Kutayapti..." : `Chop etish (${selectedIds.length})`}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${bulkPrintDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {bulkPrintDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-[#2A263D] rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden">
                      <button
                        onClick={() => handleBrowserPrint(selectedIds)}
                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                      >
                        <Globe className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white">Brauzer orqali</p>
                          <p className="text-xs text-gray-400">Istalgan printer</p>
                        </div>
                      </button>
                      <div className="border-t border-gray-100 dark:border-gray-700" />
                      <button
                        onClick={() => handleThermalPdf(selectedIds)}
                        className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-red-500" />
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white">PDF (100x60mm)</p>
                          <p className="text-xs text-gray-400">Termal printer uchun</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className={`grid gap-3 sm:gap-4 mt-4 ${!hideSend ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
            {!hideSend && (
              <div className={`bg-white dark:bg-[#2A263D] rounded-xl p-3 sm:p-4 shadow-sm border ${
                selectedIds.length === postData?.length
                  ? "border-emerald-500"
                  : "border-red-400"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedIds.length === postData?.length
                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : "bg-red-100 dark:bg-red-900/30"
                  }`}>
                    <Package className={`w-5 h-5 ${
                      selectedIds.length === postData?.length
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Tanlangan</p>
                    <p className={`text-lg font-bold ${
                      selectedIds.length === postData?.length
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {selectedIds.length} / {postData?.length}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-[#2A263D] rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Home className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("uygacha")}</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">
                    {data?.data?.homeOrders?.homeOrders ?? 0} ta
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {Number(data?.data?.homeOrders?.homeOrdersTotalPrice || 0).toLocaleString("uz-UZ")} so'm
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#2A263D] rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("markazgacha")}</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">
                    {data?.data?.centerOrders?.centerOrders ?? 0} ta
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {Number(data?.data?.centerOrders?.centerOrdersTotalPrice || 0).toLocaleString("uz-UZ")} so'm
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Takroriy telefon raqamlar haqida ogohlantirish */}
        {duplicateInfo.groups.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3 sm:p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold">
                Takroriy telefon raqamlar aniqlandi ({duplicateInfo.groups.length} ta raqam)
              </span>
            </div>
            <div className="space-y-1.5 ml-7">
              {duplicateInfo.groups.map((group, idx) => {
                const uniqueNames = [...new Set(group.orders.map((o: any) => o?.customer?.name).filter(Boolean))];
                return (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Phone className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="font-medium text-amber-800 dark:text-amber-300">{group.phone}</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      — {group.orders.length} ta buyurtma
                      {uniqueNames.length > 0 && ` (${uniqueNames.join(", ")})`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
          {/* Select All Header */}
          {!hideSend && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3 flex-shrink-0">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={!!postData && selectedIds.length === postData?.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(postData.map((item: any) => item.id));
                  } else {
                    setSelectedIds([]);
                  }
                }}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Barchasini tanlash
              </span>
            </div>
          )}

          {/* Orders List */}
          <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1">
            {filteredPostData?.map((order: any) => (
              <div
                key={order?.id}
                onClick={() => !hideSend && toggleSelect(order.id)}
                className={`bg-gray-50 dark:bg-[#3A3650] rounded-xl p-3 sm:p-4 transition-all ${
                  !hideSend ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-[#4A4660]" : ""
                } ${selectedIds.includes(order.id) ? "ring-2 ring-indigo-500" : duplicateInfo.orderIds.has(order.id) ? "ring-2 ring-amber-400 dark:ring-amber-500" : ""}`}
              >
                {/* Mobile Layout */}
                <div className="block sm:hidden">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {!hideSend && (
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          checked={selectedIds.includes(order.id)}
                          onChange={() => toggleSelect(order.id)}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                          {order?.customer?.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatPhone(order?.customer?.phone_number)}
                        </p>
                      </div>
                    </div>
                    {!hideSend && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="relative" ref={printDropdownOpen === order?.id ? printDropdownRef : undefined}>
                          <button
                            disabled={isPrintDisabled}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintDropdownOpen(printDropdownOpen === order?.id ? null : order?.id);
                            }}
                            className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                          >
                            <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </button>
                          {printDropdownOpen === order?.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#2A263D] rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleBrowserPrint([order.id]); }}
                                className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                              >
                                <Globe className="w-4 h-4 text-blue-500" />
                                <span className="text-gray-800 dark:text-white">Brauzer orqali</span>
                              </button>
                              <div className="border-t border-gray-100 dark:border-gray-700" />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleThermalPdf([order.id]); }}
                                className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                              >
                                <FileText className="w-4 h-4 text-red-500" />
                                <span className="text-gray-800 dark:text-white">PDF (100x60mm)</span>
                              </button>
                            </div>
                          )}
                        </div>
                        {role === "superadmin" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(order.id);
                              setConfirmPopup(true);
                            }}
                            className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span className="truncate">{order?.district?.name || order?.customer?.district?.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                      <Store className="w-3 h-3 text-gray-400" />
                      <span className="truncate">{order?.market?.name}</span>
                    </div>
                    <div className="font-semibold text-gray-800 dark:text-white">
                      {new Intl.NumberFormat("uz-UZ").format(Number(order?.total_price) || 0)} so'm
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        order?.where_deliver === "address"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      }`}>
                        {order?.where_deliver === "address" ? "Uygacha" : "Markazgacha"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {!hideSend && (
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        onClick={(e) => e.stopPropagation()}
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelect(order.id)}
                      />
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 lg:gap-4 flex-1">
                      {/* Customer Name */}
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                          {order?.customer?.name}
                        </span>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {formatPhone(order?.customer?.phone_number)}
                        </span>
                      </div>

                      {/* District */}
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                          {order?.district?.name || order?.customer?.district?.name}
                        </span>
                      </div>

                      {/* Market */}
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                          {order?.market?.name}
                        </span>
                      </div>

                      {/* Price */}
                      <div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-white">
                          {new Intl.NumberFormat("uz-UZ").format(Number(order?.total_price) || 0)} so'm
                        </span>
                      </div>

                      {/* Delivery */}
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                          order?.where_deliver === "address"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        }`}>
                          {order?.where_deliver === "address" ? <Home className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                          {t(`${order?.where_deliver}`)}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {formatDate(order?.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!hideSend && (
                    <div className="flex items-center gap-2 ml-4">
                      <div className="relative" ref={printDropdownOpen === order?.id ? printDropdownRef : undefined}>
                        <button
                          disabled={isPrintDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrintDropdownOpen(printDropdownOpen === order?.id ? null : order?.id);
                          }}
                          className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                        >
                          <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </button>
                        {printDropdownOpen === order?.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#2A263D] rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleBrowserPrint([order.id]); }}
                              className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                            >
                              <Globe className="w-4 h-4 text-blue-500" />
                              <span className="text-gray-800 dark:text-white">Brauzer orqali</span>
                            </button>
                            <div className="border-t border-gray-100 dark:border-gray-700" />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleThermalPdf([order.id]); }}
                              className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                            >
                              <FileText className="w-4 h-4 text-red-500" />
                              <span className="text-gray-800 dark:text-white">PDF (100x60mm)</span>
                            </button>
                          </div>
                        )}
                      </div>
                      {role === "superadmin" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(order.id);
                            setConfirmPopup(true);
                          }}
                          className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Send Button */}
          {!hideSend && (
            <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-700/50 flex-shrink-0">
              <button
                disabled={isPending}
                onClick={() => handleClick(id as string)}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {t("pochtanijonatish")}
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmPopup && (
        <ConfirmPopup
          isShow={confirmPopup}
          title="O'chirishni tasdiqlaysizmi?"
          description="Bu amalni ortga qaytarib bo'lmaydi."
          confirmText="Ha, o'chirish"
          cancelText="Bekor qilish"
          onConfirm={() => {
            if (deleteId) {
              hanlerDelete(deleteId);
            }
            setDeleteId("");
            setConfirmPopup(false);
          }}
          onCancel={() => setConfirmPopup(false)}
        />
      )}

      {isShow && (
        <Popup isShow={isShow} onClose={() => setIsShow(false)}>
          <div className="min-h-[300px] sm:min-h-[450px] w-[calc(100vw-32px)] sm:w-[450px] max-w-[450px] bg-white dark:bg-[#2A263D] rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 sm:px-6 py-4">
              <h1 className="text-lg sm:text-xl font-bold text-white">Kuryerlar ro'yxati</h1>
              <p className="text-xs sm:text-sm text-white/80">Pochtani jo'natish uchun kuryer tanlang</p>
            </div>

            <div className="p-3 sm:p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {couriers.map((courier: any) => (
                <div
                  key={courier?.id}
                  onClick={() => handleSelectedCourier(courier?.id)}
                  className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedCourierId === courier?.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        selectedCourierId === courier?.id
                          ? "bg-indigo-500"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}>
                        <User className={`w-5 h-5 ${
                          selectedCourierId === courier?.id
                            ? "text-white"
                            : "text-gray-600 dark:text-gray-400"
                        }`} />
                      </div>
                      <div>
                        <h2 className="font-semibold text-gray-800 dark:text-white">
                          {courier?.name}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {courier?.phone_number || "Telefon raqami yo'q"}
                        </p>
                      </div>
                    </div>

                    {selectedCourierId === courier?.id && (
                      <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button
                disabled={isPending}
                onClick={handleConfirmCouriers}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Tasdiqlash
              </button>
            </div>
          </div>
        </Popup>
      )}

      {/* ============ VISUAL FEEDBACK OVERLAY ============ */}
      {visualFeedback.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          {/* Overlay background */}
          <div
            className={`absolute inset-0 transition-opacity duration-200 ${
              visualFeedback.type === 'success'
                ? 'bg-green-500/20'
                : visualFeedback.type === 'warning'
                ? 'bg-amber-500/20'
                : 'bg-red-500/20'
            }`}
          />

          {/* Big icon */}
          <div className="relative flex flex-col items-center justify-center animate-in zoom-in duration-200">
            {/* Circle background */}
            <div
              className={`w-40 h-40 sm:w-52 sm:h-52 rounded-full flex items-center justify-center shadow-2xl ${
                visualFeedback.type === 'success'
                  ? 'bg-green-500 shadow-green-500/50'
                  : visualFeedback.type === 'warning'
                  ? 'bg-amber-500 shadow-amber-500/50'
                  : 'bg-red-500 shadow-red-500/50'
              }`}
            >
              {visualFeedback.type === 'success' ? (
                <CheckCircle className="w-24 h-24 sm:w-32 sm:h-32 text-white" strokeWidth={2.5} />
              ) : visualFeedback.type === 'warning' ? (
                <RefreshCw className="w-24 h-24 sm:w-32 sm:h-32 text-white" strokeWidth={2.5} />
              ) : (
                <XCircle className="w-24 h-24 sm:w-32 sm:h-32 text-white" strokeWidth={2.5} />
              )}
            </div>

            {/* Message text */}
            {visualFeedback.message && (
              <p
                className={`mt-6 text-2xl sm:text-3xl font-bold ${
                  visualFeedback.type === 'success'
                    ? 'text-green-600'
                    : visualFeedback.type === 'warning'
                    ? 'text-amber-600'
                    : 'text-red-600'
                }`}
              >
                {visualFeedback.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Reassign Courier Modal */}
      {showReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowReassign(false)}>
          <div
            className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[450px] max-w-[95vw] overflow-hidden max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Repeat className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Kuryerni o'zgartirish</h2>
                  <p className="text-xs text-white/70">Shu viloyatning boshqa kuryerini tanlang</p>
                </div>
              </div>
            </div>

            {/* Courier List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {reassignCouriers.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Bu viloyatda boshqa kuryer topilmadi</p>
                </div>
              ) : (
                reassignCouriers.map((courier: any) => (
                  <div
                    key={courier.id}
                    onClick={() => setSelectedCourierId(courier.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      selectedCourierId === courier.id
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg"
                        : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        selectedCourierId === courier.id ? "bg-white/20" : "bg-amber-100 dark:bg-amber-900/30"
                      }`}>
                        <User className={`w-4 h-4 ${selectedCourierId === courier.id ? "text-white" : "text-amber-600 dark:text-amber-400"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{courier.name}</p>
                        <p className={`text-xs ${selectedCourierId === courier.id ? "text-white/70" : "text-gray-500"}`}>{courier.phone_number}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-3 justify-end flex-shrink-0">
              <button
                onClick={() => setShowReassign(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer text-sm"
              >
                Bekor qilish
              </button>
              <button
                disabled={!selectedCourierId || reassignPost.isPending}
                onClick={handleReassign}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-sm flex items-center gap-2"
              >
                {reassignPost.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}
                O'tkazish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(MailDetail);
