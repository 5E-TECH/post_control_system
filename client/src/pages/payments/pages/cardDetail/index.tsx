import { memo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Loader2,
  Eye,
  EyeOff,
  Store,
  CircleMinus,
  CirclePlus,
  Search,
  X,
} from "lucide-react";
import { Select, message } from "antd";
import TextArea from "antd/es/input/TextArea";
import type { AxiosError } from "axios";
import { useCashBox } from "../../../../shared/api/hooks/useCashbox";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";
import { SELECT_CLS, SELECT_POPUP_CLS } from "../../../../shared/ui/select-styles";
import PaymentPopup from "../../../../shared/ui/paymentPopup";

const KIND = {
  income: { label: "Kirim", pos: true },
  expense: { label: "Chiqim", pos: false },
  transfer_in: { label: "O'tkazma (kirim)", pos: true },
  transfer_out: { label: "O'tkazma (chiqim)", pos: false },
  convert_in: { label: "Naqddan", pos: true },
  convert_out: { label: "Naqdga", pos: false },
} as const;

const fmt = (n: number) => Number(n || 0).toLocaleString("uz-UZ");
const parseAmount = (s: string) => Number(String(s).replace(/\D/g, "")) || 0;
const apiMsg = (e: unknown, fallback: string) => {
  const err = e as AxiosError<{ message?: string; error?: string }>;
  return (
    err?.response?.data?.message || err?.response?.data?.error || fallback
  );
};

const formatDate = (ts: number) => {
  const d = new Date(Number(ts));
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (d.toDateString() === today.toDateString())
    return { primary: time, secondary: "Bugun" };
  if (d.toDateString() === y.toDateString())
    return { primary: time, secondary: "Kecha" };
  return { primary: d.toLocaleDateString("uz-UZ"), secondary: time };
};

type ModalType = null | "market" | "spend" | "fill";

const CardDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getCardLedger, createPaymentMarket, cashboxSpand, cashboxFill } =
    useCashBox();
  const { getMarkets } = useMarket();

  const { data, isFetching, refetch } = getCardLedger(id || null, undefined, !!id);
  const [show, setShow] = useState(true);

  const card = data?.data?.card;
  const rows: any[] = data?.data?.rows || [];
  const s = data?.data?.summary || {};
  const totalIn =
    (s.real_income || 0) + (s.transfer_in || 0) + (s.convert_in || 0);
  const totalOut =
    (s.real_expense || 0) + (s.transfer_out || 0) + (s.convert_out || 0);

  // ===== Amallar (shu karta ichidan) =====
  const [modal, setModal] = useState<ModalType>(null);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [market, setMarket] = useState<string | undefined>();
  const [marketSearch, setMarketSearch] = useState("");

  const { data: marketData } = getMarkets(modal === "market", {
    search: marketSearch,
    limit: 0,
  });

  const closeModal = () => {
    setModal(null);
    setAmount("");
    setComment("");
    setMarket(undefined);
    setMarketSearch("");
  };

  const onDone = (msg: string) => {
    message.success(msg);
    closeModal();
    refetch();
  };
  const onErr = (e: unknown) => message.error(apiMsg(e, "Xatolik yuz berdi"));

  const handleMarketPay = () => {
    const amt = parseAmount(amount);
    if (!market || amt <= 0) return;
    createPaymentMarket.mutate(
      {
        market_id: market,
        amount: amt,
        payment_method: "click",
        payment_date: new Date().toISOString(),
        comment,
        card_id: id,
      },
      { onSuccess: () => onDone("Marketga to'landi"), onError: onErr },
    );
  };

  const handleSpend = () => {
    const amt = parseAmount(amount);
    if (amt <= 0 || !comment.trim()) return;
    cashboxSpand.mutate(
      { data: { amount: amt, type: "click", comment, card_id: id } },
      { onSuccess: () => onDone("Chiqim bajarildi"), onError: onErr },
    );
  };

  const handleFill = () => {
    const amt = parseAmount(amount);
    if (amt <= 0 || !comment.trim()) return;
    cashboxFill.mutate(
      { data: { amount: amt, type: "click", comment, card_id: id } },
      { onSuccess: () => onDone("Kartaga qo'shildi"), onError: onErr },
    );
  };

  const busy =
    createPaymentMarket.isPending ||
    cashboxSpand.isPending ||
    cashboxFill.isPending;

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] px-4 sm:px-6 py-6">
      <div className="max-w-screen-2xl mx-auto flex gap-8 lg:gap-16 max-lg:flex-col">
        {/* LEFT — virtual karta */}
        <div className="lg:max-w-[520px] w-full">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                Virtual karta
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Asosiy kassa emas — alohida karta hisobi
              </p>
            </div>
          </div>

          {/* Virtual karta vizuali — asosiy kassadan farqli ko'rinish */}
          <div className="w-full max-w-[500px] relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 text-white shadow-2xl min-h-[200px]">
            <div className="absolute inset-0 opacity-15">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-white rounded-full" />
              <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-white rounded-full translate-y-1/2" />
            </div>
            <div className="relative p-5 sm:p-6 flex flex-col h-full justify-between min-h-[200px]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-white/20 px-2 py-1 rounded-md">
                    Virtual karta
                  </span>
                  {card?.is_default && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-yellow-400/30 text-yellow-100">
                      ★ Asosiy
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShow((p) => !p)}
                  className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all cursor-pointer"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="mt-4">
                {/* Chip */}
                <div className="w-11 h-8 rounded-md bg-gradient-to-br from-yellow-200/80 to-yellow-400/80 mb-4" />
                <p className="text-lg font-semibold tracking-wide">
                  {card?.name || "Karta"}
                </p>
              </div>

              <div className="mt-2">
                <p className="text-xs text-white/70 mb-1">Joriy balans</p>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {show ? `${fmt(Number(card?.balance || 0))} UZS` : "●●●●●● UZS"}
                </p>
              </div>
            </div>
          </div>

          {/* Amallar — shu kartadan turib (karta avtomatik tanlangan) */}
          <div className="mt-7">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Shu karta orqali amallar (har safar karta tanlash shart emas):
            </p>
            <div className="flex items-start gap-5 flex-wrap">
              <button
                onClick={() => setModal("market")}
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500 flex items-center justify-center shadow-xl shadow-blue-500/40 group-hover:scale-110 transition-all">
                  <Store size={22} className="text-white" />
                </div>
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 text-center max-w-[64px] leading-tight">
                  Marketga to'lash
                </span>
              </button>

              <button
                onClick={() => setModal("spend")}
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-400 via-rose-500 to-pink-500 flex items-center justify-center shadow-xl shadow-red-500/40 group-hover:scale-110 transition-all">
                  <CircleMinus size={22} className="text-white" />
                </div>
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 text-center max-w-[64px] leading-tight">
                  Sarflash
                </span>
              </button>

              <button
                onClick={() => setModal("fill")}
                className="group flex flex-col items-center gap-2 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 via-emerald-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-green-500/40 group-hover:scale-110 transition-all">
                  <CirclePlus size={22} className="text-white" />
                </div>
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 text-center max-w-[64px] leading-tight">
                  Kartaga qo'shish
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — kirim/chiqim + tarix */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <TrendingUp className="w-5 h-5 text-white/70" />
              </div>
              <p className="text-sm text-white/80">kirim</p>
              <p className="text-2xl font-bold">+{fmt(totalIn)}</p>
              <p className="text-xs text-white/60 mt-0.5">UZS</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <TrendingDown className="w-5 h-5 text-white/70" />
              </div>
              <p className="text-sm text-white/80">chiqim</p>
              <p className="text-2xl font-bold">−{fmt(totalOut)}</p>
              <p className="text-xs text-white/60 mt-0.5">UZS</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Karta tarixi
              </h2>
              <span className="text-xs text-gray-400">
                Joriy balans: {fmt(Number(card?.balance || 0))} UZS
              </span>
            </div>

            {isFetching ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Clock className="opacity-50" size={28} />
                </div>
                <p className="text-sm font-medium">Hali harakat yo'q</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[640px] overflow-y-auto">
                {rows.map((r) => {
                  const cfg = KIND[r.kind as keyof typeof KIND] || {
                    label: r.kind,
                    pos: true,
                  };
                  const dateInfo = formatDate(Number(r.created_at));
                  return (
                    <div
                      key={r.id}
                      className="px-5 py-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                            cfg.pos
                              ? "bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40"
                              : "bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40"
                          }`}
                        >
                          {cfg.pos ? (
                            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white flex items-center gap-1.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                cfg.pos
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              }`}
                            >
                              {cfg.label}
                            </span>
                            {r.counterparty && (
                              <span className="text-gray-500 truncate">
                                {r.counterparty}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {r.created_by_name || "—"}
                            {r.comment ? ` · ${r.comment}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p
                          className={`text-sm font-bold ${
                            cfg.pos
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {cfg.pos ? "+" : "−"}
                          {fmt(r.amount)}
                          <span className="text-xs font-normal ml-0.5">so'm</span>
                        </p>
                        <span className="text-[10px] text-gray-400">
                          Qoldiq: {fmt(r.balance_after || 0)}
                        </span>
                        <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">
                          {dateInfo.primary} · {dateInfo.secondary}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Marketga to'lash (asosiy kassa dizayni) ===== */}
      <PaymentPopup isShow={modal === "market"} onClose={closeModal}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[480px] max-md:w-[95%] overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Store size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Marketga to'lash</h2>
                  <p className="text-sm text-white/70">{card?.name} kartasidan</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Market <span className="text-blue-500">*</span>
              </label>
              <Select
                size="large"
                showSearch
                filterOption={false}
                onSearch={setMarketSearch}
                value={market}
                onChange={setMarket}
                placeholder="Marketni tanlang"
                className={SELECT_CLS}
                popupClassName={SELECT_POPUP_CLS}
                suffixIcon={<Search className="w-4 h-4" />}
                options={(marketData?.data?.data || []).map((m: any) => ({
                  value: m.id,
                  label: m.name,
                }))}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Summa <span className="text-blue-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={amount}
                  onChange={(e) => setAmount(fmt(parseAmount(e.target.value)))}
                  placeholder="0"
                  className="w-full px-4 py-3 pr-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none transition-all text-lg font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                  UZS
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Karta balansi: {fmt(Number(card?.balance || 0))} UZS
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Izoh
              </label>
              <TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Izoh..."
                autoSize={{ minRows: 2, maxRows: 4 }}
                className="!rounded-xl !border-2 !border-gray-200 dark:!border-gray-700 !bg-gray-50 dark:!bg-[#312D4B] dark:!text-white"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-3 justify-end">
            <button
              onClick={closeModal}
              className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleMarketPay}
              disabled={busy || !market || parseAmount(amount) <= 0}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Yuklanmoqda...</span>
                </>
              ) : (
                <>
                  <Store size={18} />
                  <span>To'lash</span>
                </>
              )}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* ===== Sarflash (chiqim) ===== */}
      <PaymentPopup isShow={modal === "spend"} onClose={closeModal}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[480px] max-md:w-[95%] overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <CircleMinus size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Kartadan sarflash</h2>
                  <p className="text-sm text-white/70">{card?.name} — chiqim</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Summa <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={amount}
                  onChange={(e) => setAmount(fmt(parseAmount(e.target.value)))}
                  placeholder="0"
                  className="w-full px-4 py-3 pr-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] focus:border-red-400 focus:ring-4 focus:ring-red-100 dark:focus:ring-red-900/30 outline-none transition-all text-lg font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                  UZS
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Karta balansi: {fmt(Number(card?.balance || 0))} UZS
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Izoh <span className="text-red-500">*</span>
              </label>
              <TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chiqim sababi (majburiy)"
                autoSize={{ minRows: 2, maxRows: 4 }}
                className="!rounded-xl !border-2 !border-gray-200 dark:!border-gray-700 !bg-gray-50 dark:!bg-[#312D4B] dark:!text-white"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-3 justify-end">
            <button
              onClick={closeModal}
              className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleSpend}
              disabled={busy || parseAmount(amount) <= 0 || !comment.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Yuklanmoqda...</span>
                </>
              ) : (
                <>
                  <CircleMinus size={18} />
                  <span>Chiqim qilish</span>
                </>
              )}
            </button>
          </div>
        </div>
      </PaymentPopup>

      {/* ===== Kartaga qo'shish (kirim) ===== */}
      <PaymentPopup isShow={modal === "fill"} onClose={closeModal}>
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-2xl w-[480px] max-md:w-[95%] overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <CirclePlus size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Kartaga qo'shish</h2>
                  <p className="text-sm text-white/70">{card?.name} — kirim</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Summa <span className="text-emerald-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={amount}
                  onChange={(e) => setAmount(fmt(parseAmount(e.target.value)))}
                  placeholder="0"
                  className="w-full px-4 py-3 pr-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#312D4B] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/30 outline-none transition-all text-lg font-semibold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                  UZS
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Izoh <span className="text-red-500">*</span>
              </label>
              <TextArea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Kirim sababi (majburiy)"
                autoSize={{ minRows: 2, maxRows: 4 }}
                className="!rounded-xl !border-2 !border-gray-200 dark:!border-gray-700 !bg-gray-50 dark:!bg-[#312D4B] dark:!text-white"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-[#312D4B] border-t border-gray-100 dark:border-gray-800 flex gap-3 justify-end">
            <button
              onClick={closeModal}
              className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-all cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleFill}
              disabled={busy || parseAmount(amount) <= 0 || !comment.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {busy ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Yuklanmoqda...</span>
                </>
              ) : (
                <>
                  <CirclePlus size={18} />
                  <span>Qo'shish</span>
                </>
              )}
            </button>
          </div>
        </div>
      </PaymentPopup>
    </div>
  );
};

export default memo(CardDetail);
