import { memo, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { DatePicker, message } from "antd";
import type { Dayjs } from "dayjs";
import {
  ArrowLeft,
  DollarSign,
  Percent,
  HandCoins,
  MinusCircle,
  PieChart,
  Calendar,
  FileText,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useInvestorAdmin } from "../../shared/api/hooks/useInvestorAdmin";
import type { RootState } from "../../app/store";
import { formatMoney } from "../investor/components/format";

type ActionKey = "capital" | "ownership" | "distribution" | "withdrawal";

const ACTIONS: Record<
  ActionKey,
  {
    icon: React.ElementType;
    gradient: string;
    iconBg: string;
    iconColor: string;
    superOnly: boolean;
    kind: "amount" | "ownership";
  }
> = {
  capital: {
    icon: DollarSign,
    gradient: "from-blue-500 to-cyan-600",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    superOnly: true,
    kind: "amount",
  },
  ownership: {
    icon: PieChart,
    gradient: "from-emerald-500 to-green-600",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    superOnly: true,
    kind: "ownership",
  },
  distribution: {
    icon: HandCoins,
    gradient: "from-amber-500 to-orange-600",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    superOnly: false,
    kind: "amount",
  },
  withdrawal: {
    icon: MinusCircle,
    gradient: "from-rose-500 to-pink-600",
    iconBg: "bg-rose-100 dark:bg-rose-900/30",
    iconColor: "text-rose-600 dark:text-rose-400",
    superOnly: true,
    kind: "amount",
  },
};

const InvestorAction = () => {
  const { t } = useTranslation(["investor"]);
  const { id = "", action = "" } = useParams();
  const navigate = useNavigate();
  const role = useSelector((s: RootState) => s.roleSlice.role);
  const isSuper = role === "superadmin";

  const {
    getInvestorSummary,
    recordCapital,
    setOwnership,
    recordDistribution,
    recordWithdrawal,
  } = useInvestorAdmin();
  const { data: sumRes } = getInvestorSummary(id);
  const s = sumRes?.data ?? {};

  const meta = ACTIONS[action as ActionKey];
  const backTo = `/user-profile/${id}`;

  // Noto'g'ri action yoki ruxsat yo'q → orqaga.
  // Eslatma: bu sahifadagi "distribution" — SOF LEDGER yozuvi (kassaga TEGMAYDI):
  // avval yoki kassadan tashqari to'langan summani qayd etish uchun. Kassadan
  // real to'lov alohida sahifada (/cashbox/pay-investor).
  useEffect(() => {
    if (!meta) navigate(backTo, { replace: true });
    else if (meta.superOnly && !isSuper) navigate(backTo, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, isSuper]);

  const [amount, setAmount] = useState("");
  const [ownershipPct, setOwnershipPct] = useState("");
  const [basis, setBasis] = useState<"net" | "gross">("gross");
  const [date, setDate] = useState<Dayjs | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (meta?.kind === "ownership" && s.ownershipPct != null) {
      setOwnershipPct(String(s.ownershipPct));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ownershipPct]);

  if (!meta) return null;

  const titles: Record<ActionKey, string> = {
    capital: t("recordCapital", "Kapital kiritish"),
    ownership: t("setOwnership", "Ulush o'rnatish"),
    distribution: t("recordPastDistribution", "Avval to'langanni qayd etish"),
    withdrawal: t("recordWithdrawal", "Kapital qaytarish"),
  };
  const descriptions: Record<ActionKey, string> = {
    capital: t("capitalDesc", "Investor tikkan kapitalni kiriting"),
    ownership: t("ownershipDesc", "Egalik ulushi va foyda asosini belgilang"),
    distribution: t("distributionLedgerDesc", "Avval yoki kassadan tashqari to'langan foydani yozing — kassaga ta'sir qilmaydi"),
    withdrawal: t("withdrawalHint", "Tikkan asosiy puldan qaytarish (dividend emas)"),
  };
  const Icon = meta.icon;

  const onAmount = (v: string) => setAmount(v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " "));
  const amountNum = Number(amount.replace(/\s/g, "")) || 0;

  const err = (e: any) => {
    message.error(e?.response?.data?.message || t("error", "Xatolik yuz berdi"));
    setLoading(false);
  };
  const done = (key: string) => () => {
    message.success(t(key, "Bajarildi"));
    navigate(backTo);
  };

  const submit = () => {
    const dateMs = date?.valueOf();
    const noteVal = note || undefined;
    if (meta.kind === "ownership") {
      const pct = Number(ownershipPct);
      if (Number.isNaN(pct) || pct < 0 || pct > 100)
        return message.error(t("ownershipRange", "Ulush 0..100 oralig'ida"));
      setLoading(true);
      // Basis bu yerda o'zgarmaydi (joriy saqlanadi) — u faqat investor tasdig'i orqali.
      setOwnership.mutate(
        {
          id,
          body: {
            ownership_bps: Math.round(pct * 100),
            effective_from: dateMs,
            note: noteVal,
            // Asosni FAQAT dastlabki o'rnatishда yuboramiz; mavjud investorда
            // asos o'zgarishi investor tasdig'i orqali (backend himoyalaydi).
            ...(s.hasOpenStake ? {} : { profit_basis: basis }),
          },
        },
        { onSuccess: done("ownershipSet"), onError: err },
      );
      return;
    }
    if (amountNum <= 0) return message.error(t("enterAmount", "Miqdorni kiriting"));
    setLoading(true);
    if (action === "capital")
      recordCapital.mutate({ id, body: { amount: amountNum, contributed_at: dateMs, note: noteVal } }, { onSuccess: done("capitalRecorded"), onError: err });
    else if (action === "distribution")
      recordDistribution.mutate({ id, body: { amount: amountNum, distributed_at: dateMs, note: noteVal } }, { onSuccess: done("distributionRecorded"), onError: err });
    else if (action === "withdrawal")
      recordWithdrawal.mutate({ id, body: { amount: amountNum, withdrawn_at: dateMs, note: noteVal } }, { onSuccess: done("withdrawalRecorded"), onError: err });
  };

  const field =
    "w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all";

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate(backTo)}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
              {titles[action as ActionKey]}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {descriptions[action as ActionKey]}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-5 items-start">
          {/* Forma (chap) */}
          <div className="lg:col-span-3 bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-5 sm:p-6 flex flex-col gap-4">
          {action === "distribution" && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300 leading-snug">
              {t(
                "distributionLedgerWarn",
                "Bu — hisob-kitob yozuvi: investor AVVAL (kassadan tashqari) olgan pulni qayd etadi. Kassa balansiga ta'sir qilmaydi. Kassadan real to'lov uchun \"Taqsimot to'lash (kassadan)\" tugmasidan foydalaning.",
              )}
            </div>
          )}
          {meta.kind === "ownership" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("ownershipPct", "Ulush (%)")} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="number" step="0.01" min={0} max={100} value={ownershipPct}
                    onChange={(e) => setOwnershipPct(e.target.value)} className={field} placeholder="5" />
                </div>
              </div>
              {!s.hasOpenStake ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t("profitBasis", "Foyda asosi")} <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBasis("gross")}
                      className={`h-11 rounded-xl border text-sm font-medium transition-all ${basis === "gross" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}
                    >
                      {t("basisGross", "Yalpi marja")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBasis("net")}
                      className={`h-11 rounded-xl border text-sm font-medium transition-all ${basis === "net" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}
                    >
                      {t("basisNet", "Sof foyda")}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {basis === "gross"
                      ? t("basisGrossHint", "Ulush% × pochta foydasi (xarajat ayrilmaydi)")
                      : t("basisNetHint", "Ulush% × (pochta foydasi − xarajatlar)")}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-[#312D4B] rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("profitBasis", "Foyda asosi")}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                    {(s.profitBasis ?? "net") === "net" ? t("basisNet", "Sof foyda") : t("basisGross", "Yalpi marja")}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {t("basisConsentNote", "Foyda asosini o'zgartirish faqat investor tasdig'i orqali (bu sahifada o'zgarmaydi)")}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("amountUzs", "Miqdor (so'm)")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" inputMode="numeric" value={amount}
                  onChange={(e) => onAmount(e.target.value)} className={field} placeholder="100 000 000" />
              </div>
              {amountNum > 0 && (
                <p className="text-xs text-gray-400 mt-1">{formatMoney(amountNum)}</p>
              )}
            </div>
          )}

          {/* Sana */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("date", "Sana")} <span className="text-gray-400 font-normal">({t("optional", "ixtiyoriy")})</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
              <DatePicker value={date} onChange={setDate} format="DD-MM-YYYY"
                placeholder={t("selectDate", "Sanani tanlang")}
                className="w-full h-11 pl-10! rounded-xl border border-gray-200! dark:border-gray-700! bg-white! dark:bg-[#312D4B]! dark:[&_.ant-picker-input>input]:text-white!" />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {t("startDateHint", "O'tmish sanani kiriting — tizim o'sha kundan hisoblaydi")}
            </p>
          </div>

          {/* Izoh */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("note", "Izoh")}
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                className={field} placeholder={t("note", "Izoh")} />
            </div>
          </div>

          {/* Submit */}
          <button onClick={submit} disabled={loading}
            className={`w-full h-11 rounded-xl bg-gradient-to-r ${meta.gradient} text-white text-sm font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 mt-2`}>
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t("saving", "Saqlanmoqda...")}</>
            ) : (
              <>{t("save", "Saqlash")} <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
          </div>

          {/* Kontekst (o'ng) */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="bg-gradient-to-br from-[#8247ff] to-[#5b21b6] text-white p-4 rounded-2xl shadow-lg">
              <p className="text-xs opacity-90">{t("ownership", "Ulush")}</p>
              <p className="text-3xl font-bold mt-0.5">{s.ownershipPct ?? 0}%</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("capitalInvested", "Sof kapital")}</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{formatMoney(s.capitalInvested)}</p>
              </div>
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("accruedShare", "Hisoblangan foyda")}</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(s.accruedProfitShare)}</p>
              </div>
              <div className="bg-white dark:bg-[#2A263D] rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("profitBasis", "Foyda asosi")}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  {(s.profitBasis ?? "net") === "net" ? t("basisNet", "Sof foyda") : t("basisGross", "Yalpi marja")}
                </p>
              </div>
            </div>
            <div className={`${meta.iconBg} rounded-2xl p-4`}>
              <p className={`text-sm ${meta.iconColor}`}>{descriptions[action as ActionKey]}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(InvestorAction);
