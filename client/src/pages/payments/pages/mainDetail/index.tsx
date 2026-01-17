import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form } from "antd";
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
    <div className="px-5 mt-5 flex gap-24 max-md:flex-col">
      <div>
        <h2 className="flex items-center mb-5 text-[30px] font-medium capitalize">
          {t("title")}
        </h2>
        <CashboxCard
          role={"superadmin"}
          name={data?.data?.cashbox?.user?.name}
          raw={raw}
          balanceCash={balanceCash}
          balanceCard={balanceCard}
          show={show}
          setShow={setShow}
        />

        {/* === BUTTONLAR 1 QATORDA === */}
        <div className="mt-5 flex gap-3 flex-nowrap">
          <button
            title={t("kuriyerdanOlish")}
            onClick={() => setShowCurier(true)}
            className="rounded-full cursor-pointer p-3 bg-green-500 text-white hover:bg-green-600 transition flex items-center justify-center shadow-md"
          >
            <BanknoteArrowDown size={22} />
          </button>
          <button
            title={t("marketgaTo'lash")}
            onClick={() => setShowMarket(true)}
            className="rounded-full cursor-pointer p-3 bg-blue-500 text-white hover:bg-blue-600 transition flex items-center justify-center shadow-md"
          >
            <BanknoteArrowUp size={22} />
          </button>
          <button
            title={t("kassadanSarflash")}
            onClick={() => {
              if (!isShiftOpen) {
                setPendingAction("spend");
                setShowShiftWarning(true);
              } else {
                setSpand(true);
                setMaosh(false);
              }
            }}
            className="rounded-full cursor-pointer p-3 bg-red-500 text-white hover:bg-red-600 transition flex items-center justify-center shadow-md"
          >
            <CircleMinus size={22} />
          </button>
          <button
            title={t("kassaniTo'ldirish")}
            onClick={() => {
              if (!isShiftOpen) {
                setPendingAction("fill");
                setShowShiftWarning(true);
              } else {
                setMaosh(true);
                setSpand(false);
              }
            }}
            className="rounded-full cursor-pointer p-3 bg-green-500 text-white hover:bg-green-600 transition flex items-center justify-center shadow-md"
          >
            <CirclePlus size={22} />
          </button>

          <button
            title={t("maoshTo'lash")}
            onClick={() => setshowAdminAndRegistrator(true)}
            className="rounded-full cursor-pointer p-3 bg-amber-500 text-white hover:bg-amber-600 transition flex items-center justify-center shadow-md"
          >
            <Wallet size={22} />
          </button>

          <button
            title={t("button.export") || "Excelga yuklab olish"}
            onClick={handleExportExcel}
            disabled={isExporting}
            className="rounded-full cursor-pointer p-3 bg-purple-500 text-white hover:bg-purple-600 transition flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <Download size={22} />
            )}
          </button>

          {/* Smena tugmasi */}
          {isShiftOpen ? (
            <button
              title={t("button.closeShift") || "Smenani yopish"}
              onClick={() => setShowShiftConfirm(true)}
              className="rounded-full cursor-pointer p-3 bg-orange-500 text-white hover:bg-orange-600 transition flex items-center justify-center shadow-md"
            >
              <Square size={22} />
            </button>
          ) : (
            <button
              title={t("button.openShift") || "Smena ochish"}
              onClick={handleOpenShift}
              disabled={openShift.isPending}
              className="rounded-full cursor-pointer p-3 bg-teal-500 text-white hover:bg-teal-600 transition flex items-center justify-center shadow-md disabled:opacity-50"
            >
              {openShift.isPending ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <Play size={22} />
              )}
            </button>
          )}
        </div>

        {/* Smena status ko'rsatgich */}
        {isShiftOpen && shiftData?.data?.shift && (
          <div className="mt-3 p-3 bg-green-100 dark:bg-green-900 rounded-lg flex items-center gap-2">
            <Clock size={18} className="text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300">
              {t("shiftStatus.open") || "Smena ochiq"} - {shiftData.data.shift.openedByUser?.name || ""}
            </span>
          </div>
        )}

        {/* === Agar kassadan sarflash bosilsa form chiqadi === */}
        {spand && (
          <div className="mt-5">
            <h2>{t("kassadanSarflash")}</h2>
            <div className="flex gap-4 items-center mt-3">
              <input
                name={t("summa")}
                value={form.summa}
                onChange={(e) => {
                  // faqat raqamlarni olish
                  const rawValue = e.target.value.replace(/\D/g, "");
                  // formatlab chiqarish (1,000 → 10,000)
                  const formatted = new Intl.NumberFormat("uz-UZ").format(
                    Number(rawValue || 0)
                  );

                  // state-ni yangilash
                  handleChange({
                    ...e,
                    target: {
                      ...e.target,
                      name: "summa",
                      value: formatted,
                    },
                  } as any);
                }}
                type="text"
                placeholder={t("summa")}
                className="border rounded-md px-2 py-0.75 border-[#d1cfd4] outline-none hover:border-blue-400 w-[150px]"
              />
              <Select
                value={form.payment}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, payment: value }))
                }
                placeholder={t("to'lovTuri")}
                className="w-[150px]"
                options={[
                  {
                    value: "",
                    label: (
                      <span style={{ color: "#a0a0a0" }}>
                        {t("paymentType")}
                      </span>
                    ),
                    disabled: true,
                  },
                  { value: "cash", label: "cash" },
                  { value: "click", label: "click" },
                ]}
              />
            </div>
            <div className="mt-5">
              <Form>
                <Form.Item
                  name={t("comment")}
                  rules={[{ required: true, message: "Izohni kiriting!" }]}
                >
                  <TextArea placeholder={t("comment")} autoSize />
                </Form.Item>
              </Form>

              <div className="flex gap-5">
                <button
                  onClick={() => handleSubmit()}
                  disabled={
                    cashboxSpand.isPending ||
                    !form.payment ||
                    !form.summa ||
                    Number(form.summa.replace(/\s/g, "")) <= 0
                  }
                  className={`mt-5 py-1.5 px-3 rounded-md transition-colors ${
                    !form.payment ||
                    !form.summa ||
                    Number(form.summa.replace(/\s/g, "")) <= 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-[#9D70FF] hover:bg-[#9d70ffe0] text-white"
                  }`}
                >
                  {cashboxSpand.isPending ? (
                    <div className="relative w-full flex justify-center">
                      <Loader2 className="w-5 h-5 animate-spin absolute" />
                      <span className="opacity-0">{t("qabulQilish")}</span>
                    </div>
                  ) : (
                    t("qabulQilish")
                  )}
                </button>
                <button
                  onClick={() => hendleCloce()}
                  className="mt-5 bg-white py-1.5 px-3 rounded-md hover:text-[#9d70ffe0] text-[#9D70FF] border"
                >
                  {t("bekorQilish")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === kassani to'ldirishni bosganda === */}
        {kassa && (
          <div className="mt-5">
            <h2>{t("kassagaQo'shish")}</h2>
            <div className="flex gap-4 items-center mt-3">
              <input
                name={t("summa")}
                value={form.summa}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, "");
                  const formatted = new Intl.NumberFormat("uz-UZ").format(
                    Number(rawValue || 0)
                  );

                  handleChange({
                    ...e,
                    target: {
                      ...e.target,
                      name: "summa",
                      value: formatted,
                    },
                  } as any);
                }}
                type="text"
                placeholder="summa"
                className="border rounded-md px-2 py-0.75 border-[#d1cfd4] outline-none hover:border-blue-400 w-[150px]"
              />
              <Select
                value={form.payment}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, payment: value }))
                }
                placeholder="To'lov turi"
                className="w-[150px]"
                options={[
                  {
                    value: "",
                    label: (
                      <span style={{ color: "#a0a0a0" }}>
                        {t("paymentType")}
                      </span>
                    ),
                    disabled: true,
                  },
                  { value: "cash", label: `${t("cash")}` },
                  { value: "click", label: `${t("click")}` },
                ]}
              />
            </div>
            <div className="mt-5">
              <Form>
                <Form.Item
                  name="comment"
                  rules={[
                    { required: true, message: "Izoh kiritish majburiy!" },
                  ]}
                >
                  <TextArea placeholder={`${t("comment")}...`} autoSize />
                </Form.Item>
              </Form>

              <div className="flex gap-5">
                <button
                  onClick={() => handleSalarySubmit()}
                  disabled={
                    cashboxFill.isPending ||
                    !form.payment ||
                    !form.summa ||
                    Number(form.summa.replace(/\s/g, "")) <= 0
                  }
                  className={`mt-5 py-1.5 px-3 min-w-[125px] rounded-md transition-colors ${
                    !form.payment ||
                    !form.summa ||
                    Number(form.summa.replace(/\s/g, "")) <= 0
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-[#9D70FF] hover:bg-[#9d70ffe0] text-white"
                  }`}
                >
                  {cashboxFill.isPending ? (
                    <div className="relative w-full flex justify-center">
                      <Loader2 className="w-5 h-5 animate-spin absolute" />
                      <span className="opacity-0">{t("qabulQilish")}</span>
                    </div>
                  ) : (
                    t("qabulQilish")
                  )}
                </button>
                <button
                  onClick={() => hendleCloce()}
                  className="mt-5 bg-white py-1.5 px-3 rounded-md hover:text-[#9d70ffe0] text-[#9D70FF] border"
                >
                  {t("bekorQilish")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === FILTERS & HISTORY === */}
      <div className="w-full">
        {form.from == "" && (
          <h2 className="mb-5 text-[20px] font-medium">{t("today")}</h2>
        )}

        {form.from !== "" && form.from === form.to && (
          <h2 className="mb-5 text-[20px] font-medium">
            {form.from} {t("day")}
          </h2>
        )}

        {form.from !== "" && form.from !== form.to && (
          <h2 className="mb-5 text-[20px] font-medium">
            {form.from} <span className="text-[15px]">{t("dan")}</span>{" "}
            {form.to} <span className="text-[15px]">{t("gacha")}</span>{" "}
            {t("o'tkazmalar")}
          </h2>
        )}
        <div className="flex flex-row items-center gap-7 max-[550px]:w-[100%] max-[640px]:flex-col max-[640px]:gap-0">
          <h2 className="text-[20px] font-medium mb-2">{t("filters")}:</h2>
          <div className="w-full flex justify-between">
            <div className="flex gap-5 max-[640px]:gap-0  w-full">
              {isMobile ? (
                // Mobile uchun custom date inputs (faqat text input + popup)
                <div className="flex flex-col gap-2 w-full">
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
                </div>
              ) : (
                // Desktop uchun Antd RangePicker
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
                  className="w-[340px] max-md:w-[100%] border border-[#E5E7EB] rounded-lg px-3 py-[6px] outline-none"
                />
              )}
            </div>
          </div>
        </div>
        <div className="max-md:mb-5">
          <CashboxHistory
            form={form}
            income={data?.data?.income}
            outcome={data?.data?.outcome}
            cashboxHistory={data?.data?.cashboxHistory}
          />
        </div>
      </div>

      {/* === POPUP MARKET === */}
      <PaymentPopup isShow={showMarket} onClose={() => handleClose()}>
        <div className="bg-white dark:bg-[#28243d] rounded-xl shadow-xl w-[900px] h-[680px] px-6 py-6 relative flex flex-col max-md:w-[90%] max-md:h-[600px] transition-all duration-300">
          <button
            onClick={() => handleClose()}
            className="absolute top-4 right-4 flex items-center justify-center 
