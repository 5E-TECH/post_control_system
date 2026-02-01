import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CashboxCard } from "../../components/CashCard";
import { CashboxHistory } from "../../components/paymentHistory";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import {
  BanknoteArrowDown,
  BanknoteArrowUp,
  CircleMinus,
  CirclePlus,
  Download,
  Loader2,
  Search,
  Wallet,
  X,
  Clock,
  Play,
  Square,
} from "lucide-react";
import { BASE_URL } from "../../../../shared/const";
import { message } from "antd";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";
import { useCourier } from "../../../../shared/api/hooks/useCourier";
import TextArea from "antd/es/input/TextArea";
import { Select, DatePicker } from "antd";
import dayjs from "dayjs";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import { useTranslation } from "react-i18next";
import type { AxiosError } from "axios";
import CustomCalendar from "../../../../shared/components/customDate";
import PaymentPopup from "../../../../shared/ui/paymentPopup";

const { RangePicker } = DatePicker;

interface IForm {
  from: string;
  to: string;
  order: string;
  payment: string;
  summa: string;
  market: string;
  comment: string;
  search: string;
}

const initialForm: IForm = {
  from: "",
  to: "",
  order: "",
  payment: "",
  summa: "",
  market: "",
  comment: "",
  search: "",
};

const MainDetail = () => {
  const { t } = useTranslation("payment");
  const [form, setForm] = useState(initialForm);
  const [showMarket, setShowMarket] = useState(false);
  const [showCurier, setShowCurier] = useState(false);
  const [spand, setSpand] = useState(false);
  const [select, setSelect] = useState<null | string>(null);
  const [kassa, setMaosh] = useState(false);
  const [showAdminAndRegistrator, setshowAdminAndRegistrator] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [showShiftConfirm, setShowShiftConfirm] = useState(false);
  const [shiftComment, setShiftComment] = useState("");
  const [showShiftWarning, setShowShiftWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<"spend" | "fill" | null>(null);
  const { handleApiError } = useApiNotification();

  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const params = {
    fromDate: form.from,
    toDate: form.to,
  };

  const [show, setShow] = useState(true);
  const { getMarkets } = useMarket();
  const { getCourier } = useCourier();
  const { getCashBoxMain, cashboxSpand, cashboxFill, getCurrentShift, openShift, closeShift } = useCashBox();
  const { getAdminAndRegister } = useUser();

  // Get current shift status
  const { data: shiftData, refetch: refetchShift } = getCurrentShift();

  const searchParam = form.search
    ? { search: form.search } // ✅ faqat search bo‘lsa qo‘shiladi
    : {};

  const { data: adminAndRegisterData } = getAdminAndRegister(
    showAdminAndRegistrator,
    { ...searchParam }
  );

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setForm((prev) => ({
        ...prev,
        search: value,
      }));
    }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const { data, refetch } = getCashBoxMain(params);
  const { data: marketData } = getMarkets(showMarket, { ...searchParam });
  const { data: courierData } = getCourier(showCurier, { ...searchParam });

  useEffect(() => {
    refetch();
  }, []);

  const handleNavigateProfile = () => {
    navigate(`/user-profile/${select}`);
    setSelect(null);
    setshowAdminAndRegistrator(false);
  };

  const handleNavigate = () => {
    navigate(`/payments/cash-detail/${select}`, {
      state: {
        market: data?.data || [],
        selectedMarketId: select,
      },
    });
    setSelect(null);
    setShowMarket(false);
    setShowCurier(false);
  };
  const handleSubmit = () => {
    const data = {
      amount: Number(form.summa.replace(/\D/g, "")),
      type: form.payment,
      comment: form.comment,
    };
    cashboxSpand.mutate(
      { data },
      {
        onSuccess: () => {
          refetch();
          setSpand(false);
          setForm(initialForm);
        },
        onError: (error) => {
          const err = error as AxiosError<{ error?: { message?: string } }>;
          const msg =
            err.response?.data?.error?.message || "Xatolik yuz berdi!";
          handleApiError(err, `${msg}`);
        },
      }
    );
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);

      const params = new URLSearchParams();
      if (form.from) params.append("fromDate", form.from);
      if (form.to) params.append("toDate", form.to);

      const response = await fetch(
        `${BASE_URL}cashbox/main/export?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("x-auth-token")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cashbox-${form.from || "daily"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      message.success(t("messages.exportSuccess") || "Excel fayl yuklandi!");
    } catch (error) {
      message.error(t("messages.exportError") || "Excel yuklab olishda xatolik!");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSalarySubmit = () => {
    const data = {
      amount: Number(form.summa.replace(/\D/g, "")),
      type: form.payment,
      comment: form.comment,
    };

    cashboxFill.mutate(
      { data },
      {
        onSuccess: () => {
          refetch();
          setMaosh(false);
          setForm(initialForm);
        },
        onError: (error) => {
          const err = error as AxiosError<{ error?: { message?: string } }>;
          const msg =
            err.response?.data?.error?.message || "Xatolik yuz berdi!";
          handleApiError(err, `${msg}`);
        },
      }
    );
  };

  const raw = Number(data?.data?.cashbox?.balance || 0);
  const balanceCash = Number(data?.data?.cashbox?.balance_cash || 0);
  const balanceCard = Number(data?.data?.cashbox?.balance_card || 0);

  const handleClose = () => {
    setShowMarket(false);
    setShowCurier(false);
    setshowAdminAndRegistrator(false);
    setSelect(null);
  };

  const hendleCloce = () => {
    setForm(initialForm);
    setSpand(false);
    setMaosh(false);
  };

  // Smena ochish
  const handleOpenShift = () => {
    openShift.mutate(undefined, {
      onSuccess: () => {
        message.success(t("messages.shiftOpened") || "Smena ochildi!");
        refetchShift();
      },
      onError: (error) => {
        const err = error as AxiosError<{ error?: { message?: string } }>;
        const msg = err.response?.data?.error?.message || "Xatolik yuz berdi!";
        handleApiError(err, msg);
      },
    });
  };

  // Smena yopish va avtomatik Excel yuklash
  const handleCloseShift = async () => {
    setIsClosingShift(true);
    try {
      // 1. Smenani yopish
      await closeShift.mutateAsync(shiftComment);

      // 2. Avtomatik Excel yuklash
      const response = await fetch(`${BASE_URL}cashbox/shift/export`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("x-auth-token")}`,
        },
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smena-hisobot-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      message.success(t("messages.shiftClosed") || "Smena yopildi va hisobot yuklandi!");
      setShowShiftConfirm(false);
      setShiftComment("");
      refetchShift();
      refetch();
    } catch (error) {
      const err = error as AxiosError<{ error?: { message?: string } }>;
      const msg = err.response?.data?.error?.message || "Xatolik yuz berdi!";
      handleApiError(err, msg);
    } finally {
      setIsClosingShift(false);
    }
  };

  const isShiftOpen = shiftData?.data?.shift?.status === "open";

  return (
    <div className="bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] px-4 sm:px-6 py-6">
      <div className="max-w-screen-2xl mx-auto flex gap-8 lg:gap-16 max-lg:flex-col">
        <div className="lg:max-w-[520px] w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                {t("title")}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Asosiy kassa boshqaruvi
              </p>
            </div>
          </div>

          <CashboxCard
            role={"superadmin"}
            name={data?.data?.cashbox?.user?.name}
            raw={raw}
            balanceCash={balanceCash}
            balanceCard={balanceCard}
            show={show}
            setShow={setShow}
            isMainCashbox={true}
          />

          {/* === ACTION BUTTONS - Modern Circular Design === */}
          <div className="mt-8">
            <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
              {/* Kuryerdan olish */}
              <button
                onClick={() => setShowCurier(true)}
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/40 group-hover:shadow-emerald-500/60 group-hover:scale-110 group-active:scale-95 transition-all duration-300">
                    <BanknoteArrowDown size={24} className="text-white" />
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-600 dark:text-gray-300 text-center max-w-[60px] leading-tight">
                  {t("kuriyerdanOlish") || "Kuryerdan"}
                </span>
              </button>

              {/* Marketga to'lash */}
              <button
                onClick={() => setShowMarket(true)}
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500 flex items-center justify-center shadow-xl shadow-blue-500/40 group-hover:shadow-blue-500/60 group-hover:scale-110 group-active:scale-95 transition-all duration-300">
                    <BanknoteArrowUp size={24} className="text-white" />
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-600 dark:text-gray-300 text-center max-w-[60px] leading-tight">
                  {t("marketgaTo'lash") || "Marketga"}
                </span>
              </button>

              {/* Kassadan sarflash */}
              <button
                onClick={() => {
                  if (!isShiftOpen) {
                    setPendingAction("spend");
                    setShowShiftWarning(true);
                  } else {
                    setSpand(true);
                    setMaosh(false);
                  }
                }}
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-red-400 via-rose-500 to-pink-500 flex items-center justify-center shadow-xl shadow-red-500/40 group-hover:shadow-red-500/60 group-hover:scale-110 group-active:scale-95 transition-all duration-300">
                    <CircleMinus size={24} className="text-white" />
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-600 dark:text-gray-300 text-center max-w-[60px] leading-tight">
                  {t("kassadanSarflash") || "Chiqim"}
                </span>
              </button>

              {/* Kassani to'ldirish */}
              <button
                onClick={() => {
                  if (!isShiftOpen) {
                    setPendingAction("fill");
                    setShowShiftWarning(true);
                  } else {
                    setMaosh(true);
                    setSpand(false);
                  }
                }}
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-green-400 via-emerald-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-green-500/40 group-hover:shadow-green-500/60 group-hover:scale-110 group-active:scale-95 transition-all duration-300">
                    <CirclePlus size={24} className="text-white" />
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-600 dark:text-gray-300 text-center max-w-[60px] leading-tight">
                  {t("kassaniTo'ldirish") || "Kirim"}
                </span>
              </button>

              {/* Maosh to'lash */}
              <button
                onClick={() => setshowAdminAndRegistrator(true)}
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div className="relative">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-500 flex items-center justify-center shadow-xl shadow-amber-500/40 group-hover:shadow-amber-500/60 group-hover:scale-110 group-active:scale-95 transition-all duration-300">
                    <Wallet size={24} className="text-white" />
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-600 dark:text-gray-300 text-center max-w-[60px] leading-tight">
                  {t("maoshTo'lash") || "Maosh"}
                </span>
              </button>
            </div>

            {/* Secondary Actions - Pills */}
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              {/* Excel export */}
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20 text-purple-600 dark:text-purple-400 hover:from-purple-500/20 hover:to-indigo-500/20 transition-all duration-200 cursor-pointer border border-purple-200/50 dark:border-purple-700/50 disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                <span className="text-sm font-medium">{t("button.export") || "Excel"}</span>
              </button>

              {/* Smena tugmasi */}
              {isShiftOpen ? (
                <button
                  onClick={() => setShowShiftConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/10 to-red-500/10 dark:from-orange-500/20 dark:to-red-500/20 text-orange-600 dark:text-orange-400 hover:from-orange-500/20 hover:to-red-500/20 transition-all duration-200 cursor-pointer border border-orange-200/50 dark:border-orange-700/50"
                >
                  <Square size={16} />
                  <span className="text-sm font-medium">{t("button.closeShift") || "Smenani yopish"}</span>
                </button>
              ) : (
                <button
                  onClick={handleOpenShift}
                  disabled={openShift.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-teal-500/10 to-cyan-500/10 dark:from-teal-500/20 dark:to-cyan-500/20 text-teal-600 dark:text-teal-400 hover:from-teal-500/20 hover:to-cyan-500/20 transition-all duration-200 cursor-pointer border border-teal-200/50 dark:border-teal-700/50 disabled:opacity-50"
                >
                  {openShift.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  <span className="text-sm font-medium">{t("button.openShift") || "Smena ochish"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Smena status ko'rsatgich */}
          {isShiftOpen && shiftData?.data?.shift && (
            <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                <Clock size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  {t("shiftStatus.open") || "Smena ochiq"}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {shiftData.data.shift.openedByUser?.name || ""}
                </p>
              </div>
            </div>
          )}

      </div>

      {/* === FILTERS & HISTORY === */}
      <div className="w-full lg:flex-1">
        {/* Modern Filter Card */}
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-5 mb-6">
          {/* Header with date info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Clock size={18} className="text-white" />
              </div>
              <div>
                {form.from === "" ? (
                  <>
                    <h3 className="font-bold text-gray-800 dark:text-white">{t("today")}</h3>
                    <p className="text-xs text-gray-400">Bugungi operatsiyalar</p>
                  </>
                ) : form.from === form.to ? (
                  <>
                    <h3 className="font-bold text-gray-800 dark:text-white">{form.from}</h3>
                    <p className="text-xs text-gray-400">{t("day")} operatsiyalari</p>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-gray-800 dark:text-white">
                      {form.from} - {form.to}
                    </h3>
                    <p className="text-xs text-gray-400">{t("o'tkazmalar")}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {isMobile ? (
                <CustomCalendar
                  from={form.from ? dayjs(form.from) : null}
                  to={form.to ? dayjs(form.to) : null}
                  setFrom={(date: any) =>
                    setForm((prev) => ({
                      ...prev,
                      from: date.format("YYYY-MM-DD"),
                    }))
                  }
                  setTo={(date: any) =>
                    setForm((prev) => ({
                      ...prev,
                      to: date.format("YYYY-MM-DD"),
                    }))
                  }
                />
              ) : (
                <RangePicker
                  value={[
                    form.from ? dayjs(form.from) : null,
                    form.to ? dayjs(form.to) : null,
                  ]}
                  onChange={(dates) => {
                    setForm((prev) => ({
                      ...prev,
                      from: dates?.[0] ? dates[0].format("YYYY-MM-DD") : "",
                      to: dates?.[1] ? dates[1].format("YYYY-MM-DD") : "",
                    }));
                  }}
                  placeholder={[`${t("start")}`, `${t("end")}`]}
                  format="YYYY-MM-DD"
                  size="large"
                  className="w-full !rounded-xl !border-gray-200 dark:!border-gray-700 hover:!border-purple-400 focus:!border-purple-500"
                />
              )}
            </div>
            {(form.from || form.to) && (
              <button
                onClick={() => setForm((prev) => ({ ...prev, from: "", to: "" }))}
                className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* History Section */}
        <CashboxHistory
          form={form}
          income={data?.data?.income}
          outcome={data?.data?.outcome}
          cashboxHistory={data?.data?.cashboxHistory}
        />
      </div>

      {/* === POPUP MARKET === */}
      <PaymentPopup isShow={showMarket} onClose={() => handleClose()}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[600px] max-md:w-full overflow-hidden max-h-[85vh] sm:max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-4 py-4 sm:px-6 sm:py-5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <BanknoteArrowUp size={20} className="text-white sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-bold text-white truncate">
                    {t("berilishiKerak") || "Marketga to'lash"}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/70">Marketni tanlang</p>
                </div>
              </div>
              <button
                onClick={() => handleClose()}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
              >
                <X size={18} className="text-white" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                defaultValue={form.search}
                onChange={handleSearchChange}
                type="text"
                placeholder={`${t("search") || "Qidirish"}...`}
                className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-2">
              {marketData?.data?.data?.map((item: any, inx: number) => (
                <div
                  key={item?.id}
                  onClick={() => setSelect(item?.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    item.id === select
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30"
                      : "bg-gray-50 dark:bg-[#312D4B] hover:bg-gray-100 dark:hover:bg-[#3d3759]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      item.id === select ? "bg-white/20" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    }`}>
                      {inx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{item?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        item.id === select ? "text-white" : "text-blue-600 dark:text-blue-400"
                      }`}>
                        {(item?.cashbox?.balance ?? 0).toLocaleString("uz-UZ")}
                      </p>
                      <p className={`text-xs ${item.id === select ? "text-white/70" : "text-gray-400"}`}>
                        UZS
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-2 sm:gap-3 justify-end flex-shrink-0">
            <button
              onClick={() => handleClose()}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer text-sm sm:text-base"
            >
              {t("bekorQilish") || "Bekor qilish"}
            </button>
            <button
              disabled={!select}
              onClick={() => handleNavigate()}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-sm sm:text-base"
            >
              {t("tanlash") || "Tanlash"}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* === ADMIN/REGISTRATOR POPUP === */}
      <PaymentPopup isShow={showAdminAndRegistrator} onClose={() => handleClose()}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[600px] max-md:w-[95%] overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 px-6 py-5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Wallet size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {t("hodimniTanlang") || "Hodimni tanlang"}
                  </h2>
                  <p className="text-sm text-white/70">Maosh to'lash uchun</p>
                </div>
              </div>
              <button
                onClick={() => handleClose()}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                defaultValue={form.search}
                onChange={handleSearchChange}
                type="text"
                placeholder={`${t("search") || "Qidirish"}...`}
                className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] focus:border-amber-400 focus:ring-4 focus:ring-amber-100 dark:focus:ring-amber-900/30 outline-none transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-2">
              {adminAndRegisterData?.data?.data?.map((item: any, inx: number) => {
                const roleColors: Record<string, { bg: string; text: string }> = {
                  admin: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
                  registrator: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
                };
                const colors = roleColors[item?.role] || { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400" };

                return (
                  <div
                    key={item?.id}
                    onClick={() => setSelect(item?.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      item.id === select
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                        : "bg-gray-50 dark:bg-[#312D4B] hover:bg-gray-100 dark:hover:bg-[#3d3759]"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        item.id === select ? "bg-white/20" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                      }`}>
                        {inx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{item?.name}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                          item.id === select ? "bg-white/20 text-white" : colors.bg + " " + colors.text
                        }`}>
                          {item?.role}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-3 justify-end flex-shrink-0">
            <button
              onClick={() => handleClose()}
              className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer"
            >
              {t("bekorQilish") || "Bekor qilish"}
            </button>
            <button
              disabled={!select}
              onClick={() => handleNavigateProfile()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {t("tanlash") || "Tanlash"}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* === POPUP CURIER === */}
      <PaymentPopup isShow={showCurier} onClose={() => handleClose()}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[650px] max-md:w-full overflow-hidden max-h-[85vh] sm:max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-4 py-4 sm:px-6 sm:py-5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <BanknoteArrowDown size={20} className="text-white sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-bold text-white truncate">
                    {t("olinishiKerak") || "Kuryerdan olish"}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/70">Kuryerni tanlang</p>
                </div>
              </div>
              <button
                onClick={() => handleClose()}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
              >
                <X size={18} className="text-white" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                defaultValue={form.search}
                onChange={handleSearchChange}
                type="text"
                placeholder={`${t("search") || "Qidirish"}...`}
                className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/30 outline-none transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-2">
              {courierData?.data?.map((item: any, inx: number) => (
                <div
                  key={item?.id || inx}
                  onClick={() => setSelect(item?.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    item.id === select
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-gray-50 dark:bg-[#312D4B] hover:bg-gray-100 dark:hover:bg-[#3d3759]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      item.id === select ? "bg-white/20" : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {inx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{item?.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                          item.id === select ? "bg-white/20" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        }`}>
                          {item?.region?.name || "—"}
                        </span>
                      </div>
                    </div>
                    <div className={`text-right ${item.id === select ? "" : ""}`}>
                      <p className={`text-lg font-bold ${
                        item.id === select ? "text-white" : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {(item?.cashbox?.balance ?? 0).toLocaleString("uz-UZ")}
                      </p>
                      <p className={`text-xs ${item.id === select ? "text-white/70" : "text-gray-400"}`}>
                        UZS
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-2 sm:gap-3 justify-end flex-shrink-0">
            <button
              onClick={() => handleClose()}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer text-sm sm:text-base"
            >
              {t("bekorQilish") || "Bekor qilish"}
            </button>
            <button
              disabled={!select}
              onClick={() => handleNavigate()}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-sm sm:text-base"
            >
              {t("tanlash") || "Tanlash"}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* === SMENA BOSHLANMAGAN OGOHLANTIRISH POPUP === */>
      <PaymentPopup isShow={showShiftWarning} onClose={() => setShowShiftWarning(false)}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[480px] max-md:w-[95%] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Clock size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {t("shift.notStartedTitle") || "Smena boshlanmagan!"}
                  </h2>
                  <p className="text-sm text-white/70">Ogohlantirish</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowShiftWarning(false);
                  setPendingAction(null);
                }}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 mb-6">
              <p className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">
                {t("shift.notStartedWarning") || "Kassadan pul yechish yoki kiritish uchun avval smenani boshlashingiz kerak. Smena boshlangandan so'ng barcha operatsiyalar qayd etiladi."}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-3 justify-end">
            <button
              onClick={() => {
                setShowShiftWarning(false);
                setPendingAction(null);
              }}
              className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer"
            >
              {t("bekorQilish") || "Bekor qilish"}
            </button>
            <button
              onClick={() => {
                setShowShiftWarning(false);
                openShift.mutate(undefined, {
                  onSuccess: () => {
                    message.success(t("messages.shiftOpened") || "Smena ochildi!");
                    refetchShift();
                    if (pendingAction === "spend") {
                      setSpand(true);
                      setMaosh(false);
                    } else if (pendingAction === "fill") {
                      setMaosh(true);
                      setSpand(false);
                    }
                    setPendingAction(null);
                  },
                  onError: (error) => {
                    const err = error as AxiosError<{ error?: { message?: string } }>;
                    const msg = err.response?.data?.error?.message || "Xatolik yuz berdi!";
                    handleApiError(err, msg);
                    setPendingAction(null);
                  },
                });
              }}
              disabled={openShift.isPending}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {openShift.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{t("shift.opening") || "Ochilmoqda..."}</span>
                </>
              ) : (
                <>
                  <Play size={18} />
                  <span>{t("shift.startAndContinue") || "Smenani boshlash"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* === SMENA YOPISH POPUP === */}
      <PaymentPopup isShow={showShiftConfirm} onClose={() => setShowShiftConfirm(false)}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[500px] max-md:w-[95%] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Square size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {t("shift.closeTitle") || "Smenani yopish"}
                  </h2>
                  <p className="text-sm text-white/70">Smena yakunlash</p>
                </div>
              </div>
              <button
                onClick={() => setShowShiftConfirm(false)}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {t("shift.closeWarning") || "Smenani yopganingizda avtomatik ravishda Excel hisobot yuklab olinadi."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t("shift.comment") || "Izoh (ixtiyoriy)"}
              </label>
              <TextArea
                value={shiftComment}
                onChange={(e) => setShiftComment(e.target.value)}
                placeholder={t("shift.commentPlaceholder") || "Smena haqida izoh..."}
                autoSize={{ minRows: 2, maxRows: 4 }}
                className="!rounded-xl !border-2 !border-gray-200 dark:!border-gray-700 !bg-gray-50 dark:!bg-[#312D4B] dark:!text-white"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-3 justify-end">
            <button
              onClick={() => setShowShiftConfirm(false)}
              className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer"
            >
              {t("bekorQilish") || "Bekor qilish"}
            </button>
            <button
              onClick={handleCloseShift}
              disabled={isClosingShift}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {isClosingShift ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{t("shift.closing") || "Yopilmoqda..."}</span>
                </>
              ) : (
                <>
                  <Square size={18} />
                  <span>{t("shift.close") || "Smenani yopish"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* === KASSADAN SARFLASH POPUP === */}
      <PaymentPopup isShow={spand} onClose={() => hendleCloce()}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[480px] max-md:w-[95%] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <CircleMinus size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {t("kassadanSarflash") || "Kassadan sarflash"}
                  </h2>
                  <p className="text-sm text-white/70">Chiqim operatsiyasi</p>
                </div>
              </div>
              <button
                onClick={() => hendleCloce()}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Summa Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t("summa") || "Summa"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={form.summa}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, "");
                    const formatted = new Intl.NumberFormat("uz-UZ").format(Number(rawValue || 0));
                    handleChange({
                      ...e,
                      target: { ...e.target, name: "summa", value: formatted },
                    } as any);
                  }}
                  type="text"
                  placeholder="0"
                  className="w-full px-4 py-3 pr-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] focus:border-red-400 focus:ring-4 focus:ring-red-100 dark:focus:ring-red-900/30 outline-none transition-all text-lg font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                  UZS
                </span>
              </div>
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t("paymentType") || "To'lov turi"} <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.payment || undefined}
                onChange={(value) => setForm((prev) => ({ ...prev, payment: value }))}
                placeholder={t("paymentType") || "To'lov turini tanlang"}
                className="w-full !h-12 [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-2 [&_.ant-select-selector]:!border-gray-200 dark:[&_.ant-select-selector]:!border-gray-700 [&_.ant-select-selector]:!bg-gray-50 dark:[&_.ant-select-selector]:!bg-[#312D4B]"
                size="large"
                options={[
                  { value: "cash", label: `💵 ${t("cash") || "Naqd"}` },
                  { value: "click", label: `💳 ${t("click") || "Click/Karta"}` },
                ]}
              />
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t("comment") || "Izoh"}
              </label>
              <TextArea
                value={form.comment}
                onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder={`${t("comment") || "Izoh"}...`}
                autoSize={{ minRows: 2, maxRows: 4 }}
                className="!rounded-xl !border-2 !border-gray-200 dark:!border-gray-700 !bg-gray-50 dark:!bg-[#312D4B] dark:!text-white"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-3 justify-end">
            <button
              onClick={() => hendleCloce()}
              className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer"
            >
              {t("bekorQilish") || "Bekor qilish"}
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={
                cashboxSpand.isPending ||
                !form.payment ||
                !form.summa ||
                Number(form.summa.replace(/\s/g, "")) <= 0
              }
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {cashboxSpand.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Yuklanmoqda...</span>
                </>
              ) : (
                <>
                  <CircleMinus size={18} />
                  <span>{t("qabulQilish") || "Tasdiqlash"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* === KASSAGA QO'SHISH POPUP === */}
      <PaymentPopup isShow={kassa} onClose={() => hendleCloce()}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[480px] max-md:w-[95%] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <CirclePlus size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {t("kassagaQo'shish") || "Kassaga qo'shish"}
                  </h2>
                  <p className="text-sm text-white/70">Kirim operatsiyasi</p>
                </div>
              </div>
              <button
                onClick={() => hendleCloce()}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Summa Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t("summa") || "Summa"} <span className="text-emerald-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={form.summa}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, "");
                    const formatted = new Intl.NumberFormat("uz-UZ").format(Number(rawValue || 0));
                    handleChange({
                      ...e,
                      target: { ...e.target, name: "summa", value: formatted },
                    } as any);
                  }}
                  type="text"
                  placeholder="0"
                  className="w-full px-4 py-3 pr-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/30 outline-none transition-all text-lg font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                  UZS
                </span>
              </div>
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t("paymentType") || "To'lov turi"} <span className="text-emerald-500">*</span>
              </label>
              <Select
                value={form.payment || undefined}
                onChange={(value) => setForm((prev) => ({ ...prev, payment: value }))}
                placeholder={t("paymentType") || "To'lov turini tanlang"}
                className="w-full !h-12 [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-2 [&_.ant-select-selector]:!border-gray-200 dark:[&_.ant-select-selector]:!border-gray-700 [&_.ant-select-selector]:!bg-gray-50 dark:[&_.ant-select-selector]:!bg-[#312D4B]"
                size="large"
                options={[
                  { value: "cash", label: `💵 ${t("cash") || "Naqd"}` },
                  { value: "click", label: `💳 ${t("click") || "Click/Karta"}` },
                ]}
              />
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t("comment") || "Izoh"}
              </label>
              <TextArea
                value={form.comment}
                onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder={`${t("comment") || "Izoh"}...`}
                autoSize={{ minRows: 2, maxRows: 4 }}
                className="!rounded-xl !border-2 !border-gray-200 dark:!border-gray-700 !bg-gray-50 dark:!bg-[#312D4B] dark:!text-white"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-3 justify-end">
            <button
              onClick={() => hendleCloce()}
              className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer"
            >
              {t("bekorQilish") || "Bekor qilish"}
            </button>
            <button
              onClick={() => handleSalarySubmit()}
              disabled={
                cashboxFill.isPending ||
                !form.payment ||
                !form.summa ||
                Number(form.summa.replace(/\s/g, "")) <= 0
              }
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {cashboxFill.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Yuklanmoqda...</span>
                </>
              ) : (
                <>
                  <CirclePlus size={18} />
                  <span>{t("qabulQilish") || "Tasdiqlash"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </PaymentPopup>
      </div>
    </div>
  );
};

export default memo(MainDetail);
