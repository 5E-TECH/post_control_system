import { memo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import {
  ArrowLeft,
  Loader2,
  Wallet,
  CreditCard,
  Percent,
  Plus,
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  Settings,
  Undo2,
  Save,
  TrendingUp,
  Coins,
  PiggyBank,
} from "lucide-react";
import { DatePicker, InputNumber, Input, Modal } from "antd";
import dayjs from "dayjs";
import { buildAdminPath } from "../../../../shared/const";

const fmt = (val: number) => Number(val || 0).toLocaleString("uz-UZ");
const fmtDate = (ts: string | number) => {
  if (!ts) return "—";
  return new Date(Number(ts)).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
};

type FilterType = "all" | "earnings" | "deposits" | "payouts";

const InvestorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.roleSlice.role);
  const {
    getInvestorDetail, recordInvestorDeposit, payInvestor,
    refundInvestorDeposit, updateInvestor, addManualEarning,
  } = useUser();
  const { handleSuccess, handleApiError } = useApiNotification();

  // Default bugungi sana
  const today = dayjs().format("YYYY-MM-DD");
  const [fromDate, setFromDate] = useState<string | undefined>(today);
  const [toDate, setToDate] = useState<string | undefined>(today);
  const [filter, setFilter] = useState<FilterType>("all");

  const { data, isLoading } = getInvestorDetail(id || null, { fromDate, toDate });
  const d = data?.data;

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editSharePercent, setEditSharePercent] = useState<number | null>(null);
  const [editCommitted, setEditCommitted] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // Deposit modal
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [depositNote, setDepositNote] = useState("");
  const [depositDate, setDepositDate] = useState<string>(today);

  // Payout modal
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<number | null>(null);
  const [payoutNote, setPayoutNote] = useState("");

  // Refund modal
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const [refundNote, setRefundNote] = useState("");

  // Manual earning modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAmount, setManualAmount] = useState<number | null>(null);
  const [manualNote, setManualNote] = useState("");

  const openSettings = () => {
    if (!d?.investor) return;
    setEditName(d.investor.name);
    setEditSharePercent(d.investor.share_percent);
    setEditCommitted(d.investor.committed_amount);
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    if (!id) return;
    const payload: any = {};
    if (editName !== d?.investor?.name) payload.name = editName;
    if (editSharePercent !== d?.investor?.share_percent) payload.share_percent = editSharePercent;
    if (editCommitted !== d?.investor?.committed_amount) payload.committed_amount = editCommitted;
    if (Object.keys(payload).length === 0) { setSettingsOpen(false); return; }
    updateInvestor.mutate({ id, data: payload }, {
      onSuccess: () => { handleSuccess("Sozlamalar saqlandi"); setSettingsOpen(false); },
      onError: (err: any) => handleApiError(err, "Saqlashda xatolik"),
    });
  };

  const handleDeposit = () => {
    if (!depositAmount || !id) return;
    recordInvestorDeposit.mutate(
      { id, data: { amount: depositAmount, note: depositNote || undefined, effective_date: depositDate } },
      {
        onSuccess: () => { handleSuccess("Depozit qayd qilindi"); setDepositOpen(false); setDepositAmount(null); setDepositNote(""); setDepositDate(today); },
        onError: (err: any) => handleApiError(err, "Xatolik"),
      },
    );
  };

  const handlePayout = () => {
    if (!payoutAmount || !id) return;
    payInvestor.mutate(
      { id, data: { amount: payoutAmount, note: payoutNote || undefined } },
      {
        onSuccess: () => { handleSuccess("To'lov amalga oshirildi"); setPayoutOpen(false); setPayoutAmount(null); setPayoutNote(""); },
        onError: (err: any) => handleApiError(err, "Xatolik"),
      },
    );
  };

  const handleRefund = () => {
    if (!refundAmount || !id) return;
    refundInvestorDeposit.mutate(
      { id, data: { amount: refundAmount, note: refundNote || undefined } },
      {
        onSuccess: () => { handleSuccess("Investitsiya qaytarildi"); setRefundOpen(false); setRefundAmount(null); setRefundNote(""); },
        onError: (err: any) => handleApiError(err, "Xatolik"),
      },
    );
  };

  const handleManualEarning = () => {
    if (!manualAmount || !id) return;
    addManualEarning.mutate(
      { id, data: { amount: manualAmount, note: manualNote || undefined } },
      {
        onSuccess: () => { handleSuccess("Daromad qo'lda kiritildi"); setManualOpen(false); setManualAmount(null); setManualNote(""); },
        onError: (err: any) => handleApiError(err, "Xatolik"),
      },
    );
  };

  if (isLoading || !d) {
    return <div className="flex items-center justify-center h-60"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;
  }

  const inv = d.investor;
  const committed = inv?.committed_amount || 0;
  const deposited = inv?.deposited_amount || 0;
  const progressPercent = committed > 0 ? Math.min((deposited / committed) * 100, 100) : 100;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(buildAdminPath("investors"))} className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-all cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {inv?.name?.charAt(0)?.toUpperCase() || "I"}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">{inv?.name}</h1>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${committed === 0 ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"}`}>
                {committed === 0 ? "Sherik" : "Investor"}
              </span>
              <span className="text-xs text-gray-400">{inv?.phone_number}</span>
            </div>
          </div>
        </div>
        {(role === "superadmin" || role === "admin") && (
          <button onClick={openSettings} className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all cursor-pointer">
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ===== ASOSIY MA'LUMOTLAR ===== */}
      <div className={`grid gap-3 mb-4 ${(role === "superadmin" || role === "admin") ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
        {/* Balans (hammaga ko'rinadi) */}
        <div className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white shadow-lg ${(d.balance || 0) < 0 ? "bg-gradient-to-br from-red-500 to-rose-600" : "bg-gradient-to-br from-emerald-500 to-teal-600"}`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <Wallet className="w-5 h-5 text-white/60 mb-2" />
          <p className="text-xs text-white/70">Balans {(d.balance || 0) < 0 ? "(qarz)" : ""}</p>
          <p className="text-xl sm:text-2xl font-bold">{fmt(d.balance)} <span className="text-xs font-normal text-white/60">so'm</span></p>
        </div>
        {/* Jami daromad */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 p-4 sm:p-5 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <TrendingUp className="w-5 h-5 text-white/60 mb-2" />
          <p className="text-xs text-white/70">Jami daromad</p>
          <p className="text-xl sm:text-2xl font-bold">{fmt(d.total_earned)} <span className="text-xs font-normal text-white/60">so'm</span></p>
        </div>
        {(role === "superadmin" || role === "admin") && (
          <>
            {/* Jami to'langan */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-4 sm:p-5 text-white shadow-lg">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CreditCard className="w-5 h-5 text-white/60 mb-2" />
              <p className="text-xs text-white/70">Jami to'langan</p>
              <p className="text-xl sm:text-2xl font-bold">{fmt(d.total_paid)} <span className="text-xs font-normal text-white/60">so'm</span></p>
            </div>
            {/* Foiz ulushi */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-4 sm:p-5 text-white shadow-lg">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <Percent className="w-5 h-5 text-white/60 mb-2" />
              <p className="text-xs text-white/70">Foiz ulushi</p>
              <p className="text-xl sm:text-2xl font-bold">{(inv?.effective_percent || 0).toFixed(1)}% <span className="text-xs font-normal text-white/60">/ {inv?.share_percent}%</span></p>
            </div>
          </>
        )}
      </div>

      {/* ===== INVESTITSIYA PROGRESSI (faqat investor uchun) ===== */}
      {committed > 0 && (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Investitsiya: {fmt(deposited)} / {fmt(committed)} so'm</span>
            <span className="text-sm font-bold text-purple-600">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* ===== PIGGY BANK — faqat admin/superadmin ===== */}
      {(role === "superadmin" || role === "admin") && (
        <div className="bg-amber-50 dark:bg-amber-900/15 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/30 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Piggy bank</p>
                <p className="text-[10px] text-gray-400">Kunlik ajratilgan summa — investorga ko'rinmaydi</p>
              </div>
            </div>
            <p className={`text-lg font-bold ${d.cashbox_balance >= 0 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>
              {fmt(d.cashbox_balance)} so'm
            </p>
          </div>
        </div>
      )}

      {/* ===== AMALLAR — faqat admin/superadmin ===== */}
      {(role === "superadmin" || role === "admin") && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          <button onClick={() => setDepositOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium whitespace-nowrap hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Depozit
          </button>
          <button onClick={() => setPayoutOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium whitespace-nowrap hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all cursor-pointer">
            <ArrowDownLeft className="w-3.5 h-3.5" /> Pul berish
          </button>
          {role === "superadmin" && (
            <>
              <button
                onClick={() => setManualOpen(true)}
                disabled={(d.balance || 0) <= 0}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  (d.balance || 0) <= 0
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 cursor-pointer"
                }`}
                title={(d.balance || 0) <= 0 ? "Investor qarzda — ajratish mumkin emas" : "Piggy bankka ajratish"}
              >
                <Coins className="w-3.5 h-3.5" /> {(d.balance || 0) <= 0 ? "Qarzda" : "Daromad kiritish"}
              </button>
              <button onClick={() => setRefundOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium whitespace-nowrap hover:bg-red-200 dark:hover:bg-red-900/50 transition-all cursor-pointer">
                <Undo2 className="w-3.5 h-3.5" /> Pul qaytarish
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== SANA + FILTER ===== */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DatePicker.RangePicker
          value={[fromDate ? dayjs(fromDate) : null, toDate ? dayjs(toDate) : null]}
          onChange={(dates) => {
            setFromDate(dates?.[0]?.format("YYYY-MM-DD") || today);
            setToDate(dates?.[1]?.format("YYYY-MM-DD") || today);
          }}
          size="middle"
        />
        {([
          { key: "all" as FilterType, label: "Barchasi" },
          { key: "earnings" as FilterType, label: "Daromad" },
          { key: "deposits" as FilterType, label: "Depozit" },
          { key: "payouts" as FilterType, label: "To'lov" },
        ]).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${filter === f.key ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200"}`}>
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{fmt(d.period_earned)}</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-blue-600 dark:text-blue-400 font-bold">-{fmt(d.period_paid)}</span>
        </div>
      </div>

      {/* ===== YAGONA RO'YXAT ===== */}
      {(() => {
        // Barcha elementlarni birlashtirish va vaqt bo'yicha saralash
        const items: any[] = [];
        if (filter === "all" || filter === "earnings") {
          (d.earnings || []).forEach((e: any) => items.push({ ...e, _type: "earning" }));
        }
        if (filter === "all" || filter === "deposits") {
          (d.deposits || []).forEach((dep: any) => items.push({ ...dep, _type: "deposit" }));
        }
        if (filter === "all" || filter === "payouts") {
          (d.payouts || []).forEach((p: any) => items.push({ ...p, _type: "payout" }));
        }
        items.sort((a, b) => Number(b.created_at) - Number(a.created_at));

        return (
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {items.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Ma'lumot topilmadi</p>
                </div>
              ) : items.map((item, idx) => {
                if (item._type === "earning") {
                  const cancelled = item.order?.status?.includes("cancel");
                  return (
                    <div key={`e-${item.id || idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cancelled ? "bg-red-100 dark:bg-red-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}`}>
                          {cancelled ? <XCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{item.order?.customer_name || "Buyurtma"}</p>
                          <p className="text-[10px] text-gray-400">Daromad • {fmt(item.profit)} x {item.effective_percent?.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${cancelled ? "text-red-500 line-through" : "text-emerald-600 dark:text-emerald-400"}`}>+{fmt(item.amount)}</p>
                        <p className="text-[10px] text-gray-400">{fmtDate(item.created_at)}</p>
                      </div>
                    </div>
                  );
                }
                if (item._type === "deposit") {
                  const isNeg = Number(item.amount) < 0;
                  return (
                    <div key={`d-${item.id || idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isNeg ? "bg-red-100 dark:bg-red-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}>
                          {isNeg ? <Undo2 className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-purple-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-white">{isNeg ? "Qaytarildi" : "Depozit"}</p>
                          <p className="text-[10px] text-gray-400">
                            {item.note ? `${item.note} • ` : ""}Foiz: {fmtDate(item.effective_date)} dan
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${isNeg ? "text-red-500" : "text-purple-600 dark:text-purple-400"}`}>
                          {Number(item.amount) > 0 ? "+" : ""}{fmt(item.amount)}
                        </p>
                        <p className="text-[10px] text-gray-400">{fmtDate(item.created_at)}</p>
                      </div>
                    </div>
                  );
                }
                // payout
                return (
                  <div key={`p-${item.id || idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-blue-900/30">
                        <CreditCard className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white">To'lov</p>
                        {item.note && <p className="text-[10px] text-gray-400">{item.note}</p>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-blue-600 dark:text-blue-400">-{fmt(item.amount)}</p>
                      <p className="text-[10px] text-gray-400">{fmtDate(item.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ===== SETTINGS MODAL ===== */}
      <Modal open={settingsOpen} onCancel={() => setSettingsOpen(false)} footer={null} title={<div className="flex items-center gap-2"><Settings className="w-5 h-5 text-purple-500" /> Investor sozlamalari</div>}>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Ism</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} size="large" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Foiz ulushi (%)</label>
            <InputNumber value={editSharePercent} onChange={(v) => setEditSharePercent(v)} min={0.01} max={100} step={0.5} className="!w-full" size="large" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Investitsiya majburiyati (so'm)</label>
            <InputNumber value={editCommitted} onChange={(v) => setEditCommitted(v)} min={0} className="!w-full" size="large"
              formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ""} parser={(v) => Number(v!.replace(/\s/g, ""))} />
            <p className="text-xs text-gray-400 mt-1">0 = sherik (pul tikmasdan)</p>
          </div>
          <button onClick={handleSaveSettings} disabled={updateInvestor.isPending}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium shadow-lg transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {updateInvestor.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Saqlash
          </button>
        </div>
      </Modal>

      {/* ===== DEPOSIT MODAL ===== */}
      <Modal open={depositOpen} onCancel={() => setDepositOpen(false)} footer={null} title="Depozit qayd qilish">
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Summa</label>
            <InputNumber value={depositAmount} onChange={setDepositAmount} min={1} className="!w-full" size="large"
              formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ""} parser={(v) => Number(v!.replace(/\s/g, ""))} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Foiz boshlanish sanasi</label>
            <DatePicker value={dayjs(depositDate)} onChange={(v) => setDepositDate(v ? v.format("YYYY-MM-DD") : today)} className="!w-full" size="large" />
            <p className="text-xs text-gray-400 mt-1">Bu sanadan boshlab foizga qo'shiladi</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Izoh</label>
            <Input value={depositNote} onChange={(e) => setDepositNote(e.target.value)} placeholder="Ixtiyoriy" size="large" />
          </div>
          <button onClick={handleDeposit} disabled={!depositAmount || recordInvestorDeposit.isPending}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium shadow-lg transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {recordInvestorDeposit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Qayd qilish
          </button>
        </div>
      </Modal>

      {/* ===== PAYOUT MODAL ===== */}
      <Modal open={payoutOpen} onCancel={() => setPayoutOpen(false)} footer={null} title="Daromaddan pul berish">
        <div className="space-y-4 mt-4">
          <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-gray-600 dark:text-gray-400">
            Investor kassasi: <span className="font-bold text-emerald-600">{fmt(d.cashbox_balance)} so'm</span>
            {d.cashbox_balance < (payoutAmount || 0) && (
              <span className="block text-xs text-amber-600 mt-1">Yetmagan qism asosiy kassadan yechiladi</span>
            )}
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Summa</label>
            <InputNumber value={payoutAmount} onChange={setPayoutAmount} min={1} className="!w-full" size="large"
              formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ""} parser={(v) => Number(v!.replace(/\s/g, ""))} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Izoh</label>
            <Input value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} placeholder="Ixtiyoriy" size="large" />
          </div>
          <button onClick={handlePayout} disabled={!payoutAmount || payInvestor.isPending}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-medium shadow-lg transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {payInvestor.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />} To'lash
          </button>
        </div>
      </Modal>

      {/* ===== REFUND MODAL ===== */}
      <Modal open={refundOpen} onCancel={() => setRefundOpen(false)} footer={null} title="Investitsiya qaytarish">
        <div className="space-y-4 mt-4">
          <p className="text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-xl text-red-600">
            Kiritilgan mablag': <span className="font-bold">{fmt(deposited)} so'm</span>
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Qaytarish summasi</label>
            <InputNumber value={refundAmount} onChange={setRefundAmount} min={1} max={deposited} className="!w-full" size="large"
              formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ""} parser={(v) => Number(v!.replace(/\s/g, ""))} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Sabab</label>
            <Input value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="Ixtiyoriy" size="large" />
          </div>
          <button onClick={handleRefund} disabled={!refundAmount || refundInvestorDeposit.isPending}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium shadow-lg transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {refundInvestorDeposit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Qaytarish
          </button>
        </div>
      </Modal>

      {/* ===== MANUAL EARNING MODAL ===== */}
      <Modal open={manualOpen} onCancel={() => setManualOpen(false)} footer={null} title="Qo'lda daromad kiritish">
        <div className="space-y-4 mt-4">
          <p className="text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl text-amber-700 dark:text-amber-400">
            Eski daromadlarni qo'lda kiritish uchun. Bu summa investor kassasiga qo'shiladi.
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Summa</label>
            <InputNumber value={manualAmount} onChange={setManualAmount} min={1} className="!w-full" size="large"
              formatter={(v) => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ""} parser={(v) => Number(v!.replace(/\s/g, ""))} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Izoh</label>
            <Input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Masalan: 2026-yanvar daromadi" size="large" />
          </div>
          <button onClick={handleManualEarning} disabled={!manualAmount || addManualEarning.isPending}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium shadow-lg transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {addManualEarning.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />} Kiritish
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default memo(InvestorDetail);