w-9 h-9 rounded-md
bg-[#ef4444] hover:bg-[#dc2626] 
text-white shadow-lg 
transition-all duration-200 
hover:scale-110 active:scale-95
cursor-pointer"
          >
            <X size={30} />
          </button>

          <h1 className="font-bold text-left pt-10">{t("berilishiKerak")}</h1>

          {/* Qidiruv input */}
          <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
            <input
              defaultValue={form.search}
              onChange={handleSearchChange}
              type="text"
              placeholder={`${t("search")}...`}
              className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
            />
            <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
          </div>

          {/* Jadval qismi */}
          <div className="mt-4 rounded-md border border-[#9d70ff1f] dark:border-[#2E263DB2] overflow-hidden">
            {/* Jadval headeri */}
            <div className="overflow-hidden">
              <table className="w-full border-collapse cursor-pointer">
                <thead className="dark:bg-[#3d3759] bg-[#9d70ff]">
                  <tr>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        # ID
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[201px]">
                        {t("marketName")}
                      </div>
                    </th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scroll qismi */}
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-[#555] dark:scrollbar-track-[#2E263D]">
              <table className="w-full border-collapse cursor-pointer">
                <tbody className="text-[16px] text-[#2E263DB2] dark:text-[#FFFFFF] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F] font-medium">
                  {marketData?.data?.data?.map((item: any, inx: number) => (
                    <tr
                      key={item?.id}
                      onClick={() => setSelect(item?.id)}
                      className={`border-b-1 border-b-[#444444] border-[#f4f5fa] dark:border-[#E7E3FCB2] font-medium text-[16px] text-[#2E263DB2] dark:text-white ${
                        item.id == select ? "bg-gray-300 text-black" : ""
                      }`}
                    >
                      <td
                        className="text-[#8C57FF] pr-10 py-3 pl-5"
                        data-cell="# ID"
                      >
                        {inx + 1}
                      </td>

                      <td className="pr-26 py-3" data-cell={t("marketName")}>
                        {item?.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tanlash tugmasi */}
          <div className="flex justify-end py-2">
            <button
              disabled={!select ? true : false}
              onClick={() => handleNavigate()}
              className={`px-6 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 absolute bottom-2 right-4 ${
                !select ? "" : "hover:bg-blue-600"
              } text-white rounded-md cursor-pointer ${
                !select ? "opacity-40" : ""
              }`}
            >
              {t("tanlash")}
            </button>
          </div>
        </div>
      </PaymentPopup>

      <PaymentPopup
        isShow={showAdminAndRegistrator}
        onClose={() => handleClose()}
      >
        <div className="bg-white dark:bg-[#28243d] rounded-xl shadow-xl w-[900px] h-[680px] px-6 py-6 relative flex flex-col max-md:w-[90%] max-md:h-[600px] transition-all duration-300">
          <button
            onClick={() => handleClose()}
            className="absolute top-4 right-4 flex items-center justify-center 
w-9 h-9 rounded-md
bg-[#ef4444] hover:bg-[#dc2626] 
text-white shadow-lg 
transition-all duration-200 
hover:scale-110 active:scale-95
cursor-pointer"
          >
            <X size={30} />
          </button>

          <h1 className="font-bold text-left pt-10">{t("hodimniTanlang")}</h1>

          {/* Qidiruv input */}
          <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
            <input
              defaultValue={form.search}
              onChange={handleSearchChange}
              type="text"
              placeholder={`${t("search")}...`}
              className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
            />
            <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
          </div>

          {/* Jadval qismi */}
          <div className="mt-4 rounded-md border border-[#9d70ff1f] dark:border-[#2E263DB2] overflow-hidden">
            {/* Jadval sarlavhasi (thead) */}
            <div className="overflow-hidden">
              <table className="w-full border-collapse cursor-pointer">
                <thead className="dark:bg-[#3d3759] bg-[#9d70ff]">
                  <tr>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        #
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t("hodimName")}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t("rol")}
                      </div>
                    </th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scroll qilinuvchi tbody */}
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-[#555] dark:scrollbar-track-[#2E263D]">
              <table className="w-full border-collapse cursor-pointer">
                <tbody className="text-[16px] text-[#2E263DB2] dark:text-[#FFFFFF] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F] font-medium">
                  {adminAndRegisterData?.data?.data?.map(
                    (item: any, inx: number) => (
                      <tr
                        key={item?.id}
                        onClick={() => setSelect(item?.id)}
                        className={`border-b-1 border-b-[#444444] border-[#f4f5fa] dark:border-[#E7E3FCB2] font-medium text-[16px] text-[#2E263DB2] dark:text-white ${
                          item.id == select ? "bg-gray-300 text-black" : ""
                        }`}
                      >
                        <td
                          className="text-[#8C57FF] pr-10 pl-5 py-3"
                          data-cell="#"
                        >
                          {inx + 1}
                        </td>

                        <td
                          className="pr-26 py-3 pl-20"
                          data-cell={t("hodimName")}
                        >
                          {item?.name}
                        </td>

                        <td className="pr-26 py-3" data-cell={t("rol")}>
                          {item?.role}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tanlash tugmasi */}
          <div className="flex justify-end py-2">
            <button
              disabled={!select}
              onClick={() => handleNavigateProfile()}
              className={`px-6 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 absolute bottom-2 right-4 ${
                !select ? "" : "hover:bg-blue-600"
              } text-white rounded-md cursor-pointer ${
                !select ? "opacity-40" : ""
              }`}
            >
              {t("tanlash")}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* === POPUP CURIER === */}
      <PaymentPopup isShow={showCurier} onClose={() => handleClose()}>
        <div className="bg-white dark:bg-[#28243d] rounded-xl shadow-xl w-[900px] h-[680px] px-6 py-6 relative flex flex-col max-md:w-[90%] max-md:h-[600px] transition-all duration-300">
          {/* Yopish tugmasi */}
          <button
            onClick={() => handleClose()}
            className="absolute top-4 right-4 flex items-center justify-center 
w-9 h-9 rounded-md
bg-[#ef4444] hover:bg-[#dc2626] 
text-white shadow-lg 
transition-all duration-200 
hover:scale-110 active:scale-95
cursor-pointer"
          >
            <X size={30} />
          </button>

          {/* Sarlavha */}
          <h1 className="font-bold text-left pt-10">{t("olinishiKerak")}</h1>

          {/* Qidiruv */}
          <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
            <input
              defaultValue={form.search}
              onChange={handleSearchChange}
              type="text"
              placeholder={`${t("search")}`}
              className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
            />
            <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
          </div>

          {/* Jadval qismi */}
          <div className="mt-4 rounded-md border border-[#9d70ff1f] dark:border-[#2E263DB2] overflow-hidden">
            {/* Jadval headeri (qotib turadigan qism) */}
            <div className="overflow-hidden">
              <table className="w-full border-collapse cursor-pointer">
                <thead className="dark:bg-[#3d3759] bg-[#9d70ff]">
                  <tr>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        # ID
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]" />
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t("courierName")}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]" />
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t("region")}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]" />
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t("olinishiKerakSumma")}
                      </div>
                    </th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scroll bo‘luvchi tbody qismi */}
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-[#555] dark:scrollbar-track-[#2E263D]">
              <table className="w-full border-collapse cursor-pointer">
                <tbody className="text-[16px] text-[#2E263DB2] dark:text-[#FFFFFF] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F] font-medium">
                  {courierData?.data?.map((item: any, inx: number) => (
                    <tr
                      key={inx}
                      onClick={() => setSelect(item?.id)}
                      className={`border-b-1 border-[#f4f5fa] dark:border-[#E7E3FCB2] text-[16px] text-[#2E263DB2] dark:text-[#FFFFFF] font-medium ${
                        item.id == select
                          ? "bg-gray-300 text-black"
                          : "hover:bg-blue-100 dark:hover:bg-[#3d3759]"
                      }`}
                    >
                      <td
                        className="text-[#8C57FF] pr-10 py-3 pl-5"
                        data-cell="# ID"
                      >
                        {inx + 1}
                      </td>

                      <td className="py-3 pl-5" data-cell={t("courierName")}>
                        {item?.name}
                      </td>

                      <td className="py-3 pl-5" data-cell={t("region")}>
                        {item?.region?.name}
                      </td>

                      <td
                        className="py-3 pl-5"
                        data-cell={t("olinishiKerakSumma")}
                      >
                        {item?.cashbox?.balance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tanlash tugmasi */}
          <div className="flex justify-end py-2">
            <button
              disabled={!select ? true : false}
              onClick={() => handleNavigate()}
              className={`px-6 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 absolute bottom-2 right-4 ${
                !select ? "" : "hover:bg-blue-600"
              } text-white rounded-md cursor-pointer ${
                !select ? "opacity-40" : ""
              }`}
            >
              {t("tanlash")}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* === SMENA BOSHLANMAGAN OGOHLANTIRISH POPUP === */}
      <PaymentPopup isShow={showShiftWarning} onClose={() => setShowShiftWarning(false)}>
        <div className="bg-white dark:bg-[#28243d] rounded-xl shadow-xl w-[450px] px-6 py-6 relative max-md:w-[90%] transition-all duration-300">
          <button
            onClick={() => {
              setShowShiftWarning(false);
              setPendingAction(null);
            }}
            className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-md bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
          >
            <X size={24} />
          </button>

          <div className="flex items-center gap-3 mb-4 pt-2">
            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Clock size={24} className="text-orange-500" />
            </div>
            <h1 className="font-bold text-xl">
              {t("shift.notStartedTitle") || "Smena boshlanmagan!"}
            </h1>
          </div>

          <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
            <p className="text-sm text-orange-700 dark:text-orange-300">
              {t("shift.notStartedWarning") || "Kassadan pul yechish yoki kiritish uchun avval smenani boshlashingiz kerak. Smena boshlangandan so'ng barcha operatsiyalar qayd etiladi."}
            </p>
          </div>

          <div className="flex gap-4 justify-end">
            <button
              onClick={() => {
                setShowShiftWarning(false);
                setPendingAction(null);
              }}
              className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 transition"
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
                    // Kutilgan amalni bajarish
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
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-md transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {openShift.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t("shift.opening") || "Ochilmoqda..."}
                </>
              ) : (
                <>
                  <Play size={18} />
                  {t("shift.startAndContinue") || "Smenani boshlash"}
                </>
              )}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* === SMENA YOPISH POPUP === */}
      <PaymentPopup isShow={showShiftConfirm} onClose={() => setShowShiftConfirm(false)}>
        <div className="bg-white dark:bg-[#28243d] rounded-xl shadow-xl w-[500px] px-6 py-6 relative max-md:w-[90%] transition-all duration-300">
          <button
            onClick={() => setShowShiftConfirm(false)}
            className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-md bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
          >
            <X size={24} />
          </button>

          <h1 className="font-bold text-xl mb-4 pt-2">
            {t("shift.closeTitle") || "Smenani yopish"}
          </h1>

          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {t("shift.closeWarning") || "Smenani yopganingizda avtomatik ravishda Excel hisobot yuklab olinadi."}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              {t("shift.comment") || "Izoh (ixtiyoriy)"}
            </label>
            <TextArea
              value={shiftComment}
              onChange={(e) => setShiftComment(e.target.value)}
              placeholder={t("shift.commentPlaceholder") || "Smena haqida izoh..."}
              autoSize={{ minRows: 2, maxRows: 4 }}
              className="w-full"
            />
          </div>

          <div className="flex gap-4 justify-end">
            <button
              onClick={() => setShowShiftConfirm(false)}
              className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 transition"
            >
              {t("bekorQilish") || "Bekor qilish"}
            </button>
            <button
              onClick={handleCloseShift}
              disabled={isClosingShift}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClosingShift ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t("shift.closing") || "Yopilmoqda..."}
                </>
              ) : (
                <>
                  <Square size={18} />
                  {t("shift.close") || "Smenani yopish"}
                </>
              )}
            </button>
          </div>
        </div>
      </PaymentPopup>
    </div>
  );
};

export default memo(MainDetail);
